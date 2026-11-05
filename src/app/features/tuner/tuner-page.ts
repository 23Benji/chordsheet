import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GUITAR_STRINGS, IN_TUNE_CENTS, PitchSmoother, detectPitch, nearestString, noteFromFrequency } from '../../core/pitch';
import { noteName } from '../../core/transpose';
import { IT } from '../../i18n/it';
import { Icon } from '../../ui/icon';

/** Samples analysed at a time: ≥ 2 periods of a low D (73 Hz) at 48 kHz. */
const WINDOW = 4096;
/** Analyse ~16 times a second: smooth enough for the needle, light on the battery. */
const EVERY_MS = 60;

type State = 'idle' | 'listening' | 'denied' | 'unsupported';

/**
 * "Accordatore": listens through the microphone and shows the note, how
 * many cents it is off (needle), and the nearest open guitar string. The
 * sound is analysed on the device only (core/pitch.ts) — nothing is recorded
 * or sent anywhere.
 */
@Component({
  selector: 'app-tuner-page',
  imports: [Icon],
  templateUrl: './tuner-page.html',
  styleUrl: './tuner-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TunerPage {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  protected readonly t = IT.tuner;

  protected readonly state = signal<State>('idle');
  /** Smoothed frequency of the note being played; null = silence. */
  protected readonly frequency = signal<number | null>(null);

  protected readonly reading = computed(() => {
    const f = this.frequency();
    return f === null ? null : noteFromFrequency(f);
  });
  protected readonly string = computed(() => {
    const f = this.frequency();
    return f === null ? null : nearestString(f);
  });
  protected readonly inTune = computed(() => {
    const r = this.reading();
    return r !== null && Math.abs(r.cents) <= IN_TUNE_CENTS;
  });
  /** −50…+50 cents → needle angle (±60°). */
  protected readonly angle = computed(() => (this.reading()?.cents ?? 0) * 1.2);
  protected readonly strings = GUITAR_STRINGS.map((s) => ({ ...s, name: noteName(s.midi, false) }));

  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly smoother = new PitchSmoother();
  /** Last time any sound was heard: the note stays on screen for a moment after it fades. */
  private lastHeard = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Must run inside the tap: iOS only lets a page use the microphone and audio after a user gesture. */
  protected async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.state.set('unsupported');
      return;
    }
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    try {
      // The phone's "voice" processing (echo cancelling, noise suppression,
      // automatic volume) changes the sound: off, so the pitch stays true.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      void ctx.close();
      this.state.set('denied');
      return;
    }
    await ctx.resume();
    this.ctx = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = WINDOW;
    ctx.createMediaStreamSource(this.stream).connect(analyser);
    const buffer = new Float32Array(WINDOW);
    this.state.set('listening');
    this.timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      const pitch = detectPitch(buffer, ctx.sampleRate);
      const now = performance.now();
      if (pitch && pitch.clarity > 0.85) this.frequency.set(this.smoother.push(pitch.frequency, now));
      else if (now - this.lastHeard > 1500) this.frequency.set(null);
      if (pitch) this.lastHeard = now;
    }, EVERY_MS);
  }

  private stop(): void {
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  protected back(): void {
    if ((history.state as { canGoBack?: boolean } | null)?.canGoBack) this.location.back();
    else void this.router.navigate(['/']);
  }

  protected centsLabel(cents: number): string {
    const n = Math.round(cents);
    return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
  }
}

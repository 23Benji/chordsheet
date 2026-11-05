import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IN_TUNE_CENTS,
  NoteReading,
  PitchSmoother,
  TUNINGS,
  TunerInstrument,
  detectPitch,
  foldOctave,
  midiToHz,
  nearestString,
  noteFromFrequency,
  stringRange,
} from '../../core/pitch';
import { noteName } from '../../core/transpose';
import { IT } from '../../i18n/it';
import { SettingsService } from '../../services/settings.service';
import { Icon } from '../../ui/icon';
import { Haptic } from '../../ui/haptic';

/** Analyse ~16 times a second: smooth enough for the needle, light on the battery. */
const EVERY_MS = 60;
/** Below this clarity (0…1) a sound is not a note: a string that rings is ~0.9+. */
const MIN_CLARITY = 0.8;

type State = 'idle' | 'listening' | 'paused' | 'denied' | 'unsupported';

/**
 * "Accordatore": listens through the microphone and shows the note, how
 * many cents it is off (needle), and the nearest open string (guitar or
 * bass). Tapping a string tunes only that one. The sound is analysed on
 * the device only (core/pitch.ts) — nothing is recorded or sent anywhere.
 */
@Component({
  selector: 'app-tuner-page',
  imports: [Icon, Haptic],
  templateUrl: './tuner-page.html',
  styleUrl: './tuner-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TunerPage {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly settingsService = inject(SettingsService);
  protected readonly t = IT.tuner;
  protected readonly instruments: TunerInstrument[] = ['guitar', 'bass'];

  protected readonly state = signal<State>('idle');
  /** Smoothed frequency of the note being played; null = silence. */
  protected readonly frequency = signal<number | null>(null);
  /** MIDI note of the string chosen by tapping it; null = any string (automatic). */
  protected readonly picked = signal<number | null>(null);

  protected readonly instrument = computed<TunerInstrument>(() => {
    const s = this.settingsService.settings();
    return s.tunerInstrument ?? (s.instrument === 'bass' ? 'bass' : 'guitar');
  });
  protected readonly strings = computed(() =>
    TUNINGS[this.instrument()].strings.map((s) => ({ ...s, name: noteName(s.midi, false) })),
  );
  protected readonly pickedString = computed(() => this.strings().find((s) => s.midi === this.picked()) ?? null);

  /** The note and cents shown: against the chosen string when there is one, else the nearest note. */
  protected readonly reading = computed<NoteReading | null>(() => {
    const f = this.frequency();
    if (f === null) return null;
    const pick = this.picked();
    if (pick === null) return noteFromFrequency(f);
    return { name: noteName(pick, false), octave: Math.floor(pick / 12) - 1, midi: pick, cents: 1200 * Math.log2(f / midiToHz(pick)) };
  });
  protected readonly string = computed(() => {
    const f = this.frequency();
    return f === null ? null : nearestString(f, this.strings());
  });
  /** The string lit up: the chosen one, or the nearest while a note sounds. */
  protected readonly litMidi = computed(() => this.picked() ?? this.string()?.midi ?? null);
  protected readonly inTune = computed(() => {
    const r = this.reading();
    return r !== null && Math.abs(r.cents) <= IN_TUNE_CENTS;
  });
  /** −50…+50 cents → needle angle (±60°); further off, it rests at the end. */
  protected readonly angle = computed(() => Math.max(-50, Math.min(50, this.reading()?.cents ?? 0)) * 1.2);

  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private starting = false;
  private readonly smoother = new PitchSmoother();
  /** Last time any sound was heard: the note stays on screen for a moment after it fades. */
  private lastHeard = 0;

  constructor() {
    // iOS takes the microphone away (and freezes the audio) when you leave
    // the app; the old stream never comes back. So: pause on leaving, and
    // a tap on "Riprendi" opens a fresh one (iOS wants a tap for audio).
    const onVisibility = () => {
      if (document.hidden) this.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      this.stop();
    });
  }

  /** Must run inside the tap: iOS only lets a page use the microphone and audio after a user gesture. */
  protected async start(): Promise<void> {
    if (this.starting) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.state.set('unsupported');
      return;
    }
    this.starting = true;
    this.stop();
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    let stream: MediaStream;
    try {
      // The phone's "voice" processing (echo cancelling, noise suppression,
      // automatic volume) changes the sound: off, so the pitch stays true.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      void ctx.close();
      this.starting = false;
      this.state.set('denied');
      return;
    }
    await ctx.resume().catch(() => undefined);
    this.starting = false;
    // Left the app while the permission prompt was open: don't start behind its back.
    if (document.hidden) {
      stream.getTracks().forEach((track) => track.stop());
      void ctx.close();
      this.state.set('paused');
      return;
    }
    this.stream = stream;
    this.ctx = ctx;
    // Also pause when the system ends the microphone or suspends the audio
    // (a phone call, Siri, another app taking the mic) while we stay on screen.
    stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => this.pause()));
    ctx.onstatechange = () => {
      if (this.ctx === ctx && ctx.state !== 'running') this.pause();
    };

    const analyser = ctx.createAnalyser();
    ctx.createMediaStreamSource(stream).connect(analyser);
    let buffer = new Float32Array(0);
    this.smoother.reset();
    this.state.set('listening');
    this.timer = setInterval(() => {
      const tuning = TUNINGS[this.instrument()];
      // Bass needs a longer window than guitar; follows the switch at once.
      if (buffer.length !== tuning.window) {
        analyser.fftSize = tuning.window;
        buffer = new Float32Array(tuning.window);
      }
      analyser.getFloatTimeDomainData(buffer);
      const pick = this.picked();
      // A chosen string: listen only around it, so it can't be read an octave off.
      const range = pick === null ? { minFrequency: tuning.minFrequency } : stringRange(pick);
      const pitch = detectPitch(buffer, ctx.sampleRate, range);
      const now = performance.now();
      if (pitch && pitch.clarity > MIN_CLARITY) {
        const f = pick === null ? foldOctave(pitch.frequency, tuning.strings) : pitch.frequency;
        this.frequency.set(this.smoother.push(f, now));
        this.lastHeard = now;
      } else if (now - this.lastHeard > 1500) this.frequency.set(null);
    }, EVERY_MS);
  }

  private pause(): void {
    if (this.state() !== 'listening') return;
    this.stop();
    this.state.set('paused');
  }

  private stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) {
      ctx.onstatechange = null;
      void ctx.close().catch(() => undefined);
    }
    this.frequency.set(null);
    this.smoother.reset();
  }

  protected setInstrument(instrument: TunerInstrument): void {
    this.picked.set(null);
    this.frequency.set(null);
    this.smoother.reset();
    void this.settingsService.update({ tunerInstrument: instrument });
  }

  /** Tap a string to tune only that one; tap it again for automatic. */
  protected pick(midi: number): void {
    this.picked.update((current) => (current === midi ? null : midi));
    this.frequency.set(null);
    this.smoother.reset();
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

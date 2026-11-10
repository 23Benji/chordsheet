import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { BPM_MAX, BPM_MIN, METERS, Meter, beatAccent, tempoMarking, BPM_DEFAULT, beatInterval, beatsUntil, clampBpm, tapTempo } from '../core/metronome';
import { IT } from '../i18n/it';
import { Icon } from './icon';
import { Popover } from './popover';

/** How far ahead (s) beats are scheduled on the audio clock, and how often we check. */
const LOOKAHEAD = 0.12;

export interface TempoChange {
  songId: string;
  bpm: number;
  meter: Meter;
}
const TIMER_MS = 25;

/**
 * Metronome: beat dots for the bar + optional click (accented first beat).
 * Tempo by −/+, slider, typing or Tap; time signature 2/4 · 3/4 · 4/4 · 6/8.
 * Timing: Timing uses the Web Audio clock
 * with look-ahead scheduling: every 25 ms we schedule the clicks of the next
 * ~120 ms at exact audio times, so a busy page never makes the beat wobble.
 */
@Component({
  selector: 'app-metronome',
  imports: [Icon, Popover],
  templateUrl: './metronome.html',
  styleUrl: './metronome.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Metronome {
  protected readonly t = IT.metronome;

  /** The song: a new one stops the metronome and starts from its tempo. */
  readonly songId = input<string>();
  /** {tempo} of the song, the starting BPM (none yet: the chip says just "BPM"). */
  readonly tempo = input<number | undefined>();
  /** Beats per bar from the song's {time}. */
  readonly songMeter = input<Meter | null>(null);
  /**
   * Called when the player changed tempo or beat, 600 ms after the last
   * change (dragging the slider saves once); the song view saves it in the
   * song. A function input rather than an output() because a pending change
   * is also sent while the metronome is being destroyed (leaving the song),
   * when an output can no longer emit.
   */
  readonly save = input<(change: TempoChange) => void>();

  protected readonly running = signal(false);
  protected readonly bpm = signal(BPM_DEFAULT);
  protected readonly sound = signal(true);
  /** Beats per bar (time signature). */
  protected readonly meter = signal<Meter>(4);
  protected readonly meters = METERS;
  protected readonly bpmMin = BPM_MIN;
  protected readonly bpmMax = BPM_MAX;
  /** One dot per beat of the bar. */
  protected readonly slots = computed(() => Array.from({ length: this.meter() }, (_, i) => ({ i, accent: beatAccent(i, this.meter()) })));
  /** Largo, Andante, Allegro … */
  protected readonly marking = computed(() => tempoMarking(this.bpm(), IT.metronome.markings));
  /** How far along the slider is (0–100), for the filled part of its track. */
  protected readonly fill = computed(() => ((this.bpm() - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100);
  /** Beat in the bar (0 = accent) that is flashing, or null. */
  protected readonly flash = signal<number | null>(null);
  /** Beat of the bar we're on (stays lit until the next one), or null when stopped. */
  protected readonly current = signal<number | null>(null);
  /** "Salvato per questo canto" shows for a moment after a change. */
  protected readonly saved = signal(false);
  /** The chip shows a number only once the song has a tempo (or while playing). */
  protected readonly showBpm = computed(() => this.tempo() != null || this.running());

  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private savedTimer: ReturnType<typeof setTimeout> | undefined;
  private lastSong: string | undefined;
  /** The song the pending change belongs to. */
  private pendingSong: string | undefined;

  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private frame = 0;
  private nextTime = 0;
  private beatCount = 0;
  private queue: { time: number; beat: number }[] = [];
  private taps: number[] = [];

  constructor() {
    // Start from the song's {tempo} and {time}. A new song also stops the
    // click; our own save coming back (same song) leaves it playing.
    effect(() => {
      const songId = this.songId();
      const tempo = this.tempo();
      const meter = this.songMeter();
      untracked(() => {
        if (songId !== this.lastSong) {
          this.lastSong = songId;
          this.stop();
          this.flushSave();
        } else if (this.saveTimer !== undefined) {
          return; // the player is still changing it: their value wins
        }
        this.bpm.set(tempo ? clampBpm(tempo) : BPM_DEFAULT);
        this.meter.set(meter ?? 4);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      this.flushSave();
      clearTimeout(this.savedTimer);
    });
  }

  protected setBpm(value: number): void {
    if (!Number.isFinite(value)) return;
    this.bpm.set(clampBpm(value));
    this.scheduleSave();
  }

  protected setMeter(meter: Meter): void {
    this.meter.set(meter);
    this.beatCount = 0; // restart the bar on its first beat
    this.scheduleSave();
  }

  protected tap(): void {
    const result = tapTempo(this.taps, performance.now());
    this.taps = result.taps;
    if (result.bpm) {
      this.bpm.set(result.bpm);
      this.scheduleSave();
    }
  }

  private scheduleSave(): void {
    this.pendingSong = this.songId();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), 600);
  }

  /** Sends a pending change now (leaving the song must not lose it). */
  private flushSave(): void {
    if (this.saveTimer === undefined) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    if (this.pendingSong) this.save()?.({ songId: this.pendingSong, bpm: this.bpm(), meter: this.meter() });
    this.saved.set(true);
    clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => this.saved.set(false), 2000);
  }

  protected toggle(): void {
    if (this.running()) this.stop();
    else this.start();
  }

  private start(): void {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.nextTime = this.ctx.currentTime + 0.05;
    this.beatCount = 0;
    this.queue = [];
    this.running.set(true);
    this.timer = setInterval(() => this.schedule(), TIMER_MS);
    this.schedule();
    this.frame = requestAnimationFrame(() => this.draw());
  }

  private stop(): void {
    clearInterval(this.timer);
    cancelAnimationFrame(this.frame);
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.running.set(false);
    this.flash.set(null);
    this.current.set(null);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const time of beatsUntil(this.nextTime, ctx.currentTime + LOOKAHEAD, this.bpm())) {
      const beat = this.beatCount % this.meter();
      if (this.sound()) this.click(ctx, time, beatAccent(beat, this.meter()));
      this.queue.push({ time, beat });
      this.beatCount++;
      this.nextTime = time + beatInterval(this.bpm());
    }
  }

  /** A short click: higher and louder on the first beat of the bar. */
  private click(ctx: AudioContext, time: number, accent: 'strong' | 'medium' | 'weak'): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent === 'strong' ? 1600 : accent === 'medium' ? 1300 : 1000;
    gain.gain.setValueAtTime(accent === 'weak' ? 0.3 : 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  /** Visual pulse in sync with the audio clock. */
  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.queue.length && this.queue[0].time <= ctx.currentTime) {
      const { beat } = this.queue.shift()!;
      this.flash.set(beat);
      this.current.set(beat);
      setTimeout(() => this.flash.set(null), 90);
    }
    this.frame = requestAnimationFrame(() => this.draw());
  }
}

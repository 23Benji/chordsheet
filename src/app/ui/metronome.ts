import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { BPM_DEFAULT, beatInterval, beatsUntil, clampBpm, tapTempo } from '../core/metronome';
import { IT } from '../i18n/it';
import { Icon } from './icon';
import { Popover } from './popover';

/** How far ahead (s) beats are scheduled on the audio clock, and how often we check. */
const LOOKAHEAD = 0.12;
const TIMER_MS = 25;
const BEATS_PER_BAR = 4;

/**
 * Metronome: amber pulse + optional click. Timing uses the Web Audio clock
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

  /** {tempo} of the song, the starting BPM. */
  readonly tempo = input<number | undefined>();

  protected readonly running = signal(false);
  protected readonly bpm = signal(BPM_DEFAULT);
  protected readonly sound = signal(true);
  /** Beat in the bar (0 = accent) that is flashing, or null. */
  protected readonly flash = signal<number | null>(null);

  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private frame = 0;
  private nextTime = 0;
  private beatCount = 0;
  private queue: { time: number; beat: number }[] = [];
  private taps: number[] = [];

  constructor() {
    // A new song: start from its {tempo}.
    effect(() => {
      const tempo = this.tempo();
      untracked(() => {
        this.stop();
        this.bpm.set(tempo ? clampBpm(tempo) : BPM_DEFAULT);
      });
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected setBpm(value: number): void {
    if (Number.isFinite(value)) this.bpm.set(clampBpm(value));
  }

  protected tap(): void {
    const result = tapTempo(this.taps, performance.now());
    this.taps = result.taps;
    if (result.bpm) this.bpm.set(result.bpm);
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
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const time of beatsUntil(this.nextTime, ctx.currentTime + LOOKAHEAD, this.bpm())) {
      const beat = this.beatCount % BEATS_PER_BAR;
      if (this.sound()) this.click(ctx, time, beat === 0);
      this.queue.push({ time, beat });
      this.beatCount++;
      this.nextTime = time + beatInterval(this.bpm());
    }
  }

  /** A short beep: higher on the first beat of the bar. */
  private click(ctx: AudioContext, time: number, accent: boolean): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    gain.gain.setValueAtTime(accent ? 0.5 : 0.3, time);
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
      setTimeout(() => this.flash.set(null), 90);
    }
    this.frame = requestAnimationFrame(() => this.draw());
  }
}

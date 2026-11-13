import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUITAR_TUNING } from '../../core/chord-finder';
import { IN_TUNE_CENTS, detectPitch, nearestString } from '../../core/pitch';
import { IT } from '../../i18n/it';
import { Icon } from '../../ui/icon';
import { strum } from '../../ui/strum';

type TunerState = 'idle' | 'starting' | 'listening' | 'denied' | 'unavailable';

/** Low E → high e, with the octave for the big letter (E2 … E4). */
const STRINGS = [
  { name: 'E', octave: 2 },
  { name: 'A', octave: 2 },
  { name: 'D', octave: 3 },
  { name: 'G', octave: 3 },
  { name: 'B', octave: 3 },
  { name: 'e', octave: 4 },
];
/** How often the pitch is measured (ms): fast enough for the needle, light on the battery. */
const MEASURE_MS = 50;
/** A sound counts as a note only this clearly periodic (talking and noise are lower). */
const MIN_CLARITY = 0.88;
/** After the string stops ringing the last reading stays this long, dimmed after. */
const HOLD_MS = 1500;
/** In tune this long = the string gets its green dot. */
const TUNED_MS = 600;
/** The scale: pixels per cent, and where its ticks are. */
export const PX_PER_CENT = 2.2;

/**
 * "Accordatore" (look "B2 Striscia", Benji 2026-11-13): play any string, the
 * app finds which one and the scale slides under a fixed line; the words say
 * which way to turn the peg, and everything turns green when it's right.
 *
 * The microphone is read with the Web Audio API: an AnalyserNode hands over
 * the last ~0.1 s of sound, `detectPitch` (core/pitch.ts) finds its
 * frequency. Nothing is recorded or sent anywhere; the microphone is switched
 * off when leaving the page or the app.
 */
@Component({
  selector: 'app-tuner-page',
  imports: [RouterLink, Icon],
  templateUrl: './tuner-page.html',
  styleUrl: './tuner-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TunerPage {
  protected readonly t = IT.tuner;
  protected readonly back = IT.chordFinder.back;
  protected readonly strings = STRINGS.map((s, i) => ({ ...s, index: i }));

  protected readonly state = signal<TunerState>('idle');
  /** The string being heard (or last heard), and how far off it is. */
  protected readonly current = signal<number | null>(null);
  protected readonly cents = signal(0);
  /** No string ringing right now: the last reading stays, dimmed. */
  protected readonly stale = signal(true);
  protected readonly tuned = signal<ReadonlySet<number>>(new Set());

  protected readonly inTune = computed(() => this.current() !== null && !this.stale() && Math.abs(this.cents()) <= IN_TUNE_CENTS);
  protected readonly rounded = computed(() => Math.round(this.cents()));
  /** The scale moves the other way than the note: too low → the scale slides right, so the 0 is left of the line. */
  protected readonly shift = computed(() => -Math.max(-100, Math.min(100, this.cents())) * PX_PER_CENT);
  protected readonly ticks = Array.from({ length: 41 }, (_, i) => {
    const cents = -100 + i * 5;
    return { cents, x: cents * PX_PER_CENT, major: cents % 25 === 0, label: cents % 25 === 0 ? (cents > 0 ? `+${cents}` : `${cents}`) : '' };
  });

  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private frame = 0;
  private lastMeasure = 0;
  private lastHeard = 0;
  /** A different string must be heard twice in a row before the display switches (no flicker). */
  private candidate: number | null = null;
  private inTuneSince = 0;
  private buffer: Float32Array<ArrayBuffer> | null = null;

  constructor() {
    const onHidden = () => {
      if (document.hidden) this.stop();
    };
    document.addEventListener('visibilitychange', onHidden);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', onHidden);
      this.stop();
    });
  }

  /** From the tap on "Inizia": iOS only lets a page start sound and the microphone in answer to the user. */
  protected async start(): Promise<void> {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !Ctor) {
      this.state.set('unavailable');
      return;
    }
    this.state.set('starting');
    try {
      this.ctx = new Ctor();
      void this.ctx.resume().catch(() => undefined);
      // The phone's voice processing would "clean up" a guitar note: turned off.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (this.state() !== 'starting') return this.stop(); // left the page meanwhile
      const source = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 4096;
      source.connect(this.analyser);
      this.buffer = new Float32Array(this.analyser.fftSize);
      this.state.set('listening');
      this.frame = requestAnimationFrame((now) => this.tick(now));
    } catch (error) {
      this.stop();
      const name = (error as DOMException | undefined)?.name;
      this.state.set(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }

  protected stop(): void {
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.ctx?.close().catch(() => undefined);
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    if (this.state() === 'listening' || this.state() === 'starting') this.state.set('idle');
    this.stale.set(true);
  }

  /** A string circle: its reference note, like a tuning fork. */
  protected playString(index: number): void {
    strum([GUITAR_TUNING[index]]);
  }

  private tick(now: number): void {
    this.frame = requestAnimationFrame((next) => this.tick(next));
    if (!this.analyser || !this.ctx || !this.buffer || now - this.lastMeasure < MEASURE_MS) return;
    this.lastMeasure = now;
    this.analyser.getFloatTimeDomainData(this.buffer);
    // Every other sample is plenty for guitar notes and halves the work.
    const half = new Float32Array(this.buffer.length / 2);
    for (let i = 0; i < half.length; i++) half[i] = (this.buffer[2 * i] + this.buffer[2 * i + 1]) / 2;
    const pitch = detectPitch(half, this.ctx.sampleRate / 2);

    if (!pitch || pitch.clarity < MIN_CLARITY) {
      if (now - this.lastHeard > HOLD_MS) this.stale.set(true);
      this.inTuneSince = 0;
      return;
    }
    const reading = nearestString(pitch.frequency);
    if (reading.string !== this.current()) {
      if (this.candidate !== reading.string) {
        this.candidate = reading.string;
        return;
      }
      this.current.set(reading.string);
      this.cents.set(reading.cents);
      this.inTuneSince = 0;
    } else {
      // Smoothed, so the scale glides instead of shaking.
      this.cents.set(this.stale() ? reading.cents : this.cents() * 0.6 + reading.cents * 0.4);
    }
    this.candidate = null;
    this.lastHeard = now;
    this.stale.set(false);

    if (Math.abs(this.cents()) <= IN_TUNE_CENTS) {
      this.inTuneSince ||= now;
      if (now - this.inTuneSince >= TUNED_MS && !this.tuned().has(reading.string)) {
        this.tuned.update((set) => new Set(set).add(reading.string));
      }
    } else this.inTuneSince = 0;
  }
}

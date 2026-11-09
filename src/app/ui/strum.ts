// A guitar strum with the Web Audio API, no sound files: each string is
// synthesised with the Karplus–Strong algorithm (a burst of noise fed through
// a short delay line that averages neighbouring samples — it rings at the
// delay's pitch and fades like a plucked string).

const SECONDS = 2.4;
/** Pause between strings: a gentle downstroke. */
const STRUM_GAP = 0.035;
/** How much each trip round the delay line loses: lower = shorter ring. */
const DAMPING = 0.996;

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;
const buffers = new Map<number, AudioBuffer>();

function pluck(context: AudioContext, midi: number): AudioBuffer {
  const cached = buffers.get(midi);
  if (cached) return cached;
  const rate = context.sampleRate;
  const length = Math.floor(rate * SECONDS);
  const buffer = context.createBuffer(1, length, rate);
  const out = buffer.getChannelData(0);
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const period = Math.max(2, Math.round(rate / frequency));
  const ring = new Float32Array(period);
  // Softened noise (a pick, not a hammer): each sample half the previous one.
  let last = 0;
  for (let i = 0; i < period; i++) ring[i] = last = (Math.random() * 2 - 1 + last) / 2;
  let i = 0;
  for (let n = 0; n < length; n++) {
    const next = (i + 1) % period;
    out[n] = ring[i];
    ring[i] = DAMPING * 0.5 * (ring[i] + ring[next]);
    i = next;
  }
  buffers.set(midi, buffer);
  return buffer;
}

/**
 * Plays the notes low to high like a downstroke. Must be called from a tap:
 * Safari only lets a page make sound in response to the user.
 */
export function strum(midiNotes: readonly number[]): void {
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor || !midiNotes.length) return;
  ctx ??= new Ctor();
  void ctx.resume().catch(() => undefined);
  const start = ctx.currentTime + 0.02;
  const volume = 0.5 / Math.sqrt(midiNotes.length);
  midiNotes.forEach((midi, n) => {
    const source = ctx!.createBufferSource();
    source.buffer = pluck(ctx!, midi);
    const gain = ctx!.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(ctx!.destination);
    source.start(start + n * STRUM_GAP);
  });
}

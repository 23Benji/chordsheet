import {
  BASS_STRINGS,
  GUITAR_STRINGS,
  PitchSmoother,
  TUNINGS,
  detectPitch,
  foldOctave,
  nearestString,
  noteFromFrequency,
  stringRange,
} from './pitch';

const RATE = 48000;
const SIZE = 4096;
const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const cents = (measured: number, expected: number) => 1200 * Math.log2(measured / expected);

/** A steady tone with the given overtone amplitudes (1st = fundamental). */
function tone(freq: number, harmonics: number[], length = SIZE, noise = 0, seed = 1): Float32Array {
  let s = seed;
  const random = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let v = 0;
    harmonics.forEach((a, h) => (v += a * Math.sin((2 * Math.PI * freq * (h + 1) * i) / RATE + h)));
    out[i] = 0.3 * v + noise * random();
  }
  return out;
}

/**
 * A plucked string (Karplus-Strong): a burst of noise looping through a
 * delay line with a gentle low-pass, like a real string losing its overtones.
 * Each new sample averages the values from N and N − 1 samples ago, a delay
 * of N − 0.5 samples: the pitch is RATE / (N − 0.5).
 */
function pluck(freq: number, seed = 7): { sound: Float32Array; pitch: number } {
  const n = Math.round(RATE / freq + 0.5);
  let s = seed;
  const line = Float32Array.from({ length: n }, () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1);
  const total = Math.round(RATE * 0.4);
  const out = new Float32Array(total);
  for (let i = 0, p = 0; i < total; i++, p = (p + 1) % n) {
    out[i] = 0.5 * line[p];
    line[p] = 0.996 * 0.5 * (line[p] + line[(p + 1) % n]);
  }
  // Analyse after the noisy attack, like the tuner does while the note rings.
  return { sound: out.slice(RATE * 0.1, RATE * 0.1 + SIZE), pitch: RATE / (n - 0.5) };
}

describe('pitch detection (YIN)', () => {
  it('finds each open guitar string within 1 cent (pure tones)', () => {
    for (const { midi } of GUITAR_STRINGS) {
      const hz = midiHz(midi);
      const pitch = detectPitch(tone(hz, [1]), RATE)!;
      expect(Math.abs(cents(pitch.frequency, hz)), `midi ${midi}`).toBeLessThan(1);
    }
  });

  it('is not fooled by strong overtones (weak fundamental, like a low E string)', () => {
    for (const { midi } of GUITAR_STRINGS) {
      const hz = midiHz(midi);
      const pitch = detectPitch(tone(hz, [0.3, 1, 0.8, 0.5, 0.3, 0.2]), RATE)!;
      expect(Math.abs(cents(pitch.frequency, hz)), `midi ${midi}`).toBeLessThan(1);
    }
  });

  it('plucked strings (Karplus-Strong) within 1 cent', () => {
    for (const { midi } of GUITAR_STRINGS) {
      const { sound, pitch } = pluck(midiHz(midi));
      const found = detectPitch(sound, RATE)!;
      expect(found, `midi ${midi}`).not.toBeNull();
      expect(Math.abs(cents(found.frequency, pitch)), `midi ${midi}`).toBeLessThan(1);
    }
  });

  it('copes with background noise, and a slightly detuned string', () => {
    const hz = midiHz(45) * 2 ** (12 / 1200); // A2, 12 cents sharp
    const found = detectPitch(tone(hz, [0.6, 1, 0.5], SIZE, 0.05), RATE)!;
    expect(Math.abs(cents(found.frequency, hz))).toBeLessThan(2);
    expect(Math.round(noteFromFrequency(found.frequency).cents)).toBeGreaterThanOrEqual(10);
  });

  it('silence and pure noise give no note', () => {
    expect(detectPitch(new Float32Array(SIZE), RATE)).toBeNull();
    expect(detectPitch(tone(110, [1]).map((v) => v * 0.001), RATE)).toBeNull(); // too quiet
    expect(detectPitch(tone(1, [0], SIZE, 0.5), RATE)).toBeNull();
  });
});

/**
 * A real string as a phone hears it: the fundamental almost gone, overtones
 * slightly sharp (string stiffness, "inharmonicity" B), each fading at its
 * own speed, a little noise, and quiet (no automatic volume).
 */
function realString(freq: number, length: number, amp = 0.01, B = 0.0002, at = 0.2): Float32Array {
  const amps = [0.15, 1, 0.8, 0.6, 0.5, 0.35, 0.25, 0.2, 0.15, 0.1];
  let s = 3;
  const random = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = at + i / RATE;
    let v = 0;
    amps.forEach((a, k) => {
      const n = k + 1;
      v += a * Math.exp(-t * (0.8 + 0.6 * n)) * Math.sin(2 * Math.PI * n * freq * Math.sqrt(1 + B * n * n) * t + n);
    });
    out[i] = amp * v + amp * 0.05 * random();
  }
  return out;
}

describe('real strings through a phone microphone', () => {
  it('a quiet low E with a weak fundamental is still found (used to be dropped as silence)', () => {
    const found = detectPitch(realString(midiHz(40), SIZE), RATE)!;
    expect(found).not.toBeNull();
    expect(Math.abs(cents(found.frequency, midiHz(40)))).toBeLessThan(5);
  });

  it('every guitar string, quiet and inharmonic, within 5 cents', () => {
    for (const { midi } of GUITAR_STRINGS) {
      const found = detectPitch(realString(midiHz(midi), SIZE), RATE, TUNINGS.guitar)!;
      expect(found, `midi ${midi}`).not.toBeNull();
      expect(Math.abs(cents(found.frequency, midiHz(midi))), `midi ${midi}`).toBeLessThan(5);
    }
  });

  it('every bass string (E1 = 41 Hz) with the bass window', () => {
    const { window, minFrequency } = TUNINGS.bass;
    for (const { midi } of BASS_STRINGS) {
      const found = detectPitch(realString(midiHz(midi), window), RATE, { minFrequency })!;
      expect(found, `midi ${midi}`).not.toBeNull();
      expect(Math.abs(cents(found.frequency, midiHz(midi))), `midi ${midi}`).toBeLessThan(5);
    }
  });

  it('tuning one chosen string never reads it an octave up, even with no fundamental at all', () => {
    const sound = tone(midiHz(40), [0, 1, 0.1, 0.4], SIZE); // E2 heard as almost only E3
    const found = detectPitch(sound, RATE, stringRange(40))!;
    expect(Math.abs(cents(found.frequency, midiHz(40)))).toBeLessThan(2);
  });
});

describe('notes and strings', () => {
  it('names the note and the cents', () => {
    expect(noteFromFrequency(440)).toEqual({ name: 'A', octave: 4, midi: 69, cents: 0 });
    expect(noteFromFrequency(82.41)).toMatchObject({ name: 'E', octave: 2, midi: 40 });
    const sharp = noteFromFrequency(440 * 2 ** (20 / 1200));
    expect(sharp.name).toBe('A');
    expect(sharp.cents).toBeCloseTo(20, 5);
    expect(noteFromFrequency(466.16).name).toBe('A#');
    expect(noteFromFrequency(442, 442).cents).toBeCloseTo(0, 5); // A = 442 Hz
  });

  it('finds the nearest open string', () => {
    expect(nearestString(82.41)).toMatchObject({ string: 6 });
    expect(nearestString(246.94)).toMatchObject({ string: 2 });
    expect(nearestString(100)?.string).toBe(5); // a flat A string
    expect(nearestString(1000)).toBeNull();
    expect(nearestString(41.2, BASS_STRINGS)).toMatchObject({ string: 4 });
    expect(nearestString(98, BASS_STRINGS)).toMatchObject({ string: 1 });
  });

  it('octave fix: a low string heard an octave up goes back down; real strings stay', () => {
    expect(foldOctave(midiHz(52))).toBeCloseTo(midiHz(40)); // E3 → low E
    expect(foldOctave(midiHz(57))).toBeCloseTo(midiHz(45)); // A3 → A
    expect(foldOctave(midiHz(52) * 2 ** (-60 / 1200))).toBeCloseTo(midiHz(40) * 2 ** (-60 / 1200)); // a flat low E too
    for (const { midi } of GUITAR_STRINGS) expect(foldOctave(midiHz(midi)), `midi ${midi}`).toBeCloseTo(midiHz(midi));
    expect(foldOctave(midiHz(64) * 2 ** (-150 / 1200))).toBeCloseTo(midiHz(64) * 2 ** (-150 / 1200)); // a very flat high E is not "D"
    expect(foldOctave(midiHz(40), BASS_STRINGS)).toBeCloseTo(midiHz(28)); // bass: E2 → E1
    for (const { midi } of BASS_STRINGS) expect(foldOctave(midiHz(midi), BASS_STRINGS)).toBeCloseTo(midiHz(midi));
  });

  it('smoother: median of recent readings, starts over on a new note or a pause', () => {
    const s = new PitchSmoother(5, 600);
    expect(s.push(110, 0)).toBe(110);
    s.push(111, 50);
    s.push(150, 100); // jump to another note: starts over
    expect(s.push(150.2, 150)).toBeCloseTo(150.2);
    expect(s.push(110, 2000)).toBe(110); // after a pause
  });
});

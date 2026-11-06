// The opening animation ("Corde", picked by Benji on 2026-11-06): two strings
// shoot in from the sides across the whole screen, vibrate and shrink into the
// two lines of the logo; faint lines of songs drift behind; the two chords fly
// in from the sides and "pluck" the strings. Then the glow and the name come
// up, and everything fades away into the app.
//
// Pure maths, no DOM: `introFrame(geometry, t)` says where everything is at
// time t (ms). The Intro component only copies these numbers onto SVG
// elements, once per animation frame.

/** The whole animation: the fade-out starts at EXIT_AT and lasts EXIT_MS. */
export const INTRO_EXIT_AT = 2300;
export const INTRO_EXIT_MS = 450;
export const INTRO_TOTAL = INTRO_EXIT_AT + INTRO_EXIT_MS;
/** A tap fades out faster than the normal ending. */
export const INTRO_SKIP_MS = 250;

export interface IntroLine {
  y: number;
  /** Left and right end (centre of the round caps). */
  a: number;
  b: number;
}

/** A faint line (or chord) of a song passing behind: its height, width, kind, direction and start. */
export interface IntroExtra {
  y: number;
  width: number;
  chord: boolean;
  side: 1 | -1;
  delay: number;
}

export interface IntroGeometry {
  width: number;
  height: number;
  /** Logo width; its height is 240/312 of it (the icon's symbol box). */
  size: number;
  /** Thickness of the lines, size of the chords. */
  stroke: number;
  chordWidth: number;
  chordHeight: number;
  /** Centre of the logo (for the glow) and top of the name under it. */
  centerX: number;
  centerY: number;
  nameTop: number;
  lines: [IntroLine, IntroLine];
  chords: [{ x: number; y: number }, { x: number; y: number }];
  extras: IntroExtra[];
}

export interface IntroFrame {
  /** SVG path of each string and its opacity. */
  lines: { d: string; opacity: number }[];
  /** Top-left corner of each chord and its opacity. */
  chords: { x: number; y: number; opacity: number }[];
  extras: { x: number; opacity: number }[];
  /** 0 → 1: the glow behind the logo, the name. */
  glow: number;
  name: number;
  /** 0 → 1: the fade-out of everything. */
  exit: number;
}

const clamp = (t: number) => Math.min(1, Math.max(0, t));
const outCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const outQuint = (t: number) => 1 - Math.pow(1 - clamp(t), 5);
/** Ease out with a small overshoot (k = how far past the target it goes). */
const outBack = (t: number, k: number) => {
  const u = clamp(t) - 1;
  return 1 + (k + 1) * u * u * u + k * u * u;
};

/** Where the logo sits on a screen of this size (same proportions as the icon). */
export function introGeometry(width: number, height: number): IntroGeometry {
  const size = Math.round(Math.min(260, Math.max(150, Math.min(width * 0.56, height * 0.28))));
  const h = (size * 240) / 312;
  // The logo + the name under it, together a little above the middle.
  const nameGap = size * 0.16;
  const nameSize = size * 0.18;
  const top = height * 0.45 - (h + nameGap + nameSize) / 2;
  const left = (width - size) / 2;
  const stroke = 0.0729 * h;
  const x0 = left + 0.0473 * size;
  const line = (y: number, length: number): IntroLine => ({ y: top + y * h, a: x0 + stroke / 2, b: x0 + length * size - stroke / 2 });
  const k = size / 220; // the extras were designed for a 220 px logo
  const l1 = top + 0.38125 * h;
  const l2 = top + 0.90205 * h;
  const extra = (y: number, w: number, chord: boolean, side: 1 | -1, delay: number): IntroExtra => ({ y, width: w * k, chord, side, delay });
  return {
    width,
    height,
    size,
    stroke,
    chordWidth: 0.1763 * size,
    chordHeight: 0.1146 * h,
    centerX: width / 2,
    centerY: top + h / 2,
    nameTop: top + h + nameGap,
    lines: [line(0.38125, 0.9054), line(0.90205, 0.7372)],
    chords: [
      { x: left + 0.0753 * size, y: top + 0.1 * h },
      { x: left + 0.6442 * size, y: top + 0.6208 * h },
    ],
    extras: [
      extra(top - 120 * k, 150, false, 1, 0),
      extra(top - 78 * k, 40, true, -1, 80),
      extra(top - 60 * k, 190, false, -1, 40),
      extra(top - 20 * k, 34, true, 1, 180),
      extra(top + 30 * k, 120, false, -1, 140),
      extra(l1 + 32 * k, 46, true, -1, 220),
      extra(top + 120 * k, 170, false, 1, 60),
      extra(l2 + 40 * k, 38, true, 1, 120),
      extra(l2 + 80 * k, 200, false, -1, 0),
      extra(l2 + 118 * k, 44, true, -1, 240),
      extra(l2 + 150 * k, 140, false, 1, 100),
      extra(l2 + 196 * k, 180, false, -1, 180),
    ],
  };
}

interface Pluck {
  x: number;
  at: number;
}

/**
 * A string from a to b at height y, vibrating: a standing wave that dies down
 * (plus its second harmonic), and a smaller bump under a chord that lands on it.
 */
export function stringPath(a: number, b: number, y: number, amp: number, t: number, phase: number, pluck: Pluck): string {
  const steps = 36;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = a + (b - a) * u;
    const env = Math.sin(Math.PI * u);
    let off =
      amp * env * Math.cos((2 * Math.PI * 7 * t) / 1000 + phase) +
      amp * 0.3 * Math.sin(2 * Math.PI * u) * Math.cos((2 * Math.PI * 12 * t) / 1000);
    const pt = t - pluck.at;
    if (pt > 0) {
      off += 6 * Math.exp(-pt / 280) * env * Math.exp(-Math.pow((x - pluck.x) / 70, 2)) * Math.cos((2 * Math.PI * 9 * pt) / 1000);
    }
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${(y + off).toFixed(1)}`;
  }
  return d;
}

/** Everything at time t (ms). `skipAt`: when the user tapped (the fade-out starts then). */
export function introFrame(g: IntroGeometry, t: number, skipAt: number | null = null): IntroFrame {
  const { width } = g;
  const extras = g.extras.map((e) => {
    const k = (t - e.delay) / 1700;
    const x = width / 2 - e.width / 2 + e.side * (width + 30 - (width + 30) * 2 * 0.75 * outCubic(k));
    const visible = k > 0 && k < 1 ? Math.sin(Math.PI * k) * (e.chord ? 0.35 : 0.16) : 0;
    return { x, opacity: visible };
  });

  const lines = g.lines.map((line, i) => {
    const side = i === 0 ? -1 : 1; // the top string comes from the left, the bottom one from the right
    const delay = i * 120;
    const pluck = { x: g.chords[i].x + g.chordWidth / 2, at: 900 + i * 80 };
    const shoot = outQuint((t - delay) / 380);
    const shrink = outCubic((t - delay - 300) / 750);
    const fullA = -30;
    const fullB = width + 30;
    let a = side < 0 ? fullA : fullB - (fullB - fullA) * shoot;
    let b = side < 0 ? fullA + (fullB - fullA) * shoot : fullB;
    a += (line.a - a) * shrink;
    b += (line.b - b) * shrink;
    const amp = 20 * Math.exp(-Math.max(0, t - delay - 200) / 360) * clamp((t - delay - 120) / 150);
    return { d: stringPath(a, b, line.y, amp, t, i * 1.4, pluck), opacity: t > delay ? 1 : 0 };
  });

  const chords = g.chords.map((c, i) => {
    const side = i === 0 ? 1 : -1; // from the side opposite to their string
    const k = (t - 560 - i * 80) / 480;
    return { x: c.x + side * (width / 2 + 200) * (1 - outBack(k, 1.5)), y: c.y, opacity: clamp(k * 4) };
  });

  const normalExit = clamp((t - INTRO_EXIT_AT) / INTRO_EXIT_MS);
  const skipExit = skipAt === null ? 0 : clamp((t - skipAt) / INTRO_SKIP_MS);
  return {
    lines,
    chords,
    extras,
    glow: outCubic((t - 1000) / 700),
    name: outCubic((t - 1100) / 600),
    exit: Math.max(normalExit, skipExit),
  };
}

/** The animation is over (also after a tap). */
export const introFinished = (t: number, skipAt: number | null) =>
  t >= INTRO_TOTAL || (skipAt !== null && t >= skipAt + INTRO_SKIP_MS);

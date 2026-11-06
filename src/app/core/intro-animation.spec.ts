import { INTRO_EXIT_AT, INTRO_SKIP_MS, INTRO_TOTAL, introFinished, introFrame, introGeometry, stringPath } from './intro-animation';

/** The y values of an SVG path made of M/L points. */
const ys = (d: string) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]));
const xs = (d: string) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[1]));

describe('intro animation', () => {
  const phone = introGeometry(390, 844);

  it('is short: under 3 seconds', () => {
    expect(INTRO_TOTAL).toBeLessThan(3000);
  });

  it('logo geometry follows the icon: 220 px on an iPhone, centred, the second line shorter', () => {
    expect(phone.size).toBe(218);
    const [l1, l2] = phone.lines;
    expect((l1.a + l1.b) / 2).toBeCloseTo(phone.centerX, 0); // the long line is centred, the short one starts at the same place
    expect(l2.a).toBe(l1.a);
    expect(l2.b - l2.a).toBeLessThan(l1.b - l1.a);
    expect(l2.y).toBeGreaterThan(l1.y);
    expect(phone.nameTop).toBeGreaterThan(l2.y);
    // Bigger screens get a bigger logo, but never huge.
    expect(introGeometry(1280, 800).size).toBe(224);
    expect(introGeometry(2560, 1600).size).toBe(260);
  });

  it('starts empty: strings off screen or invisible, chords invisible, no glow or name', () => {
    const f = introFrame(phone, 0);
    expect(f.lines[1].opacity).toBe(0);
    expect(f.chords.every((c) => c.opacity === 0)).toBe(true);
    expect(f.extras.every((e) => e.opacity === 0)).toBe(true);
    expect(f.glow).toBe(0);
    expect(f.name).toBe(0);
    expect(f.exit).toBe(0);
  });

  it('at first the strings cross the whole screen and vibrate', () => {
    const f = introFrame(phone, 330);
    const x = xs(f.lines[0].d);
    expect(Math.min(...x)).toBeLessThan(0);
    expect(Math.max(...x)).toBeGreaterThan(300);
    const y = ys(f.lines[0].d);
    expect(Math.max(...y) - Math.min(...y)).toBeGreaterThan(5);
  });

  it('ends exactly on the logo: straight lines in place, chords on their spots, glow and name up', () => {
    const f = introFrame(phone, INTRO_EXIT_AT);
    phone.lines.forEach((line, i) => {
      const x = xs(f.lines[i].d);
      expect(x[0]).toBeCloseTo(line.a, 0);
      expect(x[x.length - 1]).toBeCloseTo(line.b, 0);
      for (const y of ys(f.lines[i].d)) expect(Math.abs(y - line.y)).toBeLessThan(0.5);
    });
    phone.chords.forEach((c, i) => {
      expect(f.chords[i].x).toBeCloseTo(c.x, 1);
      expect(f.chords[i].opacity).toBe(1);
    });
    expect(f.extras.every((e) => e.opacity === 0)).toBe(true);
    expect(f.glow).toBeCloseTo(1, 3);
    expect(f.name).toBeCloseTo(1, 3);
    expect(f.exit).toBe(0);
  });

  it('fades out at the end, or quickly after a tap', () => {
    expect(introFrame(phone, INTRO_TOTAL).exit).toBe(1);
    expect(introFinished(INTRO_TOTAL - 1, null)).toBe(false);
    expect(introFinished(INTRO_TOTAL, null)).toBe(true);
    const tapped = introFrame(phone, 500 + INTRO_SKIP_MS / 2, 500);
    expect(tapped.exit).toBeCloseTo(0.5, 5);
    expect(introFinished(500 + INTRO_SKIP_MS, 500)).toBe(true);
  });

  it('a still string is a straight line', () => {
    for (const y of ys(stringPath(10, 200, 50, 0, 1234, 0, { x: 100, at: 99999 }))) expect(y).toBe(50);
  });
});

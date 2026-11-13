import { describe, expect, it } from 'vitest';
import { TabItem, addBar, addNote, addTechnique, sanitizeItems, setCell, tabRows, tabText } from './tab-writer';

/** Builds a solo from taps: [string, fret] pairs, 'h' / '|' marks. */
function solo(...steps: (readonly [number, number] | 'h' | 'p' | '/' | 'b' | '|')[]): TabItem[] {
  let items: TabItem[] = [];
  for (const step of steps) {
    if (step === '|') items = addBar(items);
    else if (typeof step === 'string') items = addTechnique(items, step);
    else items = addNote(items, step[0], step[1]);
  }
  return items;
}

describe('tabText', () => {
  it('writes six lines, high e on top, a dash after each note', () => {
    expect(tabText(solo([3, 2], [4, 1], [5, 0]))).toBe(
      ['e|-----0-|', 'B|---1---|', 'G|-2-----|', 'D|-------|', 'A|-------|', 'E|-------|'].join('\n'),
    );
  });

  it('puts techniques between notes without dashes ("5h7")', () => {
    const text = tabText(solo([5, 5], 'h', [5, 7], 'p', [5, 5], '/', [5, 9]));
    expect(text.split('\n')[0]).toBe('e|-5h7p5/9-|');
    expect(text.split('\n')[1]).toBe('B|---------|');
  });

  it('keeps columns aligned with two-digit frets', () => {
    const lines = tabText(solo([5, 10], [4, 3])).split('\n');
    expect(lines[0]).toBe('e|-10---|');
    expect(lines[1]).toBe('B|----3-|');
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  });

  it('writes bar lines', () => {
    expect(tabText(solo([5, 0], '|', [5, 2])).split('\n')[0]).toBe('e|-0-|-2-|');
  });

  it('a bar at the end closes the row once', () => {
    const lines = tabText(solo([5, 0], '|', [5, 2], '|')).split('\n');
    expect(lines[0]).toBe('e|-0-|-2-|');
    expect(lines[5]).toBe('E|---|---|');
  });

  it('notes played together share a column', () => {
    let items = addNote([], 4, 3);
    items = addNote(items, 5, 3, true);
    const lines = tabText(items).split('\n');
    expect(lines[0]).toBe('e|-3-|');
    expect(lines[1]).toBe('B|-3-|');
  });

  it('is empty without notes', () => {
    expect(tabText([])).toBe('');
    expect(tabText(addBar([]))).toBe('');
  });

  it('wraps a long solo after a bar line, rows separated by an empty line', () => {
    const steps: ([number, number] | '|')[] = [];
    for (let bar = 0; bar < 6; bar++) {
      for (let n = 0; n < 4; n++) steps.push([5, 10 + n]);
      steps.push('|');
    }
    const items = solo(...steps);
    const rows = tabRows(items, 30);
    expect(rows.length).toBeGreaterThan(1);
    const text = tabText(items, 30);
    const blocks = text.split('\n\n');
    expect(blocks.length).toBe(rows.length);
    for (const block of blocks) expect(block.split('\n')).toHaveLength(6);
    // Never breaks in the middle of a bar: every row but the last ends on a bar's last note.
    expect(blocks[0].split('\n')[0].endsWith('-|')).toBe(true);
  });
});

describe('editing', () => {
  it('"together" toggles a fret in the last column', () => {
    let items = addNote([], 4, 3);
    items = addNote(items, 4, 3, true);
    expect(items).toEqual([]);
  });

  it('a technique needs a note just before it', () => {
    expect(addTechnique([], 'h')).toEqual([]);
    const items = solo([5, 5], '|');
    expect(addTechnique(items, 'h')).toEqual(items);
  });

  it('a technique goes on the highest string of the last column', () => {
    let items = addNote([], 2, 2);
    items = addNote(items, 4, 3, true);
    expect(addTechnique(items, 'b').at(-1)).toEqual({ kind: 'tech', mark: 'b', string: 4 });
  });

  it('no bar at the start or twice', () => {
    expect(addBar([])).toEqual([]);
    expect(addBar(solo([5, 0], '|'))).toHaveLength(2);
  });

  it('setCell writes, starts a new column, clears', () => {
    let items = setCell([], 0, 5, 3);
    expect(tabText(items).split('\n')[0]).toBe('e|-3-|');
    items = setCell(items, 1, 4, 5);
    expect(items).toHaveLength(2);
    items = setCell(items, 0, 5, 7);
    expect(tabText(items).split('\n')[0]).toBe('e|-7---|');
    items = setCell(items, 0, 5, null);
    expect(items).toHaveLength(1);
    expect(setCell(items, 5, 0, null)).toEqual(items);
  });

  it('clearing a note removes a dangling technique before it', () => {
    let items = solo([5, 5], 'h', [5, 7]);
    items = setCell(items, 2, 5, null);
    expect(items).toEqual(solo([5, 5]));
  });
});

describe('sanitizeItems', () => {
  it('keeps good items and drops broken ones', () => {
    const good = solo([5, 5], 'h', [5, 7], '|');
    expect(sanitizeItems(JSON.parse(JSON.stringify(good)))).toEqual(good);
    expect(sanitizeItems('nope')).toEqual([]);
    expect(sanitizeItems([{ kind: 'note', frets: [1, 2] }, { kind: 'tech', mark: 'x', string: 1 }, null])).toEqual([]);
  });
});

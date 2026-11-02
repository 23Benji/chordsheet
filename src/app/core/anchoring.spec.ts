import { parseChordPro } from './chordpro';
import { Annotation } from './models';
import { anchorFor, reanchorAll, resolveAll, resolveAnchor, similarity } from './anchoring';

const SONG = `[C]QUANDO GUARDO LA TUA SANTI[F]TÀ
QUANDO A[C]MMIRO LA TUA BON[Am]TÀ

{start_of_chorus}
[G]IO LODO [F]TE SI[G]GNOR
LA MIA [F]VITA È PER LODARE [C]TE
{end_of_chorus}

HO CER[C]CATO LA VIA AL TUO C[F]UORE

{start_of_chorus}
[G]IO LODO [F]TE SI[G]GNOR
LA MIA [F]VITA È PER LODARE [C]TE
{end_of_chorus}`;

const note = (sheet: ReturnType<typeof parseChordPro>, lineIndex: number): Annotation => ({
  id: `n${lineIndex}`,
  songId: 's',
  anchor: anchorFor(sheet, lineIndex),
  type: 'note',
  text: 'nota',
  createdAt: 0,
  updatedAt: 0,
});

describe('anchoring', () => {
  const sheet = parseChordPro(SONG);

  it('builds anchors with hash, snippet and occurrence (repeated chorus lines)', () => {
    const first = anchorFor(sheet, 2); // "IO LODO TE SIGNOR" in the 1st chorus
    const second = anchorFor(sheet, 5); // the same line in the 2nd chorus
    expect(first.textHash).toBe(second.textHash);
    expect([first.occurrence, second.occurrence]).toEqual([0, 1]);
    expect(first.snippet).toBe('io lodo te signor');
  });

  it('finds the same line again when nothing changed', () => {
    for (const i of [0, 2, 5]) expect(resolveAnchor(anchorFor(sheet, i), sheet)).toBe(i);
  });

  it('follows a line that moved (a line was added above)', () => {
    const edited = parseChordPro('NUOVA RIGA\n' + SONG);
    expect(resolveAnchor(anchorFor(sheet, 5), edited)).toBe(6);
  });

  it('falls back to the nearest same-text line when an occurrence disappeared', () => {
    const shorter = parseChordPro(SONG.split('HO CER')[0]); // only the first chorus remains
    expect(resolveAnchor(anchorFor(sheet, 5), shorter)).toBe(2);
  });

  it('finds an edited line by fuzzy match (≥ 80% similar)', () => {
    const edited = parseChordPro(SONG.replace('HO CER[C]CATO LA VIA AL TUO C[F]UORE', 'HO CERCATO LA VIA DEL TUO CUORE'));
    expect(resolveAnchor(anchorFor(sheet, 4), edited)).toBe(4);
    expect(similarity('ho cercato la via al tuo cuore', 'ho cercato la via del tuo cuore')).toBeGreaterThan(0.8);
  });

  it('gives up (orphan) when the line is gone', () => {
    const edited = parseChordPro(SONG.replace('HO CER[C]CATO LA VIA AL TUO C[F]UORE', 'TUTT’ALTRA COSA'));
    expect(resolveAnchor(anchorFor(sheet, 4), edited)).toBeNull();
  });

  it('re-anchors: updates moved notes, orphans missing ones, never deletes', () => {
    const notes = [note(sheet, 0), note(sheet, 4)];
    const edited = parseChordPro('INTRO NUOVA\n' + SONG.replace('HO CER[C]CATO LA VIA AL TUO C[F]UORE', 'ALTRO'));
    const result = reanchorAll(notes, edited, 9);
    expect(result.length).toBe(2);
    expect(result[0]).toMatchObject({ orphaned: false, anchor: { lineIndex: 1 }, updatedAt: 9 });
    expect(result[1]).toMatchObject({ orphaned: true, anchor: notes[1].anchor });
    // An orphan is found again if the line comes back.
    expect(reanchorAll(result, sheet)[1]).toMatchObject({ orphaned: false, anchor: { lineIndex: 4 } });
  });

  it('groups annotations by line, orphans apart', () => {
    const orphan = { ...note(sheet, 1), id: 'o', orphaned: true };
    const resolved = resolveAll([note(sheet, 2), orphan], sheet);
    expect([...resolved.byLine.keys()]).toEqual([2]);
    expect(resolved.orphans.map((a) => a.id)).toEqual(['o']);
  });
});

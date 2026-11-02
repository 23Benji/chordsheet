import { anchorFor } from './anchoring';
import { parseChordPro } from './chordpro';
import { chordproWithNotes, ExportLabels } from './export-notes';
import { Annotation } from './models';

const labels: ExportLabels = {
  note: 'Nota',
  personalChord: (p, o) => `Accordo personale: ${p} al posto di ${o}`,
  memo: 'Promemoria',
  intro: 'Intro',
  part: 'Parte',
  chords: 'Accordi',
  rhythm: 'Ritmo',
  unlinked: 'Note da ricollegare',
};

const SOURCE = `{title: Io lodo Te}
{meta: numero 1}

[C]QUANDO GUARDO LA TUA SANTI[F]TÀ
QUANDO A[C]MMIRO LA TUA BON[Am]TÀ    (Am Em)

{start_of_chorus}
Rit:
[G]IO LODO [F]TE SI[G]GNOR
{end_of_chorus}`;

describe('chordproWithNotes', () => {
  it('writes notes after their lines, memo and intro after the header', () => {
    const sheet = parseChordPro(SOURCE);
    const base = { songId: 's', createdAt: 0, updatedAt: 0 };
    const annotations: Annotation[] = [
      { ...base, id: '1', type: 'note', text: 'piano', anchor: anchorFor(sheet, 1) },
      { ...base, id: '2', type: 'chord', text: 'Fmaj7', chordIndex: 1, anchor: anchorFor(sheet, 2) },
      { ...base, id: '3', type: 'tab', title: 'Assolo', text: 'e|--0--|\nB|--1--|', anchor: anchorFor(sheet, 2) },
      { ...base, id: '4', type: 'highlight', text: '', color: 'sky', anchor: anchorFor(sheet, 0) },
      { ...base, id: '5', type: 'note', text: 'persa', anchor: anchorFor(sheet, 0), orphaned: true },
    ];
    const out = chordproWithNotes(SOURCE, annotations, { memo: 'Attacco piano', intro: { part: 'Ritornello', rhythm: '↓↑' } }, labels);
    expect(out).toBe(`{title: Io lodo Te}
{meta: numero 1}
{comment: Promemoria: Attacco piano}
{comment: Intro — Parte: Ritornello · Ritmo: ↓↑}

[C]QUANDO GUARDO LA TUA SANTI[F]TÀ
QUANDO A[C]MMIRO LA TUA BON[Am]TÀ    (Am Em)
{comment: Nota: piano}

{start_of_chorus}
Rit:
[G]IO LODO [F]TE SI[G]GNOR
{comment: Accordo personale: Fmaj7 al posto di F}
{start_of_tab: Assolo}
e|--0--|
B|--1--|
{end_of_tab}
{end_of_chorus}

{comment: Note da ricollegare}
{comment: Nota: persa}
`);
  });

  it('leaves the text unchanged without notes', () => {
    expect(chordproWithNotes(SOURCE, [], {}, labels)).toBe(SOURCE + '\n');
  });
});

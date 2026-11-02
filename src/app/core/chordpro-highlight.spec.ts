import { highlightChordPro } from './chordpro-highlight';

describe('highlightChordPro', () => {
  it('marks chords and directives', () => {
    expect(highlightChordPro('{title: X}\n[G]Dio [D]è\n')).toEqual([
      [{ text: '{title: X}', cls: 'directive' }],
      [
        { text: '[G]', cls: 'chord' },
        { text: 'Dio ', cls: 'text' },
        { text: '[D]', cls: 'chord' },
        { text: 'è', cls: 'text' },
      ],
      [],
    ]);
  });
});

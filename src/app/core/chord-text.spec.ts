import { chordLinePositions, parseChordLine, tokenizeChordText } from './chord-text';

const chords = (text: string) =>
  parseChordLine(text)?.map((i) => ('chord' in i ? i.chord : `"${i.text}"`)) ?? null;

describe('chord text (old notation)', () => {
  it('reads plain-text chord lines', () => {
    expect(chords('B- G D A — B- G D A — D')).toEqual(['Bm', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A', 'D']);
    expect(chords('G D C ..Am')).toEqual(['G', 'D', 'C', 'Am']);
    expect(chords('B-, G, D, A')).toEqual(['Bm', 'G', 'D', 'A']);
  });

  it('splits glued chords and "-" separators', () => {
    expect(chords('C AmDm G F C')).toEqual(['C', 'Am', 'Dm', 'G', 'F', 'C']);
    expect(chords('D GD')).toEqual(['D', 'G', 'D']);
    expect(chords('F#- D A-E')).toEqual(['F#m', 'D', 'A', 'E']);
    expect(chords('G7 C F#,F#7,B(E)')).toEqual(['G7', 'C', 'F#', 'F#7', 'B', 'E']);
  });

  it('normalises minor dashes, solfège and slash basses', () => {
    expect(chords('E-7 C#-7 E7-')).toEqual(['Em7', 'C#m7', 'Em7']);
    expect(chords('Mi- Do+ Sol+ Re+')).toEqual(['Em', 'C', 'G', 'D']);
    expect(chords('E- D /F# G C')).toEqual(['Em', 'D', 'F#', 'G', 'C']);
    expect(chords('D4 Dsus4 Cadd9 G/B')).toEqual(['D4', 'Dsus4', 'Cadd9', 'G/B']);
  });

  it('keeps repeat marks as text', () => {
    expect(chords('D ||')).toEqual(['D']);
    expect(chords('/x2 C, F, C, G7 — C')).toEqual(['"x2"', 'C', 'F', 'C', 'G7', 'C']);
  });

  it('never takes lyrics for chords', () => {
    expect(chords('E LA SUA BENIGNITÀ DURA IN ETERNO.')).toBeNull();
    expect(chords('E CON LUI SAREM FELICI')).toBeNull();
    expect(chords('Geremia 33:3')).toBeNull();
    expect(chords('A TE')).toBeNull();
    expect(chords('E')).toBeNull();
    expect(chords('Rit:')).toBeNull();
  });

  it('can mix words and chords (e.g. after a heading)', () => {
    expect(tokenizeChordText('ERICA: Bm,G,D,A', true)).toEqual([
      { text: 'ERICA:' },
      { chord: 'Bm' },
      { chord: 'G' },
      { chord: 'D' },
      { chord: 'A' },
    ]);
  });

  it('reports chord columns', () => {
    expect(chordLinePositions('G     D  C ..Am')).toEqual([
      { chord: 'G', at: 0 },
      { chord: 'D', at: 6 },
      { chord: 'C', at: 9 },
      { chord: 'Am', at: 13 },
    ]);
    expect(chordLinePositions('Dio è grande')).toBeNull();
  });
});

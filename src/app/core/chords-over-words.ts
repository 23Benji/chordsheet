// Pasted songs often come as "chords above the lyrics":
//
//   G        D       Em
//   Dio è grande, Dio è forte
//
// Each chord line is merged into the lyric line below it, chord by chord at
// the same column. Our own implementation (instead of chordsheetjs'
// ChordsOverWordsParser) so it shares the chord recognition — including the
// old notation "B- G D" — with the rest of the app.
import { chordLinePositions } from './chord-text';
import { lyricsToChordPro } from './editor-model';

const DIRECTIVE = /^\s*\{.*\}\s*$/;
/** "[Verse 1]", "[Chorus]" headers from websites would turn into chords in ChordPro. */
const BRACKET_HEADER = /^\s*\[([^\]]+)\]\s*$/;

export function chordsOverWordsToChordPro(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const chords = chordLinePositions(line) ?? singleChord(line);
    if (chords) {
      const next = lines[i + 1]?.trimEnd() ?? '';
      const nextIsLyrics = next.trim() !== '' && !DIRECTIVE.test(next) && !chordLinePositions(next) && !singleChord(next);
      const toLine = (t: string) => lyricsToChordPro({ text: t, chords: chords.map((c) => ({ id: '', pos: c.at, chord: c.chord })) });
      out.push(toLine(nextIsLyrics ? next : ''));
      if (nextIsLyrics) i++;
      continue;
    }
    const header = BRACKET_HEADER.exec(line);
    out.push(header ? `{comment: ${header[1]}}` : line);
  }
  return out.join('\n');
}

/** A line with one chord only ("   Am") — `chordLinePositions` needs two. */
function singleChord(line: string): { chord: string; at: number }[] | null {
  const match = /^(\s*)([A-G][#b]?(?:maj|min|sus|add|dim|aug|m|\d)*(?:\/[A-G][#b]?)?)\s*$/.exec(line);
  return match ? [{ chord: match[2], at: match[1].length }] : null;
}

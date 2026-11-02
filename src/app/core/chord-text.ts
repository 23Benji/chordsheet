// Chords written as plain text, as the PDF conversion left them:
// "B- G D A — B- G D A", "C AmDm G F C", "G D C ..Am", "E-7", "Mi- Do+".
// The old notation is normalised ("B-" → "Bm", "E7-" → "Em7", "Do" → "C")
// so these chords can be styled and transposed like [bracketed] ones.

export type ChordTextItem = { chord: string } | { text: string };

const SOLFEGE: Record<string, string> = {
  Do: 'C',
  Re: 'D',
  Mi: 'E',
  Fa: 'F',
  Sol: 'G',
  La: 'A',
  Si: 'B',
};

// Root (letter or Capitalised solfège), accidental, suffix made of known
// pieces only, optional slash bass. A "-" is "minor" unless a new chord
// letter follows ("A-E" = A then E).
const CHORD_AT =
  /^(Sol|Do|Re|Mi|Fa|La|Si|[A-G])([#b]?)((?:maj|min|sus|add|dim|aug|m|M|\d|\+|-(?![A-G]))*)(?:\/([A-G][#b]?))?/;
const SEPARATOR = /^[\s,.;:…—–|/()_-]+/;
const REPEAT = /^x\s*\d+(\s*volte)?/i; // "x2", "x 3 volte"
const WORD = /^\S+/;

function normalise(root: string, accidental: string, suffix: string, bass?: string): string {
  const letter = SOLFEGE[root] ?? root;
  let rest = suffix.replace(/\+/g, '');
  if (rest.includes('-')) rest = 'm' + rest.replace(/-/g, '');
  return letter + accidental + rest + (bass ? '/' + bass : '');
}

interface Token {
  item: ChordTextItem;
  /** Character position in the original text. */
  at: number;
  /** The characters as written ("B-" for the chord Bm). */
  raw: string;
}

function scan(text: string, allowWords: boolean): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const separator = SEPARATOR.exec(rest);
    if (separator) {
      i += separator[0].length;
      continue;
    }
    const repeat = REPEAT.exec(rest);
    if (repeat) {
      tokens.push({ item: { text: repeat[0] }, at: i, raw: repeat[0] });
      i += repeat[0].length;
      continue;
    }
    const chord = CHORD_AT.exec(rest);
    // A chord ends at a non-letter or where the next chord starts ("AmDm"):
    // "Geremia" is not G + "eremia", "ERICA" is not E + "RICA".
    const after = chord ? rest.slice(chord[0].length) : '';
    if (chord && (!/^[A-Za-z]/.test(after) || CHORD_AT.test(after))) {
      tokens.push({ item: { chord: normalise(chord[1], chord[2], chord[3], chord[4]) }, at: i, raw: chord[0] });
      i += chord[0].length;
      continue;
    }
    if (!allowWords) return null;
    const word = WORD.exec(rest)![0];
    tokens.push({ item: { text: word }, at: i, raw: word });
    i += word.length;
  }
  return tokens;
}

/**
 * Splits text into chords and other bits. Returns null when `allowWords` is
 * false and the text contains anything that is not a chord, separator or
 * repeat mark (so normal lyrics are never mistaken for chords).
 */
export function tokenizeChordText(text: string, allowWords = false): ChordTextItem[] | null {
  return scan(text, allowWords)?.map((t) => t.item) ?? null;
}

/** Rewrites every chord in free text with `map` ("B- G (2 volte)" → "Bm G (2 volte)"), keeping everything else. */
export function replaceChords(text: string, map: (chord: string) => string): string {
  let out = '';
  let last = 0;
  for (const token of scan(text, true)!) {
    if (!('chord' in token.item)) continue;
    out += text.slice(last, token.at) + map(token.item.chord);
    last = token.at + token.raw.length;
  }
  return out + text.slice(last);
}

/** Like `parseChordLine`, but with each chord's column, for converting to ChordPro. */
export function chordLinePositions(text: string): { chord: string; at: number }[] | null {
  if (!parseChordLine(text)) return null;
  return scan(text, false)!.flatMap((t) => ('chord' in t.item ? [{ chord: t.item.chord, at: t.at }] : []));
}

/**
 * A line that is only chords (old notation). Needs two chords, or one chord
 * with a separator ("D ||"), so a lone "E" or "A" in lyrics never matches.
 */
export function parseChordLine(text: string): ChordTextItem[] | null {
  const items = tokenizeChordText(text);
  if (!items) return null;
  const chords = items.filter((i) => 'chord' in i).length;
  if (chords >= 2 || (chords === 1 && /[|.…—–,]/.test(text))) return items;
  return null;
}

// Tokens for the light syntax highlighting of the ChordPro source editor.

export type HighlightClass = 'text' | 'chord' | 'directive';
export interface HighlightToken {
  text: string;
  cls: HighlightClass;
}

/** One array of tokens per line: `[chords]` and `{directives}` get their own class. */
export function highlightChordPro(source: string): HighlightToken[][] {
  return source.split('\n').map((line) => {
    if (/^\s*\{.*\}\s*$/.test(line)) return [{ text: line, cls: 'directive' as const }];
    const tokens: HighlightToken[] = [];
    let last = 0;
    for (const match of line.matchAll(/\[[^\]]*\]/g)) {
      if (match.index > last) tokens.push({ text: line.slice(last, match.index), cls: 'text' });
      tokens.push({ text: match[0], cls: 'chord' });
      last = match.index + match[0].length;
    }
    if (last < line.length) tokens.push({ text: line.slice(last), cls: 'text' });
    return tokens;
  });
}

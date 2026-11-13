import { SheetSection } from '../../core/chordpro';
import { IT } from '../../i18n/it';

/** "Strofa 2", "Ritornello", "Intermezzo musicale" … or null (no label). */
export function sectionLabel(section: SheetSection): string | null {
  const names = IT.song.sections;
  if (section.label) return section.label;
  switch (section.type) {
    case 'verse':
      return section.number === null ? null : names.verse(section.number);
    case 'plain':
      return null; // "Altro (senza numero)": no label unless one is written
    case 'chorus':
      return names.chorus;
    case 'chorusRepeat':
      return names.chorusRepeat;
    case 'bridge':
      return names.bridge;
    case 'instrumental':
      return names[section.role ?? 'interlude'];
  }
}

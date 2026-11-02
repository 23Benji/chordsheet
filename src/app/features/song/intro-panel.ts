import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { tokenizeChordText } from '../../core/chord-text';
import { cleanIntro, isEmptyIntro, mapChordText } from '../../core/intro';
import { SongIntro } from '../../core/models';
import { IT } from '../../i18n/it';
import { Icon } from '../../ui/icon';

const RHYTHM_SYMBOLS = [
  { symbol: '↓', key: 'down' },
  { symbol: '↑', key: 'up' },
  { symbol: '·', key: 'pause' },
  { symbol: '×', key: 'mute' },
  { symbol: '|', key: 'bar' },
] as const;

const RHYTHM_PRESETS = ['↓ ↓↑ ↑↓↑', '↓ ↓ ↓ ↓', '↓ ↓↑ ↓↑', '↓ · ↓↑ ·↑↓↑', 'Arpeggio'];

/** Bottom panel to write how the song starts: part, chords, rhythm, note. */
@Component({
  selector: 'app-intro-panel',
  imports: [Icon],
  templateUrl: './intro-panel.html',
  styleUrl: './intro-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntroPanel {
  readonly intro = input<SongIntro | undefined>();
  /** Section names of the song ("Ritornello", "Strofa 1" …) as quick picks for the part. */
  readonly sections = input<string[]>([]);
  /** Chords are typed and shown in the displayed key, stored in the original key. */
  readonly toDisplay = input<(chord: string) => string>((c) => c);
  readonly toOriginal = input<(chord: string) => string>((c) => c);

  readonly saved = output<SongIntro | undefined>();
  readonly closed = output<void>();

  protected readonly t = IT.song.intro;
  protected readonly symbols = RHYTHM_SYMBOLS;
  protected readonly presets = RHYTHM_PRESETS;

  private readonly partInput = viewChild.required<ElementRef<HTMLInputElement>>('part');
  private readonly rhythmInput = viewChild.required<ElementRef<HTMLInputElement>>('rhythm');

  protected readonly exists = computed(() => !isEmptyIntro(this.intro()));
  protected readonly initialChords = computed(() => mapChordText(this.intro()?.chords ?? '', this.toDisplay()));
  /** Live preview of the chords being typed. */
  protected readonly chordsText = signal<string | null>(null);
  protected readonly preview = computed(() => {
    const items = tokenizeChordText(this.chordsText() ?? this.initialChords(), true) ?? [];
    return items.filter((i) => 'chord' in i).map((i) => (i as { chord: string }).chord);
  });

  protected pickPart(name: string): void {
    this.partInput().nativeElement.value = name;
  }

  /** Inserts a rhythm symbol at the cursor. */
  protected insertSymbol(symbol: string): void {
    const el = this.rhythmInput().nativeElement;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + symbol + el.value.slice(end);
    el.focus();
    el.setSelectionRange(start + symbol.length, start + symbol.length);
  }

  protected setPreset(preset: string): void {
    this.rhythmInput().nativeElement.value = preset;
  }

  protected save(part: string, chords: string, rhythm: string, note: string): void {
    this.saved.emit(cleanIntro({ part, chords: mapChordText(chords, this.toOriginal()), rhythm, note }));
  }

  protected remove(): void {
    this.saved.emit(undefined);
  }
}

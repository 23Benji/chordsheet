import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FINDER_FRETS, FretChoice, GUITAR_TUNING, findChords, pitchName, soundingNotes } from '../../core/chord-finder';
import { mod12 } from '../../core/transpose';
import { IT } from '../../i18n/it';
import { Icon } from '../../ui/icon';
import { SidebarToggle } from '../../ui/sidebar-toggle';
import { strum } from '../../ui/strum';

/** String names, low E → high e (the high one lower-case, as in tablature). */
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
/** Fret numbers printed under the neck, where guitars have their dots. */
const MARKERS = new Set([3, 5, 7, 9, 12]);

/**
 * "Trova accordo": a guitar neck lying sideways (high e on top, as in
 * tablature). Tap a fret on a string to put a finger there, tap it again to
 * lift it; the column by the nut switches the string between open (○) and
 * not played (×). The name of the chord, its notes and its other names
 * appear above, and "Suona" strums it.
 */
@Component({
  selector: 'app-chord-finder-page',
  imports: [RouterLink, Icon, SidebarToggle],
  templateUrl: './chord-finder-page.html',
  styleUrl: './chord-finder-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChordFinderPage {
  protected readonly t = IT.chordFinder;

  /** Per string, low E → high e. Starts with nothing played. */
  protected readonly frets = signal<FretChoice[]>([null, null, null, null, null, null]);

  /** Grid rows top → bottom: the high e first. */
  protected readonly rows = [5, 4, 3, 2, 1, 0].map((string, i) => ({ string, row: i + 1, name: STRING_NAMES[string] }));
  protected readonly fretNumbers = Array.from({ length: FINDER_FRETS }, (_, i) => i + 1);
  protected readonly markers = MARKERS;

  private readonly notes = computed(() => soundingNotes(this.frets()));
  protected readonly played = computed(() => this.notes().length);
  protected readonly found = computed(() => findChords(this.frets()));
  protected readonly best = computed(() => this.found()[0] ?? null);
  /** Up to three other names for the same notes. */
  protected readonly others = computed(() => this.found().slice(1, 4).map((c) => c.name));
  /** The different notes played, lowest first: "A · E · G · C". */
  protected readonly noteNames = computed(() => [...new Set(this.notes().map((n) => pitchName(n)))].join(' · '));

  protected noteAt(string: number, fret: number): string {
    return pitchName(GUITAR_TUNING[string] + fret);
  }

  /** The chord's root gets the accent colour on the neck. */
  protected isRoot(string: number, fret: number): boolean {
    const best = this.best();
    return !!best && mod12(GUITAR_TUNING[string] + fret) === best.root;
  }

  protected press(string: number, fret: number): void {
    this.frets.update((all) => all.map((f, i) => (i === string ? (f === fret ? null : fret) : f)));
  }

  /** The column by the nut: × (not played) ↔ ○ (open); with a finger on the string it opens it. */
  protected toggleOpen(string: number): void {
    this.frets.update((all) => all.map((f, i) => (i === string ? (f === 0 ? null : 0) : f)));
  }

  protected clear(): void {
    this.frets.set([null, null, null, null, null, null]);
  }

  protected play(): void {
    strum(this.notes());
  }
}

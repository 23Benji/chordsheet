import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { monthsAgo, setlistStats } from '../../core/setlist-stats';
import { numberLabel } from '../../core/song-meta';
import { IT } from '../../i18n/it';
import { LibraryService } from '../../services/library.service';
import { SetlistService } from '../../services/setlist.service';
import { Icon } from '../../ui/icon';

type Period = 'all' | 'year' | 'quarter';

/** Rows of "I più cantati" before "Mostra tutti". */
const TOP = 10;

/**
 * "Statistiche": which songs are sung most, which parts of the songbook,
 * which never — counted from the setlists (Benji makes one every Sunday).
 * Opened from a quiet row under the setlists: useful, but not for everyone.
 * Charts are plain HTML/CSS (bars sized in %), one colour (the accent), the
 * numbers written next to them and a table under the columns, so nothing
 * depends on seeing the colour or the bar length.
 */
@Component({
  selector: 'app-stats-page',
  imports: [RouterLink, Icon],
  templateUrl: './stats-page.html',
  styleUrl: './stats-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPage {
  private readonly library = inject(LibraryService);
  private readonly setlists = inject(SetlistService);
  protected readonly t = IT.stats;
  protected readonly numberLabel = numberLabel;
  protected readonly periods: Period[] = ['all', 'year', 'quarter'];

  protected readonly period = signal<Period>('all');
  protected readonly showAll = signal(false);

  protected readonly stats = computed(() => {
    const p = this.period();
    const since = p === 'year' ? monthsAgo(12) : p === 'quarter' ? monthsAgo(3) : undefined;
    return setlistStats(this.setlists.setlists(), this.library.songs(), since);
  });
  protected readonly hasSetlists = computed(() => this.setlists.setlists().length > 0);

  protected readonly top = computed(() => {
    const songs = this.stats().songs;
    return this.showAll() ? songs : songs.slice(0, TOP);
  });
  /** Bars are as long as count / the most sung (that one fills the row). */
  protected readonly maxCount = computed(() => this.stats().songs[0]?.count ?? 1);
  protected readonly maxPlays = computed(() => Math.max(1, ...this.stats().ranges.map((r) => r.plays)));
  /** The part sung most: its column is the one labelled on the chart. */
  protected readonly topRange = computed(() => {
    const ranges = this.stats().ranges;
    return ranges.reduce((best, r) => (r.plays > best.plays ? r : best), ranges[0]);
  });

  protected setPeriod(period: Period): void {
    this.period.set(period);
    this.showAll.set(false);
  }

  protected day(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  protected percent(value: number, max: number): number {
    return max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  }
}

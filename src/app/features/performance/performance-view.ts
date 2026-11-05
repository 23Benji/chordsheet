import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { resolveAll } from '../../core/anchoring';
import { collapseRepeats, mapSheetChords, parseChordPro } from '../../core/chordpro';
import { introView } from '../../core/intro';
import { actionFor, effectiveKeymap, KeyAction } from '../../core/keymap';
import { Annotation, preferSharpsFor } from '../../core/models';
import {
  AUTOSCROLL_DEFAULT,
  AUTOSCROLL_STEP,
  clampAutoscroll,
  secondsPerScreenFromTempo,
} from '../../core/paging';
import { numberLabel } from '../../core/song-meta';
import { keyView } from '../../core/transpose';
import { IT } from '../../i18n/it';
import { AnnotationService } from '../../services/annotation.service';
import { LibraryService } from '../../services/library.service';
import { ScreenService } from '../../services/screen.service';
import { SetlistService } from '../../services/setlist.service';
import { RecentService } from '../../services/recent.service';
import { SettingsService } from '../../services/settings.service';
import { SongPrefsService } from '../../services/song-prefs.service';
import { Icon } from '../../ui/icon';
import { KeymapDialog } from '../../ui/keymap-dialog';
import { Pager, PagerMode } from '../../ui/pager';
import { Swipe } from '../../ui/swipe';
import { Pinch } from '../../ui/pinch';
import { FONT_SCALE_MAX, FONT_SCALE_MIN, pinchFontScale } from '../../core/gestures';
import { SongSheet } from '../song/song-sheet';

/** Performance font = song font × this. */
const STAGE_SCALE = 1.25;
const BASE_LYRICS_PX = 22;
const BAR_HIDE_MS = 3000;
/** Two columns only on screens wide enough and in landscape. */
const LANDSCAPE_QUERY = '(min-width: 900px) and (orientation: landscape)';

/** Set by the page that opened performance mode (Angular keeps navigation `state` in history.state). */
const canGoBack = () => (history.state as { canGoBack?: boolean } | null)?.canGoBack === true;

@Component({
  selector: 'app-performance-view',
  imports: [Icon, SongSheet, Pager, KeymapDialog, Swipe, Pinch],
  templateUrl: './performance-view.html',
  styleUrl: './performance-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-contrast': 'high',
    '(document:keydown)': 'onKeydown($event)',
    '(pointermove)': 'showBar()',
  },
})
export class PerformanceView {
  private readonly library = inject(LibraryService);
  private readonly prefsService = inject(SongPrefsService);
  private readonly settings = inject(SettingsService);
  private readonly annotations = inject(AnnotationService);
  private readonly setlists = inject(SetlistService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  protected readonly screen = inject(ScreenService);
  protected readonly t = IT.performance;
  protected readonly numberLabel = numberLabel;

  readonly id = input.required<string>();
  /** Optional queue of song ids, from `?coda=id1,id2,…`. */
  readonly coda = input<string>();
  /** Or a setlist: `?scaletta=<id>&pos=<n>` (n = position among its existing songs). */
  readonly scaletta = input<string>();
  readonly pos = input(0, { transform: numberAttribute });

  private readonly pager = viewChild(Pager);
  private readonly keymapDialog = viewChild.required(KeymapDialog);

  protected readonly song = computed(() => this.library.byId().get(this.id()) ?? null);
  private readonly parsed = computed(() => {
    const song = this.song();
    return song ? parseChordPro(song.chordpro) : null;
  });
  private readonly prefs = computed(() => this.prefsService.get(this.id()));
  private readonly capo = computed(() =>
    this.prefsService.has(this.id()) ? this.prefs().capo : (this.song()?.capo ?? 0),
  );
  // ── Queue (setlist) ───────────────────────────────────────────────────────

  protected readonly setlist = computed(() => {
    const id = this.scaletta();
    return id ? (this.setlists.byId().get(id) ?? null) : null;
  });
  /** Setlist entries whose song still exists. */
  private readonly playable = computed(() =>
    (this.setlist()?.items ?? []).filter((i) => this.library.byId().has(i.songId)),
  );
  protected readonly queue = computed(() =>
    this.setlist()
      ? this.playable().map((i) => i.songId)
      : (this.coda() ?? '').split(',').filter((id) => this.library.byId().has(id)),
  );
  protected readonly queueIndex = computed(() =>
    this.setlist() ? Math.min(this.pos(), this.queue().length - 1) : this.queue().indexOf(this.id()),
  );
  /** The setlist entry being played: its transposition and note win. */
  protected readonly item = computed(() => (this.setlist() ? (this.playable()[this.queueIndex()] ?? null) : null));
  protected readonly nextSong = computed(() => {
    const i = this.queueIndex();
    return i >= 0 ? (this.library.byId().get(this.queue()[i + 1]) ?? null) : null;
  });

  private readonly transpose = computed(() => this.item()?.transpose ?? this.prefs().transpose);
  protected readonly keys = computed(() =>
    keyView(
      this.song()?.key ?? this.parsed()?.key ?? null,
      this.transpose(),
      this.capo(),
      preferSharpsFor(this.prefs().preferSharps, this.settings.settings().accidentals),
    ),
  );
  protected readonly capoValue = this.capo;
  protected readonly sheet = computed(() => {
    const parsed = this.parsed();
    if (!parsed) return null;
    const sheet = mapSheetChords(parsed, this.keys().mapChord);
    if (!this.settings.settings().collapseRepeats) return sheet;
    // Setting "Parti ripetute una volta sola": a copy with personal notes stays visible.
    const notes = this.notes();
    return collapseRepeats(sheet, (line) => notes.has(line));
  });
  protected readonly notes = computed(() => {
    const parsed = this.parsed();
    if (!parsed || !this.settings.settings().showNotes) return new Map<number, Annotation[]>();
    const mapChord = this.keys().mapChord;
    const map = new Map<number, Annotation[]>();
    for (const [line, list] of resolveAll(this.annotations.forSong(this.id()), parsed).byLine) {
      map.set(line, list.map((a) => (a.type === 'chord' ? { ...a, text: mapChord(a.text) } : a)));
    }
    return map;
  });

  protected readonly chordStyle = computed(() => this.settings.settings().chordStyle);
  protected readonly lyricsOnly = computed(() => this.settings.settings().lyricsOnly ?? false);
  protected readonly intro = computed(() => introView(this.prefs().intro, this.keys().mapChord));
  private readonly fontScale = computed(() => this.prefs().fontScale ?? this.settings.settings().fontScale);
  protected readonly lyricsPx = computed(() => Math.round(BASE_LYRICS_PX * STAGE_SCALE * this.fontScale()));

  // ── Layout ──────────────────────────────────────────────────────────────────

  private readonly landscapeQuery = window.matchMedia(LANDSCAPE_QUERY);
  private readonly landscape = signal(this.landscapeQuery.matches);
  protected readonly columns = computed(() => this.prefs().columns ?? 2);
  protected readonly canColumns = this.landscape;
  protected readonly mode = computed<PagerMode>(() =>
    this.landscape() && this.columns() === 2 ? 'columns' : 'vertical',
  );
  protected readonly layoutKey = computed(() => [this.sheet(), this.lyricsPx(), this.notes(), this.mode(), this.intro(), this.lyricsOnly()]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────

  protected readonly running = signal(false);
  protected readonly secondsPerScreen = computed(() => this.prefs().autoscrollSpeed ?? AUTOSCROLL_DEFAULT);
  /** Columns: how far we are towards the next automatic page turn (0..1). */
  protected readonly progress = signal(0);
  private frame = 0;
  private lastTime = 0;

  // ── Bar ───────────────────────────────────────────────────────────────────

  protected readonly barVisible = signal(true);
  private barTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // "Recenti" in the library: remember each song opened (untracked: only
    // a change of song should re-run this, not what add() reads).
    const recent = inject(RecentService);
    effect(() => {
      const id = this.song()?.id;
      if (id) untracked(() => recent.add(id));
    });

    const onLandscape = (e: MediaQueryListEvent) => this.landscape.set(e.matches);
    this.landscapeQuery.addEventListener('change', onLandscape);
    void this.screen.keepAwake();
    inject(DestroyRef).onDestroy(() => {
      this.landscapeQuery.removeEventListener('change', onLandscape);
      this.stopAutoscroll();
      clearTimeout(this.barTimer);
      void this.screen.allowSleep();
      void this.screen.exitFullscreen();
    });

    // A new song (next in the queue): start from the top, scrolling stopped.
    effect(() => {
      this.id();
      this.pos();
      untracked(() => {
        this.stopAutoscroll();
        this.pager()?.reset();
        this.showBar();
      });
    });
  }

  protected showBar(): void {
    this.barVisible.set(true);
    clearTimeout(this.barTimer);
    this.barTimer = setTimeout(() => this.barVisible.set(false), BAR_HIDE_MS);
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  protected next(): void {
    this.progress.set(0);
    if (this.pager()?.next()) return;
    const i = this.queueIndex();
    if (i >= 0 && i < this.queue().length - 1) this.goToSong(i + 1);
  }

  protected prev(): void {
    this.progress.set(0);
    if (this.pager()?.prev()) return;
    const i = this.queueIndex();
    if (i > 0) this.goToSong(i - 1);
  }

  /** Opens song number `index` of the queue (replacing history: Back leaves performance mode). */
  private goToSong(index: number): void {
    const queryParams = this.setlist() ? { scaletta: this.scaletta(), pos: index } : { coda: this.coda() };
    // Keep `canGoBack` from the page that opened performance mode (see exit()).
    void this.router.navigate(['/canto', this.queue()[index], 'esibizione'], {
      queryParams,
      replaceUrl: true,
      state: { canGoBack: canGoBack() },
    });
  }

  /**
   * X / Esc: performance mode is like a full-screen sheet over the page that
   * opened it, so closing it goes back to exactly that page — the setlist when
   * played from a setlist, the song when started from the song. The pages that
   * open it set `canGoBack` in the history state; then one step back is that
   * page (song changes inside performance replace the history entry, so they
   * don't pile up). Opened from a link or after a reload there is no such page:
   * then go to the setlist or the song, replacing this entry.
   */
  protected exit(): void {
    if (canGoBack()) {
      this.location.back();
      return;
    }
    const target = this.setlist() ? ['/scalette', this.setlist()!.id] : ['/canto', this.id()];
    void this.router.navigate(target, { replaceUrl: true });
  }

  /** Taps: right third = next, left third = back, middle = show the bar. */
  protected onStageClick(event: MouseEvent, afterSwipe = false): void {
    if (afterSwipe) return; // the swipe already turned the page
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    if (x > 2 / 3) this.next();
    else if (x < 1 / 3) this.prev();
    else this.showBar();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.keymapDialog().isOpen()) return;
    if (event.key === 'Escape' && !this.screen.isFullscreen()) {
      // In full screen the first Esc is used by the browser to leave it.
      this.exit();
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (event.key === ' ' && target && ['BUTTON', 'A'].includes(target.tagName)) target.blur();
    const action = actionFor(effectiveKeymap(this.settings.settings().keyboardMap), event.key);
    if (!action) return;
    event.preventDefault();
    this.run(action);
  }

  private run(action: KeyAction): void {
    switch (action) {
      case 'next':
        return this.next();
      case 'prev':
        return this.prev();
      case 'autoscroll':
        return this.toggleAutoscroll();
      case 'slower':
        return this.setSpeed(this.secondsPerScreen() + AUTOSCROLL_STEP);
      case 'faster':
        return this.setSpeed(this.secondsPerScreen() - AUTOSCROLL_STEP);
    }
  }

  // ── Auto-scroll ─────────────────────────────────────────────────────────────

  protected toggleAutoscroll(): void {
    if (this.running()) this.stopAutoscroll();
    else this.startAutoscroll();
  }

  private startAutoscroll(): void {
    this.running.set(true);
    this.progress.set(0);
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame((time) => this.tick(time));
  }

  private stopAutoscroll(): void {
    this.running.set(false);
    this.progress.set(0);
    cancelAnimationFrame(this.frame);
  }

  /**
   * One animation frame. Vertical: scroll by (screen height / seconds per
   * screen) × elapsed time. Columns: fill the progress bar, turn the page when full.
   */
  private tick(time: number): void {
    if (!this.running()) return;
    const dt = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;
    const pager = this.pager();
    const seconds = this.secondsPerScreen();
    if (pager && this.mode() === 'vertical') {
      if (!pager.scrollBy((pager.height / seconds) * dt)) return this.stopAutoscroll();
    } else if (pager) {
      const progress = this.progress() + dt / seconds;
      if (progress >= 1) {
        if (pager.atEnd()) return this.stopAutoscroll();
        pager.next();
        this.progress.set(0);
      } else {
        this.progress.set(progress);
      }
    }
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  protected setSpeed(seconds: number): void {
    void this.prefsService.update(this.id(), { autoscrollSpeed: clampAutoscroll(seconds), capo: this.capo() });
  }

  protected speedFromTempo(): void {
    const tempo = this.song()?.tempo;
    if (tempo) this.setSpeed(secondsPerScreenFromTempo(tempo));
  }

  // ── Bar actions ───────────────────────────────────────────────────────────

  protected changeFont(delta: number): void {
    const next = Math.round((this.fontScale() + delta) * 10) / 10;
    void this.prefsService.update(this.id(), { fontScale: Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, next)), capo: this.capo() });
  }

  /** The text that grows while pinching (inside an @if, so read from code). */
  protected readonly pagerEl = viewChild('pagerEl', { read: ElementRef<HTMLElement> });
  protected readonly pinchLimits = computed(() => ({ min: FONT_SCALE_MIN / this.fontScale(), max: FONT_SCALE_MAX / this.fontScale() }));

  /** Two-finger pinch on the stage: the new text size (the pages re-flow). */
  protected onPinch(ratio: number): void {
    const fontScale = pinchFontScale(this.fontScale(), ratio);
    if (fontScale !== this.fontScale()) void this.prefsService.update(this.id(), { fontScale, capo: this.capo() });
  }

  protected setColumns(columns: 1 | 2): void {
    void this.prefsService.update(this.id(), { columns, capo: this.capo() });
  }

  protected openKeys(): void {
    this.stopAutoscroll();
    this.keymapDialog().open();
  }
}

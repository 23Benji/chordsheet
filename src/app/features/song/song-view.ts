import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { anchorFor, resolveAll } from '../../core/anchoring';
import { mapSheetChords, parseChordPro } from '../../core/chordpro';
import { introView } from '../../core/intro';
import { Annotation, SongIntro, preferSharpsFor } from '../../core/models';
import { actionFor, effectiveKeymap } from '../../core/keymap';
import { numberLabel } from '../../core/song-meta';
import { clampTranspose, keyUsesFlats, keyView, transposeChord } from '../../core/transpose';
import { IT } from '../../i18n/it';
import { AnnotationService } from '../../services/annotation.service';
import { LayoutService } from '../../services/layout.service';
import { LibraryService } from '../../services/library.service';
import { ScreenService } from '../../services/screen.service';
import { SettingsService } from '../../services/settings.service';
import { SongPrefsService } from '../../services/song-prefs.service';
import { ToastService } from '../../services/toast.service';
import { Icon } from '../../ui/icon';
import { Pager } from '../../ui/pager';
import { Swipe } from '../../ui/swipe';
import { Popover } from '../../ui/popover';
import { Switch } from '../../ui/switch';
import { ChordDiagram } from '../../ui/chord-diagram';
import { Metronome } from '../../ui/metronome';
import { AddToSetlist } from './add-to-setlist';
import { SongFolders } from './song-folders';
import { ExportMenu } from './export-menu';
import { AnnotationPanel } from './annotation-panel';
import { IntroPanel } from './intro-panel';
import { sectionLabel } from './section-label';
import { SongSheet } from './song-sheet';

const FONT_MIN = 0.6;
const FONT_MAX = 2;
const BASE_LYRICS_PX = 22;
/** From this width up the song is shown in two columns, flipped page by page. */
const WIDE_QUERY = '(min-width: 900px)';

@Component({
  selector: 'app-song-view',
  imports: [RouterLink, Icon, SongSheet, AnnotationPanel, Pager, AddToSetlist, SongFolders, IntroPanel, ExportMenu, Metronome, ChordDiagram, Swipe, Popover, Switch],
  templateUrl: './song-view.html',
  styleUrl: './song-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
    // A panel slides over the bottom of the song: the iPhone toolbar steps aside.
    '[class.panel-up]': 'panelOpen() || introOpen()',
  },
})
export class SongView {
  private readonly library = inject(LibraryService);
  private readonly prefsService = inject(SongPrefsService);
  private readonly settings = inject(SettingsService);
  private readonly annotationService = inject(AnnotationService);
  private readonly toast = inject(ToastService);
  protected readonly layout = inject(LayoutService);
  protected readonly t = IT.song;
  protected readonly nt = IT.notes;
  protected readonly pt = IT.performance;
  private readonly router = inject(Router);
  private readonly screen = inject(ScreenService);
  protected readonly lt = IT.library;

  /** Bound from the route parameter `canto/:id` (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly song = computed(() => this.library.byId().get(this.id()) ?? null);
  protected readonly label = computed(() => {
    const song = this.song();
    return song ? numberLabel(song) : '';
  });
  /** All versions of this song (123, 123b …); the switcher shows when > 1. */
  protected readonly versions = computed(() => {
    const song = this.song();
    return song ? this.library.versionsOf(song) : [];
  });

  /** Parsing only re-runs when the song text changes, not on transpose. */
  private readonly parsed = computed(() => {
    const song = this.song();
    return song ? parseChordPro(song.chordpro) : null;
  });

  private readonly prefs = computed(() => this.prefsService.get(this.id()));
  protected readonly transpose = computed(() => this.prefs().transpose);
  /** Until the user changes it, the capo comes from the song's {capo}. */
  protected readonly capo = computed(() =>
    this.prefsService.has(this.id()) ? this.prefs().capo : (this.song()?.capo ?? 0),
  );
  protected readonly fontScale = computed(
    () => this.prefs().fontScale ?? this.settings.settings().fontScale,
  );
  protected readonly lyricsPx = computed(() => Math.round(BASE_LYRICS_PX * this.fontScale()));

  protected readonly keys = computed(() =>
    keyView(
      this.song()?.key ?? this.parsed()?.key ?? null,
      this.transpose(),
      this.capo(),
      preferSharpsFor(this.prefs().preferSharps, this.settings.settings().accidentals),
    ),
  );

  protected readonly sheet = computed(() => {
    const parsed = this.parsed();
    return parsed ? mapSheetChords(parsed, this.keys().mapChord) : null;
  });

  // ── Personal layer ──────────────────────────────────────────────────────

  protected readonly showNotes = computed(() => this.settings.settings().showNotes);
  /** Annotations grouped by the line they belong to in the current text. */
  protected readonly resolved = computed(() => {
    const parsed = this.parsed();
    const annotations = this.annotationService.forSong(this.id());
    return parsed ? resolveAll(annotations, parsed) : { byLine: new Map<number, Annotation[]>(), orphans: [] };
  });
  /** What the sheet shows: personal chords transposed like the song; nothing when notes are hidden. */
  protected readonly displayAnnotations = computed(() => {
    if (!this.showNotes()) return new Map<number, Annotation[]>();
    const mapChord = this.keys().mapChord;
    const map = new Map<number, Annotation[]>();
    for (const [line, list] of this.resolved().byLine) {
      map.set(line, list.map((a) => (a.type === 'chord' ? { ...a, text: mapChord(a.text) } : a)));
    }
    return map;
  });

  protected readonly selectedLine = signal<number | null>(null);
  protected readonly showOrphans = signal(false);
  /** Orphaned annotation waiting for the user to tap its new line. */
  protected readonly relinking = signal<Annotation | null>(null);
  protected readonly panelOpen = computed(
    () => this.showNotes() && !this.relinking() && (this.selectedLine() !== null || this.showOrphans()),
  );

  // ── Chord diagrams ────────────────────────────────────────────────────────

  protected readonly showDiagrams = computed(() => this.settings.settings().showChordDiagrams);
  protected readonly chordStyle = computed(() => this.settings.settings().chordStyle);
  protected readonly diagram = signal<{ chord: string; left: number; top: number } | null>(null);

  private hideDiagramTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Places the diagram under the chord (above it near the bottom of the
   * screen). Leaving the chord hides it after a moment, unless the pointer
   * moves onto the diagram (to browse the other fingerings).
   */
  protected onChordHover(hover: { chord: string; rect: DOMRect } | null): void {
    clearTimeout(this.hideDiagramTimer);
    if (!hover) {
      this.hideDiagramTimer = setTimeout(() => this.diagram.set(null), 350);
      return;
    }
    const { rect } = hover;
    const below = rect.bottom + 220 < window.innerHeight;
    this.diagram.set({
      chord: hover.chord,
      left: Math.min(Math.max(8, rect.left - 24), window.innerWidth - 150),
      top: below ? rect.bottom + 6 : rect.top - 216,
    });
  }

  protected keepDiagram(): void {
    clearTimeout(this.hideDiagramTimer);
  }

  // ── Intro card ────────────────────────────────────────────────────────────

  protected readonly introOpen = signal(false);
  protected readonly storedIntro = computed(() => this.prefs().intro);
  protected readonly intro = computed(() => introView(this.storedIntro(), this.keys().mapChord));
  /** Section names for the "Parte" quick picks. */
  protected readonly sectionNames = computed(() => [
    ...new Set((this.parsed()?.sections ?? []).map(sectionLabel).filter((l): l is string => !!l)),
  ]);

  protected openIntro(): void {
    this.closePanel();
    this.introOpen.set(true);
  }

  protected saveIntro(intro: SongIntro | undefined): void {
    void this.prefsService.update(this.id(), { intro, capo: this.capo() });
    this.introOpen.set(false);
  }

  protected readonly selectedAnchor = computed(() => {
    const parsed = this.parsed();
    const line = this.selectedLine();
    return parsed && line !== null ? anchorFor(parsed, line) : null;
  });
  private readonly selectedSheetLine = computed(() => {
    const line = this.selectedLine();
    return this.sheet()?.sections.flatMap((s) => s.lines).find((l) => l.index === line) ?? null;
  });
  protected readonly selectedText = computed(() => {
    const line = this.selectedSheetLine();
    if (!line) return '';
    if (line.kind === 'chords') return line.items.map((i) => ('chord' in i ? i.chord : i.text)).join(' ');
    return line.text;
  });
  protected readonly selectedChords = computed(() => {
    const line = this.selectedSheetLine();
    if (line?.kind !== 'lyrics') return [];
    return line.words.flatMap((w) => w.segments).flatMap((s) => (s.chord ? [s.chord] : []));
  });
  protected readonly selectedAnnotations = computed(() => {
    const line = this.selectedLine();
    return line === null ? [] : (this.resolved().byLine.get(line) ?? []);
  });
  protected readonly toDisplay = computed(() => this.keys().mapChord);
  /** Inverse of the displayed transposition: personal chords are stored in the original key. */
  protected readonly toOriginal = computed(() => {
    const keys = this.keys();
    const flats = keyUsesFlats(keys.originalKey);
    return (chord: string) => (keys.shift === 0 ? chord : transposeChord(chord, -keys.shift, flats));
  });

  protected onLineSelect(lineIndex: number): void {
    const relinking = this.relinking();
    const parsed = this.parsed();
    if (relinking && parsed) {
      void this.annotationService.relink(relinking, anchorFor(parsed, lineIndex));
      this.relinking.set(null);
      this.toast.show(this.nt.relinked);
      return;
    }
    this.showOrphans.set(false);
    this.introOpen.set(false);
    this.diagram.set(null);
    this.selectedLine.update((current) => (current === lineIndex ? null : lineIndex));
  }

  protected openOrphans(): void {
    this.selectedLine.set(null);
    this.showOrphans.set(true);
  }

  protected startRelink(annotation: Annotation): void {
    this.relinking.set(annotation);
  }

  protected closePanel(): void {
    this.selectedLine.set(null);
    this.showOrphans.set(false);
    this.relinking.set(null);
  }

  protected toggleNotes(): void {
    void this.settings.update({ showNotes: !this.showNotes() });
    this.closePanel();
  }

  protected readonly memo = computed(() => this.prefs().memo ?? '');
  protected readonly memoPreview = computed(() => this.memo().split('\n')[0]);
  private memoTimer: ReturnType<typeof setTimeout> | undefined;

  /** Saved half a second after the last keystroke. */
  protected onMemo(text: string): void {
    clearTimeout(this.memoTimer);
    this.memoTimer = setTimeout(() => {
      void this.prefsService.update(this.id(), { memo: text.trim() ? text : undefined, capo: this.capo() });
    }, 500);
  }

  protected readonly transposeLabel = computed(() => {
    const n = this.transpose();
    return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
  });

  protected changeTranspose(delta: number): void {
    void this.prefsService.update(this.id(), {
      transpose: clampTranspose(this.transpose() + delta),
      capo: this.capo(),
    });
  }

  protected resetTranspose(): void {
    void this.prefsService.update(this.id(), { transpose: 0, capo: this.capo() });
  }

  protected changeCapo(delta: number): void {
    const capo = Math.min(11, Math.max(0, this.capo() + delta));
    void this.prefsService.update(this.id(), { capo, transpose: this.transpose() });
  }

  protected changeFont(delta: number): void {
    const next = Math.round((this.fontScale() + delta) * 10) / 10;
    void this.prefsService.update(this.id(), {
      fontScale: Math.min(FONT_MAX, Math.max(FONT_MIN, next)),
      capo: this.capo(),
    });
  }

  protected readonly fontPercent = computed(() => Math.round(this.fontScale() * 100));

  /** Per-song spelling after transposing: automatic (global setting), ♯ or ♭. */
  protected readonly accidentalOptions = [
    { value: undefined, label: IT.song.accidentalAuto },
    { value: true, label: '♯' },
    { value: false, label: '♭' },
  ];
  protected readonly songAccidental = computed(() => this.prefs().preferSharps);

  protected setAccidental(value: boolean | undefined): void {
    void this.prefsService.update(this.id(), { preferSharps: value, capo: this.capo() });
  }

  protected readonly fontMin = FONT_MIN;
  protected readonly fontMax = FONT_MAX;
  protected readonly numberLabel = numberLabel;

  // ── Two-column pages ────────────────────────────────────────────────────
  // On wide screens the sheet is laid out in two columns and flipped page by
  // page by the Pager directive (ui/pager.ts) — no scrolling while playing.

  private readonly pager = viewChild(Pager);
  private readonly wideQuery = window.matchMedia(WIDE_QUERY);
  protected readonly wide = signal(this.wideQuery.matches);
  protected readonly columns = computed(() => this.prefs().columns ?? 2);
  protected readonly paged = computed(() => this.wide() && this.columns() === 2);
  /** Everything that changes the layout: the pager measures again when it changes. */
  protected readonly layoutKey = computed(() => [
    this.sheet(),
    this.lyricsPx(),
    this.displayAnnotations(),
    this.memo(),
    this.intro(),
  ]);
  private readonly keymap = computed(() => effectiveKeymap(this.settings.settings().keyboardMap));

  constructor() {
    const onWideChange = (e: MediaQueryListEvent) => this.wide.set(e.matches);
    this.wideQuery.addEventListener('change', onWideChange);
    inject(DestroyRef).onDestroy(() => this.wideQuery.removeEventListener('change', onWideChange));

    // Opening another song starts again from page 1. `untracked` stops the
    // effect from re-running for the signals used inside it.
    effect(() => {
      this.id();
      untracked(() => {
        this.pager()?.reset();
        this.closePanel();
        this.introOpen.set(false);
        this.toolbarHidden.set(false);
        this.lastTop = 0;
      });
    });
  }

  // ── iPhone: toolbar slides away while reading (like Safari) ───────────────

  /**
   * The bottom toolbar is hidden while scrolling down the song and back on a
   * scroll up, at the top and at the end. It moves with a CSS transform over
   * the song (position: fixed), so the text never moves when it shows/hides.
   */
  protected readonly toolbarHidden = signal(false);
  private lastTop = 0;
  /** scrollTop where the current scroll direction started. */
  private turnTop = 0;
  private direction = 0;

  protected onSheetScroll(el: HTMLElement): void {
    if (!this.layout.phone()) return;
    const top = el.scrollTop;
    const end = el.scrollHeight - el.clientHeight;
    const delta = top - this.lastTop;
    if (delta && Math.sign(delta) !== this.direction) {
      this.direction = Math.sign(delta);
      this.turnTop = this.lastTop;
    }
    this.lastTop = top;
    // At the top, and at the end of the song (incl. the iOS bounce): visible.
    if (top <= 10 || top >= end - 4) {
      this.turnTop = Math.min(Math.max(top, 0), end);
      this.toolbarHidden.set(false);
      return;
    }
    // A small travel in one direction, not a single jittery event.
    if (top - this.turnTop > 30) this.toolbarHidden.set(true);
    else if (this.turnTop - top > 30) this.toolbarHidden.set(false);
  }

  /** Next/previous page with the configured keys (Space, PageDown, →… by default; pedals too). */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && (this.panelOpen() || this.relinking() || this.introOpen())) {
      this.closePanel();
      this.introOpen.set(false);
      return;
    }
    const pager = this.pager();
    if (!this.paged() || !pager || isTyping(event.target)) return;
    if (event.key === ' ' && isClickable(event.target)) return; // Space presses the button
    const action = actionFor(this.keymap(), event.key);
    if (action === 'next' || action === 'prev') {
      event.preventDefault();
      if (action === 'next') pager.next();
      else pager.prev();
    }
  }

  /** Full screen must be requested inside the click itself (a browser rule). */
  protected perform(): void {
    void this.screen.enterFullscreen();
    void this.router.navigate(['/canto', this.id(), 'esibizione']);
  }

  protected setColumns(columns: 1 | 2): void {
    void this.prefsService.update(this.id(), { columns, capo: this.capo() });
  }
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

function isClickable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['BUTTON', 'A'].includes(target.tagName);
}

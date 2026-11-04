import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { Sheet, parseChordPro } from '../../core/chordpro';
import { chordsOverWordsToChordPro } from '../../core/chords-over-words';
import {
  EditorMeta,
  EditorSong,
  detectedKey,
  newSongTemplate,
  parseEditorSong,
  serializeEditorSong,
  transposeSong,
} from '../../core/editor-model';
import { choFileName, downloadText } from '../../core/export';
import { fieldsFromChordPro, songFromChordPro, withChordPro } from '../../core/song-import';
import { numberLabel, parseSongNumber } from '../../core/song-meta';
import { IT } from '../../i18n/it';
import { AnnotationService } from '../../services/annotation.service';
import { FolderService } from '../../services/folder.service';
import { LayoutService } from '../../services/layout.service';
import { LibraryService } from '../../services/library.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FolderPicker } from '../../ui/folder-picker';
import { Icon } from '../../ui/icon';
import { Popover } from '../../ui/popover';
import { SongSheet } from '../song/song-sheet';
import { SourceEditor } from './source-editor';
import { SongChange, VisualEditor } from './visual-editor';

type Mode = 'visual' | 'source';

/** Undo steps typed within this time with the same key become one step. */
const COALESCE_MS = 1500;

@Component({
  selector: 'app-editor-page',
  imports: [Icon, VisualEditor, SourceEditor, SongSheet, ConfirmDialog, Popover, FolderPicker, NgTemplateOutlet],
  templateUrl: './editor-page.html',
  styleUrl: './editor-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class EditorPage implements OnInit, OnDestroy {
  private readonly library = inject(LibraryService);
  private readonly router = inject(Router);
  private readonly layout = inject(LayoutService);
  private readonly annotations = inject(AnnotationService);
  private readonly toast = inject(ToastService);
  private readonly folders = inject(FolderService);
  protected readonly t = IT.editor;
  protected readonly ft = IT.folders;

  /** Route parameter; missing on /nuovo. */
  readonly id = input<string>();

  private readonly dialog = viewChild.required(ConfirmDialog);
  private readonly pasteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('pasteDialog');

  protected readonly song = computed(() => {
    const id = this.id();
    return id ? (this.library.byId().get(id) ?? null) : null;
  });
  protected readonly isNew = computed(() => !this.id());

  protected readonly mode = signal<Mode>('visual');
  /** Narrow screens show editor or preview; this toggles to the preview. */
  protected readonly narrowPreview = signal(false);

  // The text being edited lives in `doc` (visual mode) or `source` (source
  // mode); switching tabs converts one into the other.
  protected readonly doc = signal<EditorSong>(newSongTemplate());
  protected readonly source = signal('');
  protected readonly text = computed(() =>
    this.mode() === 'visual' ? serializeEditorSong(this.doc()) : this.source(),
  );

  /** Text as last saved/opened (normalised), to know if there are unsaved changes. */
  private readonly savedText = signal('');
  protected readonly dirty = computed(() => this.text() !== this.savedText());
  private leaving = false;
  private sidebarWasOpen = true;

  // Undo/redo: a list of whole-song texts and a cursor into it.
  private readonly history = signal<string[]>([]);
  private readonly cursor = signal(0);
  private lastCoalesce: { key: string; time: number } | null = null;
  protected readonly canUndo = computed(() => this.cursor() > 0);
  protected readonly canRedo = computed(() => this.cursor() < this.history().length - 1);

  /**
   * New song: folders to put it in. Starts with the folder open in the
   * library, so "Nuovo canto" while looking at "Natale" files it there.
   */
  protected readonly folderIds = signal<string[]>([]);

  protected readonly error = signal<string | null>(null);
  protected readonly detectedKey = computed(() => detectedKey(this.doc()));

  /**
   * Live preview with the real renderer. If the ChordPro is momentarily
   * invalid (source mode), keep showing the last version that parsed.
   */
  private lastGoodSheet: Sheet | null = null;
  protected readonly preview = computed<{ sheet: Sheet | null; error: boolean }>(() => {
    try {
      this.lastGoodSheet = parseChordPro(this.text());
      return { sheet: this.lastGoodSheet, error: false };
    } catch {
      return { sheet: this.lastGoodSheet, error: true };
    }
  });

  ngOnInit(): void {
    const song = this.song();
    const doc = song ? parseEditorSong(song.chordpro) : newSongTemplate();
    this.doc.set(doc);
    const text = serializeEditorSong(doc);
    this.savedText.set(text);
    this.history.set([text]);
    this.cursor.set(0);
    const current = this.folders.current();
    if (!song && current) this.folderIds.set([current]);
    // More room for editing; the sidebar comes back as it was when leaving.
    this.sidebarWasOpen = this.layout.sidebarOpen();
    this.layout.sidebarOpen.set(false);
  }

  ngOnDestroy(): void {
    this.layout.sidebarOpen.set(this.sidebarWasOpen);
  }

  // ── Changes and undo ──────────────────────────────────────────────────────

  private record(text: string, coalesce?: string): void {
    const now = Date.now();
    const merge = coalesce && this.lastCoalesce?.key === coalesce && now - this.lastCoalesce.time < COALESCE_MS;
    const history = this.history().slice(0, this.cursor() + 1);
    if (merge) history[history.length - 1] = text;
    else history.push(text);
    this.history.set(history);
    this.cursor.set(history.length - 1);
    this.lastCoalesce = coalesce ? { key: coalesce, time: now } : null;
    this.error.set(null);
  }

  protected onVisualChange(change: SongChange): void {
    this.doc.set(change.song);
    this.record(serializeEditorSong(change.song), change.coalesce);
  }

  protected onSourceChange(text: string): void {
    this.source.set(text);
    this.record(text, 'source');
  }

  protected setMeta(field: keyof EditorMeta, value: string): void {
    const song = { ...this.doc(), meta: { ...this.doc().meta, [field]: value } };
    this.onVisualChange({ song, coalesce: `meta:${field}` });
  }

  /** Replaces the whole text (undo, redo, restore, paste in source mode). */
  private load(text: string): void {
    if (this.mode() === 'visual') this.doc.set(parseEditorSong(text));
    else this.source.set(text);
  }

  protected undo(): void {
    if (!this.canUndo()) return;
    this.cursor.update((c) => c - 1);
    this.lastCoalesce = null;
    this.load(this.history()[this.cursor()]);
  }

  protected redo(): void {
    if (!this.canRedo()) return;
    this.cursor.update((c) => c + 1);
    this.lastCoalesce = null;
    this.load(this.history()[this.cursor()]);
  }

  protected setMode(mode: Mode): void {
    if (mode === this.mode()) return;
    if (mode === 'source') this.source.set(serializeEditorSong(this.doc()));
    else this.doc.set(parseEditorSong(this.source()));
    this.mode.set(mode);
    this.narrowPreview.set(false);
  }

  // ── Tools ─────────────────────────────────────────────────────────────────

  protected transpose(semitones: number): void {
    this.onVisualChange({ song: transposeSong(this.doc(), semitones), coalesce: 'transpose' });
  }

  protected openPaste(): void {
    this.pasteDialog().nativeElement.showModal();
  }

  protected applyPaste(raw: string, replace: boolean): void {
    this.pasteDialog().nativeElement.close();
    if (!raw.trim()) return;
    const body = chordsOverWordsToChordPro(raw);
    if (this.mode() === 'source') {
      const text = replace ? body : `${this.source().trimEnd()}\n\n${body}\n`;
      this.onSourceChange(text);
      return;
    }
    const pasted = parseEditorSong(body);
    const doc = this.doc();
    const sections = replace ? pasted.sections : [...doc.sections, ...pasted.sections];
    const meta = { ...doc.meta, title: doc.meta.title || pasted.meta.title };
    this.onVisualChange({ song: { ...doc, meta, sections } });
  }

  protected exportCho(): void {
    downloadText(choFileName(fieldsFromChordPro(this.text())), this.text());
  }

  protected async restoreOriginal(): Promise<void> {
    const song = this.song();
    if (!song) return;
    const ok = await this.dialog().ask({ ...this.t.confirmRestore });
    if (!ok) return;
    const original = await this.library.bundledSource(song);
    if (original === null) {
      this.error.set(this.t.errors.restore);
      return;
    }
    const text = serializeEditorSong(parseEditorSong(original));
    this.load(text);
    this.record(text);
  }

  protected async deleteSong(): Promise<void> {
    const song = this.song();
    if (!song) return;
    const ok = await this.dialog().ask({ ...this.t.confirmDelete, danger: true });
    if (!ok) return;
    await this.library.deleteSong(song.id);
    this.leaving = true;
    void this.router.navigate(['/']);
  }

  // ── Save / leave ──────────────────────────────────────────────────────────

  private validate(text: string): string | null {
    const fields = fieldsFromChordPro(text);
    if (!fields.title || fields.title === 'Senza titolo') return this.t.errors.title;
    const numberText = this.mode() === 'visual' ? this.doc().meta.number.trim() : null;
    if (numberText && parseSongNumber(numberText).number === null) return this.t.errors.number;
    if (fields.number !== null) {
      const other = this.library.findByNumber(fields.number, fields.suffix, this.song()?.id);
      if (other) return this.t.errors.numberTaken(numberLabel(fields), other.title);
    }
    return null;
  }

  protected async save(): Promise<void> {
    const text = this.text();
    const problem = this.validate(text);
    if (problem) {
      this.error.set(problem);
      return;
    }
    const existing = this.song();
    const song = existing ? withChordPro(existing, text) : songFromChordPro(text, '', 'created');
    await this.library.saveSong(song);
    if (!existing) await this.folders.addSongs(this.folderIds(), [song.id]);
    // Personal notes follow their lines to the new text (SPEC §4.1).
    const orphans = existing ? await this.annotations.reanchorSong(song.id, parseChordPro(text)) : 0;
    this.toast.show(orphans ? IT.notes.orphanedAfterSave(orphans) : this.t.saved);
    this.savedText.set(text);
    this.leaving = true;
    void this.router.navigate(['/canto', song.id], { replaceUrl: this.isNew() });
  }

  protected cancel(): void {
    const song = this.song();
    void this.router.navigate(song ? ['/canto', song.id] : ['/']);
  }

  /** Route guard (canDeactivate): ask before throwing away unsaved changes. */
  async canLeave(): Promise<boolean> {
    if (this.leaving || !this.dirty()) return true;
    return this.dialog().ask({ ...this.t.confirmLeave, danger: true });
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    // Closing the tab/reloading with unsaved changes: the browser asks.
    if (this.dirty() && !this.leaving) event.preventDefault();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
    } else if (key === 'y') {
      event.preventDefault();
      this.redo();
    } else if (key === 's') {
      event.preventDefault();
      void this.save();
    }
  }
}

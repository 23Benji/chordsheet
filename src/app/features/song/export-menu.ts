import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { choFileName, downloadText } from '../../core/export';
import { chordproWithNotes } from '../../core/export-notes';
import { Song } from '../../core/models';
import { IT } from '../../i18n/it';
import { AnnotationService } from '../../services/annotation.service';
import { SongPrefsService } from '../../services/song-prefs.service';
import { RouterLink } from '@angular/router';
import { Icon } from '../../ui/icon';
import { Popover } from '../../ui/popover';

/** The "⋯" menu of a song: export .cho (with or without notes), print / PDF. */
@Component({
  selector: 'app-export-menu',
  imports: [Icon, Popover, RouterLink],
  template: `
    <app-popover [label]="IT.song.more" [menu]="true">
      <app-icon trigger name="more" />
      <a class="menu-item" role="menuitem" [routerLink]="['/canto', song().id, 'modifica']"><app-icon name="edit" /> {{ IT.song.edit }}</a>
      <!-- iPhone: no room for the Cartelle button in the bar, so it is here. -->
      <button type="button" class="menu-item phone-only" role="menuitem" (click)="setlist.emit()"><app-icon name="listAdd" /> {{ IT.setlists.addToSetlist }}…</button>
      <button type="button" class="menu-item phone-only" role="menuitem" (click)="folders.emit()"><app-icon name="folder" /> {{ IT.folders.songMenu }}…</button>
      <div class="menu-separator"></div>
      <button type="button" class="menu-item" role="menuitem" (click)="exportCho(false)"><app-icon name="download" /> {{ t.cho }}</button>
      <button type="button" class="menu-item" role="menuitem" (click)="exportCho(true)"><app-icon name="note" /> {{ t.choNotes }}</button>
      <div class="menu-separator"></div>
      <button type="button" class="menu-item" role="menuitem" (click)="print()"><app-icon name="print" /> {{ t.print }}</button>
    </app-popover>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportMenu {
  private readonly annotations = inject(AnnotationService);
  private readonly prefs = inject(SongPrefsService);
  protected readonly IT = IT;
  protected readonly t = IT.exportMenu;

  readonly song = input.required<Song>();
  /** "Cartelle…" chosen (iPhone only). */
  readonly folders = output<void>();
  /** "Aggiungi a una scaletta…" chosen (iPhone only). */
  readonly setlist = output<void>();

  protected exportCho(withNotes: boolean): void {
    const song = this.song();
    const prefs = this.prefs.get(song.id);
    const text = withNotes
      ? chordproWithNotes(song.chordpro, this.annotations.forSong(song.id), { memo: prefs.memo, intro: prefs.intro }, IT.exportNotes)
      : song.chordpro;
    downloadText(choFileName(song), text);
  }

  protected print(): void {
    // Let the menu close before the print dialog takes a snapshot of the page.
    setTimeout(() => window.print(), 50);
  }
}

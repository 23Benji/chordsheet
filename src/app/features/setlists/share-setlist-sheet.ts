import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { shareOrDownload } from '../../core/export';
import { Setlist } from '../../core/models';
import { Qr, makeQr } from '../../core/qr';
import { encodeSetlistLink, setlistLinkUrl } from '../../core/setlist-link';
import { exportSetlist, setlistFileName } from '../../core/setlists';
import { IT } from '../../i18n/it';
import { LibraryService } from '../../services/library.service';
import { ToastService } from '../../services/toast.service';
import { Icon } from '../../ui/icon';

/**
 * "Condividi" a setlist: a QR code to scan with another phone's camera, the
 * same link to send (WhatsApp, Messaggi, AirDrop…) or copy, and the old
 * file for computers. The link carries the whole setlist (core/setlist-link.ts).
 */
@Component({
  selector: 'app-share-setlist-sheet',
  imports: [Icon],
  template: `
    <dialog #dialog class="sheet" (click)="onBackdrop($event)" (close)="onClose()" [attr.aria-label]="t.title">
      <header class="bar">
        <h2>{{ t.title }}</h2>
        <button type="button" class="btn done" (click)="close()">{{ IT.setlists.done }}</button>
      </header>
      <p class="name">{{ name() }}</p>
      <div class="qr" [attr.aria-label]="t.qrLabel" role="img">
        @if (qr(); as qr) {
          <svg [attr.viewBox]="'-2 -2 ' + (qr.size + 4) + ' ' + (qr.size + 4)" shape-rendering="crispEdges">
            <rect x="-2" y="-2" [attr.width]="qr.size + 4" [attr.height]="qr.size + 4" class="qr-bg" />
            <path [attr.d]="qr.path" class="qr-fg" />
          </svg>
        } @else if (failed()) {
          <p class="qr-error">{{ t.qrError }}</p>
        }
      </div>
      <p class="hint">{{ t.hint }}</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" [disabled]="!url()" (click)="shareLink()"><app-icon name="share" /> {{ t.shareLink }}</button>
        <button type="button" class="btn btn-secondary" [disabled]="!url()" (click)="copyLink()"><app-icon name="copy" /> {{ t.copyLink }}</button>
      </div>
      <button type="button" class="btn file" (click)="shareFile()"><app-icon name="fileDown" /> {{ t.file }}</button>
    </dialog>
  `,
  styleUrl: '../../ui/qr-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareSetlistSheet {
  private readonly library = inject(LibraryService);
  private readonly toast = inject(ToastService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly IT = IT;
  protected readonly t = IT.shareSetlist;

  protected readonly name = signal('');
  protected readonly url = signal<string | null>(null);
  protected readonly qr = signal<Qr | null>(null);
  protected readonly failed = signal(false);
  private setlist: Setlist | null = null;

  async open(setlist: Setlist): Promise<void> {
    this.setlist = setlist;
    this.name.set(setlist.name);
    this.url.set(null);
    this.qr.set(null);
    this.failed.set(false);
    this.dialog().nativeElement.showModal();
    try {
      const encoded = await encodeSetlistLink(exportSetlist(setlist, this.library.byId()));
      const url = setlistLinkUrl(document.baseURI, encoded);
      this.url.set(url);
      this.qr.set(await makeQr(url));
    } catch {
      this.failed.set(true);
    }
  }

  close(): void {
    if (this.dialog().nativeElement.open) this.dialog().nativeElement.close();
  }

  /** iPhone/iPad: the share sheet (WhatsApp, Messaggi, AirDrop…); elsewhere: copy. */
  protected async shareLink(): Promise<void> {
    const url = this.url();
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: this.name(), text: this.t.shareText(this.name()), url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    await this.copyLink();
  }

  protected async copyLink(): Promise<void> {
    const url = this.url();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.toast.show(this.t.copied);
    } catch {
      this.toast.show(this.t.copyFailed);
    }
  }

  /** The .json file, as before (for computers, e-mail, or a backup of the setlist). */
  protected shareFile(): void {
    if (!this.setlist) return;
    const json = JSON.stringify(exportSetlist(this.setlist, this.library.byId()), null, 2);
    void shareOrDownload(setlistFileName(this.setlist), json);
  }

  protected onClose(): void {
    this.setlist = null;
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }
}

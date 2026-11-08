import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Qr, makeQr } from '../core/qr';
import { IT } from '../i18n/it';
import { ToastService } from '../services/toast.service';
import { Icon } from './icon';

/**
 * "Condividi Chordsheet": the app's address as a QR code to scan with another
 * phone, or as a link to send or copy. The address comes from document.baseURI
 * (the <base href> of the page), so it is always the one the app runs on and
 * never has to be remembered or written down anywhere.
 */
@Component({
  selector: 'app-share-app-sheet',
  imports: [Icon],
  template: `
    <dialog #dialog class="sheet" (click)="onBackdrop($event)" [attr.aria-label]="t.title">
      <header class="bar">
        <h2>{{ t.title }}</h2>
        <button type="button" class="btn done" (click)="close()">{{ IT.setlists.done }}</button>
      </header>
      <div class="qr with-top-gap" [attr.aria-label]="t.qrLabel" role="img">
        @if (qr(); as qr) {
          <svg [attr.viewBox]="'-2 -2 ' + (qr.size + 4) + ' ' + (qr.size + 4)" shape-rendering="crispEdges">
            <rect x="-2" y="-2" [attr.width]="qr.size + 4" [attr.height]="qr.size + 4" class="qr-bg" />
            <path [attr.d]="qr.path" class="qr-fg" />
          </svg>
        } @else if (failed()) {
          <p class="qr-error">{{ s.qrError }}</p>
        }
      </div>
      <p class="hint">{{ t.hint }}</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" (click)="shareLink()"><app-icon name="share" /> {{ s.shareLink }}</button>
        <button type="button" class="btn btn-secondary" (click)="copyLink()"><app-icon name="copy" /> {{ s.copyLink }}</button>
      </div>
    </dialog>
  `,
  styleUrl: './qr-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareAppSheet {
  private readonly toast = inject(ToastService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly IT = IT;
  protected readonly t = IT.shareApp;
  protected readonly s = IT.shareSetlist;
  protected readonly qr = signal<Qr | null>(null);
  protected readonly failed = signal(false);

  private get url(): string {
    return document.baseURI;
  }

  async open(): Promise<void> {
    this.dialog().nativeElement.showModal();
    if (this.qr()) return;
    this.failed.set(false);
    try {
      this.qr.set(await makeQr(this.url));
    } catch {
      this.failed.set(true);
    }
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  /** iPhone/iPad: the share sheet (WhatsApp, Messaggi, AirDrop…); elsewhere: copy. */
  protected async shareLink(): Promise<void> {
    if (navigator.share) {
      try {
        await navigator.share({ title: IT.appName, text: this.t.shareText, url: this.url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    await this.copyLink();
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url);
      this.toast.show(this.s.copied);
    } catch {
      this.toast.show(this.s.copyFailed);
    }
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }
}

import { TestBed } from '@angular/core/testing';
import { ShareAppSheet } from './share-app-sheet';

function setup() {
  // jsdom has no showModal/close on <dialog>.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const fixture = TestBed.createComponent(ShareAppSheet);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el };
}

describe('ShareAppSheet', () => {
  it('shows a QR code when opened', async () => {
    const { fixture, el } = setup();
    await fixture.componentInstance.open();
    fixture.detectChanges();
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    expect(el.querySelector('.qr-fg')?.getAttribute('d')).toContain('M');
  });

  it('copies the address the app runs on', async () => {
    const { el } = setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    el.querySelector<HTMLButtonElement>('.btn-secondary')!.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(document.baseURI);
  });
});

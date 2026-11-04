import { TestBed } from '@angular/core/testing';
import { ActionSheet } from './action-sheet';

describe('ActionSheet', () => {
  it('a choice that opens the sheet again is not cancelled by the late "close" event', async () => {
    const fixture = TestBed.createComponent(ActionSheet);
    fixture.detectChanges();
    const sheet = fixture.componentInstance;
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    // jsdom has no <dialog> behaviour: model open / close / the queued "close" event.
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => {
      dialog.removeAttribute('open');
      setTimeout(() => dialog.dispatchEvent(new Event('close'))); // fired later, as in browsers
    };

    const first = sheet.choose('Mostra', [{ id: 'options', label: 'Opzioni', icon: 'more' }], 'Annulla');
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.menu-item')!.click();
    expect(await first).toBe('options');

    // Opened again straight away (like "Opzioni di …" → folder options).
    let second: string | null | undefined;
    void sheet.choose('Private', [{ id: 'rename', label: 'Rinomina', icon: 'edit' }], 'Annulla').then((v) => (second = v));
    await new Promise((r) => setTimeout(r, 10)); // the late "close" of the first one arrives
    expect(dialog.open).toBe(true);
    expect(second).toBeUndefined(); // still waiting for an answer

    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.menu-item')!.click();
    await Promise.resolve();
    expect(second).toBe('rename');
  });
});

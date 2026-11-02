import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BackupService } from '../services/backup.service';
import { LibraryService } from '../services/library.service';
import { HintBanner } from './hint-banner';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DAY = 86_400_000;

function setup(opts: { createdAt: number; lastBackupAt?: number }) {
  const exported = vi.fn().mockResolvedValue(undefined);
  TestBed.configureTestingModule({
    imports: [HintBanner],
    providers: [
      { provide: LibraryService, useValue: { isEmpty: signal(false), songs: signal([{ createdAt: opts.createdAt }]) } },
      {
        provide: BackupService,
        useValue: { autoStatus: signal('off'), lastBackupAt: signal(opts.lastBackupAt), export: exported },
      },
    ],
  });
  const fixture = TestBed.createComponent(HintBanner);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, exported };
}

describe('HintBanner', () => {
  const original = navigator.userAgent;
  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true });
  });

  it('suggests "Aggiungi alla schermata Home" in iPhone Safari, and remembers dismissal', () => {
    Object.defineProperty(navigator, 'userAgent', { value: IPHONE, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    const { fixture, el } = setup({ createdAt: Date.now() });
    expect(el.textContent).toContain('Aggiungi alla schermata Home');

    el.querySelector<HTMLButtonElement>('[aria-label="Non mostrare più"]')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.hint')).toBeNull();
    expect(localStorage.getItem('innario.dismissedHints')).toBe('["install"]');
  });

  it('reminds to make a backup after 14 days; "Più tardi" snoozes it', () => {
    const { fixture, el, exported } = setup({ createdAt: Date.now() - 30 * DAY, lastBackupAt: Date.now() - 20 * DAY });
    expect(el.textContent).toContain('Ultimo backup: 20 giorni fa');
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Crea un backup'))!.click();
    expect(exported).toHaveBeenCalled();

    el.querySelector<HTMLButtonElement>('[aria-label="Più tardi"]')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.hint')).toBeNull();
    expect(Number(localStorage.getItem('innario.backupSnoozedUntil'))).toBeGreaterThan(Date.now() + 13 * DAY);
  });

  it('no reminder for recent data', () => {
    const { el } = setup({ createdAt: Date.now() - 2 * DAY });
    expect(el.textContent).not.toContain('backup');
  });
});

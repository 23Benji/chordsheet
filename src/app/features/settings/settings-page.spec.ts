import { TestBed } from '@angular/core/testing';
import { DB } from '../../data/db';
import { LibraryService } from '../../services/library.service';
import { SettingsPage } from './settings-page';

describe('SettingsPage', () => {
  it('switches theme, chord style and accidentals (saved and applied)', async () => {
    const saved: unknown[] = [];
    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        { provide: DB, useValue: { settings: { get: async () => undefined, put: async (s: unknown) => void saved.push(s) } } },
        { provide: LibraryService, useValue: { bundledAvailable: async () => false } },
      ],
    });
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const click = async (text: string) => {
      Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === text)!.click();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    await click('Chiaro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    await click('Nel testo');
    await click('♭');
    expect(saved[saved.length - 1]).toMatchObject({ theme: 'light', chordStyle: 'inline', accidentals: 'flats' });
    expect(el.querySelector('.about')?.textContent).toContain('Versione');
    await click('Scuro');
  });
});

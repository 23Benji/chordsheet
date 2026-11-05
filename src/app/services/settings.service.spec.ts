import { TestBed } from '@angular/core/testing';
import { resolveTheme } from '../core/models';
import { DB } from '../data/db';
import { SettingsService } from './settings.service';

describe('Automatico theme', () => {
  it('Chiaro by day, Scuro in dark mode; a chosen theme stays as it is', () => {
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('paper', true)).toBe('paper');
  });

  it('follows the system switch live', async () => {
    let listener: (e: { matches: boolean }) => void = () => undefined;
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      addEventListener: (_: string, fn: typeof listener) => (listener = fn),
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    TestBed.configureTestingModule({
      providers: [{ provide: DB, useValue: { settings: { get: async () => undefined, put: async () => undefined } } }],
    });
    const settings = TestBed.inject(SettingsService);
    await settings.update({ theme: 'auto' });
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    listener({ matches: true }); // the phone goes dark at sunset
    TestBed.tick();
    expect(settings.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    window.matchMedia = original;
  });
});

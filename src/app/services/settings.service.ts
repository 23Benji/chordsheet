import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { STATUS_BAR_KEY, Settings, Theme, resolveTheme, statusBarStyle } from '../core/models';
import { DB } from '../data/db';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  textSize: 1,
  chordStyle: 'above',
  showChordDiagrams: true,
  keyboardMap: {},
  showNotes: true,
  accidentals: 'auto',
  collapseRepeats: false,
  lyricsOnly: false,
  instrument: 'guitar',
};

/** Global app settings (the settings page arrives in M5). */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly db = inject(DB);
  private readonly _settings = signal<Settings>(DEFAULT_SETTINGS);
  readonly settings = this._settings.asReadonly();

  /** The phone/computer is in dark mode (follows the system switch live). */
  private readonly systemDark = signal(false);
  /** The theme on screen: the chosen one, or for "Automatico" Chiaro / Scuro following the system. */
  readonly theme = computed<Theme>(() => resolveTheme(this._settings().theme, this.systemDark()));

  constructor() {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (dark) {
      this.systemDark.set(dark.matches);
      // Changes while the app is open too (iOS switches at sunset).
      dark.addEventListener?.('change', (e) => this.systemDark.set(e.matches));
    }
    // An effect re-runs whenever a signal it reads changes: keeps <html data-theme> in sync.
    effect(() => {
      const theme = this.theme();
      document.documentElement.setAttribute('data-theme', theme);
      // The iPhone status bar: black above the dark themes, white above the light ones.
      const style = statusBarStyle(theme);
      document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', style);
      try {
        localStorage.setItem(STATUS_BAR_KEY, style);
      } catch {
        // Private mode: the next start just begins with the default (black).
      }
      // The browser / status bar colour follows the theme's background.
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
    });
  }

  async load(): Promise<void> {
    const stored = await this.db.settings.get('settings');
    if (stored) {
      const { id: _id, ...settings } = stored;
      this._settings.set({ ...DEFAULT_SETTINGS, ...settings });
    }
  }

  async update(patch: Partial<Settings>): Promise<void> {
    const next = { ...this._settings(), ...patch };
    this._settings.set(next);
    await this.db.settings.put({ ...next, id: 'settings' });
  }
}

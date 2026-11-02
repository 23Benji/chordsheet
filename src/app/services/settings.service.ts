import { Injectable, effect, inject, signal } from '@angular/core';
import { Settings } from '../core/models';
import { DB } from '../data/db';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  fontScale: 1,
  chordStyle: 'above',
  showChordDiagrams: true,
  keyboardMap: {},
  showNotes: true,
  accidentals: 'auto',
};

/** Global app settings (the settings page arrives in M5). */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly db = inject(DB);
  private readonly _settings = signal<Settings>(DEFAULT_SETTINGS);
  readonly settings = this._settings.asReadonly();

  constructor() {
    // An effect re-runs whenever a signal it reads changes: keeps <html data-theme> in sync.
    effect(() => document.documentElement.setAttribute('data-theme', this._settings().theme));
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

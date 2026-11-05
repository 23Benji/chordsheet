import { TestBed } from '@angular/core/testing';
import { DB } from '../data/db';
import { HapticsService } from './haptics.service';
import { SettingsService } from './settings.service';

describe('HapticsService', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [{ provide: DB, useValue: { settings: { get: async () => undefined, put: async () => undefined } } }],
    });
    return { haptics: TestBed.inject(HapticsService), settings: TestBed.inject(SettingsService) };
  }
  afterEach(() => vi.unstubAllGlobals());

  it('Android: a 10 ms vibration; off in the settings: nothing', async () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, vibrate });
    const { haptics, settings } = setup();
    haptics.tick();
    expect(vibrate).toHaveBeenCalledWith(10);
    await settings.update({ haptics: false });
    haptics.tick();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('iPhone (no vibrate): clicks a hidden switch checkbox and removes it', () => {
    vi.stubGlobal('navigator', { ...navigator, vibrate: undefined });
    const clicks: Element[] = [];
    const onClick = (e: Event) => clicks.push(e.target as Element);
    document.addEventListener('click', onClick, true);
    setup().haptics.tick();
    document.removeEventListener('click', onClick, true);
    expect(clicks.some((el) => el.tagName === 'LABEL')).toBe(true);
    expect(document.head.querySelector('input[switch]')).toBeNull();
  });
});

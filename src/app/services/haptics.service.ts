import { Injectable, inject } from '@angular/core';
import { currentPlatform, isIos } from '../core/platform';
import { SettingsService } from './settings.service';

/**
 * A short "tick" under the finger, like iOS gives when you flip a switch.
 *
 * - Android (and any browser with the Vibration API): navigator.vibrate.
 * - iPhone: Safari has no vibrate(), but since iOS 18 tapping a switch-style
 *   checkbox (<input type="checkbox" switch>) makes the Taptic Engine tick,
 *   also in home-screen apps. So we click a hidden one. Unofficial: if Apple
 *   ever removes it, there's simply no tick. Like vibrate(), it only works
 *   during a tap (a user gesture), which is when we call it.
 *
 * Off in Impostazioni → "Vibrazione", and silent when the phone's own
 * system haptics are off.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly settings = inject(SettingsService);
  private readonly ios = isIos(currentPlatform());

  tick(): void {
    if (this.settings.settings().haptics === false) return;
    // iPhone: always the switch (a vibrate() there, if it ever appears, may do nothing).
    if (!this.ios && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
      return;
    }
    switchTick();
  }
}

function switchTick(): void {
  try {
    // Drawn but invisible and out of the way (iOS may skip the tick for a
    // switch that isn't rendered at all, e.g. display: none).
    const label = document.createElement('label');
    label.ariaHidden = 'true';
    label.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01;overflow:hidden;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // No tick, nothing else lost.
  }
}

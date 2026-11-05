import { Directive, inject } from '@angular/core';
import { HapticsService } from '../services/haptics.service';

/** `appHaptic` on a button: a short tick when it's tapped (see HapticsService). */
@Directive({
  selector: '[appHaptic]',
  host: { '(click)': 'haptics.tick()' },
})
export class Haptic {
  protected readonly haptics = inject(HapticsService);
}

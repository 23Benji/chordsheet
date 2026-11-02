import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  it('hides plain toasts after a while; keeps toasts with an action until used', () => {
    vi.useFakeTimers();
    const toast = TestBed.inject(ToastService);
    toast.show('Salvato', 1000);
    vi.advanceTimersByTime(1001);
    expect(toast.toast()).toBeNull();

    const run = vi.fn();
    toast.show('Nuova versione disponibile.', 0, { label: 'Aggiorna', run });
    vi.advanceTimersByTime(60000);
    expect(toast.toast()?.action?.label).toBe('Aggiorna');
    toast.runAction();
    expect(run).toHaveBeenCalled();
    expect(toast.toast()).toBeNull();
    vi.useRealTimers();
  });
});

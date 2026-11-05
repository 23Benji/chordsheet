import { TestBed } from '@angular/core/testing';
import { AppErrorHandler } from './app-error-handler';
import { ToastService } from './toast.service';

describe('AppErrorHandler', () => {
  it('real errors: "Ricarica" message, not repeated for a while; harmless ones: only logged', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: [AppErrorHandler] });
    const handler = TestBed.inject(AppErrorHandler);
    const toast = TestBed.inject(ToastService);

    handler.handleError(Object.assign(new Error(), { name: 'AbortError' })); // closed share sheet
    expect(toast.toast()).toBeNull();

    handler.handleError(new TypeError("Cannot read properties of undefined (reading 'id')"));
    expect(toast.toast()?.message).toContain('Qualcosa non ha funzionato');
    expect(toast.toast()?.action?.label).toBe('Ricarica');

    toast.dismiss();
    handler.handleError(new Error('the same fault again'));
    expect(toast.toast()).toBeNull(); // quiet for 30 s
  });
});

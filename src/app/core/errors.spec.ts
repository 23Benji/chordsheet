import { isHarmless, isStaleVersion, unwrapError } from './errors';

const named = (name: string, message = '') => Object.assign(new Error(message), { name });

describe('unexpected errors', () => {
  it('normal browser life is harmless: closed share sheet, late share, ResizeObserver', () => {
    expect(isHarmless(named('AbortError'))).toBe(true);
    expect(isHarmless({ reason: named('NotAllowedError') })).toBe(true); // an unhandled promise rejection
    expect(isHarmless(new Error('ResizeObserver loop completed with undelivered notifications.'))).toBe(true);
  });

  it('real failures are not', () => {
    expect(isHarmless(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(false);
    expect(isHarmless(named('QuotaExceededError'))).toBe(false);
    expect(isHarmless('boom')).toBe(false);
  });

  it('recognises a page left over from the previous version', () => {
    expect(isStaleVersion(new TypeError('Failed to fetch dynamically imported module: https://x/chunk-ABC.js'))).toBe(true);
    expect(isStaleVersion(new TypeError('Importing a module script failed.'))).toBe(true); // Safari
    expect(isStaleVersion(new Error('other'))).toBe(false);
  });

  it('unwraps rejections', () => {
    const e = new Error('x');
    expect(unwrapError({ reason: e })).toBe(e);
    expect(unwrapError(e)).toBe(e);
  });
});

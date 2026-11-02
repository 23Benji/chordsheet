import { DEFAULT_KEYMAP, actionFor, assignKey, effectiveKeymap, keyLabel, keysFor, unassignKey } from './keymap';

describe('keymap', () => {
  it('uses the defaults until the user changes something', () => {
    const map = effectiveKeymap({});
    expect(actionFor(map, ' ')).toBe('next');
    expect(actionFor(map, 'PageUp')).toBe('prev');
    expect(actionFor(map, 'S')).toBe('autoscroll'); // case-insensitive
    expect(actionFor(map, 'x')).toBeNull();
    expect(effectiveKeymap({ q: 'next', bogus: 'fly' })).toEqual({ q: 'next' });
  });

  it('moves a key to a new action and removes keys', () => {
    let map = assignKey(DEFAULT_KEYMAP, 'ArrowDown', 'autoscroll');
    expect(actionFor(map, 'ArrowDown')).toBe('autoscroll');
    expect(keysFor(map, 'next')).not.toContain('ArrowDown');
    map = unassignKey(map, ' ');
    expect(actionFor(map, ' ')).toBeNull();
  });

  it('labels keys in Italian', () => {
    expect([' ', 'PageDown', 'ArrowLeft', 's'].map(keyLabel)).toEqual(['Spazio', 'Pagina giù', '←', 'S']);
  });
});

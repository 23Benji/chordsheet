import { describe, expect, it } from 'vitest';
import { addDigit, songForNumber, startsNumberJump } from './number-jump';
import { groupVersions } from './versions';

const song = (id: string, number: number | null, suffix = '') => ({ id, number, suffix });
const groups = groupVersions([song('a', 12), song('b', 123, 'b'), song('c', 123), song('d', 7, 'b'), song('e', null)]);

describe('addDigit', () => {
  it('adds digits up to four', () => {
    expect(addDigit('', '1')).toBe('1');
    expect(addDigit('12', '3')).toBe('123');
    expect(addDigit('1234', '5')).toBe('1234');
  });

  it('ignores other keys and a leading zero', () => {
    expect(addDigit('', 'a')).toBeNull();
    expect(addDigit('1', 'Enter')).toBeNull();
    expect(addDigit('', '0')).toBeNull();
    expect(addDigit('1', '0')).toBe('10');
  });
});

describe('songForNumber', () => {
  it('finds the main version', () => {
    expect(songForNumber(groups, '123')?.id).toBe('c');
    expect(songForNumber(groups, '12')?.id).toBe('a');
  });

  it('takes the first version when there is no plain one', () => {
    expect(songForNumber(groups, '7')?.id).toBe('d');
  });

  it('is null for unknown numbers or nothing typed', () => {
    expect(songForNumber(groups, '999')).toBeNull();
    expect(songForNumber(groups, '')).toBeNull();
  });
});

describe('startsNumberJump', () => {
  const base = { key: '4', modifier: false, typing: false, dialogOpen: false, url: '/' };

  it('starts on a digit in the library, a song, setlists', () => {
    expect(startsNumberJump(base)).toBe(true);
    expect(startsNumberJump({ ...base, url: '/canto/abc' })).toBe(true);
    expect(startsNumberJump({ ...base, url: '/scalette/xyz' })).toBe(true);
  });

  it('not while typing, with a modifier, over a dialog, or for other keys', () => {
    expect(startsNumberJump({ ...base, typing: true })).toBe(false);
    expect(startsNumberJump({ ...base, modifier: true })).toBe(false);
    expect(startsNumberJump({ ...base, dialogOpen: true })).toBe(false);
    expect(startsNumberJump({ ...base, key: 's' })).toBe(false);
    expect(startsNumberJump({ ...base, key: '0' })).toBe(false);
  });

  it('not in the editor or in presentation mode', () => {
    expect(startsNumberJump({ ...base, url: '/nuovo' })).toBe(false);
    expect(startsNumberJump({ ...base, url: '/canto/abc/modifica' })).toBe(false);
    expect(startsNumberJump({ ...base, url: '/canto/abc/modifica?from=x' })).toBe(false);
    expect(startsNumberJump({ ...base, url: '/canto/abc/esibizione' })).toBe(false);
  });
});

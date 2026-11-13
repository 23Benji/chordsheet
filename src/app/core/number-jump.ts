// "Vai al numero" (computer keyboard): type a song's number anywhere and it
// opens. Pure functions, unit-tested (the box on screen is ui/number-jump.ts).

import { Versioned, mainVersion } from './versions';

/** The songbook's numbers have at most 4 digits. */
export const NUMBER_JUMP_MAX_DIGITS = 4;
/** Stop typing this long and the song opens by itself (Enter opens it right away). */
export const NUMBER_JUMP_DELAY_MS = 1500;

/** The digits typed so far plus one more key; null when the key isn't a digit that can be added. */
export function addDigit(digits: string, key: string): string | null {
  if (!/^[0-9]$/.test(key)) return null;
  if (digits === '' && key === '0') return null; // no song 0, and "07" would read oddly
  if (digits.length >= NUMBER_JUMP_MAX_DIGITS) return digits;
  return digits + key;
}

/** The song with that number (its main version, as the library shows it), or null. */
export function songForNumber<T extends Versioned>(groups: ReadonlyMap<number, readonly T[]>, digits: string): T | null {
  if (!digits) return null;
  const group = groups.get(Number(digits));
  return group?.length ? mainVersion(group) : null;
}

export interface JumpContext {
  key: string;
  /** Ctrl / Cmd / Alt held: a shortcut, not a number. */
  modifier: boolean;
  /** Focus is in a text field. */
  typing: boolean;
  /** A dialog or sheet is open. */
  dialogOpen: boolean;
  url: string;
}

/**
 * Whether a digit key starts a jump: not while writing, not in the editor
 * (digits are lyrics there), not in presentation mode (a stray key on stage
 * must never change the song — Benji's choice), not over a dialog.
 */
export function startsNumberJump(context: JumpContext): boolean {
  if (context.modifier || context.typing || context.dialogOpen) return false;
  const path = context.url.split(/[?#]/)[0];
  if (/^\/nuovo|\/modifica$|\/esibizione$/.test(path)) return false;
  return addDigit('', context.key) !== null;
}

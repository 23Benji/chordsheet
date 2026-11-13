// Keys for performance mode. Bluetooth page-turner pedals (AirTurn, PageFlip
// …) behave like a keyboard and send keys such as PageDown or arrows, so the
// mapping is configurable (Settings.keyboardMap: key → action).

export type KeyAction = 'next' | 'prev' | 'autoscroll' | 'slower' | 'faster';
export const KEY_ACTIONS: KeyAction[] = ['next', 'prev', 'autoscroll', 'slower', 'faster'];
export type KeyMap = Record<string, KeyAction>;

export const DEFAULT_KEYMAP: KeyMap = {
  ' ': 'next',
  PageDown: 'next',
  ArrowRight: 'next',
  ArrowDown: 'next',
  PageUp: 'prev',
  ArrowLeft: 'prev',
  ArrowUp: 'prev',
  s: 'autoscroll',
  '[': 'slower',
  ']': 'faster',
};

/** Letters are case-insensitive ("S" with Caps Lock = "s"). */
export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/** The stored map, or the defaults when the user never changed it. */
export function effectiveKeymap(stored: Record<string, string> | undefined): KeyMap {
  const entries = Object.entries(stored ?? {}).filter(([, action]) => KEY_ACTIONS.includes(action as KeyAction));
  return entries.length ? (Object.fromEntries(entries) as KeyMap) : { ...DEFAULT_KEYMAP };
}

export function actionFor(map: KeyMap, key: string): KeyAction | null {
  return map[normalizeKey(key)] ?? null;
}

export function keysFor(map: KeyMap, action: KeyAction): string[] {
  return Object.keys(map).filter((key) => map[key] === action);
}

/** A key belongs to one action only: assigning it moves it. */
export function assignKey(map: KeyMap, key: string, action: KeyAction): KeyMap {
  return { ...map, [normalizeKey(key)]: action };
}

export function unassignKey(map: KeyMap, key: string): KeyMap {
  const next = { ...map };
  delete next[key];
  return next;
}

/** Keys that can't be assigned (they're needed to leave full screen, use dialogs, type a song's number, …). */
export function isReservedKey(key: string): boolean {
  return ['Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Enter'].includes(key) || /^[0-9]$/.test(key);
}

const LABELS: Record<string, string> = {
  ' ': 'Spazio',
  PageDown: 'Pagina giù',
  PageUp: 'Pagina su',
  ArrowRight: '→',
  ArrowLeft: '←',
  ArrowDown: '↓',
  ArrowUp: '↑',
  Home: 'Inizio',
  End: 'Fine',
  Backspace: '⌫',
};

export function keyLabel(key: string): string {
  return LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

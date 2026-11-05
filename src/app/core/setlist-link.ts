// A setlist inside a link (and so inside a QR code): no server needed.
//
//   https://…/chordsheet/scaletta-condivisa#1.<data>
//
// <data> is the setlist in a compact JSON form, compressed (deflate) and
// written in base64url (letters, digits, - and _ only, safe in a URL). It
// sits after "#": browsers never send that part to the web server, so the
// setlist only travels from phone to phone. Songs are referred to by number
// (+ version letter), like the shared setlist files; the title is added only
// for songs without a number. "0." instead of "1." = not compressed (for
// browsers without CompressionStream).

import { SETLIST_FORMAT, SharedSetlist } from './setlists';

/** The route that opens a shared setlist. */
export const SHARED_SETLIST_PATH = 'scaletta-condivisa';

/** Compact form: short keys, one array per song: [number, title?, transpose (null = not set)?, note?]. */
interface Compact {
  n: string;
  d?: string;
  i: Row[];
}

type Row = [string, string?, (number | null)?, string?];

function toCompact(setlist: SharedSetlist): Compact {
  return {
    n: setlist.name,
    ...(setlist.date ? { d: setlist.date } : {}),
    i: setlist.items.map((item) => {
      const row: Row = [item.number, item.number ? '' : item.title];
      if (item.transpose !== undefined || item.note) row.push(item.transpose ?? null);
      if (item.note) row.push(item.note);
      // Drop the empty title at the end ("12", not "12","").
      while (row.length > 1 && (row[row.length - 1] === '' || row[row.length - 1] === undefined || row[row.length - 1] === null)) row.pop();
      return row;
    }),
  };
}

function fromCompact(data: Compact): SharedSetlist {
  if (!data || typeof data.n !== 'string' || !Array.isArray(data.i)) throw new Error('not-a-setlist');
  return {
    format: SETLIST_FORMAT,
    version: 1,
    name: data.n,
    ...(typeof data.d === 'string' ? { date: data.d } : {}),
    items: data.i.map(([number, title, transpose, note]) => ({
      number: String(number ?? ''),
      title: String(title ?? ''),
      ...(Number.isInteger(transpose) ? { transpose: transpose as number } : {}),
      ...(note ? { note: String(note) } : {}),
    })),
  };
}

const toBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string) => {
  const b64 = text.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

/** Runs bytes through a (de)compression stream: write everything in, read everything out. */
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(bytes as BufferSource).catch(() => undefined);
  void writer.close().catch(() => undefined);
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) chunks.push(r.value);
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** The part after "#". */
export async function encodeSetlistLink(setlist: SharedSetlist): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toCompact(setlist)));
  if (!canCompress()) return `0.${toBase64Url(json)}`;
  return `1.${toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`;
}

/** Reads the part after "#"; throws when it isn't a setlist link. */
export async function decodeSetlistLink(hash: string): Promise<SharedSetlist> {
  const text = hash.replace(/^#/, '');
  const [version, data] = [text.slice(0, 2), text.slice(2)];
  if (!data || (version !== '0.' && version !== '1.')) throw new Error('not-a-setlist');
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(data);
    if (version === '1.') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  } catch {
    throw new Error('not-a-setlist');
  }
  let compact: Compact;
  try {
    compact = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('not-a-setlist');
  }
  return fromCompact(compact);
}

/** The "1.…" part of a setlist link found in any text (a message, a pasted address), or null. */
export function linkFragment(text: string): string | null {
  const match = new RegExp(`${SHARED_SETLIST_PATH}#([01]\\.[A-Za-z0-9_-]+)`).exec(text ?? '');
  return match ? match[1] : null;
}

/** The full address to share, from the app's base address (document.baseURI). */
export function setlistLinkUrl(baseUri: string, encoded: string): string {
  return `${new URL(SHARED_SETLIST_PATH, baseUri).href}#${encoded}`;
}

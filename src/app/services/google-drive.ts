// Google sign-in (OAuth 2.0) and the one sync file in Google Drive's hidden
// "app data" folder. Plain fetch() calls, no Google library.
//
// Sign-in uses the "authorization code" flow with PKCE: the whole page goes to
// Google, the user says yes, Google sends the page back with a one-time
// `?code=…`, and we swap it for two tokens:
// - an access token (valid 1 hour) sent with every Drive request;
// - a refresh token (stays valid) kept on this device to get new access tokens
//   silently, so the user signs in only once per device.
//
// The scope `drive.appdata` only reaches a hidden folder that belongs to this
// app: Chordsheet can't see the user's other Drive files, and other apps can't
// see this folder.

import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from './sync-config';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata openid email';
const FILE_NAME = 'chordsheet-sync.json';
/** Survives the trip to Google and back (localStorage: on iPhone the trip may change tab). */
const PENDING_KEY = 'chordsheet.oauthPending';

export interface GoogleAuth {
  refreshToken: string;
  email: string | null;
}

/** Thrown when the sign-in is no longer valid (revoked, password changed…): sign in again. */
export class SignInRequired extends Error {
  constructor() {
    super('sign-in-required');
  }
}

/** The address Google sends the user back to: the app's start page. */
export function redirectUri(): string {
  return new URL(document.baseURI).href;
}

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

function randomString(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** Goes to Google's sign-in page (the app reloads when it comes back). */
export async function startSignIn(): Promise<void> {
  const verifier = randomString();
  const state = randomString();
  localStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline', // → a refresh token
    prompt: 'consent select_account',
  });
  location.assign(`${AUTH_URL}?${params}`);
}

/**
 * Called at start-up. If Google just sent the user back (?code=…&state=…),
 * removes the parameters from the address and returns the new sign-in;
 * otherwise null. Throws if Google reported an error or the exchange failed.
 */
export async function finishSignIn(fetchFn: typeof fetch = fetch): Promise<GoogleAuth | null> {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  if (!state || (!code && !error)) return null;
  const pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as { verifier: string; state: string } | null;
  if (!pending || pending.state !== state) return null; // not ours
  localStorage.removeItem(PENDING_KEY);
  for (const p of ['code', 'state', 'scope', 'authuser', 'prompt', 'hd', 'error', 'iss']) url.searchParams.delete(p);
  history.replaceState(history.state, '', url.href);
  if (error || !code) throw new Error(error ?? 'no-code');

  const tokens = await postToken(fetchFn, {
    grant_type: 'authorization_code',
    code,
    code_verifier: pending.verifier,
    redirect_uri: redirectUri(),
  });
  if (!tokens.refresh_token) throw new Error('no-refresh-token');
  return { refreshToken: tokens.refresh_token, email: emailFromIdToken(tokens.id_token) };
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

async function postToken(fetchFn: typeof fetch, body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, ...body }),
  });
  if (response.status === 400 || response.status === 401) throw new SignInRequired();
  if (!response.ok) throw new Error(`token-${response.status}`);
  return response.json();
}

/** The id token is a JWT: its middle part is base64 JSON with the user's e-mail (display only). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const payload = idToken!.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
    const json = new TextDecoder().decode(Uint8Array.from(atob(payload), (c) => c.charCodeAt(0)));
    return JSON.parse(json).email ?? null;
  } catch {
    return null;
  }
}

/** Reads and writes the sync file with a valid access token (renewed when needed). */
export class DriveClient {
  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor(
    private readonly auth: GoogleAuth,
    private readonly fetchFn: typeof fetch = fetch.bind(globalThis),
  ) {}

  private async token(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - 60_000) return this.accessToken;
    const tokens = await postToken(this.fetchFn, { grant_type: 'refresh_token', refresh_token: this.auth.refreshToken });
    this.accessToken = tokens.access_token;
    this.expiresAt = Date.now() + tokens.expires_in * 1000;
    return this.accessToken;
  }

  private async call(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.fetchFn(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${await this.token()}` },
    });
    if (response.status === 401) throw new SignInRequired();
    if (!response.ok) throw new Error(`drive-${response.status}`);
    return response;
  }

  /** The sync file's id, or null when no device has synced yet. */
  async findFile(): Promise<string | null> {
    const q = new URLSearchParams({ spaces: 'appDataFolder', q: `name = '${FILE_NAME}'`, fields: 'files(id)', pageSize: '1' });
    const { files } = (await (await this.call(`${FILES_URL}?${q}`)).json()) as { files: { id: string }[] };
    return files[0]?.id ?? null;
  }

  async download(id: string): Promise<string> {
    return (await this.call(`${FILES_URL}/${id}?alt=media`)).text();
  }

  /** Creates the file (id null) or replaces its content; returns the id. */
  async upload(id: string | null, json: string): Promise<string> {
    if (id) {
      await this.call(`${UPLOAD_URL}/${id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      });
      return id;
    }
    // New file: metadata (name, hidden folder) and content in one "multipart" request.
    const boundary = `chordsheet${randomString()}`;
    const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
    const response = await this.call(`${UPLOAD_URL}?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return ((await response.json()) as { id: string }).id;
  }

  /** "Esci": tells Google to forget this device's sign-in (best effort). */
  async revoke(): Promise<void> {
    await this.fetchFn(`${REVOKE_URL}?token=${encodeURIComponent(this.auth.refreshToken)}`, { method: 'POST' }).catch(() => undefined);
  }
}

import { DriveClient, emailFromIdToken } from './google-drive';

/** A fake fetch that records the calls and answers from a list of handlers. */
function fakeFetch(answer: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return answer(url, init);
  }) as typeof fetch;
  return { fn, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('DriveClient', () => {
  it('gets an access token once, then reads and writes the sync file in the hidden app folder', async () => {
    const { fn, calls } = fakeFetch((url, init) => {
      if (url.includes('oauth2.googleapis.com/token')) return json({ access_token: 'tok', expires_in: 3600 });
      if (url.includes('/upload/') && init.method === 'POST') return json({ id: 'new-file', version: '1' });
      if (url.includes('/upload/')) return json({ id: 'new-file', version: '2' });
      if (url.includes('alt=media')) return new Response('{"x":1}');
      return json({ files: [] });
    });
    const drive = new DriveClient({ refreshToken: 'refresh', email: null }, fn);

    expect(await drive.findFile()).toBeNull();
    expect(await drive.upload(null, '{}')).toEqual({ id: 'new-file', version: '1' });
    expect(await drive.upload('new-file', '{"a":1}')).toEqual({ id: 'new-file', version: '2' });
    expect(await drive.download('new-file')).toBe('{"x":1}');

    expect(calls.filter((c) => c.url.includes('/token')).length).toBe(1); // token reused
    expect(calls[1].url).toContain('spaces=appDataFolder');
    expect(decodeURIComponent(calls[1].url)).toContain('files(id,version)');
    const create = calls.find((c) => c.init.method === 'POST' && c.url.includes('/upload/'))!;
    expect(String(create.init.body)).toContain('"parents":["appDataFolder"]');
    expect((create.init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
    expect(calls.find((c) => c.init.method === 'PATCH')!.init.body).toBe('{"a":1}');
  });

  it('asks to sign in again when Google refuses the refresh token', async () => {
    const { fn } = fakeFetch(() => json({ error: 'invalid_grant' }, 400));
    const drive = new DriveClient({ refreshToken: 'revoked', email: null }, fn);
    await expect(drive.findFile()).rejects.toThrow('sign-in-required');
  });
});

describe('emailFromIdToken', () => {
  it('reads the e-mail from the token payload', () => {
    const payload = btoa(JSON.stringify({ email: 'benji@example.com' })).replace(/=+$/, '');
    expect(emailFromIdToken(`h.${payload}.s`)).toBe('benji@example.com');
    expect(emailFromIdToken(undefined)).toBeNull();
  });
});

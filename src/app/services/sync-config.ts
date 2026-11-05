// Google sign-in for the sync (see google-drive.ts). Kept in its own tiny file
// so the start-up bundle only needs these two strings: the sync code itself is
// loaded on demand with import().

/** From Google Cloud Console → Credentials (public values for a browser app). Empty = sync hidden. */
export const GOOGLE_CLIENT_ID: string = '';
/**
 * Google requires it for web clients even with PKCE. In an app without a
 * server it can't be kept secret; that's acceptable here because Google only
 * sends codes to the redirect addresses registered for this client (our own
 * GitHub Pages site), so the value alone gives nobody access to anyone's data.
 */
export const GOOGLE_CLIENT_SECRET: string = '';

export const syncAvailable = () => GOOGLE_CLIENT_ID !== '';

/** Google sent the user back to the app after signing in (or cancelling). */
export const isSignInReturn = (href: string) => /[?&]state=/.test(href) && /[?&](code|error)=/.test(href);

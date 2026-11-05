// Google sign-in for the sync (see google-drive.ts). Kept in its own tiny file
// so the start-up bundle only needs these two strings: the sync code itself is
// loaded on demand with import().

/** From Google Cloud Console → Google Auth Platform → Client (a public value). */
export const GOOGLE_CLIENT_ID: string = '1036367655047-67hph5207h05rufq5l1p8gfs22ngg5v7.apps.googleusercontent.com';
/**
 * Google requires it for web clients even with PKCE. In an app without a
 * server it can't be kept secret; that's acceptable here because Google only
 * sends codes to the redirect addresses registered for this client (our own
 * GitHub Pages site), so the value alone gives nobody access to anyone's data.
 *
 * It is still kept out of git: the deploy workflow replaces the placeholder
 * with the repository's Actions secret GOOGLE_CLIENT_SECRET just before
 * building. Without it (local builds, secret not set) the sync stays hidden.
 */
export const GOOGLE_CLIENT_SECRET: string = '__GOOGLE_CLIENT_SECRET__';

export const syncAvailable = () =>
  GOOGLE_CLIENT_ID !== '' && GOOGLE_CLIENT_SECRET !== '' && !GOOGLE_CLIENT_SECRET.startsWith('__');

/** Google sent the user back to the app after signing in (or cancelling). */
export const isSignInReturn = (href: string) => /[?&]state=/.test(href) && /[?&](code|error)=/.test(href);

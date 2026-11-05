import { IT } from './i18n/it';

/**
 * The app could not start (usually IndexedDB can't be opened: private mode,
 * no space): a plain page with what happened and "Ricarica", instead of a
 * blank screen. Plain DOM, because Angular is exactly what failed (the
 * design tokens are already there: styles.css loads before the app).
 */
export function showStartError(): void {
  const t = IT.errors;
  const box = document.createElement('main');
  box.setAttribute('role', 'alert');
  box.style.cssText =
    'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;' +
    'padding:32px;box-sizing:border-box;background:var(--bg);color:var(--text);text-align:center;font-family:system-ui,sans-serif';
  const title = document.createElement('h1');
  title.textContent = t.startTitle;
  title.style.cssText = 'margin:0;font-size:24px';
  const text = document.createElement('p');
  text.textContent = t.startText;
  text.style.cssText = 'margin:0;max-width:380px;color:var(--text-muted);line-height:1.45';
  const button = document.createElement('button');
  button.textContent = t.reload;
  button.style.cssText = 'min-height:44px;padding:0 24px;border:0;border-radius:12px;background:var(--accent);color:var(--accent-ink);font:inherit;font-weight:700';
  button.addEventListener('click', () => location.reload());
  box.append(title, text, button);
  document.body.replaceChildren(box);
}

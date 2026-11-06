import { Injectable, signal } from '@angular/core';

/** UI layout state shared between the sidebar and the song view. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  /**
   * Wide screens start with the library visible; on phones/iPad portrait it
   * slides over the page, so it opens by itself only on the home page.
   */
  readonly sidebarOpen = signal(
    window.matchMedia?.('(min-width: 900px)').matches !== false ||
      location.pathname === new URL(document.baseURI).pathname,
  );
  /**
   * iPhone layout (≤600px, same breakpoint as the bottom bar). There the
   * library is a page, not a drawer: it shows exactly when the URL is "/".
   */
  readonly phone = signal(false);
  /** Show the app (editor …) even with an empty library: "scrivi il primo canto". */
  readonly forceShell = signal(false);
  /** The opening animation is on screen (the start screen waits to animate until it's gone). */
  readonly introPlaying = signal(false);
  /**
   * Keep the start screen up although songs have arrived: it shows "142 canti
   * arrivati" for a moment, then lets the library come in (see Welcome).
   */
  readonly holdWelcome = signal(false);
  /** The library was just reached from the start screen: it fades in instead of popping up. */
  readonly fromWelcome = signal(false);
  /** Bumped to ask the library search box to take focus (e.g. after pressing "/"). */
  readonly focusSearch = signal(0);
  /** Bumped when "Libreria" is tapped in the bottom bar while already there: back to the top. */
  readonly libraryToTop = signal(0);

  constructor() {
    const query = window.matchMedia?.('(max-width: 600px)');
    if (query) {
      this.phone.set(query.matches);
      query.addEventListener?.('change', (e) => this.phone.set(e.matches));
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }
}

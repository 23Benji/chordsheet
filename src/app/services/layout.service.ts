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
  /** Show the app (editor …) even with an empty library: "scrivi il primo canto". */
  readonly forceShell = signal(false);
  /** Bumped to ask the library search box to take focus (e.g. after pressing "/"). */
  readonly focusSearch = signal(0);

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }
}

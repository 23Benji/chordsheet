import { Routes } from '@angular/router';
import type { EditorPage } from './features/editor/editor-page';

export const routes: Routes = [
  // Loaded on its own: phones never show it (the library covers it there).
  { path: '', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
  {
    path: 'canto/:id',
    // Lazy-loaded: the song view is downloaded only when first needed.
    loadComponent: () => import('./features/song/song-view').then((m) => m.SongView),
  },
  {
    path: 'canto/:id/modifica',
    loadComponent: () => import('./features/editor/editor-page').then((m) => m.EditorPage),
    // Ask before leaving with unsaved changes (the component decides).
    canDeactivate: [(page: EditorPage) => page.canLeave()],
  },
  {
    path: 'canto/:id/esibizione',
    loadComponent: () => import('./features/performance/performance-view').then((m) => m.PerformanceView),
  },
  {
    path: 'nuovo',
    loadComponent: () => import('./features/editor/editor-page').then((m) => m.EditorPage),
    canDeactivate: [(page: EditorPage) => page.canLeave()],
  },
  {
    path: 'scalette',
    loadComponent: () => import('./features/setlists/setlists-page').then((m) => m.SetlistsPage),
  },
  {
    // Before 'scalette/:id', or "statistiche" would be read as a setlist id.
    path: 'scalette/statistiche',
    loadComponent: () => import('./features/setlists/stats-page').then((m) => m.StatsPage),
  },
  {
    path: 'scalette/:id',
    loadComponent: () => import('./features/setlists/setlist-page').then((m) => m.SetlistPage),
  },
  {
    // A setlist received as a link or QR code (the data is after "#").
    path: 'scaletta-condivisa',
    loadComponent: () => import('./features/setlists/shared-setlist-page').then((m) => m.SharedSetlistPage),
  },
  {
    // "Trova accordo" (guitar): its tab/link shows only with Strumento = Chitarra.
    path: 'accordi',
    loadComponent: () => import('./features/chords/chord-finder-page').then((m) => m.ChordFinderPage),
  },
  {
    path: 'cestino',
    loadComponent: () => import('./features/library/trash-page').then((m) => m.TrashPage),
  },
  {
    path: 'impostazioni',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: '' },
];

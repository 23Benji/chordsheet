import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { AnnotationService } from './services/annotation.service';
import { LibraryService } from './services/library.service';
import { BackupService } from './services/backup.service';
import { FolderService } from './services/folder.service';
import { SetlistService } from './services/setlist.service';
import { SettingsService } from './services/settings.service';
import { SongPrefsService } from './services/song-prefs.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: route params (":id") arrive as component inputs.
    // PreloadAllModules: every lazy part (song view, editor …) is downloaded
    // right after start-up, so it works even if the connection drops.
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    // Load everything from IndexedDB before the first render (it takes a few ms),
    // so the UI never flashes an empty library.
    provideAppInitializer(() =>
      Promise.all([
        inject(LibraryService).load(),
        inject(SongPrefsService).load(),
        inject(AnnotationService).load(),
        inject(SettingsService).load(),
        inject(SetlistService).load(),
        inject(FolderService).load(),
        inject(BackupService).load(),
      ]),
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Start caching for offline use immediately on the first visit.
      registrationStrategy: 'registerImmediately',
    }),
  ],
};

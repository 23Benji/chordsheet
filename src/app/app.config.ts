import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { AnnotationService } from './services/annotation.service';
import { LibraryService } from './services/library.service';
import { BackupService } from './services/backup.service';
import { SetlistService } from './services/setlist.service';
import { SettingsService } from './services/settings.service';
import { SongPrefsService } from './services/song-prefs.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: route params (":id") arrive as component inputs.
    provideRouter(routes, withComponentInputBinding()),
    // Load everything from IndexedDB before the first render (it takes a few ms),
    // so the UI never flashes an empty library.
    provideAppInitializer(() =>
      Promise.all([
        inject(LibraryService).load(),
        inject(SongPrefsService).load(),
        inject(AnnotationService).load(),
        inject(SettingsService).load(),
        inject(SetlistService).load(),
        inject(BackupService).load(),
      ]),
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

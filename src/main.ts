import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => {
  console.error(err);
  // Loaded only when it's needed (the service worker has it cached offline).
  void import('./app/start-error').then((m) => m.showStartError());
});

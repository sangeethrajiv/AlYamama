import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { provideMockApiClient } from '@erp/web/api-client';
import { provideCore } from '@erp/web/core';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      appRoutes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
    ),
    // The NestJS /api/v1 backend is out of scope for this build: every feature talks to its mock adapter.
    provideMockApiClient(),
    provideCore(),
  ],
};

import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { provideHttpApiClient, provideMockApiClient } from '@erp/web/api-client';
import { provideCore } from '@erp/web/core';
import { appRoutes } from './app.routes';

/**
 * true: Contacts, Product and Accounting use the Express backend (`/v2`). false: everything runs on the in-memory sample data.
 * `nx serve` (development) talks to the backend on localhost. The production build, which is what Vercel deploys, has no
 * backend to reach, so it runs on the sample data.
 */
const USE_BACKEND = isDevMode();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      appRoutes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
    ),
    // Identity, System, Accounting and Catalog are still mocks; Contacts and Product use the backend when USE_BACKEND is on.
    USE_BACKEND ? provideHttpApiClient() : provideMockApiClient(),
    provideCore(),
  ],
};

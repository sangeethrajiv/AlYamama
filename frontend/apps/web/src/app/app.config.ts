import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { provideHttpApiClient, provideMockApiClient } from '@erp/web/api-client';
import { provideCore } from '@erp/web/core';
import { appRoutes } from './app.routes';

/** true: Contacts and Product use the Express backend (`/v2`). false: everything runs on the in-memory mocks. */
const USE_BACKEND = true;

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

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { makeEnvironmentProviders, provideAppInitializer, inject, type EnvironmentProviders } from '@angular/core';
import { AuthService } from './auth/auth.service';
import { provideAppI18n } from './i18n/provide-i18n';
import { ManifestService } from './manifest/manifest.service';
import { problemDetailsInterceptor, requestContextInterceptor } from './http/http-interceptors';

/** Everything the shell needs at startup: HTTP stack, i18n, session restore and the manifest. */
export function provideCore(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(withInterceptors([requestContextInterceptor, problemDetailsInterceptor])),
    provideAppI18n(),
    provideAppInitializer(async () => {
      // inject() must run before the first await
      const auth = inject(AuthService);
      const manifest = inject(ManifestService);
      await auth.restore();
      await manifest.load();
    }),
  ]);
}

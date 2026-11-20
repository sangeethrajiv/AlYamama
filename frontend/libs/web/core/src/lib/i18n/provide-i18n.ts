import { Injectable, isDevMode, type EnvironmentProviders } from '@angular/core';
import { makeEnvironmentProviders } from '@angular/core';
import { provideTransloco, TranslocoLoader, type Translation } from '@jsverse/transloco';
import { from, type Observable } from 'rxjs';

/** Root dictionary (common, nav, status, shell, login). Feature dictionaries are lazy scopes loaded with their routes. */
@Injectable({ providedIn: 'root' })
export class RootTranslationLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    return from(lang === 'ar' ? import('./ar.json').then(m => m.default) : import('./en.json').then(m => m.default));
  }
}

export function provideAppI18n(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: ['en', 'ar'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: { useFallbackTranslation: true, logMissingKey: false },
      },
      loader: RootTranslationLoader,
    }),
  ]);
}

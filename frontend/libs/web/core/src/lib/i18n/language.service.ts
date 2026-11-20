import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Directionality } from '@angular/cdk/bidi';
import { TranslocoService } from '@jsverse/transloco';

export type Lang = 'en' | 'ar';

/**
 * Language + direction. Arabic switches the whole app to right-to-left: the `dir` attribute, the CDK Directionality
 * used by overlays, and Transloco's active language (section 12.2: RTL from the first release).
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly doc = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);
  private readonly cdkDir = inject(Directionality);

  private readonly current = signal<Lang>('en');
  readonly lang = this.current.asReadonly();
  readonly dir = computed<'ltr' | 'rtl'>(() => (this.current() === 'ar' ? 'rtl' : 'ltr'));
  readonly isArabic = computed(() => this.current() === 'ar');

  set(lang: Lang): void {
    this.current.set(lang);
    const dir = this.dir();
    this.doc.documentElement.lang = lang;
    this.doc.documentElement.dir = dir;
    this.transloco.setActiveLang(lang);
    if (this.cdkDir.value !== dir) {
      this.cdkDir.valueSignal.set(dir);
      this.cdkDir.change.emit(dir);
    }
  }

  toggle(): void {
    this.set(this.current() === 'ar' ? 'en' : 'ar');
  }
}

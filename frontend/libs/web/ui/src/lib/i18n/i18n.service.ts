import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Signal-aware translation for code (computed values, services). Reading `tr()` inside a computed or template makes it
 * re-run when a language is switched or a lazy scope dictionary finishes loading, which `TranslocoService.translate`
 * alone does not. Templates should still prefer the `transloco` pipe.
 */
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly t = inject(TranslocoService);
  private readonly tick = signal(0);

  constructor() {
    this.t.events$.subscribe(e => { if (e.type === 'translationLoadSuccess' || e.type === 'langChanged') this.tick.update(v => v + 1); });
  }

  tr(key: string, params?: Record<string, unknown>): string {
    this.tick();
    return this.t.translate(key, params);
  }
}

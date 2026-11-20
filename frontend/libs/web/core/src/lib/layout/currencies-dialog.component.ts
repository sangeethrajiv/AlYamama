import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SystemApi } from '@erp/web/api-client';
import { DialogFrameComponent, MoneyPipe } from '@erp/web/ui';

@Component({
  selector: 'erp-currencies-dialog',
  imports: [DialogFrameComponent, TranslocoPipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="'shell.currenciesTitle' | transloco">
      <p class="mb-3 text-xs text-slate-500">{{ 'shell.currenciesNote' | transloco }}</p>
      <div class="space-y-2">
        @for (c of currencies.value() ?? []; track c.currency) {
          <div class="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 text-xs">
            <div><span class="font-bold text-slate-800">{{ c.currency }}</span> — {{ c.name }}</div>
            <div class="font-mono font-semibold text-emerald-700">1 {{ c.currency }} = {{ c.rateToBase | erpMoney }} SAR</div>
          </div>
        }
      </div>
    </erp-dialog-frame>`,
})
export class CurrenciesDialogComponent {
  protected readonly currencies = resource({ loader: () => inject(SystemApi).currencies() });
}

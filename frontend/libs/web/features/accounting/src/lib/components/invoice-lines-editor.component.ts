import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DECIMAL_RE } from '@erp/web/metadata-forms';
import { IconComponent, MoneyPipe, QuantityPipe } from '@erp/web/ui';
import type { AnalyticAccount, DirectoryProduct, InvoiceLine } from '@erp/shared/contracts';
import { dec, lt } from '@erp/shared/utils';
import { TAX_OPTIONS, applyProduct, blankLine, recompute, taxLabel } from '../models/invoice-math';

const SUBSCRIPTION_TYPES = ['Vehicle Subscription', 'Service Subscription', 'Maintenance Contract'];
const FREQUENCIES = ['One Year', 'Six Months', 'Quarterly', 'Monthly', 'One Time'];

/** Purpose-built invoice line editor with exact-decimal tax computation (section 12.4: hybrid screen). */
@Component({
  selector: 'erp-invoice-lines-editor',
  imports: [TranslocoPipe, IconComponent, MoneyPipe, QuantityPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto rounded-lg border border-slate-200">
      <table class="erp-table whitespace-nowrap">
        <thead><tr>
          <th>{{ 'accounting.lines.product' | transloco }}</th><th class="min-w-[150px]">{{ 'accounting.lines.description' | transloco }}</th>
          @if (mode() === 'proforma') {
            <th>{{ 'accounting.lines.subscriptionType' | transloco }}</th><th class="text-end">{{ 'accounting.lines.subscriptions' | transloco }}</th><th>{{ 'accounting.lines.frequency' | transloco }}</th>
            <th>{{ 'accounting.lines.startDate' | transloco }}</th><th>{{ 'accounting.lines.endDate' | transloco }}</th><th>{{ 'accounting.lines.vehicles' | transloco }}</th>
          } @else { <th>{{ 'accounting.lines.analytic' | transloco }}</th><th>{{ 'accounting.lines.unit' | transloco }}</th> }
          <th class="text-end">{{ 'accounting.lines.quantity' | transloco }}</th><th class="text-end">{{ 'accounting.lines.unitPrice' | transloco }}</th><th class="text-center">{{ 'accounting.lines.taxes' | transloco }}</th>
          <th class="text-end">{{ 'accounting.lines.discount' | transloco }}</th><th class="text-end">{{ 'accounting.lines.subtotal' | transloco }}</th>@if (editable()) { <th class="w-7"></th> }
        </tr></thead>
        <tbody>
          @for (l of lines(); track l.id) {
            <tr>
              <td class="!px-2 !py-1.5">
                <input class="erp-input erp-input-sm w-28" [disabled]="!editable()" [value]="l.product" list="erp-catalog" (change)="setProduct(l, $any($event.target).value)" />
                @if (stockOf(l); as s) { <div class="mt-0.5 text-[10px]" [class]="lowStock(l) ? 'font-bold text-rose-600' : 'text-slate-400'">{{ 'accounting.lines.onHand' | transloco: { qty: s } }}</div> }
              </td>
              <td class="!px-2 !py-1.5"><input class="erp-input erp-input-sm w-44" [disabled]="!editable()" [value]="l.description" (input)="patch(l, { description: $any($event.target).value })" /></td>
              @if (mode() === 'proforma') {
                <td class="!px-2 !py-1.5"><select class="erp-input erp-input-sm" [disabled]="!editable()" (change)="patch(l, { subscriptionType: $any($event.target).value })">@for (t of subTypes; track t) { <option [selected]="(l.subscriptionType || subTypes[0]) === t">{{ t }}</option> }</select></td>
                <td class="!px-2 !py-1.5 text-end"><input type="number" min="0" class="erp-input erp-input-sm w-16 text-end" [disabled]="!editable()" [value]="l.subscriptions ?? 1" (input)="patch(l, { subscriptions: +$any($event.target).value || 0 })" /></td>
                <td class="!px-2 !py-1.5"><select class="erp-input erp-input-sm" [disabled]="!editable()" (change)="patch(l, { frequency: $any($event.target).value })">@for (f of freqs; track f) { <option [selected]="(l.frequency || 'One Year') === f">{{ f }}</option> }</select></td>
                <td class="!px-2 !py-1.5"><input type="date" class="erp-input erp-input-sm" [disabled]="!editable()" [value]="l.startDate || ''" (change)="patch(l, { startDate: $any($event.target).value })" /></td>
                <td class="!px-2 !py-1.5"><input type="date" class="erp-input erp-input-sm" [disabled]="!editable()" [value]="l.endDate || ''" (change)="patch(l, { endDate: $any($event.target).value })" /></td>
                <td class="!px-2 !py-1.5"><input class="erp-input erp-input-sm w-32" [disabled]="!editable()" [value]="l.vehiclesText || ''" [placeholder]="'accounting.lines.plates' | transloco" (input)="patch(l, { vehiclesText: $any($event.target).value })" /></td>
              } @else {
                <td class="!px-2 !py-1.5"><select class="erp-input erp-input-sm w-44" [disabled]="!editable()" (change)="patch(l, { analyticAccountId: $any($event.target).value, analyticAccountName: analyticName($any($event.target).value) })"><option value=""></option>@for (a of analytic(); track a.id) { <option [value]="a.id" [selected]="l.analyticAccountId === a.id">{{ a.code }} - {{ a.name }}</option> }</select></td>
                <td class="!px-2 !py-1.5"><input class="erp-input erp-input-sm w-16" [disabled]="!editable()" [value]="l.unitOfMeasure ?? ''" (input)="patch(l, { unitOfMeasure: $any($event.target).value })" /></td>
              }
              <td class="!px-2 !py-1.5 text-end"><input inputmode="decimal" class="erp-input erp-input-sm w-20 text-end font-mono" [disabled]="!editable()" [value]="l.quantity | erpQty" (change)="num(l, 'quantity', $any($event.target).value, 4)" /></td>
              <td class="!px-2 !py-1.5 text-end"><input inputmode="decimal" class="erp-input erp-input-sm w-24 text-end font-mono" [disabled]="!editable()" [value]="l.unitPrice" (change)="num(l, 'unitPrice', $any($event.target).value, 2)" /></td>
              <td class="!px-2 !py-1.5 text-center"><select class="erp-input erp-input-sm" [disabled]="!editable()" (change)="setTax(l, $any($event.target).value)">@for (t of taxes; track t.value) { <option [value]="t.value" [selected]="t.value === l.taxRate">{{ t.label }}</option> }</select></td>
              <td class="!px-2 !py-1.5 text-end"><input inputmode="decimal" class="erp-input erp-input-sm w-20 text-end font-mono" [disabled]="!editable()" [value]="l.discount" (change)="num(l, 'discount', $any($event.target).value, 2)" /></td>
              <td class="!px-3 text-end font-mono font-semibold text-slate-900">{{ l.subtotal | erpMoney }}</td>
              @if (editable()) { <td class="!px-1"><button type="button" class="p-1 text-rose-500 hover:text-rose-700 disabled:opacity-30" [disabled]="lines().length <= 1" [attr.aria-label]="'metadata.remove' | transloco" (click)="remove(l)"><erp-icon name="trash" [size]="14" /></button></td> }
            </tr>
          }
        </tbody>
      </table>
      <datalist id="erp-catalog">@for (p of products(); track p.id) { @if (p.canSell) { <option [value]="p.sku">{{ p.name }}</option> } }</datalist>
    </div>
    @if (editable()) { <button type="button" class="mt-2 inline-flex items-center gap-1 rounded bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100" (click)="addLine()"><erp-icon name="plus" [size]="13" />{{ 'accounting.lines.add' | transloco }}</button> }`,
})
export class InvoiceLinesEditorComponent {
  readonly lines = input.required<InvoiceLine[]>();
  readonly editable = input<boolean>(true);
  readonly mode = input<'standard' | 'proforma'>('standard');
  readonly products = input<DirectoryProduct[]>([]);
  readonly analytic = input<AnalyticAccount[]>([]);
  readonly stock = input<Record<string, string>>({});
  readonly linesChange = output<InvoiceLine[]>();

  protected readonly subTypes = SUBSCRIPTION_TYPES;
  protected readonly freqs = FREQUENCIES;
  protected readonly taxes = TAX_OPTIONS;
  private readonly bySku = computed(() => new Map(this.products().map(p => [p.sku, p])));

  protected stockOf(l: InvoiceLine): string { return this.stock()[l.product] ?? ''; }
  protected lowStock(l: InvoiceLine): boolean { const s = this.stock()[l.product]; return !!s && lt(s, l.quantity); }
  protected analyticName(id: string): string { const a = this.analytic().find(x => x.id === id); return a ? `${a.code} - ${a.name}` : ''; }

  private emit(next: InvoiceLine[]): void { this.linesChange.emit(next); }
  protected patch(l: InvoiceLine, p: Partial<InvoiceLine>): void { this.emit(this.lines().map(x => (x.id === l.id ? recompute({ ...x, ...p }) : x))); }
  protected setProduct(l: InvoiceLine, sku: string): void {
    const p = this.bySku().get(sku);
    this.emit(this.lines().map(x => (x.id === l.id ? (p ? applyProduct(x, p) : { ...x, product: sku }) : x)));
  }
  protected setTax(l: InvoiceLine, rate: string): void { this.patch(l, { taxRate: rate, taxesApplied: taxLabel(rate) }); }
  protected num(l: InvoiceLine, key: 'quantity' | 'unitPrice' | 'discount', v: string, places: number): void {
    this.patch(l, { [key]: DECIMAL_RE.test(v.trim()) ? dec(v.trim(), places) : dec('0', places) } as Partial<InvoiceLine>);
  }
  protected addLine(): void { this.emit([...this.lines(), blankLine(this.mode() === 'proforma' ? { subscriptionType: SUBSCRIPTION_TYPES[0], subscriptions: 1, frequency: 'One Year' } : {})]); }
  protected remove(l: InvoiceLine): void { if (this.lines().length > 1) this.emit(this.lines().filter(x => x.id !== l.id)); }
}

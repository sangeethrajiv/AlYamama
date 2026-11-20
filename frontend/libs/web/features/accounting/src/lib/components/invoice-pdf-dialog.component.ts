import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { CompanyContext } from '@erp/web/core';
import { AmountPipe, DatePipe, IconComponent, MoneyPipe, QuantityPipe } from '@erp/web/ui';
import type { Invoice } from '@erp/shared/contracts';
import { mul, toNumber } from '@erp/shared/utils';
import { AccountingStore } from '../data/accounting.store';

export interface PdfDialogData { invoice: Invoice; autoPrint?: boolean }

/** Printable tax invoice / proforma preview. Printing uses the browser; the PDF service is a server concern. */
@Component({
  selector: 'erp-invoice-pdf-dialog',
  imports: [TranslocoPipe, IconComponent, AmountPipe, MoneyPipe, QuantityPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex max-h-[90vh] flex-col overflow-hidden">
      <div class="no-print flex items-center justify-between bg-slate-900 px-6 py-3 text-white">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-extrabold tracking-wide">{{ (isProforma ? 'accounting.pdf.proformaPreview' : 'accounting.pdf.taxPreview') | transloco }} — {{ inv.number }}</h3>
          <span class="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-400">{{ (isProforma ? 'accounting.pdf.notTax' : 'accounting.pdf.zatcaTax') | transloco }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500" (click)="print()"><erp-icon name="printer" [size]="14" />{{ 'accounting.pdf.print' | transloco }}</button>
          <button type="button" class="rounded-lg p-1 text-slate-400 transition hover:text-white" [attr.aria-label]="'common.close' | transloco" (click)="ref.close()"><erp-icon name="x" [size]="18" /></button>
        </div>
      </div>
      <div class="flex flex-1 justify-center overflow-y-auto bg-slate-100 p-6">
        <article id="invoice-sheet" class="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-8 text-xs text-slate-800 shadow-md">
          <div class="flex items-start justify-between border-b-2 border-emerald-600 pb-5">
            <div>
              <div class="text-lg font-black uppercase tracking-wide text-emerald-700">{{ company().name }}</div>
              <div class="text-[11px] text-slate-500">{{ company().legalName }}</div>
              <div class="mt-1 text-[11px] text-slate-500">{{ company().city }}</div>
              <div class="mt-2 space-y-0.5 text-[11px]"><div>{{ 'accounting.pdf.crNo' | transloco }} <b>{{ company().crNumber }}</b></div><div>{{ 'accounting.pdf.vatId' | transloco }} <b>{{ company().vatNumber }}</b></div></div>
            </div>
            <div class="text-end">
              <div class="font-mono text-lg font-extrabold text-slate-900">{{ inv.number }}</div>
              @if (inv.zatca) { <div class="mt-1 inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><erp-icon name="check-circle-2" [size]="11" />{{ 'accounting.pdf.verified' | transloco }}</div> }
              <div class="mt-2 grid h-20 w-20 place-items-center rounded border border-dashed border-slate-300 text-[9px] text-slate-400" aria-label="QR">QR</div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-6 py-5">
            <div><div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{{ 'accounting.pdf.billTo' | transloco }}</div><div class="font-bold text-slate-900">{{ inv.partner }}</div><div class="mt-0.5 whitespace-pre-line text-slate-600">{{ inv.customerAddress }}</div>@if (inv.customerVat) { <div class="mt-1">{{ 'accounting.pdf.vatId' | transloco }} <b>{{ inv.customerVat }}</b></div> }</div>
            <dl class="space-y-1 text-[11px]">
              <div class="flex justify-between"><dt class="text-slate-500">{{ 'accounting.pdf.invoiceDate' | transloco }}</dt><dd class="font-semibold">{{ inv.dateInvoice | erpDate }}</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">{{ 'accounting.pdf.dueDate' | transloco }}</dt><dd class="font-semibold">{{ inv.dateDue | erpDate }}</dd></div>
              <div class="flex justify-between"><dt class="text-slate-500">{{ 'accounting.pdf.paymentTerms' | transloco }}</dt><dd class="font-semibold">{{ inv.paymentTerms }}</dd></div>
              @if (inv.poNumber && inv.poNumber !== '-') { <div class="flex justify-between"><dt class="text-slate-500">{{ 'accounting.pdf.customerPo' | transloco }}</dt><dd class="font-semibold">{{ inv.poNumber }}</dd></div> }
            </dl>
          </div>
          @if (inv.category === 'progressive') {
            <div class="mb-4 grid grid-cols-4 gap-2 rounded-lg bg-slate-50 p-3 text-[11px]">
              <div><div class="text-slate-500">{{ 'accounting.pdf.contractTotal' | transloco }}</div><b class="font-mono">{{ inv.contractAmount | erpMoney }}</b></div>
              <div><div class="text-slate-500">{{ 'accounting.pdf.previouslyBilled' | transloco }}</div><b class="font-mono">{{ inv.previouslyBilled | erpMoney }}</b></div>
              <div><div class="text-slate-500">{{ 'accounting.pdf.progress' | transloco }}</div><b class="font-mono">{{ inv.progressPercentage }}%</b></div>
              <div><div class="text-slate-500">{{ 'accounting.pdf.retainage' | transloco }}</div><b class="font-mono">{{ inv.retainageAmount | erpMoney }}</b></div>
            </div>
          }
          <table class="w-full text-start">
            <thead class="border-y border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th class="px-2 py-2 text-start">{{ 'accounting.pdf.item' | transloco }}</th><th class="px-2 text-end">{{ 'accounting.pdf.qty' | transloco }}</th><th class="px-2 text-end">{{ 'accounting.pdf.unitPrice' | transloco }}</th><th class="px-2 text-end">{{ 'accounting.pdf.vat' | transloco }}</th><th class="px-2 text-end">{{ 'accounting.lines.subtotal' | transloco }}</th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              @for (l of inv.lines; track l.id) {
                <tr><td class="px-2 py-2"><div class="font-semibold text-slate-900">{{ l.description || l.product }}</div>@if (l.product && l.description) { <div class="font-mono text-[10px] text-slate-400">{{ l.product }}</div> }</td>
                  <td class="px-2 text-end font-mono">{{ l.quantity | erpQty }}</td><td class="px-2 text-end font-mono">{{ l.unitPrice | erpMoney }}</td><td class="px-2 text-end font-mono">{{ pct(l.taxRate) }}%</td><td class="px-2 text-end font-mono font-semibold">{{ l.subtotal | erpMoney }}</td></tr>
              }
            </tbody>
          </table>
          <div class="mt-4 ms-auto w-64 space-y-1.5 text-[11px]">
            <div class="flex justify-between"><span class="text-slate-500">{{ 'accounting.pdf.subtotal' | transloco }}</span><b class="font-mono">{{ inv.amountUntaxed | erpAmount: inv.currency }}</b></div>
            <div class="flex justify-between"><span class="text-slate-500">{{ 'accounting.pdf.vatAmount' | transloco }}</span><b class="font-mono">{{ inv.amountTax | erpAmount: inv.currency }}</b></div>
            <div class="flex justify-between border-t border-slate-300 pt-1.5 text-sm font-extrabold text-emerald-700"><span>{{ 'accounting.pdf.totalDue' | transloco }}</span><span class="font-mono">{{ inv.amountTotal | erpAmount: inv.currency }}</span></div>
          </div>
          <div class="mt-6 border-t border-slate-200 pt-4 text-[10px] text-slate-500">
            <div class="font-bold text-slate-700">{{ 'accounting.pdf.bankDetails' | transloco }}</div><div>Riyad Bank · IBAN SA00 0000 0000 0000 0000 0000</div>
            <div class="mt-2 flex items-center justify-between"><span>{{ 'accounting.pdf.thanks' | transloco }}</span>@if (inv.companySeal) { <span class="rounded border border-emerald-300 px-2 py-0.5 font-bold text-emerald-700">{{ 'accounting.pdf.sealed' | transloco }}</span> }</div>
          </div>
        </article>
      </div>
    </div>`,
})
export class InvoicePdfDialogComponent {
  protected readonly data = inject<PdfDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly companies = inject(CompanyContext);
  protected readonly inv = this.data.invoice;
  protected readonly isProforma = this.inv.category === 'proforma';
  protected readonly company = computed(() => this.companies.companies().find(c => c.id === this.inv.companyId) ?? (this.companies.active() as NonNullable<ReturnType<CompanyContext['active']>>));
  protected readonly printing = signal(false);
  protected pct = (rate: string) => Math.round(toNumber(mul(rate, '100', 2)));
  protected print(): void { window.print(); }
  constructor() { if (this.data.autoPrint) setTimeout(() => window.print(), 250); }
}
void AccountingStore;

import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { AmountPipe, DialogFrameComponent, DialogService } from '@erp/web/ui';
import type { CreditNoteOptions, Invoice } from '@erp/shared/contracts';
import { gt, todayIso } from '@erp/shared/utils';

export interface CustomerSnapshot { name: string; vat: string; address: string }

/** Mandatory customer data a ZATCA submission needs. */
export const zatcaChecks = (inv: Invoice, c: CustomerSnapshot) => [
  { key: 'accounting.next.check.name', ok: !!c.name.trim() },
  { key: 'accounting.next.check.vat', ok: /^\d{15}$/.test(c.vat.replace(/\s/g, '')) },
  { key: 'accounting.next.check.address', ok: c.address.trim().length > 5 },
  { key: 'accounting.next.check.lines', ok: inv.lines.length > 0 },
];

@Component({
  selector: 'erp-credit-note-dialog',
  imports: [FormsModule, TranslocoPipe, DialogFrameComponent, AmountPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="'accounting.next.addCreditNote' | transloco" [subtitle]="data.invoice.number + ' · ' + (data.invoice.amountTotal | erpAmount: data.invoice.currency)">
      <div class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-xs">
        <label class="block"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.next.reason' | transloco }}</span><input class="erp-input" [ngModel]="reason()" (ngModelChange)="reason.set($event)" [placeholder]="'accounting.next.reasonPlaceholder' | transloco" /></label>
        <label class="block"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.next.creditDate' | transloco }}</span><input type="date" class="erp-input" [ngModel]="date()" (ngModelChange)="date.set($event)" /></label>
        <fieldset class="space-y-2"><legend class="mb-1 font-bold text-slate-600">{{ 'accounting.next.creditMethod' | transloco }}</legend>
          @for (m of methods; track m) {
            <label class="flex cursor-pointer gap-2.5 rounded-lg border p-3" [class]="method() === m ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'">
              <input type="radio" name="cn-method" class="mt-0.5" [checked]="method() === m" (change)="method.set(m)" /><span class="font-semibold text-slate-800">{{ 'accounting.next.method.' + m | transloco }}</span></label>
          }
        </fieldset>
      </div>
      <div footer class="contents">
        <button type="button" class="erp-btn-ghost" (click)="ref.close()">{{ 'common.cancel' | transloco }}</button>
        <button type="button" class="erp-btn-primary" [disabled]="!reason().trim()" (click)="ref.close({ reason: reason().trim(), date: date(), method: method() })">{{ 'accounting.next.createCreditNote' | transloco }}</button>
      </div>
    </erp-dialog-frame>`,
})
export class CreditNoteDialogComponent {
  protected readonly data = inject<{ invoice: Invoice }>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<CreditNoteOptions>>(DialogRef);
  protected readonly methods: CreditNoteOptions['method'][] = ['draft', 'cancel', 'modify'];
  protected readonly reason = signal('');
  protected readonly date = signal(todayIso());
  protected readonly method = signal<CreditNoteOptions['method']>('draft');
}

@Component({
  selector: 'erp-zatca-dialog',
  imports: [TranslocoPipe, DialogFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="'accounting.next.submitZatca' | transloco" [subtitle]="'accounting.next.zatcaChecking' | transloco">
      <div class="space-y-3 text-xs">
        <ul class="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white">
          @for (c of checks; track c.key) { <li class="flex items-center justify-between px-3 py-2"><span class="text-slate-700">{{ c.key | transloco }}</span><span class="font-bold" [class]="c.ok ? 'text-emerald-700' : 'text-rose-600'">{{ (c.ok ? 'accounting.next.ready' : 'accounting.next.missing') | transloco }}</span></li> }
        </ul>
        @if (!allOk) { <p class="text-rose-600">{{ 'accounting.next.completeCustomer' | transloco }}</p> }
        <label class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900"><input type="checkbox" class="mt-0.5" [checked]="ack()" (change)="ack.set($any($event.target).checked)" /><span>{{ 'accounting.next.zatcaAck' | transloco }}</span></label>
      </div>
      <div footer class="contents">
        <button type="button" class="erp-btn-ghost" (click)="ref.close(false)">{{ 'common.cancel' | transloco }}</button>
        <button type="button" class="erp-btn-primary" [disabled]="!allOk || !ack()" (click)="ref.close(true)">{{ 'accounting.next.submitInvoice' | transloco }}</button>
      </div>
    </erp-dialog-frame>`,
})
export class ZatcaDialogComponent {
  protected readonly data = inject<{ invoice: Invoice; customer: CustomerSnapshot }>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly checks = zatcaChecks(this.data.invoice, this.data.customer);
  protected readonly allOk = this.checks.every(c => c.ok);
  protected readonly ack = signal(false);
}

/** Post-posting actions: collect money, correct the invoice, report it to ZATCA. */
@Component({
  selector: 'erp-invoice-next-steps',
  imports: [TranslocoPipe, AmountPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-3" [attr.aria-label]="'accounting.next.title' | transloco">
      <div class="flex items-baseline justify-between"><h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ 'accounting.next.title' | transloco }}</h3><span class="text-[11px] text-slate-400">{{ 'accounting.next.subtitle' | transloco }}</span></div>
      <div class="grid grid-cols-1 gap-3" [class]="hideCreditNote() ? 'lg:grid-cols-2' : 'lg:grid-cols-3'">
        <div class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div><div class="text-xs font-extrabold text-slate-800">{{ 'accounting.next.collect' | transloco }}</div><div class="mt-0.5 text-[11px] text-slate-500">{{ 'accounting.next.amountDue' | transloco }}</div><div class="font-mono text-lg font-black text-slate-900">{{ invoice().residual | erpAmount: invoice().currency }}</div></div>
          <button type="button" class="mt-auto h-8 rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50" [disabled]="!canPay()" (click)="registerPayment.emit()">{{ (canPay() ? 'accounting.next.registerPayment' : 'accounting.next.fullyPaid') | transloco }}</button>
        </div>
        @if (!hideCreditNote()) {
          <div class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div><div class="text-xs font-extrabold text-slate-800">{{ 'accounting.next.correct' | transloco }}</div><p class="mt-0.5 text-[11px] text-slate-500">{{ (isCreditNote() ? 'accounting.next.alreadyCreditNote' : 'accounting.next.creditNoteHelp') | transloco }}</p></div>
            <button type="button" class="mt-auto h-8 rounded-lg border border-slate-300 px-3.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50" [disabled]="isCreditNote()" (click)="openCreditNote()">{{ 'accounting.next.addCreditNote' | transloco }}</button>
          </div>
        }
        <div class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <div class="flex items-center justify-between"><div class="text-xs font-extrabold text-slate-800">{{ 'accounting.next.zatca' | transloco }}</div>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-bold" [class]="z() ? (z()!.status === 'cleared' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700') : 'bg-amber-100 text-amber-800'">{{ (z() ? (z()!.status === 'cleared' ? 'accounting.next.cleared' : 'accounting.next.rejected') : 'accounting.next.notSubmitted') | transloco }}</span></div>
            <ol class="mt-3 flex items-center gap-1.5" [attr.aria-label]="'accounting.next.zatca' | transloco">
              @for (s of steps; track s; let i = $index) {
                <li class="flex flex-1 items-center gap-1.5 last:flex-none">
                  <span class="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold" [class]="i <= stepIndex() ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'">{{ i + 1 }}</span>
                  <span class="text-[10px] font-semibold" [class]="i <= stepIndex() ? 'text-slate-800' : 'text-slate-400'">{{ 'accounting.next.step.' + s | transloco }}</span>
                  @if (i < steps.length - 1) { <span class="h-px flex-1" [class]="i < stepIndex() ? 'bg-emerald-500' : 'bg-slate-200'"></span> }
                </li>
              }
            </ol>
          </div>
          @if (z()) { <button type="button" class="mt-auto h-8 rounded-lg border border-slate-300 px-3.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50" (click)="details.set(!details())">{{ (details() ? 'accounting.next.hideDetails' : 'accounting.next.viewDetails') | transloco }}</button> }
          @else { <button type="button" class="mt-auto h-8 rounded-lg bg-slate-900 px-3.5 text-xs font-bold text-white transition hover:bg-slate-800" (click)="openZatca()">{{ 'accounting.next.submitZatca' | transloco }}</button> }
        </div>
      </div>
      @if (z() && details()) {
        <dl class="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2">
          @for (r of rows(); track r[0]) { <div class="min-w-0"><dt class="font-medium text-slate-500">{{ r[0] | transloco }}</dt><dd class="break-all font-mono text-slate-800">{{ r[1] }}</dd></div> }
        </dl>
      }
    </section>`,
})
export class InvoiceNextStepsComponent {
  private readonly dialogs = inject(DialogService);
  readonly invoice = input.required<Invoice>();
  readonly customer = input.required<CustomerSnapshot>();
  readonly hideCreditNote = input<boolean>(false);
  readonly registerPayment = output<void>();
  readonly creditNote = output<CreditNoteOptions>();
  readonly submitZatca = output<void>();

  protected readonly steps = ['posted', 'submitted', 'cleared'];
  protected readonly details = signal(false);
  protected readonly z = computed(() => this.invoice().zatca);
  protected readonly stepIndex = computed(() => (this.z() ? (this.z()?.status === 'cleared' ? 2 : 1) : 0));
  protected readonly canPay = computed(() => (this.invoice().state === 'open' || this.invoice().state === 'in_payment') && gt(this.invoice().residual, '0'));
  protected readonly isCreditNote = computed(() => this.invoice().type === 'out_refund');
  protected readonly rows = computed<[string, string][]>(() => {
    const z = this.z();
    return z ? [['accounting.next.uuid', z.uuid], ['accounting.next.hash', z.invoiceHash], ['accounting.next.chain', String(z.chainIndex)], ['accounting.next.submittedAt', z.submittedAt], ['accounting.next.submittedBy', z.submittedBy], ['accounting.next.result', z.message || z.status]] : [];
  });

  protected async openCreditNote(): Promise<void> {
    const ref = this.dialogs.open<CreditNoteDialogComponent, { invoice: Invoice }, CreditNoteOptions>(CreditNoteDialogComponent, { data: { invoice: this.invoice() }, kind: 'modal' });
    const opts = await firstValueFrom(ref.closed, { defaultValue: undefined });
    if (opts) this.creditNote.emit(opts);
  }
  protected async openZatca(): Promise<void> {
    const ref = this.dialogs.open<ZatcaDialogComponent, { invoice: Invoice; customer: CustomerSnapshot }, boolean>(ZatcaDialogComponent, { data: { invoice: this.invoice(), customer: this.customer() }, kind: 'modal' });
    if ((await firstValueFrom(ref.closed, { defaultValue: false })) === true) { this.submitZatca.emit(); this.details.set(true); }
  }
}

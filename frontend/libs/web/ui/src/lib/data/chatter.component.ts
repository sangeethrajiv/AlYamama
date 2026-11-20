import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AuditLogEntry, AuditRecordType } from '@erp/shared/contracts';

type Tone = 'green' | 'amber' | 'rose' | 'slate';
const EVENTS: Record<string, Tone> = {
  create: 'slate', update: 'slate', state: 'green', renew: 'green', payment: 'green', approvalStatus: 'amber', zatca_submit: 'green',
  reconciliation: 'green', bulk_reconciliation: 'green', unreconcile: 'amber', convert_proforma: 'green', create_credit_note: 'amber',
  auto_intercompany: 'slate', save_bill: 'slate', approved: 'green', rejected: 'rose', cheque_bounced: 'rose', reverse_entry: 'amber',
  direct_bank_tx: 'slate', period_lock_date: 'amber', create_credit: 'slate', inventory_validate: 'green',
};
const TONES: Record<Tone, { bar: string; title: string }> = {
  green: { bar: 'border-emerald-500 bg-emerald-50/60', title: 'text-emerald-800' },
  amber: { bar: 'border-amber-500 bg-amber-50/60', title: 'text-amber-800' },
  rose: { bar: 'border-rose-500 bg-rose-50/60', title: 'text-rose-800' },
  slate: { bar: 'border-slate-400 bg-slate-50', title: 'text-slate-800' },
};
const CHIP_OK = ['paid', 'posted', 'reconciled', 'approved'];
const CHIP_WARN = ['open', 'in_payment'];
const CHIP_BAD = ['cancel', 'rejected', 'bounced'];

interface Item extends AuditLogEntry { edits?: AuditLogEntry[] }

/** Conversation-style timeline for one record: write internal notes, see system events as they happen. */
@Component({
  selector: 'erp-chatter',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" [attr.aria-label]="'chatter.title' | transloco">
      <div class="flex items-center justify-between px-5 pb-3 pt-4">
        <h3 class="text-sm font-extrabold text-slate-800">{{ 'chatter.title' | transloco }}</h3>
        <div class="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold" role="tablist">
          @for (t of tabs; track t) {
            <button type="button" role="tab" [attr.aria-selected]="tab() === t" (click)="tab.set(t)" class="rounded-md px-2.5 py-1 transition" [class]="tab() === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'">{{ 'chatter.tab.' + t | transloco }}</button>
          }
        </div>
      </div>
      @if (!readonly()) {
        <div class="px-5 pb-4">
          <div class="rounded-xl border border-slate-200 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <textarea [value]="text()" (input)="text.set($any($event.target).value)" (keydown)="onKey($event)" rows="2" [placeholder]="'chatter.placeholder' | transloco" class="w-full resize-none rounded-t-xl bg-transparent px-3 py-2 text-xs outline-none placeholder-slate-400"></textarea>
            <div class="flex items-center justify-between rounded-b-xl border-t border-slate-100 bg-slate-50 px-3 py-1.5">
              <span class="text-[10px] text-slate-400">{{ 'chatter.hint' | transloco }}</span>
              <button type="button" class="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50" [disabled]="!text().trim()" (click)="post()">{{ 'chatter.post' | transloco }}</button>
            </div>
          </div>
        </div>
      }
      <ol class="max-h-80 space-y-3 overflow-y-auto px-5 pb-5">
        @if (items().length === 0) { <li class="py-4 text-center text-xs text-slate-400">{{ (tab() === 'notes' ? 'chatter.noNotes' : 'chatter.noActivity') | transloco }}</li> }
        @for (l of items(); track l.id) {
          <li class="flex gap-3">
            <div class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold" [class]="l.fieldName === 'note' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'">{{ initials(l.user) }}</div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2 text-[11px]"><span class="font-bold text-slate-800">{{ l.user }}</span><span class="text-slate-400">{{ l.timestamp }}</span></div>
              @if (l.fieldName === 'note') {
                <div class="mt-1 whitespace-pre-wrap rounded-lg rounded-ss-none bg-slate-100 px-3 py-2 text-xs text-slate-800">{{ l.notes }}</div>
              } @else if (l.edits) {
                <div class="mt-1 rounded-lg border-s-2 border-slate-400 bg-slate-50 px-3 py-2 text-xs">
                  <div class="font-bold text-slate-800">{{ 'chatter.edited' | transloco }}</div>
                  <ul class="mt-1 space-y-0.5 text-slate-600">@for (e of l.edits; track e.id) { <li><b>{{ e.fieldName.slice(5) }}</b>: <span class="text-slate-400 line-through">{{ e.oldValue }}</span> → <span class="font-semibold text-slate-800">{{ e.newValue }}</span></li> }</ul>
                </div>
              } @else {
                <div class="mt-1 rounded-lg border-s-2 px-3 py-2 text-xs" [class]="tone(l).bar">
                  <div class="font-bold" [class]="tone(l).title">{{ 'chatter.event.' + eventKey(l) | transloco }}</div>
                  @if (l.oldValue || l.newValue) { <div class="mt-0.5 flex items-center gap-1.5 text-slate-600">@if (l.oldValue && l.oldValue !== '—') { <span [class]="chip(l.oldValue)">{{ l.oldValue.replace('_', ' ') }}</span> → } <span [class]="chip(l.newValue)">{{ l.newValue.replace('_', ' ') }}</span></div> }
                  @if (l.notes) { <div class="mt-1 text-slate-600">{{ l.notes }}</div> }
                </div>
              }
            </div>
          </li>
        }
      </ol>
    </section>`,
})
export class ChatterComponent {
  readonly recordType = input.required<AuditRecordType>();
  readonly recordId = input.required<string>();
  readonly recordName = input.required<string>();
  readonly logs = input.required<AuditLogEntry[]>();
  readonly readonly = input<boolean>(false);
  readonly noteAdded = output<string>();

  protected readonly tabs = ['all', 'notes', 'system'] as const;
  protected readonly tab = signal<(typeof this.tabs)[number]>('all');
  protected readonly text = signal('');

  protected readonly items = computed<Item[]>(() => {
    const out: Item[] = [];
    for (const l of this.logs().filter(x => x.recordId === this.recordId()).filter(x => (this.tab() === 'all' ? true : this.tab() === 'notes' ? x.fieldName === 'note' : x.fieldName !== 'note'))) {
      const last = out[out.length - 1];
      const edit = l.fieldName.startsWith('edit:');
      if (edit && last?.edits && last.user === l.user && last.timestamp === l.timestamp) last.edits.push(l);
      else out.push(edit ? { ...l, edits: [l] } : l);
    }
    return out;
  });

  protected initials = (name: string) => name.split(/[\s()]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
  protected eventKey = (l: AuditLogEntry) => (l.fieldName in EVENTS ? l.fieldName : 'update');
  protected tone = (l: AuditLogEntry) => TONES[EVENTS[l.fieldName] ?? 'slate'];
  protected chip(v: string): string {
    const k = v.toLowerCase();
    const c = CHIP_OK.includes(k) ? 'bg-emerald-100 text-emerald-800' : CHIP_WARN.includes(k) ? 'bg-amber-100 text-amber-800' : CHIP_BAD.includes(k) ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700';
    return `rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${c}`;
  }
  protected onKey(e: KeyboardEvent): void { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') this.post(); }
  protected post(): void {
    const t = this.text().trim();
    if (!t) return;
    this.noteAdded.emit(t);
    this.text.set('');
  }
}

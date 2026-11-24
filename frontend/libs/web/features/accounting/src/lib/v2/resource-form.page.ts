import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PermissionService } from '@erp/web/core';
import { AccountingBackend } from '@erp/web/api-client';
import { MetadataFormComponent, type Rec, type ViewDef } from '@erp/web/metadata-forms';
import { DialogService, DocumentActionBarComponent, ErrorBannerComponent, IconComponent, PillComponent, ToastService, type ActionItem } from '@erp/web/ui';
import { LinesEditorComponent, type Row } from './lines-editor.component';
import { RecordExtrasComponent } from './record-extras.component';
import { makeSpecs } from './resources';
import { pillText, pillTone, toBody, toForm, type ActionSpec } from './resource-spec';

/** Generic create / edit / act form for any ResourceSpec. Route data: `{ resource: key }`; the `:id` param is `id` ('new' for a blank form). */
@Component({
  selector: 'erp-resource-form-page',
  imports: [RouterLink, MetadataFormComponent, LinesEditorComponent, DocumentActionBarComponent, ErrorBannerComponent, IconComponent, PillComponent, RecordExtrasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-5xl space-y-4 pb-20">
      <div>
        <nav class="mb-1 flex items-center gap-1 text-xs"><a [routerLink]="['/accounting', spec().path]" class="font-bold text-emerald-700 hover:underline">{{ spec().title }}</a><erp-icon name="chevron-right" [size]="12" [flip]="true" class="text-slate-400" /></nav>
        <div class="flex flex-wrap items-center gap-2.5">
          <h1 class="font-display text-xl font-black tracking-tight text-slate-800">{{ heading() }}</h1>
          @if (state(); as s) { <erp-pill [tone]="tone(s)">{{ pretty(s) }}</erp-pill> }
          @if (rec()['request_status'] && rec()['request_status'] !== 'not_required') { <erp-pill [tone]="tone(str(rec()['request_status']))">{{ pretty(str(rec()['request_status'])) }}</erp-pill> }
        </div>
        @if (rec()['reject_reason']) { <p class="mt-1 text-xs text-rose-600">Rejected: {{ rec()['reject_reason'] }}</p> }
      </div>
      <erp-error-banner [text]="error()" />
      <erp-document-action-bar [items]="items()" />

      @if (reasonFor(); as a) {
        <div class="flex flex-wrap items-end gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <label class="block flex-1 text-[11px] font-bold text-slate-600">{{ a.reason }}<input class="erp-input mt-1" [value]="reason()" (input)="reason.set($any($event.target).value)" /></label>
          <button type="button" class="erp-btn-primary" (click)="run(a, reason())">Confirm</button>
          <button type="button" class="erp-btn-ghost" (click)="reasonFor.set(null)">Back</button>
        </div>
      }

      @if (ready()) {
        <erp-metadata-form [view]="view()" [value]="form()" [readonly]="locked()" (valueChange)="onChange($event)" />
        @for (l of spec().lines ?? []; track l.key) {
          <section class="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <h3 class="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{{ l.title }}</h3>
            <erp-lines-editor [columns]="l.columns" [rows]="rowsOf(l.key)" [readonly]="locked() || !!l.readonly" [newRow]="l.newRow" (rowsChange)="setRows(l.key, $event)" />
            @if (l.key === 'lines') { <div class="flex justify-end gap-6 text-xs"><span>Debit <b class="font-mono">{{ sum('debit') }}</b></span><span>Credit <b class="font-mono">{{ sum('credit') }}</b></span></div> }
          </section>
        }
      }

      @if (ready() && rec()['move_id']) {
        <p class="text-xs">Journal entry <a class="font-mono font-bold text-emerald-700 hover:underline" [routerLink]="['/accounting/journal-entries', rec()['move_id']]">{{ rec()['move_id_label'] }}</a></p>
      }
      @if (ready() && settledRows().length) {
        <section class="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <h3 class="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Reconciled With</h3>
          <table class="erp-table w-full"><thead><tr><th>Document</th><th>Journal</th><th>Date</th><th class="text-end">Matched amount</th></tr></thead>
            <tbody>@for (s of settledRows(); track s['reconcile_id']) { <tr><td class="font-mono font-bold">{{ s['move_name'] }}</td><td>{{ s['journal_name'] }}</td><td>{{ str(s['date']).slice(0, 10) }}</td><td class="text-end font-mono">{{ s['amount'] }}</td></tr> }</tbody></table>
        </section>
      }
      @if (ready() && entryRows().length) {
        <section class="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <h3 class="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Journal Items</h3>
          <table class="erp-table w-full"><thead><tr><th>Account</th><th>Partner</th><th>Label</th><th class="text-end">Debit</th><th class="text-end">Credit</th><th>Matching</th></tr></thead>
            <tbody>@for (l of entryRows(); track l['id']) { <tr><td class="font-mono">{{ l['account_id_label'] }}</td><td>{{ l['partner_id_label'] }}</td><td>{{ l['name'] ?? '' }}</td><td class="text-end font-mono">{{ l['debit'] }}</td><td class="text-end font-mono">{{ l['credit'] }}</td><td>@if (l['full_reconcile_id']) { <erp-pill tone="green">A{{ l['full_reconcile_id'] }}</erp-pill> }</td></tr> }</tbody></table>
        </section>
      }

      @if (!isNew() && ready() && spec().model) { <erp-record-extras [model]="spec().model!" [recordId]="recordId()" [canWrite]="canWrite()" /> }

      @if (!locked() && spec().fields.length) {
        <div class="no-print fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur lg:ps-72">
          <button type="button" class="erp-btn-ghost" (click)="back()">Close</button>
          <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="save()">{{ isNew() ? 'Create' : 'Save' }}</button>
        </div>
      }
    </div>`,
})
export class ResourceFormPage {
  private readonly ab = inject(AccountingBackend);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly perms = inject(PermissionService);

  readonly resource = input.required<string>();
  /** Route param. Absent (`undefined`) on the `/new` route, because component input binding resets inputs the route lacks. */
  readonly id = input<string | undefined>(undefined);
  protected readonly spec = computed(() => makeSpecs(this.ab)[this.resource()]);
  protected readonly isNew = computed(() => !this.id() || this.id() === 'new');
  protected readonly rec = signal<Row>({});
  /** Value handed to the metadata form; replaced only on load, never on typing (that would reset the form). */
  protected readonly form = signal<Row>({});
  private readonly draft = signal<Row>({});
  protected readonly ready = signal(false);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly reason = signal('');
  protected readonly reasonFor = signal<ActionSpec | null>(null);
  private readonly meta = viewChild(MetadataFormComponent);

  protected readonly state = computed(() => { const k = this.spec().stateKey; return k ? String(this.rec()[k] ?? '') : ''; });
  protected readonly heading = computed(() => (this.isNew() ? `New ${this.spec().singular}` : String(this.rec()['name'] ?? this.spec().singular)));
  protected readonly canWrite = computed(() => this.perms.has(this.spec().perm as never));
  protected readonly locked = computed(() => (!this.isNew() && !!this.spec().lockedWhen?.(this.rec())) || !this.canWrite());
  protected readonly recordId = computed(() => Number(this.id()) || 0);
  protected readonly view = computed<ViewDef>(() => ({ entity: this.spec().key, type: 'form', sections: [{ id: 'main', columns: 2, fields: this.spec().fields }] }));
  protected readonly settledRows = computed(() => ((this.rec()['reconciled_items'] as Row[]) ?? []));
  /** Only a payment returns its own entry lines; journal entries already show theirs in the form. */
  protected readonly entryRows = computed(() => (this.spec().lines?.some(l => l.key === 'lines') ? [] : ((this.rec()['entry_lines'] as Row[]) ?? [])));
  protected tone = pillTone;
  protected pretty = pillText;
  protected str = (v: unknown) => String(v ?? '');

  protected readonly items = computed<ActionItem[]>(() => {
    if (this.isNew() || !this.canWrite()) return [];
    const r = this.rec(); const s = this.spec();
    const out: ActionItem[] = (s.actions ?? []).filter(a => (!a.when || a.when(r)) && !(a.notByPreparer && r['prepared_by'] != null && Number(r['prepared_by']) === this.ab.userId())).map(a => ({
      id: a.id, label: a.label, kind: a.kind, disabled: this.busy(), run: () => void this.start(a),
    }));
    if (s.canDelete && (!s.stateKey || ['draft', 'cancelled', 'cancel'].includes(this.state()))) out.push({ id: 'delete', label: 'Delete', kind: 'danger', run: () => void this.remove() });
    return out;
  });

  constructor() {
    effect(() => { this.resource(); const id = this.id() || 'new'; untracked(() => void this.load(id)); });
  }

  private async load(id: string): Promise<void> {
    this.ready.set(false); this.error.set('');
    const s = this.spec();
    try {
      const raw = id === 'new' ? (s.blank?.() ?? {}) : await this.ab.get(`${s.api}/${id}`);
      const rec = id === 'new' ? raw : toForm(raw, [...(s.lines ?? []).map(l => l.key), 'entry_lines', 'reconciled_items']);
      this.rec.set(rec); this.form.set(rec); this.draft.set(rec);
      this.ready.set(true);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not open the record.'); }
  }

  protected onChange(v: Rec): void { this.draft.set({ ...this.draft(), ...v }); }
  protected rowsOf(key: string): Row[] { return ((this.draft()[key] ?? this.rec()[key]) as Row[]) ?? []; }
  protected setRows(key: string, rows: Row[]): void { this.draft.update(d => ({ ...d, [key]: rows })); this.rec.update(r => ({ ...r, [key]: rows })); }
  protected sum(field: string): string {
    return this.rowsOf('lines').reduce((t, r) => t + (Number(r[field]) || 0), 0).toFixed(2);
  }

  protected async save(): Promise<void> {
    const meta = this.meta();
    if (meta && !meta.validate()) { this.error.set(meta.firstError() || 'Please complete the required fields.'); return; }
    const s = this.spec();
    this.busy.set(true); this.error.set('');
    try {
      const merged = { ...this.rec(), ...(meta?.current() ?? {}), ...Object.fromEntries((s.lines ?? []).map(l => [l.key, this.rowsOf(l.key)])) };
      const body = toBody(merged, s.fields, s.lines);
      if (this.isNew()) {
        const created = await this.ab.create<Row>(s.api, body);
        this.toast.success(`${s.singular} created`);
        await this.router.navigate(['/accounting', s.path, created['id']]);
      } else {
        await this.ab.update(`${s.api}/${this.id()}`, body);
        this.toast.success(`${s.singular} saved`);
        await this.load(String(this.id()));
      }
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not save.'); }
    finally { this.busy.set(false); }
  }

  protected async start(a: ActionSpec): Promise<void> {
    if (a.reason) { this.reason.set(''); this.reasonFor.set(a); return; }
    if (a.confirm && !(await this.dialogs.confirm({ title: a.label, message: a.confirm, confirmLabel: a.label, danger: a.kind === 'danger' }))) return;
    await this.run(a);
  }

  protected async run(a: ActionSpec, reason?: string): Promise<void> {
    if (a.reason && !reason?.trim()) { this.error.set('A reason is required.'); return; }
    this.busy.set(true); this.error.set('');
    try {
      const res = await this.ab.action<Row>(`${this.spec().api}/${this.id()}/${a.id}`, { ...(a.body ?? {}), ...(reason ? { reason } : {}) });
      this.reasonFor.set(null);
      this.toast.success(`${a.label}: done`);
      if (a.openResult) await this.router.navigate(['/accounting', ...a.openResult(res).split('/')]);
      else await this.load(String(this.id()));
    } catch (e) { this.error.set(e instanceof Error ? e.message : `${a.label} failed.`); }
    finally { this.busy.set(false); }
  }

  protected async remove(): Promise<void> {
    if (!(await this.dialogs.confirm({ title: 'Delete', message: `Delete this ${this.spec().singular.toLowerCase()}?`, confirmLabel: 'Delete', danger: true }))) return;
    try { await this.ab.remove(`${this.spec().api}/${this.id()}`); this.toast.success('Deleted'); await this.back(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not delete.'); }
  }
  protected back(): Promise<boolean> { return this.router.navigate(['/accounting', this.spec().path]); }
}

import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent, TabsComponent, I18n } from '@erp/web/ui';
import { dec } from '@erp/shared/utils';
import { startWith } from 'rxjs';
import { DECIMAL_RE, type FieldDef, type Lookups, type Option, type Rec, type SectionDef, type ViewDef } from './view.model';

const GRID: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' };
const SPAN: Record<string, string> = { 1: '', 2: 'sm:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4', full: 'col-span-full' };
/** Full class names so Tailwind can see them. */
const COLUMN: Record<number, string> = { 1: 'sm:col-start-1', 2: 'sm:col-start-2' };

/**
 * Renders a metadata view (appendix A.10) as a typed reactive form. Use it for simple master data and settings;
 * bespoke workflows (invoice lines, journal entries) are purpose-built components instead (section 12.4).
 */
@Component({
  selector: 'erp-metadata-form',
  imports: [NgTemplateOutlet, ReactiveFormsModule, TranslocoPipe, IconComponent, TabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view().tabs; as tabs) {
      <erp-tabs [tabs]="tabTitles()" [(active)]="activeTab" class="mb-3 block" />
    }
    @if (layout() === 'split') {
      <div class="grid items-start gap-3 lg:grid-cols-2">
        <div class="min-w-0 space-y-3">@for (s of leftSections(); track s.id) { <ng-container [ngTemplateOutlet]="sec" [ngTemplateOutletContext]="{ $implicit: s }" /> }</div>
        <div class="min-w-0 space-y-3">@for (s of rightSections(); track s.id) { <ng-container [ngTemplateOutlet]="sec" [ngTemplateOutletContext]="{ $implicit: s }" /> }<ng-content /></div>
      </div>
    } @else {
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">@for (s of visibleSections(); track s.id) { <div class="min-w-0" [class]="s.half ? '' : 'lg:col-span-2'"><ng-container [ngTemplateOutlet]="sec" [ngTemplateOutletContext]="{ $implicit: s }" /></div> }</div>
    }
    <ng-template #sec let-s>
        <section class="rounded-xl border border-slate-200 bg-white p-4">
          @if (s.title) { <h3 class="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{{ s.title | transloco }}</h3> }
          <div class="grid grid-cols-1 gap-x-4 gap-y-3" [class]="grid(s)">
            @for (f of s.fields; track f.key) {
              @if (isVisible(f)) {
                <div [class]="span(f)">
                  @if (f.type === 'boolean') {
                    <label class="flex cursor-pointer items-center gap-2 pt-5 text-xs font-bold text-slate-700">
                      <input type="checkbox" class="accent-emerald-600" [formControl]="ctrl(f.key)" />{{ f.label | transloco }}
                    </label>
                  } @else {
                    <label class="block">
                      <span class="mb-1 flex items-center gap-1 text-[11px] font-bold text-slate-600">{{ f.label | transloco }}@if (isRequired(f)) { <span class="text-rose-500">*</span> }</span>
                      @switch (f.type) {
                        @case ('textarea') { <textarea rows="3" class="erp-input" [class.font-mono]="f.mono" [attr.dir]="f.rtl ? 'rtl' : null" [formControl]="ctrl(f.key)" [placeholder]="ph(f)"></textarea> }
                        @case ('select') {
                          <select class="erp-input" [formControl]="ctrl(f.key)">
                            @if (f.emptyOption !== false) { <option [ngValue]="null"></option> }
                            @for (o of optionsOf(f); track o.value) { <option [ngValue]="o.value">{{ f.translateOptions ? (o.label | transloco) : o.label }}</option> }
                          </select>
                        }
                        @case ('many2one') {
                          <select class="erp-input" [formControl]="ctrl(f.key)">
                            @if (f.emptyOption !== false) { <option [ngValue]="null"></option> }
                            @for (o of optionsOf(f); track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
                          </select>
                        }
                        @case ('many2many') {
                          <div class="flex flex-wrap gap-1.5 rounded-lg border border-slate-300 bg-white p-2" [class.opacity-60]="ctrl(f.key).disabled">
                            @for (o of optionsOf(f); track o.value) {
                              <button type="button" [disabled]="ctrl(f.key).disabled" (click)="toggleMany(f, o)"
                                class="rounded-full border px-2 py-0.5 text-[11px] font-semibold transition"
                                [class]="hasMany(f, o) ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'">{{ o.label }}</button>
                            }
                          </div>
                        }
                        @case ('money') { <input type="text" inputmode="decimal" class="erp-input text-end font-mono" [formControl]="ctrl(f.key)" [placeholder]="ph(f)" (blur)="normalizeMoney(f)" /> }
                        @case ('number') { <input type="number" class="erp-input" [class.font-mono]="f.mono" [formControl]="ctrl(f.key)" [attr.min]="f.min" [attr.max]="f.max" [placeholder]="ph(f)" /> }
                        @case ('date') { <input type="date" class="erp-input" [formControl]="ctrl(f.key)" /> }
                        @case ('email') { <input type="email" class="erp-input" [formControl]="ctrl(f.key)" [placeholder]="ph(f)" /> }
                        @case ('tel') { <input type="tel" class="erp-input font-mono" dir="ltr" [formControl]="ctrl(f.key)" [placeholder]="ph(f)" /> }
                        @case ('url') { <input type="url" class="erp-input" dir="ltr" [formControl]="ctrl(f.key)" [placeholder]="ph(f)" /> }
                        @case ('readonly') { <input type="text" readonly class="erp-input bg-slate-50" [class.font-mono]="f.mono" [value]="display(f)" /> }
                        @case ('image') {
                          <div class="flex items-center gap-3">
                            @if (ctrl(f.key).value) { <img [src]="ctrl(f.key).value" alt="" class="h-14 w-14 rounded-lg border border-slate-200 object-contain" /> }
                            @else { <span class="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300"><erp-icon name="camera" [size]="20" /></span> }
                            @if (!ctrl(f.key).disabled) {
                              <label class="erp-btn-ghost erp-btn-sm cursor-pointer"><erp-icon name="upload" [size]="13" />{{ 'metadata.upload' | transloco }}
                                <input type="file" accept="image/*" class="hidden" (change)="pickImage(f, $event)" /></label>
                              @if (ctrl(f.key).value) { <button type="button" class="erp-btn-danger erp-btn-sm" (click)="ctrl(f.key).setValue('')">{{ 'metadata.remove' | transloco }}</button> }
                            }
                          </div>
                        }
                        @case ('one2many') {
                          <div class="overflow-x-auto rounded-lg border border-slate-200">
                            <table class="erp-table">
                              <thead><tr>@for (c of f.columns ?? []; track c.key) { <th [class]="c.width ?? ''">{{ c.label | transloco }}</th> }<th class="w-8"></th></tr></thead>
                              <tbody>
                                @for (row of rows(f); track $index) {
                                  <tr>
                                    @for (c of f.columns ?? []; track c.key) {
                                      <td class="!px-1.5 !py-1">
                                        @if (c.type === 'select') {
                                          <select class="erp-input erp-input-sm" [disabled]="ctrl(f.key).disabled" [value]="row[c.key] ?? ''" (change)="setCell(f, $index, c.key, $any($event.target).value)">
                                            @for (o of cellOptions(c, row); track o.value) { <option [value]="o.value" [selected]="o.value === row[c.key]">{{ o.label }}</option> }
                                          </select>
                                        } @else {
                                          <input class="erp-input erp-input-sm" [class.font-mono]="c.mono" [attr.dir]="c.rtl ? 'rtl' : null" [disabled]="ctrl(f.key).disabled" [value]="row[c.key] ?? ''" (input)="setCell(f, $index, c.key, $any($event.target).value)" />
                                        }
                                      </td>
                                    }
                                    <td class="!px-1 !py-1">@if (!ctrl(f.key).disabled) { <button type="button" class="p-1 text-rose-500 hover:text-rose-700" [attr.aria-label]="'metadata.remove' | transloco" (click)="removeRow(f, $index)"><erp-icon name="trash" [size]="14" /></button> }</td>
                                  </tr>
                                } @empty { <tr><td [attr.colspan]="(f.columns?.length ?? 0) + 1" class="py-3 text-center text-slate-400">{{ 'common.noResults' | transloco }}</td></tr> }
                              </tbody>
                            </table>
                            @if (!ctrl(f.key).disabled) { <div class="border-t border-slate-100 p-1.5"><button type="button" class="erp-btn-ghost erp-btn-sm" (click)="addRow(f)"><erp-icon name="plus" [size]="13" />{{ 'metadata.add' | transloco }}</button></div> }
                          </div>
                        }
                        @default {
                          <input type="text" class="erp-input" [class.font-mono]="f.mono" [attr.dir]="f.rtl ? 'rtl' : null" [formControl]="ctrl(f.key)" [placeholder]="ph(f)" [attr.list]="f.suggestions ? 'dl-' + f.key : null" />
                          @if (f.suggestions) { <datalist [id]="'dl-' + f.key">@for (o of suggestionsOf(f); track o.value) { <option [value]="o.label"></option> }</datalist> }
                        }
                      }
                    </label>
                  }
                  @if (errorOf(f); as e) { <span role="alert" class="mt-1 block text-[11px] text-rose-600">{{ e }}</span> }
                  @else if (f.hint) { <span class="mt-1 block text-[10px] text-slate-400">{{ f.hint | transloco }}</span> }
                </div>
              }
            }
          </div>
        </section>
    </ng-template>`,
})
export class MetadataFormComponent {
  private readonly i18n = inject(I18n);

  readonly view = input.required<ViewDef>();
  /** The record being edited. Replacing the object resets the form. */
  readonly value = input.required<Rec>();
  readonly readonly = input<boolean>(false);
  readonly lookups = input<Lookups>({});
  /** Problem Details `errors[]` mapped by field key (appendix A.9). */
  readonly serverErrors = input<Record<string, string>>({});

  /** `split` puts sections with `column: 2` on the right; projected content goes below them. */
  readonly layout = input<'single' | 'split'>('single');
  readonly valueChange = output<Rec>();

  protected readonly activeTab = signal('');
  private readonly form = new FormGroup<Record<string, AbstractControl>>({});
  private readonly shown = signal(false);
  private readonly snapshot = signal<Rec>({});
  /** Live values (reactive), for hosts that react to what the user is typing. */
  readonly state = this.snapshot.asReadonly();

  protected readonly tabTitles = computed(() => this.view().tabs ?? []);
  protected readonly visibleSections = computed(() => {
    const v = this.view();
    const tab = this.activeTab() || v.tabs?.[0]?.id;
    return v.sections.filter(s => (!v.tabs || s.tab === tab) && (!s.visible || s.visible(this.snapshot())));
  });

  protected readonly leftSections = computed(() => this.visibleSections().filter(x => x.column !== 2));
  protected readonly rightSections = computed(() => this.visibleSections().filter(x => x.column === 2));

  constructor() {
    // (Re)build controls when the view changes
    effect(() => {
      const view = this.view();
      untracked(() => this.build(view));
    });
    // Reset values when a different record arrives
    effect(() => {
      const v = this.value();
      untracked(() => this.load(v));
    });
    effect(() => {
      const ro = this.readonly();
      untracked(() => this.applyDisabled(ro));
    });
    const sig = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });
    let first = true;
    effect(() => {
      sig();
      untracked(() => {
        const next = { ...this.value(), ...this.form.getRawValue() };
        this.snapshot.set(next);
        this.applyDisabled(this.readonly());
        // User edits only: loading a record uses emitEvent:false, so a host can mirror edits without feedback loops
        if (!first) this.valueChange.emit(next);
        first = false;
      });
    });
  }

  // ------------------------------------------------------------------ public API for the host page
  /** Marks everything touched and reports validity. */
  validate(): boolean {
    this.shown.set(true);
    this.form.markAllAsTouched();
    return this.form.valid;
  }
  /** The record with the edited values merged in. */
  current(): Rec {
    return { ...this.value(), ...this.form.getRawValue() };
  }
  get dirty(): boolean {
    return this.form.dirty;
  }
  /** Programmatic edit (e.g. choosing a customer fills its tax number). Emits `valueChange` like a user edit. */
  patchValue(values: Rec): void {
    for (const [k, v] of Object.entries(values)) this.form.controls[k]?.setValue(v);
  }
  /** First error message, e.g. for a banner. */
  firstError(): string {
    for (const f of this.allFields()) {
      const e = this.errorOf(f);
      if (e) return e;
    }
    return '';
  }

  // ------------------------------------------------------------------ template helpers
  protected ctrl(key: string): FormControl<unknown> {
    let c = this.form.controls[key] as FormControl<unknown> | undefined;
    if (!c) { c = new FormControl<unknown>(null); this.form.addControl(key, c as never); }
    return c;
  }
  protected grid(s: SectionDef): string {
    return GRID[s.columns ?? 2] + (this.packed(s) ? ' sm:grid-flow-dense' : '');
  }
  protected span(f: FieldDef): string {
    return `${SPAN[String(f.span ?? 1)]} ${f.column ? COLUMN[f.column] : ''}`.trim();
  }
  /** A section whose fields are pinned to columns packs them densely (left column first, then right). */
  protected packed(s: SectionDef): boolean {
    return s.fields.some(f => f.column);
  }
  protected isRequired(f: FieldDef): boolean {
    return !!f.required || !!f.requiredWhen?.(this.snapshot());
  }
  protected ph(f: FieldDef): string {
    return f.placeholder ? this.i18n.tr(f.placeholder) : '';
  }
  protected isVisible(f: FieldDef): boolean {
    return !f.visible || f.visible(this.snapshot());
  }
  protected optionsOf(f: FieldDef): Option[] {
    const o = f.options ?? (f.resource ? this.lookups()[f.resource] : undefined) ?? [];
    return typeof o === 'function' ? o(this.snapshot(), this.lookups()) : o;
  }
  protected suggestionsOf(f: FieldDef): Option[] {
    return (f.suggestions ? this.lookups()[f.suggestions] : undefined) ?? [];
  }
  protected cellOptions(c: NonNullable<FieldDef['columns']>[number], row: Rec): Option[] {
    const o = c.options ?? [];
    return typeof o === 'function' ? o(row, this.lookups()) : o;
  }
  protected display(f: FieldDef): string {
    const v = this.snapshot()[f.key];
    if (v === null || v === undefined || v === '') return '';
    const opt = this.optionsOf(f).find(o => o.value === v);
    return opt ? opt.label : String(v);
  }
  protected hasMany(f: FieldDef, o: Option): boolean {
    return ((this.ctrl(f.key).value as unknown[]) ?? []).includes(o.value);
  }
  protected toggleMany(f: FieldDef, o: Option): void {
    const cur = [...(((this.ctrl(f.key).value as unknown[]) ?? []) as Option['value'][])];
    const i = cur.indexOf(o.value);
    if (i >= 0) cur.splice(i, 1);
    else cur.push(o.value);
    this.ctrl(f.key).setValue(cur);
    this.ctrl(f.key).markAsDirty();
  }
  protected normalizeMoney(f: FieldDef): void {
    const c = this.ctrl(f.key);
    const v = String(c.value ?? '').trim();
    if (v && DECIMAL_RE.test(v)) c.setValue(dec(v, f.places ?? 2), { emitEvent: false });
  }
  protected pickImage(f: FieldDef, ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { this.ctrl(f.key).setValue(String(r.result)); this.ctrl(f.key).markAsDirty(); };
    r.readAsDataURL(file);
  }
  protected rows(f: FieldDef): Rec[] {
    return (this.ctrl(f.key).value as Rec[]) ?? [];
  }
  protected addRow(f: FieldDef): void {
    const row = f.newRow ? f.newRow() : Object.fromEntries((f.columns ?? []).map(c => [c.key, '']));
    this.ctrl(f.key).setValue([...this.rows(f), row]);
    this.ctrl(f.key).markAsDirty();
  }
  protected removeRow(f: FieldDef, i: number): void {
    this.ctrl(f.key).setValue(this.rows(f).filter((_, idx) => idx !== i));
    this.ctrl(f.key).markAsDirty();
  }
  protected setCell(f: FieldDef, i: number, key: string, v: string): void {
    this.ctrl(f.key).setValue(this.rows(f).map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
    this.ctrl(f.key).markAsDirty();
  }
  protected errorOf(f: FieldDef): string {
    const server = this.serverErrors()[f.key];
    if (server) return server;
    const c = this.form.controls[f.key];
    if (!c || !(c.touched || this.shown()) || c.valid || c.disabled) return '';
    const e = c.errors ?? {};
    if (e['required']) return this.i18n.tr('metadata.required');
    if (e['pattern']) return f.patternMessage ? this.i18n.tr(f.patternMessage) : this.i18n.tr('metadata.invalid');
    if (e['decimal']) return this.i18n.tr('metadata.invalidNumber');
    if (e['min'] || e['max']) return this.i18n.tr('metadata.outOfRange');
    if (typeof e['custom'] === 'string') return this.i18n.tr(e['custom']);
    return this.i18n.tr('metadata.invalid');
  }

  // ------------------------------------------------------------------ internals
  private allFields(): FieldDef[] {
    return this.view().sections.flatMap(s => s.fields);
  }

  private build(view: ViewDef): void {
    Object.keys(this.form.controls).forEach(k => this.form.removeControl(k as never));
    for (const f of view.sections.flatMap(s => s.fields)) {
      const validators: ValidatorFn[] = [];
      if ((f.required || f.requiredWhen) && f.type !== 'boolean') validators.push(this.requiredWhenVisible(f));
      if (f.pattern) validators.push(Validators.pattern(f.pattern));
      if (f.min !== undefined) validators.push(Validators.min(f.min));
      if (f.max !== undefined) validators.push(Validators.max(f.max));
      if (f.type === 'money') validators.push(c => (c.value === null || c.value === '' || DECIMAL_RE.test(String(c.value)) ? null : { decimal: true }));
      if (f.validate) validators.push(c => { const m = f.validate?.(c.value, this.snapshot()); return m ? ({ custom: m } as ValidationErrors) : null; });
      const control = new FormControl<unknown>(null, validators);
      if (f.clears?.length) control.valueChanges.subscribe(() => f.clears?.forEach(k => this.form.controls[k]?.setValue(null)));
      this.form.addControl(f.key, control as never);
    }
    if (!this.activeTab()) this.activeTab.set(view.tabs?.[0]?.id ?? '');
    this.load(this.value());
  }

  private requiredWhenVisible(f: FieldDef): ValidatorFn {
    return c => {
      if (f.visible && !f.visible(this.snapshot())) return null;
      if (!f.required && !f.requiredWhen?.(this.snapshot())) return null;
      const v = c.value;
      const empty = v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
      return empty ? { required: true } : null;
    };
  }

  private load(v: Rec): void {
    const patch: Rec = {};
    for (const f of this.allFields()) {
      const raw = v[f.key];
      patch[f.key] = raw === undefined ? (f.type === 'boolean' ? false : f.type === 'many2many' || f.type === 'one2many' ? [] : null) : raw;
    }
    this.form.reset(patch, { emitEvent: false });
    this.shown.set(false);
    this.snapshot.set({ ...v, ...patch });
    this.applyDisabled(this.readonly());
  }

  private applyDisabled(ro: boolean): void {
    for (const f of this.allFields()) {
      const c = this.form.controls[f.key];
      if (!c) continue;
      const off = ro || !!f.readonly || !!f.disabled?.(this.snapshot());
      if (off && c.enabled) c.disable({ emitEvent: false });
      else if (!off && c.disabled) c.enable({ emitEvent: false });
    }
  }
}

import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, effect, forwardRef, inject, input, output, signal, untracked } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

export type SelectValue = string | number | boolean | null;
export interface SelectOption { value: SelectValue; label: string; group?: SelectValue; hint?: string; /** The source record, so a host can fill other fields when this one is picked. */ data?: unknown }
/** Async option source. `ids` asks for the labels of already-chosen values (hydration), otherwise `query` filters. */
export type SelectSearch = (query: string, ids?: SelectValue[]) => Promise<SelectOption[]>;

/**
 * Many2one dropdown: type to search, arrow keys and Enter to pick, Esc to close, x to clear.
 * Options come from a fixed list (`options`) or an async `search` (large tables such as partners or accounts).
 * A reactive-forms control: its value is the option's `value` (an id), or null.
 */
@Component({
  selector: 'erp-select',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true }],
  host: { class: 'relative block' },
  template: `
    <div class="erp-input flex items-center gap-1 !py-0" [class.opacity-60]="disabled()" [class.ring-2]="open()" [class.ring-emerald-200]="open()">
      <input #box type="text" role="combobox" autocomplete="off" class="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
        [attr.aria-expanded]="open()" [attr.aria-controls]="listId" [attr.aria-activedescendant]="open() && active() >= 0 ? listId + '-' + active() : null"
        [disabled]="disabled()" [placeholder]="open() ? (selectedLabel() || placeholder()) : placeholder()"
        [value]="open() ? query() : selectedLabel()" (focus)="openList()" (input)="onType($any($event.target).value)" (keydown)="onKey($event)" />
      @if (selected() !== null && clearable() && !disabled()) {
        <button type="button" class="p-0.5 text-slate-400 hover:text-slate-700" aria-label="Clear" (mousedown)="$event.preventDefault()" (click)="pick(null)"><erp-icon name="x" [size]="13" /></button>
      }
      <erp-icon name="chevron-down" [size]="14" class="shrink-0 text-slate-400" />
    </div>
    @if (open()) {
      <ul [id]="listId" role="listbox" class="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
        @if (loading()) { <li class="px-3 py-2 text-xs text-slate-400">Searching…</li> }
        @for (o of shown(); track o.value; let i = $index) {
          <li role="option" [id]="listId + '-' + i" [attr.aria-selected]="o.value === selected()" class="cursor-pointer px-3 py-1.5"
            [class.bg-emerald-50]="i === active()" [class.font-semibold]="o.value === selected()"
            (mousedown)="$event.preventDefault()" (click)="pick(o)" (mouseenter)="active.set(i)">
            {{ o.label }}@if (o.hint) { <span class="ms-2 text-[11px] text-slate-400">{{ o.hint }}</span> }
          </li>
        } @empty { @if (!loading()) { <li class="px-3 py-2 text-xs text-slate-400">No results</li> } }
      </ul>
    }`,
})
export class SelectComponent implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input<SelectOption[]>([]);
  readonly search = input<SelectSearch | undefined>(undefined);
  readonly placeholder = input<string>('');
  readonly clearable = input<boolean>(true);
  /** Label to show before the options are loaded, e.g. the name that came with the record. */
  readonly labelHint = input<string>('');
  /** Fires when the user chooses (or clears) an option, with the whole option. */
  readonly picked = output<SelectOption | null>();
  protected readonly listId = `erp-select-${Math.random().toString(36).slice(2, 8)}`;

  protected readonly selected = signal<SelectValue>(null);
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(-1);
  protected readonly loading = signal(false);
  private readonly remote = signal<SelectOption[]>([]);
  /** Labels learnt for chosen values, so the box keeps showing a name after the list changes. */
  private readonly known = signal<Map<SelectValue, string>>(new Map());
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Id of the latest search; an answer to an older one is ignored (it would overwrite newer results). */
  private seq = 0;
  private onChange: (v: SelectValue) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  /** What the dropdown lists: the fixed options filtered by the text, or what the async search returned. */
  protected readonly shown = computed(() => {
    if (this.search()) return this.remote();
    const q = this.query().trim().toLowerCase();
    const all = this.options();
    return q ? all.filter(o => o.label.toLowerCase().includes(q)) : all;
  });
  protected readonly selectedLabel = computed(() => {
    const v = this.selected();
    if (v === null) return '';
    return this.options().find(o => o.value === v)?.label ?? this.known().get(v) ?? this.remote().find(o => o.value === v)?.label ?? (this.labelHint() || String(v));
  });

  constructor() {
    // an async value arrives as a bare id: ask the source for its label once
    effect(() => {
      const v = this.selected(); const s = this.search();
      if (v === null || !s || this.options().some(o => o.value === v)) return;
      if (untracked(() => this.known().has(v)) || untracked(() => this.labelHint())) return;
      void s('', [v]).then(r => { if (r[0]) this.remember(r[0]); });
    });
    effect(() => { this.shown(); untracked(() => this.active.set(this.shown().length ? 0 : -1)); });
  }

  writeValue(v: SelectValue | undefined): void { this.selected.set(v === undefined || v === '' ? null : v); }
  registerOnChange(fn: (v: SelectValue) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected openList(): void {
    if (this.disabled() || this.open()) return;
    this.query.set(''); this.open.set(true);
    if (this.search()) this.run('');
  }
  protected onType(text: string): void {
    this.query.set(text); this.open.set(true);
    // drop the old results at once so a stale option cannot be picked while the new search runs
    if (this.search()) { clearTimeout(this.timer); this.seq++; this.remote.set([]); this.loading.set(true); this.timer = setTimeout(() => this.run(text), 220); }
  }
  private run(text: string): void {
    const s = this.search(); if (!s) return;
    const mine = ++this.seq;
    this.loading.set(true);
    void s(text).then(r => { if (mine !== this.seq) return; this.remote.set(r); this.loading.set(false); }).catch(() => { if (mine !== this.seq) return; this.remote.set([]); this.loading.set(false); });
  }
  private remember(o: SelectOption): void { this.known.update(m => new Map(m).set(o.value, o.label)); }

  protected pick(o: SelectOption | null): void {
    if (o) this.remember(o);
    this.selected.set(o ? o.value : null);
    this.onChange(o ? o.value : null); this.onTouched();
    this.picked.emit(o);
    this.close();
  }
  private close(): void { this.open.set(false); this.query.set(''); }

  protected onKey(e: KeyboardEvent): void {
    const n = this.shown().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!this.open()) this.openList(); else this.active.update(i => Math.min(i + 1, n - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.update(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && this.open()) { e.preventDefault(); const o = this.shown()[this.active()]; if (o) this.pick(o); }
    else if (e.key === 'Escape' || e.key === 'Tab') this.close();
  }

  @HostListener('document:mousedown', ['$event'])
  protected outside(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) { this.close(); this.onTouched(); }
  }
}

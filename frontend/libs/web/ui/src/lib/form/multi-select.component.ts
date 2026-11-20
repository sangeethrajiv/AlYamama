import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, effect, forwardRef, inject, input, signal, untracked } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import type { SelectOption, SelectSearch, SelectValue } from './select.component';

/**
 * Many2many control: chosen records show as removable chips, a search box adds more.
 * Same sources as `erp-select`. Its value is an array of option values.
 */
@Component({
  selector: 'erp-multi-select',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MultiSelectComponent), multi: true }],
  host: { class: 'relative block' },
  template: `
    <div class="erp-input flex min-h-[2.25rem] flex-wrap items-center gap-1 !py-1" [class.opacity-60]="disabled()" [class.ring-2]="open()" [class.ring-emerald-200]="open()" (click)="focus()">
      @for (v of values(); track v) {
        <span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
          {{ labelOf(v) }}
          @if (!disabled()) { <button type="button" class="text-emerald-600 hover:text-emerald-900" [attr.aria-label]="'Remove ' + labelOf(v)" (mousedown)="$event.preventDefault()" (click)="remove(v)"><erp-icon name="x" [size]="11" /></button> }
        </span>
      }
      <input #box type="text" role="combobox" autocomplete="off" class="min-w-[6rem] flex-1 bg-transparent py-0.5 text-sm outline-none"
        [attr.aria-expanded]="open()" [disabled]="disabled()" [placeholder]="values().length ? '' : placeholder()"
        [value]="query()" (focus)="openList()" (input)="onType($any($event.target).value)" (keydown)="onKey($event)" />
    </div>
    @if (open()) {
      <ul role="listbox" aria-multiselectable="true" class="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
        @if (loading()) { <li class="px-3 py-2 text-xs text-slate-400">Searching…</li> }
        @for (o of shown(); track o.value; let i = $index) {
          <li role="option" [attr.aria-selected]="has(o.value)" class="flex cursor-pointer items-center justify-between px-3 py-1.5"
            [class.bg-emerald-50]="i === active()" (mousedown)="$event.preventDefault()" (click)="toggle(o)" (mouseenter)="active.set(i)">
            <span>{{ o.label }}</span>@if (has(o.value)) { <erp-icon name="check" [size]="13" class="text-emerald-600" /> }
          </li>
        } @empty { @if (!loading()) { <li class="px-3 py-2 text-xs text-slate-400">No results</li> } }
      </ul>
    }`,
})
export class MultiSelectComponent implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input<SelectOption[]>([]);
  readonly search = input<SelectSearch | undefined>(undefined);
  readonly placeholder = input<string>('');

  protected readonly values = signal<SelectValue[]>([]);
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly loading = signal(false);
  private readonly remote = signal<SelectOption[]>([]);
  private readonly known = signal<Map<SelectValue, string>>(new Map());
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Id of the latest search; an answer to an older one is ignored (it would overwrite newer results). */
  private seq = 0;
  private onChange: (v: SelectValue[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly shown = computed(() => {
    if (this.search()) return this.remote();
    const q = this.query().trim().toLowerCase();
    return q ? this.options().filter(o => o.label.toLowerCase().includes(q)) : this.options();
  });

  constructor() {
    // chosen ids without a known label (loaded with a record): ask the source for them
    effect(() => {
      const s = this.search(); const vs = this.values();
      if (!s) return;
      const missing = vs.filter(v => !untracked(() => this.known()).has(v) && !untracked(() => this.options()).some(o => o.value === v));
      if (missing.length) void s('', missing).then(r => r.forEach(o => this.remember(o)));
    });
    effect(() => { this.shown(); untracked(() => this.active.set(0)); });
  }

  writeValue(v: SelectValue[] | null | undefined): void { this.values.set(Array.isArray(v) ? [...v] : []); }
  registerOnChange(fn: (v: SelectValue[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected labelOf(v: SelectValue): string {
    return this.options().find(o => o.value === v)?.label ?? this.known().get(v) ?? this.remote().find(o => o.value === v)?.label ?? String(v);
  }
  protected has(v: SelectValue): boolean { return this.values().includes(v); }
  private remember(o: SelectOption): void { this.known.update(m => new Map(m).set(o.value, o.label)); }
  protected focus(): void { this.host.nativeElement.querySelector('input')?.focus(); }

  protected openList(): void {
    if (this.disabled() || this.open()) return;
    this.open.set(true);
    if (this.search()) this.run('');
  }
  protected onType(t: string): void {
    this.query.set(t); this.open.set(true);
    if (this.search()) { clearTimeout(this.timer); this.seq++; this.remote.set([]); this.loading.set(true); this.timer = setTimeout(() => this.run(t), 220); }
  }
  private run(t: string): void {
    const s = this.search(); if (!s) return;
    const mine = ++this.seq;
    this.loading.set(true);
    void s(t).then(r => { if (mine !== this.seq) return; this.remote.set(r); this.loading.set(false); }).catch(() => { if (mine !== this.seq) return; this.remote.set([]); this.loading.set(false); });
  }

  protected toggle(o: SelectOption): void {
    this.remember(o);
    this.commit(this.has(o.value) ? this.values().filter(x => x !== o.value) : [...this.values(), o.value]);
    this.query.set('');
  }
  protected remove(v: SelectValue): void { this.commit(this.values().filter(x => x !== v)); }
  private commit(next: SelectValue[]): void { this.values.set(next); this.onChange(next); this.onTouched(); }

  protected onKey(e: KeyboardEvent): void {
    const n = this.shown().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!this.open()) this.openList(); else this.active.update(i => Math.min(i + 1, n - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.update(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && this.open()) { e.preventDefault(); const o = this.shown()[this.active()]; if (o) this.toggle(o); }
    else if (e.key === 'Backspace' && !this.query() && this.values().length) this.remove(this.values()[this.values().length - 1]);
    else if (e.key === 'Escape' || e.key === 'Tab') this.open.set(false);
  }

  @HostListener('document:mousedown', ['$event'])
  protected outside(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) { this.open.set(false); this.onTouched(); }
  }
}

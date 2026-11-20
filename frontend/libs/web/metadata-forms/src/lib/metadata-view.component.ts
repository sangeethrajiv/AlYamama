import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PillComponent, I18n } from '@erp/web/ui';
import { formatDecimal } from '@erp/shared/utils';
import type { FieldDef, Lookups, Option, Rec, SectionDef, ViewDef } from './view.model';

/** Read-only rendering of a metadata view: one card per section with label/value pairs. */
@Component({
  selector: 'erp-metadata-view',
  imports: [TranslocoPipe, PillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (s of sections(); track s.id) {
      <section class="rounded-xl border border-slate-200 bg-white p-4">
        @if (s.title) { <h3 class="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{{ s.title | transloco }}</h3> }
        <dl class="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
          @for (f of visible(s); track f.key) {
            <div class="min-w-0" [class.sm:col-span-2]="f.span === 'full' || f.span === 2">
              <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">{{ f.label | transloco }}</dt>
              <dd class="mt-0.5 break-words text-xs font-medium text-slate-800">
                @switch (f.type) {
                  @case ('boolean') { <erp-pill [tone]="value()[f.key] ? 'green' : 'slate'">{{ (value()[f.key] ? 'common.yes' : 'common.no') | transloco }}</erp-pill> }
                  @case ('many2many') { <div class="flex flex-wrap gap-1">@for (t of tags(f); track t) { <erp-pill tone="green">{{ t }}</erp-pill> } @empty { <span class="text-slate-300">—</span> }</div> }
                  @case ('email') { @if (text(f)) { <a [href]="'mailto:' + text(f)" class="font-bold text-emerald-700 hover:underline">{{ text(f) }}</a> } @else { <span class="text-slate-300">—</span> } }
                  @case ('tel') { @if (text(f)) { <a [href]="'tel:' + text(f).replace(' ', '')" class="hover:underline" dir="ltr">{{ text(f) }}</a> } @else { <span class="text-slate-300">—</span> } }
                  @default {
                    @if (text(f)) { <span [attr.dir]="f.rtl ? 'rtl' : null" [class.font-mono]="f.mono">{{ text(f) }}</span> } @else { <span class="text-slate-300">—</span> }
                  }
                }
              </dd>
            </div>
          }
        </dl>
      </section>
    }`,
})
export class MetadataViewComponent {
  private readonly i18n = inject(I18n);
  readonly view = input.required<ViewDef>();
  readonly value = input.required<Rec>();
  readonly lookups = input<Lookups>({});
  /** Restrict to some sections. */
  readonly only = input<string[] | null>(null);

  protected readonly sections = computed<SectionDef[]>(() => this.view().sections.filter(s => !this.only() || this.only()?.includes(s.id)));
  protected visible(s: SectionDef): FieldDef[] {
    return s.fields.filter(f => (!f.visible || f.visible(this.value())) && f.type !== 'image' && f.type !== 'one2many');
  }

  private options(f: FieldDef): Option[] {
    const o = f.options ?? (f.resource ? this.lookups()[f.resource] : undefined) ?? [];
    return typeof o === 'function' ? o(this.value(), this.lookups()) : o;
  }
  protected tags(f: FieldDef): string[] {
    return ((this.value()[f.key] as unknown[]) ?? []).map(v => this.options(f).find(o => o.value === v)?.label ?? `#${v}`);
  }
  protected text(f: FieldDef): string {
    const v = this.value()[f.key];
    if (v === null || v === undefined || v === '') return '';
    if (f.type === 'select' || f.type === 'many2one') {
      const o = this.options(f).find(x => x.value === v);
      return o ? (f.translateOptions ? this.i18n.tr(o.label) : o.label) : `#${v}`;
    }
    if (f.type === 'money') return formatDecimal(String(v), f.places ?? 2);
    return String(v);
  }
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const TONES = ['bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700'];

/** Photo, or initials on a tone derived from the name. */
@Component({
  selector: 'erp-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="name()" [style.width.px]="size()" [style.height.px]="size()" class="shrink-0 border border-slate-200 object-cover" [class]="round() ? 'rounded-full' : 'rounded-xl'" />
    } @else {
      <span aria-hidden="true" class="flex shrink-0 items-center justify-center font-extrabold" [class]="(round() ? 'rounded-full ' : 'rounded-xl ') + tone()"
        [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.36">{{ initials() }}</span>
    }`,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly src = input<string | undefined>(undefined);
  readonly size = input<number>(36);
  readonly round = input<boolean>(false);
  protected readonly initials = computed(
    () => this.name().replace(/\(.*?\)/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?',
  );
  protected readonly tone = computed(() => TONES[[...this.name()].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]);
}

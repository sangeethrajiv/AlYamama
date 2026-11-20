import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS } from './icon-registry';

/** `<erp-icon name="search" [size]="16" />` renders a Lucide icon from the internal registry. */
@Component({
  selector: 'erp-icon',
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0 items-center justify-center', '[class.rtl-flip]': 'flip()' },
  template: `@if (icon(); as i) {
    <svg [lucideIcon]="i" [size]="size()" [strokeWidth]="strokeWidth()" aria-hidden="true"></svg>
  }`,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input<number>(16);
  readonly strokeWidth = input<number>(2);
  /** Mirror directional icons (chevrons, arrows) in right-to-left layouts. */
  readonly flip = input<boolean>(false);
  protected readonly icon = computed(() => ICONS[this.name()] ?? null);
}

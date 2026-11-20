import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogFrameComponent, IconComponent } from '@erp/web/ui';

export interface BlockedData { title: string; message: string }

/** Explains why Archive / Delete is refused (the record is still referenced). One OK button, no choice to make. */
@Component({
  selector: 'erp-product-blocked-dialog',
  imports: [DialogFrameComponent, IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="data.title">
      <div class="flex gap-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"><erp-icon name="x-circle" [size]="18" /></span>
        <p class="pt-1 text-sm text-slate-600">{{ data.message }}</p>
      </div>
      <div footer class="contents"><button type="button" class="erp-btn-primary" (click)="ref.close()">{{ 'product.ok' | transloco }}</button></div>
    </erp-dialog-frame>`,
})
export class BlockedDialogComponent {
  protected readonly data = inject<BlockedData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
}

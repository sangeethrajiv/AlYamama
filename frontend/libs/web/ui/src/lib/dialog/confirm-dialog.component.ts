import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogFrameComponent } from './dialog-frame.component';

export interface ConfirmData {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** When set, asks for text (e.g. a rejection reason) and returns it. */
  prompt?: { label: string; required?: boolean; placeholder?: string; initial?: string };
}

@Component({
  selector: 'erp-confirm-dialog',
  imports: [DialogFrameComponent, FormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="data.title">
      @if (data.message) { <p class="text-sm text-slate-600">{{ data.message }}</p> }
      @if (data.prompt; as p) {
        <label class="mt-3 block">
          <span class="mb-1 block text-xs font-bold text-slate-600">{{ p.label }}</span>
          <textarea class="erp-input min-h-20" [placeholder]="p.placeholder ?? ''" [ngModel]="text()" (ngModelChange)="text.set($event)" rows="3"></textarea>
        </label>
      }
      <div footer class="contents">
        <button type="button" class="erp-btn-ghost" (click)="ref.close()">{{ data.cancelLabel ?? ('common.cancel' | transloco) }}</button>
        <button type="button" [class]="data.danger ? 'erp-btn-danger' : 'erp-btn-primary'" [disabled]="!valid()" (click)="confirm()">
          {{ data.confirmLabel ?? ('common.confirm' | transloco) }}
        </button>
      </div>
    </erp-dialog-frame>`,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string | boolean | undefined>>(DialogRef);
  protected readonly text = signal(this.data.prompt?.initial ?? '');
  protected valid(): boolean {
    return !this.data.prompt?.required || this.text().trim().length > 0;
  }
  protected confirm(): void {
    this.ref.close(this.data.prompt ? this.text().trim() : true);
  }
}

import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '@erp/web/api-client';
import { DialogFrameComponent, ErrorBannerComponent, I18n } from '@erp/web/ui';
import { MetadataFormComponent } from './metadata-form.component';
import type { Lookups, Rec, ViewDef } from './view.model';

export interface CrudDialogData<T extends object> {
  title: string;
  record: T;
  view: ViewDef;
  lookups: Lookups;
  readOnly: boolean;
  /** Return an error message / translation key, or an empty string when valid. */
  validate?: (record: T) => string;
  /** Persist. Throw ApiError to keep the dialog open and show server-side errors. */
  save: (record: T) => Promise<void> | void;
}

@Component({
  selector: 'erp-crud-dialog',
  imports: [DialogFrameComponent, MetadataFormComponent, ErrorBannerComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="data.title">
      <div class="mx-auto max-w-3xl space-y-3">
        <erp-error-banner [text]="error()" />
        <erp-metadata-form [view]="data.view" [value]="asRec(data.record)" [readonly]="data.readOnly" [lookups]="data.lookups" [serverErrors]="serverErrors()" />
      </div>
      <div footer class="contents">
        @if (!data.readOnly) { <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="save()">{{ 'common.save' | transloco }}</button> }
        <button type="button" class="erp-btn-ghost" (click)="ref.close()">{{ (data.readOnly ? 'common.close' : 'common.discard') | transloco }}</button>
      </div>
    </erp-dialog-frame>`,
})
export class CrudDialogComponent<T extends object> {
  protected readonly data = inject<CrudDialogData<T>>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly i18n = inject(I18n);
  private readonly form = viewChild.required(MetadataFormComponent);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly serverErrors = signal<Record<string, string>>({});

  protected asRec(r: T): Rec { return r as unknown as Rec; }

  protected async save(): Promise<void> {
    this.error.set('');
    this.serverErrors.set({});
    const f = this.form();
    if (!f.validate()) return this.error.set(f.firstError() || this.i18n.tr('metadata.invalid'));
    const rec = f.current() as T;
    const msg = this.data.validate?.(rec);
    if (msg) return this.error.set(this.i18n.tr(msg));
    this.busy.set(true);
    try {
      await this.data.save(rec);
      this.ref.close(true);
    } catch (e) {
      if (e instanceof ApiError) {
        this.error.set(e.problem.detail ?? e.problem.title);
        this.serverErrors.set(Object.fromEntries((e.problem.errors ?? []).map(x => [x.field, x.message])));
      } else {
        this.error.set(this.i18n.tr('common.errorGeneric'));
      }
    } finally {
      this.busy.set(false);
    }
  }
}

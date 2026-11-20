import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { DialogService } from '@erp/web/ui';
import { TranslocoService } from '@jsverse/transloco';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before leaving a form with unsaved edits (appendix A.9). */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = component => {
  if (!component.hasUnsavedChanges()) return true;
  const t = inject(TranslocoService);
  return inject(DialogService).confirm({
    title: t.translate('common.unsavedTitle'),
    message: t.translate('common.unsavedMessage'),
    confirmLabel: t.translate('common.discard'),
    danger: true,
  });
};

import { Injectable, inject } from '@angular/core';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import type { ComponentType } from '@angular/cdk/portal';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, type ConfirmData } from './confirm-dialog.component';

export type DialogKind = 'drawer' | 'drawer-wide' | 'modal' | 'modal-wide';

export interface OpenOptions<D> {
  data?: D;
  kind?: DialogKind;
  ariaLabel?: string;
  /** Prevents closing by backdrop click or Esc (use for forms with unsaved work). */
  disableClose?: boolean;
}

/** Single entry point for drawers, modals and confirmations. Wraps the CDK so features never import it directly. */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  open<C, D = unknown, R = unknown>(component: ComponentType<C>, options: OpenOptions<D> = {}): DialogRef<R, C> {
    const kind = options.kind ?? 'modal';
    const drawer = kind.startsWith('drawer');
    const wide = kind.endsWith('wide');
    return this.dialog.open<R, D, C>(component, {
      data: options.data,
      ariaLabel: options.ariaLabel,
      disableClose: options.disableClose,
      hasBackdrop: true,
      backdropClass: 'erp-backdrop',
      panelClass: ['erp-panel', drawer ? 'erp-panel-drawer' : 'erp-panel-modal', wide ? 'erp-panel-wide' : 'erp-panel-normal'],
      positionStrategy: drawer
        ? this.overlay.position().global().top('0').end('0')
        : this.overlay.position().global().centerHorizontally().centerVertically(),
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
  }

  async confirm(data: ConfirmData): Promise<boolean> {
    const ref = this.open<ConfirmDialogComponent, ConfirmData, boolean>(ConfirmDialogComponent, { data, kind: 'modal' });
    return (await firstValueFrom(ref.closed, { defaultValue: false })) === true;
  }

  /** Asks for text; resolves to the trimmed text, or null when cancelled. */
  async prompt(data: ConfirmData): Promise<string | null> {
    const ref = this.open<ConfirmDialogComponent, ConfirmData, string>(ConfirmDialogComponent, { data, kind: 'modal' });
    const out = await firstValueFrom(ref.closed, { defaultValue: undefined });
    return typeof out === 'string' ? out : null;
  }
}

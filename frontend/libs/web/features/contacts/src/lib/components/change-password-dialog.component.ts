import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogFrameComponent, ErrorBannerComponent, I18n } from '@erp/web/ui';
import { ApiError } from '@erp/web/api-client';
import { ContactsStore } from '../data/contacts.store';

export interface ChangePasswordData { userId: number; name: string }

export const MIN_PASSWORD_LENGTH = 8;

/** Sets a new password for one user (admin reset: the old password is not asked for). */
@Component({
  selector: 'erp-change-password-dialog',
  imports: [DialogFrameComponent, ErrorBannerComponent, FormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="'contacts.users.changePassword' | transloco" [subtitle]="data.name">
      <form class="space-y-3" (ngSubmit)="save()" id="erp-change-password">
        <erp-error-banner [text]="error()" />
        <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'contacts.users.newPassword' | transloco }}</span>
          <input class="erp-input" type="password" name="pw" autocomplete="new-password" [ngModel]="pw()" (ngModelChange)="pw.set($event); error.set('')" /></label>
        <label class="block"><span class="mb-1 block text-[11px] font-bold text-slate-600">{{ 'contacts.users.confirmPassword' | transloco }}</span>
          <input class="erp-input" type="password" name="pw2" autocomplete="new-password" [ngModel]="pw2()" (ngModelChange)="pw2.set($event); error.set('')" /></label>
        <p class="text-[10px] text-slate-400">{{ 'contacts.users.passwordHint' | transloco: { n: min } }}</p>
      </form>
      <div footer class="contents">
        <button type="button" class="erp-btn-ghost" (click)="ref.close()">{{ 'common.cancel' | transloco }}</button>
        <button type="submit" form="erp-change-password" class="erp-btn-primary" [disabled]="!ready() || busy()">{{ 'contacts.users.changePassword' | transloco }}</button>
      </div>
    </erp-dialog-frame>`,
})
export class ChangePasswordDialogComponent {
  protected readonly data = inject<ChangePasswordData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly store = inject(ContactsStore);
  private readonly i18n = inject(I18n);

  protected readonly min = MIN_PASSWORD_LENGTH;
  protected readonly pw = signal('');
  protected readonly pw2 = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly ready = computed(() => this.pw().length > 0 && this.pw2().length > 0);

  protected async save(): Promise<void> {
    if (!this.ready() || this.busy()) return;
    if (this.pw().length < MIN_PASSWORD_LENGTH) return this.error.set(this.i18n.tr('contacts.users.err.passwordShort', { n: MIN_PASSWORD_LENGTH }));
    if (this.pw() !== this.pw2()) return this.error.set(this.i18n.tr('contacts.users.err.passwordMismatch'));
    this.busy.set(true);
    try {
      await this.store.changeUserPassword(this.data.userId, this.pw());
      this.ref.close(true);
    } catch (e) {
      this.error.set(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric'));
    } finally {
      this.busy.set(false);
    }
  }
}

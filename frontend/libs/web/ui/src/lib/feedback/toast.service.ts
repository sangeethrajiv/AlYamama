import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Global notifications (section 12.2: the shell owns them). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly bar = inject(MatSnackBar);
  success(message: string): void { this.show(message, 'erp-toast-success'); }
  error(message: string): void { this.show(message, 'erp-toast-error', 6000); }
  info(message: string): void { this.show(message, 'erp-toast-info'); }
  private show(message: string, panelClass: string, duration = 3500): void {
    this.bar.open(message, undefined, { duration, panelClass: [panelClass], horizontalPosition: 'end', verticalPosition: 'bottom' });
  }
}

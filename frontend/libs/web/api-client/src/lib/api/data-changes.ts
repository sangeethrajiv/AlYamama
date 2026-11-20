import { Injectable, signal } from '@angular/core';

/**
 * Monotonic counter that moves whenever data behind the API may have changed (a write through this client, or a
 * server push). Stores re-read when it moves, so a count in the sidebar and a list stay consistent.
 */
@Injectable({ providedIn: 'root' })
export class DataChanges {
  private readonly counter = signal(0);
  readonly revision = this.counter.asReadonly();
  bump(): void {
    this.counter.update(v => v + 1);
  }
}

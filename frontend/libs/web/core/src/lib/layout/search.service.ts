import { Injectable, signal } from '@angular/core';

/** Global search box in the header; list pages filter by this text. */
@Injectable({ providedIn: 'root' })
export class SearchService {
  readonly query = signal('');
  readonly term = () => this.query().trim().toLowerCase();
}

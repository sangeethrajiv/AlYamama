import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { AccountingBackend, BACKEND_CONFIG, type Rec } from '@erp/web/api-client';
import { IconComponent, ToastService } from '@erp/web/ui';

/**
 * Notes and attachments of one record (Odoo's chatter and attachments). `model` is the Odoo model name
 * (`account.move`, `account.payment`, ...) and `recordId` the row. Shown under a saved document.
 */
@Component({
  selector: 'erp-record-extras',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-2">
      <div class="space-y-2">
        <h3 class="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Notes</h3>
        @if (canWrite()) {
          <div class="flex gap-2">
            <textarea rows="2" class="erp-input flex-1" placeholder="Write a note…" [value]="draft()" (input)="draft.set($any($event.target).value)"></textarea>
            <button type="button" class="erp-btn-primary self-start" [disabled]="busy() || !draft().trim()" (click)="addNote()">Add</button>
          </div>
        }
        @for (n of notes(); track n['id']) {
          <div class="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
            <div class="flex items-center justify-between text-[10px] text-slate-400"><span>{{ n['author'] ?? 'System' }} · {{ str(n['create_date']).slice(0, 16).replace('T', ' ') }}</span>
              @if (n['kind'] === 'note' && canWrite()) { <button type="button" class="text-rose-500 hover:text-rose-700" aria-label="Delete note" (click)="removeNote(n['id'])"><erp-icon name="trash" [size]="12" /></button> }</div>
            <p class="mt-1 whitespace-pre-wrap text-slate-700">{{ n['body'] }}</p>
          </div>
        } @empty { <p class="text-xs text-slate-400">No notes yet.</p> }
      </div>
      <div class="space-y-2">
        <h3 class="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Attachments ({{ files().length }})</h3>
        @if (canWrite()) {
          <label class="erp-btn-ghost erp-btn-sm inline-flex cursor-pointer items-center gap-1.5"><erp-icon name="upload" [size]="13" />Attach a file
            <input type="file" class="hidden" (change)="upload($event)" /></label>
        }
        <ul class="divide-y divide-slate-100 text-xs">
          @for (f of files(); track f['id']) {
            <li class="flex items-center justify-between gap-2 py-1.5">
              <a class="truncate font-semibold text-emerald-700 hover:underline" [href]="url(f['id'])" target="_blank" rel="noopener">{{ f['name'] }}</a>
              <span class="flex shrink-0 items-center gap-2 text-slate-400">{{ size(f['file_size']) }}
                @if (canWrite()) { <button type="button" class="text-rose-500 hover:text-rose-700" aria-label="Delete file" (click)="removeFile(f['id'])"><erp-icon name="trash" [size]="12" /></button> }</span>
            </li>
          } @empty { <li class="py-1 text-slate-400">No files attached.</li> }
        </ul>
        @if (error()) { <p role="alert" class="text-[11px] text-rose-600">{{ error() }}</p> }
      </div>
    </section>`,
})
export class RecordExtrasComponent {
  private readonly ab = inject(AccountingBackend);
  private readonly toast = inject(ToastService);
  private readonly base = inject(BACKEND_CONFIG).baseUrl;

  readonly model = input.required<string>();
  readonly recordId = input.required<number>();
  /** Hide the controls for read-only users. */
  readonly canWrite = input<boolean>(true);

  protected readonly notes = signal<Rec[]>([]);
  protected readonly files = signal<Rec[]>([]);
  protected readonly draft = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() { effect(() => { this.model(); this.recordId(); untracked(() => void this.load()); }); }

  protected str = (v: unknown) => String(v ?? '');
  protected url = (id: unknown) => `${this.base}/accounting/attachments/${id}/download`;
  protected size = (n: unknown) => { const b = Number(n); return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b > 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`; };
  private path = (kind: string) => `/accounting/records/${this.model()}/${this.recordId()}/${kind}`;

  private async load(): Promise<void> {
    try {
      const [n, f] = await Promise.all([this.ab.get<Rec[]>(this.path('notes')), this.ab.get<Rec[]>(this.path('attachments'))]);
      this.notes.set(n); this.files.set(f); this.error.set('');
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Could not load notes.'); }
  }
  protected async addNote(): Promise<void> { await this.run(async () => { await this.ab.create(this.path('notes'), { body: this.draft() }); this.draft.set(''); }); }
  protected async removeNote(id: unknown): Promise<void> { await this.run(() => this.ab.remove(`/accounting/notes/${id}`)); }
  protected async removeFile(id: unknown): Promise<void> { await this.run(() => this.ab.remove(`/accounting/attachments/${id}`)); }
  protected async upload(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
    if (file.size > 8 * 1024 * 1024) { this.error.set('The file is larger than 8 MB.'); input.value = ''; return; }
    const data = await new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = () => bad(r.error); r.readAsDataURL(file); });
    await this.run(() => this.ab.create(this.path('attachments'), { name: file.name, mimetype: file.type, content_base64: data }));
    input.value = '';
  }
  private async run(fn: () => Promise<unknown>): Promise<void> {
    this.busy.set(true); this.error.set('');
    try { await fn(); await this.load(); } catch (e) { this.error.set(e instanceof Error ? e.message : 'The action failed.'); this.toast.error(this.error()); }
    finally { this.busy.set(false); }
  }
}

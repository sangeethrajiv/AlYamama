import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '@erp/web/api-client';
import { DialogService, I18n, ToastService } from '@erp/web/ui';
import { BlockedDialogComponent, type BlockedData } from '../components/blocked-dialog.component';
import { archiveBlocker, deleteBlocker } from '../models/product-rules';
import { singularKey, type EntityConfig, type Rec } from '../models/product-types';
import { ENTITY_BY_KEY } from '../models/product-entities';
import { ProductListMemory } from './list-memory';
import { ProductStore } from './product.store';

/** Archive / Restore / Delete with confirmation and "blocked" explanations, shared by the list and detail screens. */
@Injectable({ providedIn: 'root' })
export class ProductActions {
  private readonly store = inject(ProductStore);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18n);
  private readonly router = inject(Router);
  private readonly memory = inject(ProductListMemory);

  private what(cfg: EntityConfig): string { return this.i18n.tr(singularKey(cfg.key)); }
  private name(cfg: EntityConfig, rec: Rec): string { return cfg.nameOf(rec, this.store.ctx()); }

  private blocked(cfg: EntityConfig, verb: 'archive' | 'delete', reason: string): void {
    const data: BlockedData = { title: this.i18n.tr(`product.blocked.${verb}`, { what: this.what(cfg).toLowerCase() }), message: reason };
    this.dialog.open(BlockedDialogComponent, { data, kind: 'modal' });
  }
  private fail(cfg: EntityConfig, verb: 'archive' | 'delete', e: unknown): void {
    if (e instanceof ApiError && e.problem.status === 422) this.blocked(cfg, verb, e.problem.detail ?? e.problem.title);
    else this.toast.error(this.i18n.tr('common.errorGeneric'));
  }

  /** The record's stat button (Odoo `oe_stat_button`): open the related list already narrowed to this record. */
  openSmartButton(cfg: EntityConfig, rec: Rec): void {
    const sb = cfg.smartButton;
    if (!sb) return;
    const target = ENTITY_BY_KEY[sb.entity];
    this.memory.set(sb.entity, { q: '', status: 'active', filters: { [sb.filterKey]: String(rec.id) }, sort: target.defaultSort, page: 1, pageSize: 10 });
    void this.router.navigate(['/product', target.route]);
  }

  async requestArchive(cfg: EntityConfig, rec: Rec): Promise<boolean> {
    const reason = archiveBlocker(cfg.key, rec, this.store.s(), (k, p) => this.i18n.tr(k, p));
    if (reason) { this.blocked(cfg, 'archive', reason); return false; }
    const name = this.name(cfg, rec);
    const ok = await this.dialog.confirm({
      title: this.i18n.tr('product.confirm.archiveTitle', { what: this.what(cfg).toLowerCase() }),
      message: this.i18n.tr('product.confirm.archiveMsg', { name }),
      confirmLabel: this.i18n.tr('product.act.archive'),
    });
    if (!ok) return false;
    try { await this.store.api.setActive(cfg.key, rec.id, false); } catch (e) { this.fail(cfg, 'archive', e); return false; }
    this.toast.success(this.i18n.tr('product.toast.archived', { what: this.what(cfg), name }));
    return true;
  }

  async restore(cfg: EntityConfig, rec: Rec): Promise<boolean> {
    try { await this.store.api.setActive(cfg.key, rec.id, true); } catch (e) { this.fail(cfg, 'archive', e); return false; }
    this.toast.success(this.i18n.tr('product.toast.restored', { what: this.what(cfg), name: this.name(cfg, rec) }));
    return true;
  }

  async requestDelete(cfg: EntityConfig, rec: Rec): Promise<boolean> {
    const reason = deleteBlocker(cfg.key, rec, this.store.s(), (k, p) => this.i18n.tr(k, p));
    if (reason) { this.blocked(cfg, 'delete', reason); return false; }
    const name = this.name(cfg, rec);
    const ok = await this.dialog.confirm({
      title: this.i18n.tr('product.confirm.deleteTitle', { what: this.what(cfg).toLowerCase() }),
      message: this.i18n.tr('product.confirm.deleteMsg', { name }),
      confirmLabel: this.i18n.tr('product.act.delete'),
      danger: true,
    });
    if (!ok) return false;
    try { await this.store.api.remove(cfg.key, rec.id); } catch (e) { this.fail(cfg, 'delete', e); return false; }
    this.toast.success(this.i18n.tr('product.toast.deleted', { what: this.what(cfg), name }));
    return true;
  }
}

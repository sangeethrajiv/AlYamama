import type { ProductEntityKey, ProductState } from '@erp/shared/contracts';
import { isZero } from '@erp/shared/utils';
import type { Rec, Tr } from './product-types';

/**
 * Pre-flight checks for Archive and Delete so the screen can explain a refusal before asking for confirmation.
 * The API enforces the same rules (and is authoritative); these only choose the dialog. Returns the reason, or null.
 */
export function archiveBlocker(entity: ProductEntityKey, rec: Rec, s: ProductState, tr: Tr): string | null {
  switch (entity) {
    case 'categories': {
      const n = s.products.filter(p => p.categ_id === rec.id && p.active).length;
      const kids = s.categories.filter(c => c.parent_id === rec.id && c.active).length;
      if (n) return tr('product.block.catProducts', { n });
      if (kids) return tr('product.block.catKids', { n: kids });
      return null;
    }
    case 'uomCategories': {
      const n = s.uoms.filter(u => u.category_id === rec.id && u.active).length;
      return n ? tr('product.block.ucUnits', { n }) : null;
    }
    case 'uoms': {
      const n = s.products.filter(p => p.active && (p.uom_id === rec.id || p.uom_po_id === rec.id)).length;
      if (n) return tr('product.block.uomProducts', { n });
      if (rec['uom_type'] === 'reference' && s.uoms.some(u => u.id !== rec.id && u.category_id === rec['category_id'] && u.active)) return tr('product.block.uomReference');
      return null;
    }
    default:
      return null;
  }
}

export function deleteBlocker(entity: ProductEntityKey, rec: Rec, s: ProductState, tr: Tr): string | null {
  switch (entity) {
    case 'products':
      return !isZero(rec['qty_available']) ? tr('product.block.prodStock', { n: rec['qty_available'] }) : null;
    case 'categories': {
      const n = s.products.filter(p => p.categ_id === rec.id).length;
      const kids = s.categories.filter(c => c.parent_id === rec.id).length;
      if (n) return tr('product.block.catDelProducts', { n });
      return kids ? tr('product.block.catDelKids', { n: kids }) : null;
    }
    case 'uomCategories': {
      const n = s.uoms.filter(u => u.category_id === rec.id).length;
      return n ? tr('product.block.ucDelUnits', { n }) : null;
    }
    case 'uoms': {
      const n = s.products.filter(p => p.uom_id === rec.id || p.uom_po_id === rec.id).length;
      return n ? tr('product.block.uomDelProducts', { n }) : null;
    }
  }
}

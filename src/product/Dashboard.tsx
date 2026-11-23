import { AlertTriangle, ArrowRight, Plus } from 'lucide-react'
import { ENTITY_BY_KEY } from './entities'
import { navigate } from './router'
import { useProduct } from './store'
import { categoryPath, num } from './derived'
import { PRODUCT_TYPE_OPTIONS, TRACKING_OPTIONS } from './options'
import type { ProductState } from './types'
import { Badge, Button, Card, PageHeader } from './ui'

function Bars({ rows, href }: { rows: { label: string; value: number; to?: string }[]; href?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            {r.to || href ? <a href={r.to ?? href} className="truncate text-slate-700 hover:text-indigo-700 hover:underline">{r.label}</a> : <span className="truncate text-slate-700">{r.label}</span>}
            <span className="tabular-nums font-medium text-slate-900">{r.value}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100" role="img" aria-label={`${r.label}: ${r.value}`}>
            <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function attention(s: ProductState) {
  const live = s.products.filter((p) => p.active)
  return [
    { label: 'Products without an internal reference', items: live.filter((p) => !p.default_code) },
    { label: 'Storable products without lot or serial tracking', items: live.filter((p) => p.type === 'product' && p.tracking === 'none') },
    { label: 'Storable products out of stock', items: live.filter((p) => p.type === 'product' && p.qty_available <= 0) },
  ]
}

export function Dashboard() {
  const s = useProduct()
  const live = s.products.filter((p) => p.active)
  const kpis = [
    { key: 'products' as const, value: live.length, label: 'Active products', hint: `${s.products.length - live.length} archived` },
    { key: 'categories' as const, value: s.categories.filter((c) => c.active).length, label: 'Product categories', hint: `${s.categories.filter((c) => !c.parent_id).length} root` },
    { key: 'uoms' as const, value: s.uoms.filter((u) => u.active).length, label: 'Units of measure', hint: `${s.uomCategories.length} categories` },
    { key: 'uomCategories' as const, value: s.uomCategories.filter((c) => c.active).length, label: 'UoM categories', hint: 'Weight, length, volume…' },
  ]
  const byType = PRODUCT_TYPE_OPTIONS.map((o) => ({ label: o.label, value: live.filter((p) => p.type === o.value).length, to: '#/prd_products' }))
  const byTracking = TRACKING_OPTIONS.map((o) => ({ label: o.label, value: live.filter((p) => p.type === 'product' && p.tracking === o.value).length }))
  const topCats = s.categories
    .filter((c) => c.active)
    .map((c) => ({ label: categoryPath(s, c).replace(/^All \/ /, ''), value: s.products.filter((p) => p.active && p.categ_id === c.id).length, to: `#/prd_categories/${c.id}` }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 7)
  const stockValue = live.filter((p) => p.type === 'product').reduce((sum, p) => sum + p.qty_available * p.standard_price, 0)
  const issues = attention(s)

  return (
    <div>
      <PageHeader
        title="Product Overview"
        subtitle="Product master data at a glance. All data on this screen is local mock data."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/prd_products/new')}>New Product</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {kpis.map((k) => {
          const cfg = ENTITY_BY_KEY[k.key]
          const Icon = cfg.icon
          return (
            <a key={k.key} href={`#/${cfg.route}`} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow">
              <div className="flex items-center justify-between text-slate-400 group-hover:text-indigo-600"><Icon className="h-5 w-5" /><ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" /></div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">{k.value}</p>
              <p className="text-sm font-medium text-slate-700">{k.label}</p>
              <p className="mt-0.5 text-xs text-slate-400">{k.hint}</p>
            </a>
          )
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Products by type" description={`${live.length} active products`}>
          <Bars rows={byType} />
        </Card>
        <Card title="Tracking of storable products" description="Lot / serial traceability">
          <Bars rows={byTracking} />
        </Card>
        <Card title="Largest categories" description="Active products per category">
          <Bars rows={topCats} />
        </Card>

        <Card title="Needs attention" description="Quick data-quality checks on active products" className="lg:col-span-2" bodyClassName="p-0">
          <ul className="divide-y divide-slate-100">
            {issues.map((g) => (
              <li key={g.label} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    {g.items.length > 0 && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    {g.label}
                  </span>
                  {g.items.length === 0 ? <Badge tone="green">All good</Badge> : <Badge tone="amber">{g.items.length}</Badge>}
                </div>
                {g.items.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-6 text-xs">
                    {g.items.slice(0, 4).map((p) => <a key={p.id} className="text-indigo-700 hover:underline" href={`#/prd_products/${p.id}`}>{p.name}</a>)}
                    {g.items.length > 4 && <span className="text-slate-400">+{g.items.length - 4} more</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Stock snapshot" description="Computed from on-hand quantities × cost">
          <p className="text-3xl font-semibold tabular-nums text-slate-900">{num(stockValue, 0)} <span className="text-base font-normal text-slate-400">SAR</span></p>
          <p className="mt-1 text-sm text-slate-500">Estimated value of {num(live.filter((p) => p.type === 'product').reduce((a, p) => a + p.qty_available, 0), 0)} units across {live.filter((p) => p.type === 'product').length} storable products.</p>
        </Card>
      </div>
    </div>
  )
}

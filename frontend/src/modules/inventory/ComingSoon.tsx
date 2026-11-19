import { Hourglass } from 'lucide-react'

/**
 * Placeholder for the Inventory screens that are not built yet: transfers,
 * receipts, deliveries, adjustments and the stock reports. They need stock
 * moves, which come after the master data.
 */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-slate-900">{title}</h1>
      <div className="flex flex-col items-center justify-center text-center bg-white border border-dashed border-slate-300 rounded-xl py-20 px-6">
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
          <Hourglass size={26} />
        </div>
        <p className="text-lg font-extrabold text-slate-800">Coming soon</p>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">This feature is on its way and is not available in this version yet.</p>
      </div>
    </div>
  )
}

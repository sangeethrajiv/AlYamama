import { moneyFormat } from '../data/mockAccountingData'

interface Segment {
  id: string
  label: string
  count: number
  amount: number
  color: 'blue' | 'orange' | 'red' | 'green' | 'purple'
}

interface MoneyBarProps {
  segments: Segment[]
  selectedSegment: string
  onSelectSegment: (id: string) => void
  currency?: string
}

export default function MoneyBar({
  segments,
  selectedSegment,
  onSelectSegment,
  currency = 'SAR',
}: MoneyBarProps) {
  const getColorClasses = (color: Segment['color'], isSelected: boolean) => {
    switch (color) {
      case 'blue':
        return isSelected
          ? 'border-slate-600 bg-slate-50/80 text-slate-900 ring-2 ring-slate-500/20'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
      case 'orange':
        return isSelected
          ? 'border-amber-600 bg-amber-50/80 text-amber-900 ring-2 ring-amber-500/20'
          : 'border-slate-200 hover:border-amber-300 hover:bg-slate-50 text-slate-800'
      case 'red':
        return isSelected
          ? 'border-rose-600 bg-rose-50/80 text-rose-900 ring-2 ring-rose-500/20'
          : 'border-slate-200 hover:border-rose-300 hover:bg-slate-50 text-slate-800'
      case 'green':
        return isSelected
          ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20'
          : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50 text-slate-800'
      case 'purple':
        return isSelected
          ? 'border-slate-600 bg-slate-50/80 text-slate-900 ring-2 ring-slate-500/20'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
    }
  }

  const getTopBarColor = (color: Segment['color']) => {
    switch (color) {
      case 'blue': return 'bg-slate-500'
      case 'orange': return 'bg-amber-500'
      case 'red': return 'bg-rose-500'
      case 'green': return 'bg-emerald-500'
      case 'purple': return 'bg-slate-500'
    }
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Overview Summary — Click category to filter
        </span>
        {selectedSegment !== 'all' && (
          <button
            onClick={() => onSelectSegment('all')}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold hover:underline"
          >
            Clear Filter (Show All)
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {segments.map(seg => {
          const isSelected = selectedSegment === seg.id
          return (
            <button
              key={seg.id}
              onClick={() => onSelectSegment(isSelected ? 'all' : seg.id)}
              className={`relative overflow-hidden text-left p-3 rounded-xl border bg-white transition-all shadow-xs cursor-pointer ${getColorClasses(seg.color, isSelected)}`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${getTopBarColor(seg.color)}`} />
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
                <span>{seg.label}</span>
                <span className="font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-full text-[10px]">
                  {seg.count}
                </span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-slate-900">
                {moneyFormat(seg.amount, currency)}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}


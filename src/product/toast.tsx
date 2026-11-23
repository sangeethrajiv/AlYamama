import { useSyncExternalStore } from 'react'
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'

type Toast = { id: number; tone: 'success' | 'info' | 'error'; message: string }
let toasts: Toast[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(message: string, tone: Toast['tone'] = 'success') {
  const id = ++seq
  toasts = [...toasts, { id, tone, message }]
  emit()
  setTimeout(() => dismiss(id), 4000)
}
function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function Toaster() {
  const items = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l) },
    () => toasts,
  )
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" role="status" aria-live="polite">
      {items.map((t) => {
        const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : Info
        const color = t.tone === 'success' ? 'text-emerald-600' : t.tone === 'error' ? 'text-rose-600' : 'text-sky-600'
        return (
          <div key={t.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-lg">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
        )
      })}
    </div>
  )
}

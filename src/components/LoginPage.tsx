import { useEffect, useState, type FormEvent } from 'react'
import { Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck, BookOpen, Users, Boxes, CheckCircle2, AlertTriangle } from 'lucide-react'
import { authenticate, USERS, DEMO_PASSWORD, type AuthUser } from '../auth/users'

interface Props {
  notice?: string
  onLogin: (user: AuthUser, remember: boolean) => void
}

const MAX_TRIES = 5
const LOCK_SECONDS = 30

export default function LoginPage({ notice, onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [caps, setCaps] = useState(false)
  const [tries, setTries] = useState(0)
  const [lockLeft, setLockLeft] = useState(0)
  const [forgot, setForgot] = useState(false)

  useEffect(() => {
    if (lockLeft <= 0) return
    const t = setTimeout(() => setLockLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [lockLeft])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy || lockLeft > 0) return
    if (!email.trim() || !password) return setError('Enter your email and password.')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.')
    setError(''); setBusy(true)
    setTimeout(() => {
      const user = authenticate(email, password)
      if (user) return onLogin(user, remember)
      const n = tries + 1
      setTries(n); setBusy(false); setPassword('')
      if (n >= MAX_TRIES) { setLockLeft(LOCK_SECONDS); setTries(0); setError(`Too many attempts. Try again in ${LOCK_SECONDS} seconds.`) }
      else setError(`Incorrect email or password. ${MAX_TRIES - n} attempt${MAX_TRIES - n === 1 ? '' : 's'} left.`)
    }, 500)
  }

  const fill = (u: AuthUser) => { setEmail(u.email); setPassword(DEMO_PASSWORD); setError('') }
  const field = 'w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/40 focus:border-emerald-600'

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-slate-100">
      {/* Brand panel */}
      <aside className="hidden lg:flex flex-col justify-between bg-slate-900 text-slate-300 p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-600/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden="true" />
        <div className="flex items-center gap-3 relative">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-emerald-900/40">AY</div>
          <div><div className="font-extrabold text-white tracking-wide">Al-Yamama</div><div className="text-xs text-slate-400">Workshop ERP</div></div>
        </div>
        <div className="relative space-y-8 max-w-md">
          <div>
            <h1 className="text-3xl font-black text-white leading-tight">Run the workshop from one place.</h1>
            <p className="text-sm text-slate-400 mt-3">Invoices, payments, contacts and stock, connected, so every number you see is the same number your team sees.</p>
          </div>
          <ul className="space-y-4 text-sm">
            {[[BookOpen, 'Accounting', 'Invoices, ZATCA, payments and reconciliation'], [Users, 'Contacts', 'Customers and vendors with full tax details'], [Boxes, 'Inventory', 'Products, warehouses, receipts and deliveries']].map(([Icon, t, d]) => {
              const I = Icon as typeof BookOpen
              return <li key={t as string} className="flex gap-3"><span className="w-9 h-9 rounded-lg bg-slate-800 text-emerald-400 flex items-center justify-center flex-shrink-0"><I size={17} /></span><span><span className="block font-bold text-white">{t as string}</span><span className="text-xs text-slate-400">{d as string}</span></span></li>
            })}
          </ul>
        </div>
        <div className="relative text-[11px] text-slate-500 flex items-center gap-1.5"><ShieldCheck size={13} />Role-based access · every change is recorded in the audit log</div>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-extrabold">AY</div>
            <div className="font-extrabold text-slate-900">Al-Yamama Workshop ERP</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
            <h2 className="text-xl font-black text-slate-900">Sign in</h2>
            <p className="text-xs text-slate-500 mt-1">Use your work account to continue.</p>

            {notice && <div role="status" className="mt-4 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 flex items-center gap-2"><CheckCircle2 size={14} />{notice}</div>}
            {error && <div role="alert" className="mt-4 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 flex items-center gap-2"><AlertTriangle size={14} className="flex-shrink-0" />{error}</div>}

            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Email</span>
                <span className="relative block"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" autoComplete="username" autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className={field} /></span>
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Password</span>
                <span className="relative block"><Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
                    onKeyUp={e => setCaps(e.getModifierState?.('CapsLock') ?? false)} placeholder="••••••••" className={`${field} pr-10`} />
                  <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button></span>
                {caps && <span className="block text-[11px] text-amber-600 mt-1">Caps Lock is on.</span>}
              </label>
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-600"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Keep me signed in</label>
                <button type="button" onClick={() => setForgot(f => !f)} className="text-emerald-700 font-bold hover:underline">Forgot password?</button>
              </div>
              {forgot && <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">Password resets are handled by your system administrator. Ask them to send you a new password.</p>}
              <button type="submit" disabled={busy || lockLeft > 0} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition">
                {busy && <Loader2 size={15} className="animate-spin" />}{lockLeft > 0 ? `Locked, try again in ${lockLeft}s` : busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <div className="mt-5 bg-white/70 border border-slate-200 rounded-xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Demo accounts · password <span className="font-mono normal-case text-slate-700">{DEMO_PASSWORD}</span></div>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {USERS.map(u => (
                <button key={u.id} type="button" onClick={() => fill(u)} className="text-left px-2.5 py-2 rounded-lg border border-slate-200 bg-white hover:border-emerald-400 transition">
                  <div className="text-xs font-bold text-slate-800 truncate">{u.name}</div><div className="text-[10px] text-slate-500">{u.role}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

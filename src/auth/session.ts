import type { CompanyId, UserRole } from '../types/accounting'
import { USERS, type AuthUser } from './users'

const KEY = 'ay.session'
export interface Session { userId: string; role: UserRole; companyId: CompanyId; arabic: boolean; remember: boolean }

const stores = (): Storage[] => { try { return [localStorage, sessionStorage] } catch { return [] } }

export function loadSession(): { user: AuthUser; session: Session } | null {
  for (const s of stores()) {
    try {
      const raw = s.getItem(KEY)
      if (!raw) continue
      const session = JSON.parse(raw) as Session
      const user = USERS.find(u => u.id === session.userId)
      if (user) return { user, session }
    } catch { /* ignore corrupt data */ }
  }
  return null
}

export function saveSession(s: Session) {
  clearSession()
  try { (s.remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s)) } catch { /* storage unavailable */ }
}

export function clearSession() {
  for (const s of stores()) { try { s.removeItem(KEY) } catch { /* ignore */ } }
}

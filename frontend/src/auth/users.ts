import type { UserRole } from '../types/accounting'

export interface AuthUser { id: string; email: string; name: string; title: string; role: UserRole; initials: string }

/** Demo accounts. This app has no backend, so credentials are checked locally. */
export const DEMO_PASSWORD = 'Yamama@2026'
export const USERS: AuthUser[] = [
  { id: 'u1', email: 'sangeeth@alyamama.example', name: 'Sangeeth R.', title: 'Finance & Accounts', role: 'Accounts Manager', initials: 'SR' },
  { id: 'u2', email: 'director@alyamama.example', name: 'Faisal Al-Harbi', title: 'Finance Director', role: 'Finance Director', initials: 'FH' },
  { id: 'u3', email: 'senior@alyamama.example', name: 'Noura Al-Qahtani', title: 'Senior Accountant', role: 'Senior Accountant', initials: 'NQ' },
  { id: 'u4', email: 'accountant@alyamama.example', name: 'Omar Siddiqui', title: 'Accountant', role: 'Accountant', initials: 'OS' },
  { id: 'u5', email: 'auditor@alyamama.example', name: 'Layla Hassan', title: 'External Auditor', role: 'Auditor', initials: 'LH' },
]

export function authenticate(email: string, password: string): AuthUser | null {
  const u = USERS.find(x => x.email.toLowerCase() === email.trim().toLowerCase())
  return u && password === DEMO_PASSWORD ? u : null
}

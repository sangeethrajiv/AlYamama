import type { Session } from '@erp/shared/contracts';

const KEY = 'ay.session';
const stores = (): Storage[] => {
  try { return [localStorage, sessionStorage]; } catch { return []; }
};

/**
 * Remembers who is signed in, the role, company and language. Only non-secret preferences live in the browser; a
 * real deployment relies on an HttpOnly session cookie (section 10.1) and never stores tokens here.
 */
export const sessionStore = {
  load(): Session | null {
    for (const s of stores()) {
      try {
        const raw = s.getItem(KEY);
        if (raw) return JSON.parse(raw) as Session;
      } catch { /* ignore corrupt data */ }
    }
    return null;
  },
  save(session: Session): void {
    sessionStore.clear();
    try { (session.remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session)); } catch { /* storage unavailable */ }
  },
  clear(): void {
    for (const s of stores()) { try { s.removeItem(KEY); } catch { /* ignore */ } }
  },
};

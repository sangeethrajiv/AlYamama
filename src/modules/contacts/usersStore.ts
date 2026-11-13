import { useSyncExternalStore } from 'react'
import { RES_USERS } from './usersData'
import type { ResUser } from './usersTypes'

/** In-memory holder for the user records, so edits made in the form show up in the list until the page is reloaded. */
let users: ResUser[] = RES_USERS
const listeners = new Set<() => void>()

export const saveUser = (u: ResUser) => {
  users = users.map(x => (x.id === u.id ? u : x))
  listeners.forEach(l => l())
}
export const useUsers = () => useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => users)

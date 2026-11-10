import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Contact } from '../contacts/types'
import type { Product } from '../inventory/types'

/** Read-only bridge: lets Accounting forms pick contacts and products without importing module internals. */
interface Directory { customers: Contact[]; vendors: Contact[]; products: Product[]; stockOf: (sku: string) => number }
const Ctx = createContext<Directory>({ customers: [], vendors: [], products: [], stockOf: () => 0 })
export const useDirectory = () => useContext(Ctx)

export function DirectoryProvider({ contacts, products, stockOf, children }: { contacts: Contact[]; products: Product[]; stockOf: (sku: string) => number; children: ReactNode }) {
  const value = useMemo<Directory>(() => ({
    customers: contacts.filter(c => c.active && c.isCustomer), vendors: contacts.filter(c => c.active && c.isVendor),
    products: products.filter(p => p.active), stockOf,
  }), [contacts, products, stockOf])
  return (
    <Ctx.Provider value={value}>
      {children}
      <datalist id="erp-customers">{value.customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
      <datalist id="erp-vendors">{value.vendors.map(c => <option key={c.id} value={c.name} />)}</datalist>
      <datalist id="erp-products">{value.products.filter(p => p.canSell).map(p => <option key={p.id} value={p.sku}>{p.name}</option>)}</datalist>
    </Ctx.Provider>
  )
}

export const formatAddress = (c: Contact): string => {
  const a = c.addresses.find(x => x.type === 'invoice') || c.addresses[0]
  return a ? [a.street, [a.city, a.zip].filter(Boolean).join(' '), a.region, a.country].filter(Boolean).join('\n') : ''
}

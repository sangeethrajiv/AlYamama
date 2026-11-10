export type ContactKind = 'company' | 'individual'
export type AddressType = 'invoice' | 'delivery' | 'other'

export interface ContactAddress {
  id: string
  type: AddressType
  street: string
  city: string
  region: string
  zip: string
  country: string
  neighborhood?: string
  streetAr?: string
  cityAr?: string
  buildingNumber?: string
  plotId?: string
}

export interface Contact {
  id: string
  kind: ContactKind
  name: string
  /** For an individual: the company they work for */
  parentId?: string
  jobTitle?: string
  isCustomer: boolean
  isVendor: boolean
  email: string
  phone: string
  mobile: string
  website: string
  /** Tax information */
  vat: string
  crNumber: string
  taxRegime: 'VAT registered' | 'Not registered' | 'Exempt'
  paymentTerms: string
  creditLimit: number
  currency: string
  addresses: ContactAddress[]
  tags: string[]
  notes: string
  active: boolean
  /** Profile picture as a data URL */
  image?: string
  /** ZATCA / e-invoicing identity */
  legalName?: string
  idScheme?: 'CRN' | 'MOM' | 'MLS' | 'SAG' | 'OTH' | 'TIN' | '700'
  idNumber?: string
  customerCode?: string
  vendorNo?: string
  discountPct?: number
  cashCustomer?: boolean
  language?: string
  title?: string
  fax?: string
  taxIdArabic?: string
  discount?: number
  girfalcoId?: string
  /** Individuals only */
  companyCode?: string
  /** Sign & seal */
  signature?: string
  seal?: string
  signatory?: string
  signatoryTitle?: string
  /** Sales & purchases */
  salesperson?: string
  vendorPaymentTerms?: string
  /** Location */
  latitude?: string
  longitude?: string
  locationNotes?: string
  /** Invoicing */
  bankName?: string
  iban?: string
  swift?: string
  billingEmail?: string
  invoiceDelivery?: 'email' | 'print' | 'both'
  createdAt: string
}

import type { ProductState, Product, ProductCategory, Uom, UomCategory, InternalType, ProductType, Tracking } from './types'

/** Mock data only. Shapes follow the Odoo 12 models; values are illustrative. */
export function buildSeed(): ProductState {
  const companies = [
    { id: 1, name: 'Al-Yamama Holding' },
    { id: 5, name: 'Al-Yamama Hydraulic Workshop' },
    { id: 7, name: 'Al-Yamama Trading' },
    { id: 9, name: 'Al-Yamama Services' },
  ]
  const users = [
    { id: 2, name: 'Administrator' },
    { id: 6, name: 'Khalid Al-Harbi' },
    { id: 7, name: 'Sara Ahmed' },
    { id: 8, name: 'Omar Nasser' },
    { id: 9, name: 'Fatima Zahra' },
  ]

  // ── UoM categories & UoMs ──
  const uomCategories: UomCategory[] = [
    { id: 1, name: 'Unit', measure_type: 'unit', active: true },
    { id: 2, name: 'Weight', measure_type: 'weight', active: true },
    { id: 3, name: 'Working Time', measure_type: 'time', active: true },
    { id: 4, name: 'Length / Distance', measure_type: 'length', active: true },
    { id: 5, name: 'Volume', measure_type: 'volume', active: true },
    { id: 6, name: 'Area', measure_type: '', active: true },
  ]
  let uid = 0
  const U = (name: string, category_id: number, uom_type: Uom['uom_type'], ratio: number, view_name = '', rounding = 0.01): Uom => ({
    id: ++uid, name, category_id, uom_type,
    // `ratio` is what the user types: "smaller" => factor = ratio; "bigger" => factor = 1 / ratio
    factor: uom_type === 'bigger' ? 1 / ratio : ratio,
    rounding, view_name, active: true,
  })
  const uoms: Uom[] = [
    U('Unit(s)', 1, 'reference', 1, 'Pcs', 1),
    U('Dozen(s)', 1, 'bigger', 12, 'Dz', 1),
    U('kg', 2, 'reference', 1, 'Kg'),
    U('g', 2, 'smaller', 1000, 'g'),
    U('t', 2, 'bigger', 1000, 'Ton'),
    U('Hour(s)', 3, 'reference', 1, 'Hr'),
    U('Day(s)', 3, 'bigger', 8, 'Day'),
    U('m', 4, 'reference', 1, 'Mtr'),
    U('cm', 4, 'smaller', 100, 'cm'),
    U('mm', 4, 'smaller', 1000, 'mm'),
    U('km', 4, 'bigger', 1000, 'Km'),
    U('Liter(s)', 5, 'reference', 1, 'Ltr'),
    U('Gallon(s)', 5, 'bigger', 3.78541, 'Gal'),
    U('m²', 6, 'reference', 1, 'm²'),
  ]
  const uomId = (name: string) => uoms.find((u) => u.name === name)!.id

  // ── Product categories ──
  let cid = 0
  const C = (name: string, parent_id: number | null, arabic_name = '', sequence_code = ''): ProductCategory => ({
    id: ++cid, name, parent_id, arabic_name, sequence_code, active: true,
  })
  const categories: ProductCategory[] = [
    C('All', null, 'الكل'), // 1
    C('Hoses & Pipes', 1, 'خراطيم وأنابيب', 'HSP'), // 2
    C('Hydraulic Hoses', 2, 'خراطيم هيدروليكية', 'HHS'), // 3
    C('Hose Fittings', 2, 'وصلات الخراطيم', 'FIT'), // 4
    C('Pipes & Tubes', 2, 'مواسير وأنابيب', 'PIP'), // 5
    C('Seals & Gaskets', 1, 'موانع التسرب', 'SEL'), // 6
    C('O-Rings', 6, 'حلقات دائرية', 'ORG'), // 7
    C('Cylinder Seal Kits', 6, 'أطقم موانع تسرب الأسطوانات', 'CSK'), // 8
    C('Pumps & Motors', 1, 'مضخات ومحركات', 'PMP'), // 9
    C('Gear Pumps', 9, 'مضخات ترسية', 'GRP'), // 10
    C('Piston Pumps', 9, 'مضخات مكبسية', 'PSP'), // 11
    C('Valves', 1, 'صمامات', 'VLV'), // 12
    C('Filters', 1, 'فلاتر', 'FLT'), // 13
    C('Lubricants & Oils', 1, 'زيوت وشحومات', 'OIL'), // 14
    C('Cylinders', 1, 'أسطوانات هيدروليكية', 'CYL'), // 15
    C('Workshop Consumables', 1, 'مستهلكات الورشة', 'CON'), // 16
    C('Services', 1, 'خدمات', 'SRV'), // 17
    C('Labour', 17, 'عمالة', 'LAB'), // 18
    C('Repair & Overhaul', 17, 'إصلاح وصيانة شاملة', 'ROH'), // 19
  ]
  const catId = (name: string) => categories.find((c) => c.name === name)!.id

  // ── Products ──
  const products: Product[] = []
  let pid = 0
  type PSpec = {
    name: string; ar: string; code: string; short?: string; cat: string; type?: ProductType; uom: string; po?: string
    price: number; cost: number; internal?: InternalType; margin?: number; tracking?: Tracking
    weight?: number; volume?: number; sale?: boolean; purchase?: boolean; nodisc?: boolean; resp?: number; company?: number
    active?: boolean; stock?: number; sdesc?: string; pdesc?: string
  }
  const addProduct = (p: PSpec) => {
    const id = ++pid
    const type = p.type ?? 'product'
    const stored = type === 'product'
    const qty = stored ? (p.stock ?? ((id * 37) % 140)) : 0
    products.push({
      id, name: p.name, default_code: p.code, barcode: `629${String(100000 + id * 7).padStart(9, '0')}`, type,
      categ_id: catId(p.cat), uom_id: uomId(p.uom), uom_po_id: uomId(p.po ?? p.uom),
      tracking: stored ? (p.tracking ?? 'lot') : 'none', active: p.active ?? true, company_id: p.company ?? 5,
      sale_ok: p.sale ?? true, purchase_ok: p.purchase ?? type !== 'service', list_price: p.price, standard_price: p.cost,
      weight: p.weight ?? 0, volume: p.volume ?? 0, responsible_id: p.resp ?? [2, 6, 7, 8][id % 4],
      description_sale: p.sdesc ?? '', description_purchase: p.pdesc ?? '',
      arabic_name: p.ar, internal_short_code: p.short ?? p.code.replace(/[^A-Z0-9]/g, '').slice(0, 6),
      internal_type: p.internal ?? (type === 'service' ? 'labour' : 'material'), margin_perc: p.margin ?? 20,
      no_discount: p.nodisc ?? false, qty_available: qty,
      virtual_available: stored ? Math.max(0, qty + ((id % 5) - 2) * 3) : 0,
    })
  }

  // Hoses
  for (const [size, ar, price, w] of [['1/4"', '1/4 بوصة', 14, 0.18], ['3/8"', '3/8 بوصة', 19, 0.26], ['1/2"', '1/2 بوصة', 26, 0.34], ['5/8"', '5/8 بوصة', 33, 0.42], ['3/4"', '3/4 بوصة', 41, 0.55], ['1"', '1 بوصة', 62, 0.82]] as const)
    addProduct({ name: `Hydraulic Hose 1SN ${size}`, ar: `خرطوم هيدروليكي 1SN ${ar}`, code: `HH1-${size.replace(/\D/g, '').padStart(3, '0')}`, cat: 'Hydraulic Hoses', uom: 'm', price, cost: +(price * 0.68).toFixed(2), weight: w, margin: 32, pdesc: 'EN 853 1SN, 225 bar working pressure.' })
  for (const [size, ar, price, w] of [['1/4"', '1/4 بوصة', 24, 0.3], ['3/8"', '3/8 بوصة', 31, 0.42], ['1/2"', '1/2 بوصة', 42, 0.6], ['3/4"', '3/4 بوصة', 66, 0.95]] as const)
    addProduct({ name: `Hydraulic Hose 2SN ${size}`, ar: `خرطوم هيدروليكي 2SN ${ar}`, code: `HH2-${size.replace(/\D/g, '').padStart(3, '0')}`, cat: 'Hydraulic Hoses', uom: 'm', price, cost: +(price * 0.7).toFixed(2), weight: w, margin: 30 })
  addProduct({ name: 'Hydraulic Hose 4SP 1"', ar: 'خرطوم هيدروليكي 4SP 1 بوصة', code: 'HH4-100', cat: 'Hydraulic Hoses', uom: 'm', price: 118, cost: 82, weight: 1.6, margin: 30, stock: 0 })
  // Fittings
  for (const [size, ar] of [['1/4"', '1/4 بوصة'], ['3/8"', '3/8 بوصة'], ['1/2"', '1/2 بوصة'], ['3/4"', '3/4 بوصة'], ['1"', '1 بوصة']] as const)
    addProduct({ name: `JIC Female Swivel Fitting ${size}`, ar: `وصلة JIC أنثى دوارة ${ar}`, code: `FJF-${size.replace(/\D/g, '').padStart(3, '0')}`, cat: 'Hose Fittings', uom: 'Unit(s)', price: 9 + size.length * 3, cost: 5 + size.length * 2, weight: 0.08, tracking: 'none', margin: 40 })
  for (const [size, ar] of [['1/4"', '1/4 بوصة'], ['3/8"', '3/8 بوصة'], ['1/2"', '1/2 بوصة'], ['3/4"', '3/4 بوصة']] as const)
    addProduct({ name: `BSP Male Straight Fitting ${size}`, ar: `وصلة BSP ذكر مستقيمة ${ar}`, code: `FBM-${size.replace(/\D/g, '').padStart(3, '0')}`, cat: 'Hose Fittings', uom: 'Unit(s)', price: 7 + size.length * 2, cost: 4 + size.length, weight: 0.06, tracking: 'none', margin: 40 })
  addProduct({ name: 'Quick Release Coupling 1/2"', ar: 'وصلة سريعة 1/2 بوصة', code: 'FQR-050', cat: 'Hose Fittings', uom: 'Unit(s)', price: 48, cost: 31, weight: 0.35 })
  addProduct({ name: 'Steel Tube 12mm x 1.5mm', ar: 'أنبوب فولاذ 12 مم', code: 'PIP-012', cat: 'Pipes & Tubes', uom: 'm', price: 22, cost: 15, weight: 0.4 })
  addProduct({ name: 'Steel Tube 20mm x 2mm', ar: 'أنبوب فولاذ 20 مم', code: 'PIP-020', cat: 'Pipes & Tubes', uom: 'm', price: 38, cost: 27, weight: 0.9 })
  // Seals
  addProduct({ name: 'O-Ring Assortment Kit (382 pcs)', ar: 'طقم حلقات دائرية 382 قطعة', code: 'ORK-382', cat: 'O-Rings', uom: 'Unit(s)', price: 125, cost: 78, weight: 0.5, tracking: 'none', sdesc: 'Metric NBR 70 assortment in a compartment box.' })
  addProduct({ name: 'O-Ring NBR 70 25x3', ar: 'حلقة دائرية NBR 25×3', code: 'ORN-2503', cat: 'O-Rings', uom: 'Unit(s)', price: 1.5, cost: 0.6, tracking: 'none', stock: 640 })
  addProduct({ name: 'O-Ring Viton 40x3', ar: 'حلقة دائرية فيتون 40×3', code: 'ORV-4003', cat: 'O-Rings', uom: 'Unit(s)', price: 4.2, cost: 2, tracking: 'none', stock: 210 })
  addProduct({ name: 'Cylinder Seal Kit 80/50', ar: 'طقم موانع تسرب أسطوانة 80/50', code: 'CSK-8050', cat: 'Cylinder Seal Kits', uom: 'Unit(s)', price: 210, cost: 135, tracking: 'none', margin: 35 })
  addProduct({ name: 'Cylinder Seal Kit 100/70', ar: 'طقم موانع تسرب أسطوانة 100/70', code: 'CSK-10070', cat: 'Cylinder Seal Kits', uom: 'Unit(s)', price: 285, cost: 190, tracking: 'none', margin: 35 })
  addProduct({ name: 'Wiper Seal 60mm', ar: 'جلدة مسح 60 مم', code: 'WSL-060', cat: 'Seals & Gaskets', uom: 'Unit(s)', price: 18, cost: 9, tracking: 'none' })
  // Pumps
  addProduct({ name: 'Gear Pump 20cc Group 2', ar: 'مضخة ترسية 20 سم³', code: 'GRP-020', cat: 'Gear Pumps', uom: 'Unit(s)', price: 780, cost: 540, weight: 4.2, margin: 25, sdesc: 'Group 2 aluminium body, SAE A flange.' })
  addProduct({ name: 'Gear Pump 32cc Group 3', ar: 'مضخة ترسية 32 سم³', code: 'GRP-032', cat: 'Gear Pumps', uom: 'Unit(s)', price: 1150, cost: 810, weight: 6.8, margin: 25 })
  addProduct({ name: 'Axial Piston Pump A10VSO 45', ar: 'مضخة مكبسية محورية A10VSO 45', code: 'PSP-A45', cat: 'Piston Pumps', uom: 'Unit(s)', price: 6400, cost: 4700, weight: 18.5, margin: 20, tracking: 'serial', nodisc: true, company: 7 })
  addProduct({ name: 'Hydraulic Motor 160cc', ar: 'محرك هيدروليكي 160 سم³', code: 'HMT-160', cat: 'Pumps & Motors', uom: 'Unit(s)', price: 3200, cost: 2300, weight: 14, tracking: 'serial', company: 7 })
  addProduct({ name: 'Pump Repair Kit (Gear)', ar: 'طقم إصلاح مضخة ترسية', code: 'PRK-GR', cat: 'Gear Pumps', uom: 'Unit(s)', price: 240, cost: 150, tracking: 'none' })
  // Valves
  addProduct({ name: 'Directional Valve 4/3 NG6', ar: 'صمام اتجاهي 4/3 NG6', code: 'VLV-DC6', cat: 'Valves', uom: 'Unit(s)', price: 520, cost: 360, weight: 1.9, company: 7 })
  addProduct({ name: 'Pressure Relief Valve 1/2"', ar: 'صمام تنفيس الضغط 1/2 بوصة', code: 'VLV-PR5', cat: 'Valves', uom: 'Unit(s)', price: 195, cost: 128, weight: 0.9, company: 7 })
  addProduct({ name: 'Check Valve 3/8"', ar: 'صمام عدم رجوع 3/8 بوصة', code: 'VLV-CK3', cat: 'Valves', uom: 'Unit(s)', price: 64, cost: 38, weight: 0.3, tracking: 'none', company: 7 })
  addProduct({ name: 'Ball Valve 1" High Pressure', ar: 'صمام كروي 1 بوصة ضغط عالي', code: 'VLV-BL1', cat: 'Valves', uom: 'Unit(s)', price: 145, cost: 96, weight: 1.1, company: 7 })
  // Filters
  addProduct({ name: 'Return Line Filter Element 10µ', ar: 'عنصر فلتر خط الرجوع 10 ميكرون', code: 'FLT-R10', cat: 'Filters', uom: 'Unit(s)', price: 85, cost: 52, tracking: 'none' })
  addProduct({ name: 'Suction Strainer 1"', ar: 'مصفاة شفط 1 بوصة', code: 'FLT-S01', cat: 'Filters', uom: 'Unit(s)', price: 58, cost: 34, tracking: 'none' })
  addProduct({ name: 'Breather Cap 3/4"', ar: 'غطاء تنفس 3/4 بوصة', code: 'FLT-BC3', cat: 'Filters', uom: 'Unit(s)', price: 27, cost: 14, tracking: 'none' })
  addProduct({ name: 'Pressure Filter Housing 3/4"', ar: 'حاوية فلتر ضغط 3/4 بوصة', code: 'FLT-PH3', cat: 'Filters', uom: 'Unit(s)', price: 430, cost: 295, weight: 3.5 })
  // Oils
  addProduct({ name: 'Hydraulic Oil ISO VG 46 (20L)', ar: 'زيت هيدروليك VG 46 (20 لتر)', code: 'OIL-046-20', cat: 'Lubricants & Oils', uom: 'Unit(s)', price: 165, cost: 118, weight: 18, volume: 0.02, margin: 28, sdesc: 'Anti-wear mineral oil, 20 litre can.' })
  addProduct({ name: 'Hydraulic Oil ISO VG 68 (20L)', ar: 'زيت هيدروليك VG 68 (20 لتر)', code: 'OIL-068-20', cat: 'Lubricants & Oils', uom: 'Unit(s)', price: 172, cost: 124, weight: 18, volume: 0.02, margin: 28 })
  addProduct({ name: 'Hydraulic Oil ISO VG 46 (bulk)', ar: 'زيت هيدروليك VG 46 (سائب)', code: 'OIL-046-BK', cat: 'Lubricants & Oils', uom: 'Liter(s)', po: 'Gallon(s)', price: 7.5, cost: 5.2, volume: 0.001, stock: 1850 })
  addProduct({ name: 'Multi-Purpose Grease EP2 (400g)', ar: 'شحم متعدد الأغراض EP2 (400 جم)', code: 'GRS-EP2', cat: 'Lubricants & Oils', uom: 'Unit(s)', price: 16, cost: 9.5, weight: 0.4, tracking: 'none' })
  // Cylinders
  addProduct({ name: 'Hydraulic Cylinder 63/36 x 300', ar: 'أسطوانة هيدروليكية 63/36 × 300', code: 'CYL-6336', cat: 'Cylinders', uom: 'Unit(s)', price: 1450, cost: 1020, weight: 11, tracking: 'serial', margin: 25, nodisc: true })
  addProduct({ name: 'Hydraulic Cylinder 100/60 x 500', ar: 'أسطوانة هيدروليكية 100/60 × 500', code: 'CYL-10060', cat: 'Cylinders', uom: 'Unit(s)', price: 2650, cost: 1900, weight: 26, tracking: 'serial', margin: 25, nodisc: true })
  addProduct({ name: 'Chrome Rod 40mm', ar: 'ساق كروم 40 مم', code: 'CRR-040', cat: 'Cylinders', uom: 'm', price: 190, cost: 130, weight: 9.9 })
  // Consumables
  addProduct({ name: 'Safety Gloves (Pair)', ar: 'قفازات أمان (زوج)', code: 'CON-GLV', cat: 'Workshop Consumables', uom: 'Unit(s)', price: 6, cost: 3.2, type: 'consu', sale: false })
  addProduct({ name: 'Cleaning Rags (10 kg bag)', ar: 'خرق تنظيف (كيس 10 كجم)', code: 'CON-RAG', cat: 'Workshop Consumables', uom: 'Unit(s)', price: 38, cost: 24, type: 'consu', sale: false })
  addProduct({ name: 'Cable Ties 300mm (100 pcs)', ar: 'أربطة كابلات 300 مم', code: 'CON-TIE', cat: 'Workshop Consumables', uom: 'Unit(s)', price: 12, cost: 6, type: 'consu' })
  addProduct({ name: 'Hose Protective Sleeve 1/2"', ar: 'غلاف حماية خرطوم 1/2 بوصة', code: 'CON-SLV', cat: 'Workshop Consumables', uom: 'm', price: 9, cost: 5, type: 'consu' })
  addProduct({ name: 'Thread Sealant Tape', ar: 'شريط عزل خيوط', code: 'CON-PTFE', cat: 'Workshop Consumables', uom: 'Unit(s)', price: 3, cost: 1.4, type: 'consu' })
  // Services
  addProduct({ name: 'Workshop Labour', ar: 'أجور عمالة الورشة', code: 'SRV-LAB', cat: 'Labour', type: 'service', uom: 'Hour(s)', price: 120, cost: 65, internal: 'labour', margin: 45, company: 9, nodisc: true })
  addProduct({ name: 'Hose Assembly Crimping', ar: 'كبس وتجميع الخراطيم', code: 'SRV-CRM', cat: 'Labour', type: 'service', uom: 'Unit(s)', price: 15, cost: 6, internal: 'labour', margin: 60, company: 9 })
  addProduct({ name: 'Hydraulic Pump Overhaul', ar: 'صيانة شاملة لمضخة هيدروليكية', code: 'SRV-POH', cat: 'Repair & Overhaul', type: 'service', uom: 'Unit(s)', price: 950, cost: 540, internal: 'labour', margin: 40, company: 9 })
  addProduct({ name: 'Cylinder Re-sealing', ar: 'تغيير موانع تسرب الأسطوانة', code: 'SRV-CRS', cat: 'Repair & Overhaul', type: 'service', uom: 'Unit(s)', price: 420, cost: 230, internal: 'labour', margin: 45, company: 9 })
  addProduct({ name: 'Pressure Test & Certification', ar: 'اختبار الضغط والشهادة', code: 'SRV-PTC', cat: 'Repair & Overhaul', type: 'service', uom: 'Unit(s)', price: 180, cost: 70, internal: 'overhead', margin: 55, company: 9 })
  // Archived
  addProduct({ name: 'Hydraulic Hose 1SN 2" (discontinued)', ar: 'خرطوم هيدروليكي 1SN 2 بوصة (متوقف)', code: 'HH1-200', cat: 'Hydraulic Hoses', uom: 'm', price: 140, cost: 98, active: false, stock: 0 })
  addProduct({ name: 'Legacy Gear Pump 12cc', ar: 'مضخة ترسية قديمة 12 سم³', code: 'GRP-012', cat: 'Gear Pumps', uom: 'Unit(s)', price: 520, cost: 400, active: false, stock: 0 })

  return {
    products, categories, uoms, uomCategories, companies, users,
  }
}

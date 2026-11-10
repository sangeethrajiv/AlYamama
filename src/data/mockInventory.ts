import type { StockQuant } from '../types/accounting'

export const mockStockQuants: StockQuant[] = [
  { id: 'q1', companyId: 'co_1', productCode: 'SEAL-KIT-80', productName: 'Hydraulic Seal Kit 80mm', category: 'Seals & Spares', location: 'WH/Stock/Shelf A1', uom: 'Units', onHand: 48, unitCost: 125 },
  { id: 'q2', companyId: 'co_1', productCode: 'SEAL-KIT-100', productName: 'Hydraulic Seal Kit 100mm', category: 'Seals & Spares', location: 'WH/Stock/Shelf A1', uom: 'Units', onHand: 32, unitCost: 160 },
  { id: 'q3', companyId: 'co_1', productCode: 'ROD-CHR-60', productName: 'Chrome Piston Rod 60mm', category: 'Raw Materials', location: 'WH/Stock/Rack B2', lot: 'LOT-2026-114', uom: 'Meters', onHand: 120, unitCost: 310 },
  { id: 'q4', companyId: 'co_1', productCode: 'ROD-CHR-60', productName: 'Chrome Piston Rod 60mm', category: 'Raw Materials', location: 'WH/Stock/Rack B2', lot: 'LOT-2026-131', uom: 'Meters', onHand: 80, unitCost: 322 },
  { id: 'q5', companyId: 'co_1', productCode: 'TUBE-HON-120', productName: 'Honed Steel Tube 120mm', category: 'Raw Materials', location: 'WH/Stock/Rack B3', lot: 'LOT-2026-097', uom: 'Meters', onHand: 64, unitCost: 440 },
  { id: 'q6', companyId: 'co_1', productCode: 'FAB-MANIFOLD-SS', productName: 'CNC Stainless Steel Hydraulic Manifold', category: 'Fabricated Parts', location: 'WH/Stock/Shelf C1', pack: 'PACK-0031', uom: 'Units', onHand: 12, unitCost: 1850 },
  { id: 'q7', companyId: 'co_1', productCode: 'PUMP-GEAR-25', productName: 'Gear Pump 25cc (Reman)', category: 'Pumps & Motors', location: 'WH/Stock/Shelf D1', lot: 'SN-GP25-0412', uom: 'Units', onHand: 1, unitCost: 3200 },
  { id: 'q8', companyId: 'co_1', productCode: 'PUMP-GEAR-25', productName: 'Gear Pump 25cc (Reman)', category: 'Pumps & Motors', location: 'WH/Stock/Shelf D1', lot: 'SN-GP25-0418', uom: 'Units', onHand: 1, unitCost: 3200 },
  { id: 'q9', companyId: 'co_1', productCode: 'OIL-ISO46-20L', productName: 'Hydraulic Oil ISO 46 (20L)', category: 'Consumables', location: 'WH/Stock/Bay E1', uom: 'Drums', onHand: 26, unitCost: 210 },
  { id: 'q10', companyId: 'co_1', productCode: 'HOSE-2SN-1', productName: 'Hydraulic Hose 2SN 1"', category: 'Consumables', location: 'WH/Stock/Bay E2', owner: 'Riyadh Infrastructure Construction Co.', uom: 'Meters', onHand: 150, unitCost: 38 },
  { id: 'q11', companyId: 'co_1', productCode: 'RP25-KIT', productName: '[RP25] Repair Kit', category: 'Seals & Spares', location: 'Workshop/Bench 2', uom: 'Units', onHand: 9, unitCost: 540 },
  { id: 'q12', companyId: 'co_1', productCode: 'FMC130', productName: '[FMC130] Teltonika Tracker', category: 'Electronics', location: 'WH/Stock/Shelf F1', lot: 'IMEI-8650', uom: 'Units', onHand: 40, unitCost: 195 },
]

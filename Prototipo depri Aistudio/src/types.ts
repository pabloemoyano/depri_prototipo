/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum BarCategory {
  CERVEZAS = "Cervezas",
  REFRESCOS = "Refrescos y Aguas",
  VINOS_COPAS = "Vinos y Copas",
  LICORES = "Licores y Combinados",
  TAPAS_COMIDA = "Tapas y Comida",
  OTROS = "Otros"
}

export interface RecipeComponent {
  stock_item_id: string; // Ingredient product ID
  quantity: number;      // Amount consumed (supports decimals)
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  date: string;
  type: "COMPRA" | "VENTA" | "AJUSTE" | "COMBO" | "FRACCIONADO" | "INICIAL" | "CONSUMO";
  quantity: number; // Changed quantity (positive for increase, negative for decrease)
  documentId: string;
  operator: string;
  operationDate?: string;
  purchaseDate?: string;
}

export interface Presentation {
  id: string;
  name: string; // e.g., "Cajón", "Pack"
  units: number; // e.g., 12, 18
}

export interface StockItem {
  id: string;
  ownerId: string;
  name: string;
  presentationName?: string; // e.g., "Cajón", "Pack"
  presentationUnits?: number; // e.g., 12, 18
  category: string;
  quantity: number;
  min_quantity: number; // For low stock alerts
  purchase_price: number; // Cost price or auto-calculated cost if recipe
  selling_price: number; // Price to client
  image_url?: string;
  last_updated: string;
  subgroup?: string; // e.g. "Vodka", "Gin Premium"
  sku?: string;      // e.g. "BEV-GIN-01", "SKU: WHI-MAC-012"
  is_active?: boolean;
  is_recipe?: boolean;  // True if composite/fractional recipe
  components?: RecipeComponent[]; // Recipe ingredients composition
}

export interface SaleItem {
  stock_item_id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  purchase_price?: number;
}

export interface SaleTransaction {
  id: string;
  ownerId: string;
  items: SaleItem[];
  total: number;
  date: string;
  method: "efectivo" | "tarjeta" | "bizum" | string;
  origin: "terminal" | "mesa" | "ticket_ai";
  notes?: string;
  table_number?: string; // Optional e.g., "Mesa 4", "Barra"
  caja_session_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
}

export interface TablePayment {
  id: string;
  amount: number;
  date: string;
  time: string;
  operator: string;
  method: "efectivo" | "tarjeta" | "bizum" | string;
  notes?: string;
}

export interface TableSession {
  id: string;
  ownerId: string;
  name: string;
  status: "libre" | "abierta" | "cerrada" | "deuda";
  client_id?: string | null;
  client_name: string;
  items: SaleItem[];
  payments: TablePayment[];
  total_consumed: number;
  total_paid: number;
  outstanding_balance: number;
  fecha_apertura: string;
  fecha_cierre?: string;
  operator: string;
  notes?: string;
}

export interface ScannerItemResult {
  rawName: string;
  matchedItemId: string | null;
  matchedItemName: string | null;
  quantity: number;
  price: number;
  total: number;
}

export interface ScannerResponse {
  scannedItems: ScannerItemResult[];
  extractedTotal: number;
  scannedTextSummary?: string;
}

// 1. PROVIDERS
export interface Provider {
  id: string;
  ownerId: string;
  name: string;
  contactPerson: string;
  category: string; // e.g. "Beverages", "Syrups", "Spirits"
  phone: string;
  email: string;
  taxId: string; // e.g. "30-71458922-9"
  address: string;
  paymentMethod: string; // e.g. "Bank Transfer"
  billingCycle: string; // e.g. "Monthly (15th)"
  nextPaymentDate: string; // e.g. "Oct 15, 2023"
  nextPaymentAmount: number;
  ytdPurchases: number;
  orderFrequency: string; // e.g. "Weekly"
  avgLeadTimeDays: number; // e.g. "2.5"
  is_active?: boolean;
  image_url?: string;
  current_account_balance?: number; // Balance owed to/by the provider
}

// 2. PURCHASES / COST ANALYSIS
export interface CostChangeRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  providerName: string;
  oldCost: number;
  newCost: number;
  variationPct: number; // e.g. 0.084
}

// 3. AUDIT ENTRIES
export interface AuditLogEntry {
  id: string; // e.g. "#AUD-2405-001"
  date: string;
  responsible: string;
  avatarUrl?: string;
  role?: string;
  adjustmentCost: number | null; // e.g. -245.00
  adjustmentSales: number | null; // e.g. -890.00
  productCount: number;
  status: "Completado" | "En Proceso" | "Alerta";
  items?: AuditDraftItem[];
  note?: string;
  snapshotTotalQty?: number;
  snapshotTotalItems?: number;
  snapshotTotalCostValuation?: number;
  snapshotTotalSalesValuation?: number;
}

export interface AuditDraftItem {
  id: string;
  sku: string;
  name: string;
  theoretical: number;
  real: number;
  difference: number;
  valCosto: number;
  valVenta: number;
  reason: string;
  observation?: string;
}

// 4. CASH OPERATIONS (CAJA DIARIA)
export interface CashMovement {
  id: string;
  time: string;
  type: "VENTA" | "EGRESO" | "INGRESO" | "COMPRA";
  concept: string;
  amount: number; // Signed e.g. +42500.00, -12000.00
  stockStatus?: string; // e.g. "Actualizado", "N/A"
  accountId?: string;
  subaccountId?: string;
}

export interface PendingClassification {
  id: string;
  movementId: string;
  accountId: string;
  suggestedSubaccount: string;
  description: string;
  amount: number;
  user: string;
  date: string;
  imputedPeriod: string; // e.g. "2026-06"
  status: "PENDIENTE" | "RESUELTO" | "RECHAZADO";
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface CashSession {
  id: string;
  closeDate: string;
  responsible: string;
  avatarChar: string;
  initialBalance: number;
  receipts: number;
  disbursements: number;
  finalBalance: number;
  hasDiscrepancy: boolean;
}

// 5. CUSTOMERS
export interface CustomerProfile {
  id: string;
  ownerId: string;
  fullName: string;
  phone: string;
  email: string;
  category: "VIP" | "Regular" | "Corporativo" | "Nuevo";
  loyaltyTier: "GOLD TIER" | "SILVER TIER" | "PLATINUM TIER" | "STANDARD TIER";
  loyaltyPoints: number;
  progressToNextPct: number;
  nextReward: string;
  ytdSales: number;
  outstandingCredit: number;
  preferredStock: string; // e.g. "Wine", "Spirits"
  internalNotes: string;
  purchaseHistory: CustomerPurchase[];
  is_active?: boolean;
  image_url?: string;
}

export interface CustomerPurchase {
  id: string;
  date: string;
  invoiceNumber: string;
  items: string;
  total: number;
}

// 6. EVENT MODELLING for De Primera (Fútbol & Eventos)
export interface EventModel {
  id: string;
  ownerId: string;
  title: string;
  customerName: string;
  date: string;
  time: string;
  fieldNumber: "Cancha Principal & Barra F7" | "Cancha F5 Techada" | "Cancha F5 Infantil" | "Salón de Eventos VIP";
  price: number;
  status: "Confirmado" | "Pendiente" | "Cancelado";
  cateringNeeded: boolean;
  notes?: string;
}


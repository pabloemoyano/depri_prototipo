/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Power, 
  Package, 
  Users, 
  Truck, 
  RefreshCw, 
  PowerOff,
  AlertCircle,
  TrendingDown,
  Trash2,
  DollarSign
} from "lucide-react";
import { StockItem, CustomerProfile, Provider } from "../types";

interface DeactivatedTabProps {
  stock: StockItem[];
  customers: CustomerProfile[];
  providers: Provider[];
  onEditStockItem: (id: string, fields: Partial<StockItem>) => Promise<boolean>;
  onEditCustomer: (cust: CustomerProfile) => Promise<void>;
  onEditProvider: (prov: Provider) => Promise<void>;
}

export const DeactivatedTab: React.FC<DeactivatedTabProps> = ({
  stock = [],
  customers = [],
  providers = [],
  onEditStockItem,
  onEditCustomer,
  onEditProvider
}) => {
  const [subTab, setSubTab] = useState<"products" | "customers" | "providers">("products");

  // Filter inactive items
  const deletedProducts = stock.filter((item) => item.is_active === false);
  const deletedCustomers = customers.filter((c) => c.is_active === false);
  const deletedProviders = providers.filter((p) => p.is_active === false);

  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleRestoreProduct = async (item: StockItem) => {
    setLoadingId(item.id);
    try {
      await onEditStockItem(item.id, { is_active: true });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleRestoreCustomer = async (c: CustomerProfile) => {
    setLoadingId(c.id);
    try {
      await onEditCustomer({ ...c, is_active: true });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleRestoreProvider = async (p: Provider) => {
    setLoadingId(p.id);
    try {
      await onEditProvider({ ...p, is_active: true });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="deactivated_tab_container">
      
      {/* Header Panel */}
      <div className="bg-[#091426] text-white p-6 rounded-2xl border border-[#1e293b] relative overflow-hidden shadow-xs">
        <div className="relative z-10 space-y-1.5 max-w-2xl">
          <span className="text-[10px] font-black tracking-widest text-[#10b981] uppercase bg-[#112038] py-1 px-3 rounded-full border border-[#1e293b] w-fit inline-block">
            Gestión de Archivo
          </span>
          <h2 className="text-xl font-black font-display tracking-tight uppercase">Módulo de Elementos Desactivados</h2>
          <p className="text-xs text-[#bcc7de] leading-relaxed">
            Lista de control y re-adscripción. Desde este centro de mandos puedes visualizar y re-activar de forma inmediata productos de stock, fichas de clientes CRM u operadores logísticos que hayan sido deshabilitados temporalmente.
          </p>
        </div>
        <div className="absolute top-0 right-0 p-8 text-slate-800 opacity-20 select-none pointer-events-none">
          <PowerOff className="w-32 h-32" />
        </div>
      </div>

      {/* Internal Subtab Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setSubTab("products")}
          className={`py-3 px-6 text-xs font-bold tracking-wide border-b-2 flex items-center gap-2 transition cursor-pointer ${
            subTab === "products" 
              ? "border-[#16a34a] text-[#16a34a]" 
              : "border-transparent text-slate-500 hover:text-slate-850"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Productos ({deletedProducts.length})</span>
        </button>

        <button
          onClick={() => setSubTab("customers")}
          className={`py-3 px-6 text-xs font-bold tracking-wide border-b-2 flex items-center gap-2 transition cursor-pointer ${
            subTab === "customers" 
              ? "border-[#16a34a] text-[#16a34a]" 
              : "border-transparent text-slate-500 hover:text-slate-850"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Clientes ({deletedCustomers.length})</span>
        </button>

        <button
          onClick={() => setSubTab("providers")}
          className={`py-3 px-6 text-xs font-bold tracking-wide border-b-2 flex items-center gap-2 transition cursor-pointer ${
            subTab === "providers" 
              ? "border-[#16a34a] text-[#16a34a]" 
              : "border-transparent text-slate-500 hover:text-slate-850"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Proveedores ({deletedProviders.length})</span>
        </button>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white border border-[#eff4ff] rounded-2xl shadow-xs overflow-hidden">
        
        {subTab === "products" && (
          <div className="overflow-x-auto">
            {deletedProducts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-6 h-6 text-slate-300" />
                <span>No hay ningún producto de stock desactivado en este momento. All product parameters are active.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">SKU / Cód</th>
                    <th className="py-3 px-4 text-right">Existencias</th>
                    <th className="py-3 px-4 text-right">P. Unit Costo</th>
                    <th className="py-3 px-4 text-right">PVP Venta</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deletedProducts.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-xs">{item.category}</td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[10px]">{item.sku || "N/A"}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-800 font-medium">{item.quantity} raciones</td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-500">${item.purchase_price.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-900 font-bold">${item.selling_price.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleRestoreProduct(item)}
                          disabled={loadingId === item.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#16a34a] font-bold text-[10px] transition cursor-pointer border border-[#86efac]/40 hover:border-emerald-300 disabled:opacity-50"
                        >
                          <Power className="w-3 h-3" />
                          <span>{loadingId === item.id ? "Activando..." : "Re-Activar"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {subTab === "customers" && (
          <div className="overflow-x-auto">
            {deletedCustomers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-6 h-6 text-slate-300" />
                <span>No hay ningún perfil de cliente desactivado en este momento. All CRM profiles are active.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Teléfono / Email</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Rango de Fidelidad</th>
                    <th className="py-3 px-4 text-right">Puntos Acumulados</th>
                    <th className="py-3 px-4 text-right">Consumo YTD</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deletedCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs">{c.fullName}</div>
                      </td>
                      <td className="py-3.5 px-4 space-y-0.5 text-xs">
                        <div className="text-slate-705 font-medium font-mono text-[10px]">{c.phone}</div>
                        <div className="text-slate-400 text-[10.5px] truncate max-w-[150px]">{c.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="bg-slate-100 text-slate-700 py-0.5 px-2 rounded-md font-bold text-[9px] uppercase">
                          {c.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold text-slate-600">{c.loyaltyTier}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-800 font-bold">{c.loyaltyPoints.toLocaleString()} pts</td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-900 font-extrabold">${c.ytdSales.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleRestoreCustomer(c)}
                          disabled={loadingId === c.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#16a34a] font-bold text-[10px] transition cursor-pointer border border-[#86efac]/40 hover:border-emerald-300 disabled:opacity-50"
                        >
                          <Power className="w-3 h-3" />
                          <span>{loadingId === c.id ? "Activando..." : "Re-Activar"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {subTab === "providers" && (
          <div className="overflow-x-auto">
            {deletedProviders.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-6 h-6 text-slate-300" />
                <span>No hay ningún proveedor inactivo en la base de datos de auditoría.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">Responsable / Cat</th>
                    <th className="py-3 px-4">Teléfono / Email</th>
                    <th className="py-3 px-4">C.I.F Fiscal</th>
                    <th className="py-3 px-4">Ciclo de Cobro</th>
                    <th className="py-3 px-4 text-right">Facturación YTD</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deletedProviders.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.address}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-bold text-slate-700">{p.contactPerson}</div>
                        <div className="text-slate-450 mt-0.5">{p.category}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-mono text-[10px] text-slate-600">{p.phone}</div>
                        <div className="text-slate-400 truncate max-w-[150px]">{p.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono font-medium text-slate-500">{p.taxId}</td>
                      <td className="py-3.5 px-4 text-xs font-bold text-slate-550">{p.billingCycle}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-900 font-extrabold">${p.ytdPurchases.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleRestoreProvider(p)}
                          disabled={loadingId === p.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#16a34a] font-bold text-[10px] transition cursor-pointer border border-[#86efac]/40 hover:border-emerald-300 disabled:opacity-50"
                        >
                          <Power className="w-3 h-3" />
                          <span>{loadingId === p.id ? "Activando..." : "Re-Activar"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>

    </div>
  );
};

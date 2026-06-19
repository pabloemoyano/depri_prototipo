/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React from "react";
import { 
  TrendingUp, 
  AlertTriangle, 
  Coins, 
  DollarSign, 
  Activity, 
  ArrowUpRight, 
  Plus, 
  Package, 
  Clock, 
  ChevronRight,
  TrendingDown,
  Sparkles
} from "lucide-react";
import { StockItem, SaleTransaction } from "../types";

interface DashboardStatsProps {
  stock: StockItem[];
  sales: SaleTransaction[];
  purchases?: any[];
  onRefillStock: (id: string, amount: number) => void;
  onNavigateToTab: (tab: string) => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ 
  stock, 
  sales, 
  purchases = [],
  onRefillStock,
  onNavigateToTab
}) => {
  const [chartType, setChartType] = React.useState<"sales" | "purchases">("sales");
  // Statistics and holdings computations
  const totalItemsCount = stock.length;
  const alertItems = stock.filter(item => item.is_active !== false && !item.is_recipe && item.quantity <= item.min_quantity);
  
  // Financial holdings
  const totalCostValuation = stock.reduce((acc, item) => acc + (item.quantity * item.purchase_price), 0);
  const totalRetailValuation = stock.reduce((acc, item) => acc + (item.quantity * item.selling_price), 0);
  const potentialProfit = totalRetailValuation - totalCostValuation;
  const averageMarginPct = totalRetailValuation > 0 ? (potentialProfit / totalRetailValuation) * 100 : 0;

  // Real best seller computation from sales
  const itemQuantities: { [name: string]: { qty: number; total: number } } = {};
  sales.forEach(s => {
    s.items.forEach(item => {
      if (!itemQuantities[item.name]) {
        itemQuantities[item.name] = { qty: 0, total: 0 };
      }
      itemQuantities[item.name].qty += item.quantity;
      itemQuantities[item.name].total += item.total;
    });
  });

  let bestSellerName = "Ninguno registrado";
  let bestSellerQty = 0;
  let bestSellerTotal = 0;
  Object.entries(itemQuantities).forEach(([name, data]) => {
    if (data.qty > bestSellerQty) {
      bestSellerQty = data.qty;
      bestSellerName = name;
      bestSellerTotal = data.total;
    }
  });

  // Dynamic weekday sales / purchases aggregate totals
  const weekdayTotals = { LUN: 0, MAR: 0, MIE: 0, JUE: 0, VIE: 0, SÁB: 0, DOM: 0 };
  let maxWeekdayTotal = 1; // avoid division by zero

  if (chartType === "sales") {
    sales.forEach(sale => {
      try {
        // Safely parse date ignoring timezone shift
        const isoDateOnly = sale.date.includes("T") ? sale.date.split("T")[0] : sale.date;
        const [year, month, day] = isoDateOnly.split("-").map(Number);
        const d = new Date(year, month - 1, day);
        
        const dayIndex = d.getDay(); // 0 is Sunday, 1 is Monday ...
        const days: ("DOM"|"LUN"|"MAR"|"MIE"|"JUE"|"VIE"|"SÁB")[] = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SÁB"];
        const dayKey = days[dayIndex];
        weekdayTotals[dayKey === "SÁB" ? "SÁB" : dayKey] += sale.total;
      } catch (e) {
        // safe backup parse
      }
    });
  } else {
    (purchases || []).forEach(p => {
      try {
        if (!p || !p.date) return;
        const isoDateOnly = p.date.includes("T") ? p.date.split("T")[0] : p.date;
        const [year, month, day] = isoDateOnly.split("-").map(Number);
        const d = new Date(year, month - 1, day);
        
        const dayIndex = d.getDay(); // 0 is Sunday, 1 is Monday ...
        const days: ("DOM"|"LUN"|"MAR"|"MIE"|"JUE"|"VIE"|"SÁB")[] = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SÁB"];
        const dayKey = days[dayIndex];
        if (dayKey) {
          const key = dayKey === "SÁB" ? "SÁB" : dayKey;
          weekdayTotals[key] += Number(p.total) || 0;
        }
      } catch (e) {
        // safe backup parse
      }
    });
  }
  
  // Calculate relative chart heights
  Object.values(weekdayTotals).forEach(val => {
    if (val > maxWeekdayTotal) maxWeekdayTotal = val;
  });

  // Recent activity logs compiled dynamically from current sales
  const activityLogs = sales
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((sale) => {
      const itemsList = sale.items.map(item => `${item.quantity}x ${item.name}`).join(", ") || "Operación registrada";
      const paymentMethodStr = sale.method.toUpperCase();
      return {
        id: sale.id,
        icon: TrendingUp,
        type: `Venta ($${sale.total.toFixed(2)})`,
        desc: `${itemsList} [Mesa: ${sale.table_number || "Barra"}] - Pagado vía ${paymentMethodStr}`,
        time: "Hace instantes",
        badgeCol: "bg-emerald-50 text-emerald-700 border-emerald-100"
      };
    })
    .slice(0, 4);

  return (
    <div className="space-y-6">
      
      {/* High density KPI widgets list */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Total inventory Valuation card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex flex-col justify-between min-h-[10.5rem] h-auto pb-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">VALOR TOTAL DEL INVENTARIO</span>
            <h3 className="text-2xl font-bold font-mono text-[#091426] dark:text-slate-50 tracking-tight mt-1 ml-0.5">
              ${totalCostValuation.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Costo real de reposición para reponer bodega</p>
          </div>
          
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between text-[10px] text-slate-450 dark:text-slate-400 font-bold">
              <span>Capacidad de Almacenamiento ocupada:</span>
              <span>{stock.length > 0 ? "Normal" : "Vacío (0%)"}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#16a34a] rounded-full" style={{ width: stock.length > 0 ? "65%" : "0%" }} />
            </div>
          </div>
        </div>

        {/* Low Stock Alerts card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex flex-col justify-between min-h-[10.5rem] h-auto pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">ALERTAS DE STOCK CRÍTICO</span>
            <div className="flex items-center gap-2.5 mt-1.5">
              <h3 className={`text-2xl font-black font-mono leading-none ${alertItems.length > 0 ? "text-[#ba1a1a] dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                {alertItems.length} Ítems
              </h3>
              {alertItems.length > 0 && <AlertTriangle className="w-5 h-5 text-[#ba1a1a] dark:text-red-400 animate-pulse" />}
            </div>
            <p className="text-[11px] text-[#45474c] dark:text-slate-300 mt-1 font-semibold">Productos bajo límites óptimos de venta.</p>
          </div>

          <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold flex justify-between items-center ${
            alertItems.length > 0 
              ? "bg-[#ffdad6] dark:bg-red-950/40 text-[#93000a] dark:text-red-300 border-red-150 dark:border-red-900/50" 
              : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-150 dark:border-emerald-900/50"
          }`}>
            <span className="truncate">{alertItems.length > 0 ? `Sugerido: Reposición inmediata` : "Stock estable, todo en orden"}</span>
            <button 
              onClick={() => onNavigateToTab("inventory")}
              className="underline hover:opacity-80 text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              Ver
            </button>
          </div>
        </div>

        {/* Sales vs Purchases card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex flex-col justify-between min-h-[10.5rem] h-auto pb-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">INGRESOS VS INVERSIÓN COSTO</span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <p className="text-[9px] font-bold text-slate-400">Ventas Registradas</p>
                <p className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  ${sales.reduce((acc, s) => acc + s.total, 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="border-l pl-3 border-slate-150 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-400">Valor de Almacén</p>
                <p className="text-base font-bold font-mono text-slate-800 dark:text-slate-100">
                  ${totalCostValuation.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 p-2 rounded-xl border border-emerald-150 dark:border-emerald-900/50 flex items-center justify-between text-[10px] font-bold">
            <span>Margen de Beneficio Promedio:</span>
            <span className="font-mono text-xs">%{averageMarginPct.toFixed(1)}</span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Tendency de Movimiento de Stock SVG curves (Cols = 7) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#eff4ff] shadow-xs space-y-4">
          
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-555 uppercase tracking-widest">
                Tendencia Semanal de {chartType === "sales" ? "Ventas" : "Compras"} (Totales)
              </h3>
              <p className="text-xs text-slate-400">
                Evolución diaria de {chartType === "sales" ? "ventas" : "compras"} acumuladas por día de la semana ingresados por ti
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex items-center border border-slate-200/50 dark:border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setChartType("sales")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition duration-150 cursor-pointer ${chartType === "sales" ? "bg-[#16a34a] text-white shadow-xs" : "text-slate-500 hover:text-slate-705"}`}
                >
                  Ventas
                </button>
                <button
                  type="button"
                  onClick={() => setChartType("purchases")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition duration-150 cursor-pointer ${chartType === "purchases" ? "bg-[#16a34a] text-white shadow-xs" : "text-slate-500 hover:text-slate-705"}`}
                >
                  Compras
                </button>
              </div>
            </div>
          </div>

          {/* SVG representation with live dataset */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 h-52 flex flex-col justify-between relative overflow-hidden text-slate-350">
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />
            
            {/* SVG Bars container */}
            <div className="relative h-36 w-full flex items-end justify-between px-4 z-10 pt-4">
              
              {/* LUN */}
              <div className="flex flex-col items-center gap-1.5 w-8">
                <span className={`text-[9px] font-mono font-bold ${weekdayTotals.LUN > 0 ? "text-[#22c55e] dark:text-emerald-400 font-black" : "text-slate-500"}`}>
                  ${weekdayTotals.LUN.toFixed(0)}
                </span>
                <div 
                  className={`w-4 rounded-t-sm transition-all ${weekdayTotals.LUN > 0 ? "bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.3)]" : "bg-slate-700"} hover:brightness-110`}
                  style={{ height: `${Math.max(10, (weekdayTotals.LUN / maxWeekdayTotal) * 110)}px` }}
                />
                <span className="text-[10px] text-slate-500 font-bold">LUN</span>
              </div>

              {/* MAR */}
              <div className="flex flex-col items-center gap-1.5 w-8">
                <span className={`text-[9px] font-mono font-bold ${weekdayTotals.MAR > 0 ? "text-[#22c55e] dark:text-emerald-400 font-black" : "text-slate-500"}`}>
                  ${weekdayTotals.MAR.toFixed(0)}
                </span>
                <div 
                  className={`w-4 rounded-t-sm transition-all ${weekdayTotals.MAR > 0 ? "bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.3)]" : "bg-slate-700"} hover:brightness-110`} 
                  style={{ height: `${Math.max(10, (weekdayTotals.MAR / maxWeekdayTotal) * 110)}px` }}
                />
                <span className="text-[10px] text-slate-500 font-bold">MAR</span>
              </div>

              {/* MIE */}
              <div className="flex flex-col items-center gap-1.5 w-8">
                <span className={`text-[9px] font-mono font-bold ${weekdayTotals.MIE > 0 ? "text-[#22c55e] dark:text-emerald-400 font-black" : "text-slate-500"}`}>
                  ${weekdayTotals.MIE.toFixed(0)}
                </span>
                <div 
                  className={`w-4 rounded-t-sm transition-all ${weekdayTotals.MIE > 0 ? "bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.3)]" : "bg-slate-700"} hover:brightness-110`} 
                  style={{ height: `${Math.max(10, (weekdayTotals.MIE / maxWeekdayTotal) * 110)}px` }}
                />
                <span className="text-[10px] text-slate-500 font-bold">MIE</span>
              </div>

              {/* JUE */}
              <div className="flex flex-col items-center gap-1.5 w-8">
                <span className={`text-[9px] font-mono font-bold ${weekdayTotals.JUE > 0 ? "text-[#22c55e] dark:text-emerald-400 font-black" : "text-slate-500"}`}>
                  ${weekdayTotals.JUE.toFixed(0)}
                </span>
                <div 
                  className={`w-4 rounded-t-sm transition-all ${weekdayTotals.JUE > 0 ? "bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.3)]" : "bg-slate-700"} hover:brightness-110`} 
                  style={{ height: `${Math.max(10, (weekdayTotals.JUE / maxWeekdayTotal) * 110)}px` }}
                />
                <span className="text-[10px] text-slate-500 font-bold">JUE</span>
              </div>

              {/* VIE */}
              <div className="flex flex-col items-center gap-1.5 w-8">
                <span className={`text-[9px] font-mono font-bold ${weekdayTotals.VIE > 0 ? "text-[#22c55e] dark:text-emerald-400 font-black" : "text-slate-500"}`}>
                  ${weekdayTotals.VIE.toFixed(0)}
                </span>
                <div 
                  className={`w-4 rounded-t-sm transition-all ${weekdayTotals.VIE > 0 ? "bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.3)]" : "bg-slate-700"} hover:brightness-110`} 
                  style={{ height: `${Math.max(10, (weekdayTotals.VIE / maxWeekdayTotal) * 110)}px` }}
                />
                <span className="text-[10px] text-slate-500 font-bold">VIE</span>
              </div>

              {/* SAB */}
              <div className="flex flex-col items-center gap-1.5 w-8 scale-x-110">
                <span className={`text-[9px] font-mono font-black ${weekdayTotals.SÁB > 0 ? "text-[#22c55e]" : "text-slate-500"}`}>
                  ${weekdayTotals.SÁB.toFixed(0)}
                </span>
                <div 
                  className={`w-4.5 rounded-t-sm shadow-md transition-all ${weekdayTotals.SÁB > 0 ? "bg-[#22c55e]" : "bg-slate-700"} hover:brightness-110`} 
                  style={{ height: `${Math.max(10, (weekdayTotals.SÁB / maxWeekdayTotal) * 110)}px` }}
                />
                <span className={`text-[10px] font-bold ${weekdayTotals.SÁB > 0 ? "text-[#22c55e]" : "text-slate-550"}`}>SÁB</span>
              </div>

              {/* DOM */}
              <div className="flex flex-col items-center gap-1.5 w-8 scale-x-110">
                <span className={`text-[9px] font-mono font-black ${weekdayTotals.DOM > 0 ? "text-[#22c55e]" : "text-slate-500"}`}>
                  ${weekdayTotals.DOM.toFixed(0)}
                </span>
                <div 
                  className={`w-4.5 rounded-t-sm shadow-sm transition-all ${weekdayTotals.DOM > 0 ? "bg-[#22c55e]" : "bg-slate-700"} hover:brightness-110`} 
                  style={{ height: `${Math.max(10, (weekdayTotals.DOM / maxWeekdayTotal) * 110)}px` }}
                />
                <span className={`text-[10px] font-bold ${weekdayTotals.DOM > 0 ? "text-[#22c55e]" : "text-slate-550"}`}>DOM</span>
              </div>

            </div>

            <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold pt-2 border-t border-slate-800 z-10 select-none">
              <span>Optimización de Auditoría en Tiempo Real</span>
              {chartType === "sales" ? (
                <span className="font-mono text-slate-400">Total Ventas: ${sales.reduce((acc, s) => acc + s.total, 0).toFixed(0)}</span>
              ) : (
                <span className="font-mono text-[#22c55e]">Total Compras: ${(purchases || []).reduce((acc, p) => acc + (Number(p?.total) || 0), 0).toFixed(0)}</span>
              )}
            </div>

          </div>

        </div>

        {/* Right: Actividad Reciente Feed card (Cols = 5) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-[#eff4ff] shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-550 uppercase tracking-widest block">Registro de Actividad Real</h3>
          
          <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-1">
            {activityLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10">
                <p className="text-slate-400 text-xs font-medium">No hay transacciones registradas aún.</p>
                <p className="text-slate-300 text-[11px] mt-1">Registra cobros en Ventas / TPV para ver la actividad en vivo.</p>
              </div>
            ) : (
              activityLogs.map((log) => {
                const LogIcon = log.icon;
                return (
                  <div key={log.id} className="py-2.5 flex items-start gap-3 text-xs">
                    <div className={`p-1.5 rounded-lg border ${log.badgeCol} flex items-center justify-center`}>
                      <LogIcon className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.type}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        <span className="text-[10px] text-slate-450 font-medium">{log.time}</span>
                      </div>
                      <p className="text-slate-500 font-semibold leading-relaxed text-[11px]">{log.desc}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 text-center">
            <button
              onClick={() => onNavigateToTab("sales")}
              className="text-[#16a34a] hover:text-[#14532d] font-bold text-xs flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              Ir a Ventas / TPV
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

      {/* Corporate bottom feature card: Producto Estrella and floating circular details */}
      <div className="bg-[#eff4ff]/30 p-5 rounded-2xl border border-[#eff4ff] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
        
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-[#22c55e]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Análisis Real de Ventas</span>
            <h4 className="text-sm font-black text-[#0c1b33] mt-1">
              PRODUCTO MÁS VENDIDO: <span className="text-[#16a34a] font-black uppercase">{bestSellerName}</span>
            </h4>
            <p className="text-xs text-slate-500">
              {bestSellerQty > 0 
                ? `Mantiene una popularidad alta con ${bestSellerQty} unidades vendidas para un volumen total de $${bestSellerTotal.toFixed(2)}.` 
                : "Agrega productos y realiza transacciones de TPV para ver qué artículo rota más rápido."}
            </p>
          </div>
        </div>

        {bestSellerQty > 0 && (
          <div className="flex items-center gap-4 text-xs font-mono font-bold shrink-0">
            <div>
              <p className="text-slate-400 text-[10px]">Cantidad Vendida</p>
              <p className="text-sm text-slate-900">{bestSellerQty} unidades</p>
            </div>
            <div className="border-l pl-3 border-slate-205">
              <p className="text-slate-400 text-[10px]">Ingreso Único</p>
              <p className="text-sm text-emerald-600">${bestSellerTotal.toFixed(2)}</p>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};

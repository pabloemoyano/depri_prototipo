/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  History, 
  Search, 
  Filter, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  CreditCard, 
  FileText,
  Bookmark
} from "lucide-react";
import { SaleTransaction } from "../types";

interface SalesHistoryProps {
  sales: SaleTransaction[];
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({ sales }) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("TODOS");
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  // Toggle rows to inspect details
  const toggleRow = (id: string) => {
    setExpandedSaleId(expandedSaleId === id ? null : id);
  };

  // Perform active client filtering
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchMethod = methodFilter === "TODOS" || s.method === methodFilter;
      const matchSearch = s.table_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchMethod && matchSearch;
    });
  }, [sales, methodFilter, searchQuery]);

  // Aggregate stats
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + s.total, 0);
  }, [filteredSales]);

  // Format nice timezone string
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6" id="sales_history_center">
      
      {/* Controls panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Quick filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por mesa (ej: Mesa 3), ID de venta, notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="text-xs font-bold leading-tight bg-transparent border-none py-1 focus:outline-hidden pr-6 cursor-pointer"
            >
              <option value="TODOS">Todos los Pagos</option>
              <option value="efectivo">💵 Efectivo</option>
              <option value="tarjeta">💳 Tarjeta</option>
              <option value="bizum">📱 Bizum</option>
            </select>
          </div>
        </div>

        {/* Dynamic total filter revenue aggregate */}
        <div className="text-right flex flex-col md:items-end justify-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">RECAUDACIÓN FILTRADA :</span>
          <span className="text-xl font-black text-slate-900 font-mono tracking-tight">${totalRevenue.toFixed(2)}</span>
          <span className="text-[10px] text-slate-400 font-semibold">{filteredSales.length} transacciones</span>
        </div>

      </div>

      {/* Main transactions List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="sales_list_cards">
        <div className="divide-y divide-slate-100">
          
          {filteredSales.length === 0 ? (
            <div className="py-24 text-center space-y-2 text-slate-500">
              <History className="w-10 h-10 text-slate-300 mx-auto animate-pulse" />
              <p className="text-sm font-semibold">No se encontraron ventas registradas.</p>
              <p className="text-xs">Realiza transacciones en la pestaña POS o procesa un tique con IA en Escaner Tique.</p>
            </div>
          ) : (
            filteredSales.map((sale) => {
              const isExpanded = expandedSaleId === sale.id;
              const hasAIOrigin = sale.origin === "ticket_ai";

              return (
                <div 
                  key={sale.id} 
                  className={`transition duration-150 ${isExpanded ? "bg-slate-50/30" : "hover:bg-slate-50/20"}`}
                  id={`sale_transaction_${sale.id}`}
                >
                  
                  {/* General Overview Table row */}
                  <div 
                    onClick={() => toggleRow(sale.id)}
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    
                    <div className="flex items-center gap-3">
                      {/* Origin indicator banner icon */}
                      <div className={`p-2 rounded-xl border flex items-center justify-center ${
                        hasAIOrigin 
                          ? "bg-indigo-50 border-indigo-100 text-indigo-700 animate-gently" 
                          : "bg-slate-100 border-slate-200 text-slate-600"
                      }`}>
                        {hasAIOrigin ? (
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 font-mono">{sale.id}</span>
                          {hasAIOrigin && (
                            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-sm leading-none">
                              ESCANER IA
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="font-extrabold text-slate-900 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                            {sale.table_number || "Barra"}
                          </span>
                          <span className="font-medium text-slate-500 flex items-center gap-1 text-xs">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatDate(sale.date)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                      
                      {/* Price tag with method */}
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-slate-950 font-mono tracking-tight">
                          ${sale.total.toFixed(2)}
                        </span>
                        
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-0.5">
                          {sale.method === "efectivo" ? "💵 efectivo" : sale.method === "tarjeta" ? "💳 tarjeta" : "📱 bizum"}
                        </span>
                      </div>

                      {/* Accordion pointer */}
                      <div className="text-slate-400 p-1 rounded-lg border border-transparent">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>

                    </div>

                  </div>

                  {/* Expanded ticket accordion content */}
                  {isExpanded && (
                    <div className="px-6 pb-5 pt-1 space-y-4 animate-scale-up border-t border-slate-100 bg-slate-50/50">
                      
                      <div className="bg-white p-4 rounded-xl border border-slate-150 max-w-xl shadow-3xs space-y-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-1.5">
                          <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                          Desglose del Tique de Caja
                        </div>

                        {/* Splitted table item elements */}
                        <div className="divide-y divide-slate-100 space-y-2">
                          {sale.items.map((item, idx) => (
                            <div key={idx} className="pt-2 flex items-center justify-between text-xs font-semibold">
                              <div className="space-y-0.5">
                                <p className="text-slate-900 font-bold">{item.name}</p>
                                <p className="text-[10px] text-slate-400 font-medium font-mono">
                                  ${item.price.toFixed(2)} x {item.quantity} raciones
                                </p>
                              </div>
                              <span className="font-bold text-slate-900 font-mono">
                                ${item.total.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Receipt Totals summary block */}
                        <div className="pt-3 border-t border-slate-150 flex items-center justify-between text-xs font-bold font-mono">
                          <span className="text-slate-500 uppercase font-bold tracking-wider">Base Liquida Generada</span>
                          <span className="text-sm font-black text-slate-900 font-mono">${sale.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Observations banner details */}
                      {sale.notes && (
                        <div className="p-3 bg-indigo-50/50 border border-indigo-100/40 rounded-xl text-xs max-w-xl">
                          <span className="font-extrabold text-indigo-700 block uppercase text-[9px] tracking-wider mb-0.5">Observaciones de Auditoría IA:</span>
                          <p className="text-slate-705 leading-relaxed font-semibold">{sale.notes}</p>
                        </div>
                      )}

                    </div>
                  )}

                </div>
              );
            })
          )}

        </div>
      </div>

    </div>
  );
};

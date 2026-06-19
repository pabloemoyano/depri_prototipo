/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { 
  Beer, 
  ShoppingCart, 
  ClipboardList, 
  Sparkles, 
  History, 
  Clock,
  Menu,
  TrendingUp,
  Activity
} from "lucide-react";

interface HeaderProps {
  activeTab: "dashboard" | "pos" | "stock" | "scanner" | "history";
  setActiveTab: (tab: "dashboard" | "pos" | "stock" | "scanner" | "history") => void;
  stockInAlertCount: number;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  setActiveTab, 
  stockInAlertCount 
}) => {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    // Live clock update support
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Menu lists
  const tabs = [
    { id: "dashboard", label: "Estadísticas", icon: TrendingUp },
    { id: "pos", label: "Vaquilla POS (Cobrar)", icon: ShoppingCart },
    { id: "stock", label: "Inventario Stock", icon: ClipboardList, badge: stockInAlertCount > 0 ? stockInAlertCount : undefined },
    { id: "scanner", label: "Escaner Tique IA", icon: Sparkles, highlight: true },
    { id: "history", label: "Historial Ventas", icon: History }
  ];

  return (
    <header className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4" id="main_header">
      
      {/* Brand logo bar & Live Clock info */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 pb-4 gap-4">
        
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-650 text-white rounded-xl shadow-md border border-indigo-500 animate-gently flex items-center justify-center">
            <Beer className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
                BarStock Pro
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 py-0.5 px-2 rounded-md border border-indigo-500/30">
                Hostelería IA
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Gestión Profesional de Inventarios, Barras y Mesas</p>
          </div>
        </div>

        {/* Live system clock indicator (Architectural and premium layout detail) */}
        <div className="flex items-center gap-3 bg-slate-950/40 py-2 px-3.5 rounded-xl border border-slate-800/65 text-xs text-slate-300">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span className="font-mono text-xs font-bold font-semibold tracking-wider">
            {time || "Cargando..."}
          </span>
          <span className="h-2 w-2 rounded-full bg-emerald-500 border border-emerald-400 animate-pulse" title="Sistema en línea" />
        </div>

      </div>

      {/* Main navigation row */}
      <nav className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative px-4 py-2.5 rounded-xl text-xs font-bold leading-none tracking-wide transition flex items-center gap-2 cursor-pointer select-none border ${
                isActive
                  ? tab.highlight 
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "bg-white border-white text-slate-950 shadow-md"
                  : tab.highlight
                    ? "bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-300 border-indigo-950/80 hover:border-indigo-800/40"
                    : "bg-slate-950/20 hover:bg-slate-800/50 text-slate-300 border-slate-950/40 hover:border-slate-800/40"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "" : "text-slate-400"}`} />
              <span>{tab.label}</span>
              
              {/* Count / Alert badge indicator */}
              {tab.badge !== undefined && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-650 text-white text-[9px] font-black tracking-wider leading-none h-4 px-1.5 rounded-full flex items-center justify-center border border-slate-900 shadow-sm animate-pulse">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

    </header>
  );
};

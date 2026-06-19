/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Calendar, 
  TrendingUp, 
  Users, 
  Clock, 
  MapPin, 
  Filter, 
  Search, 
  Activity, 
  Grid,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowUpRight,
  Printer,
  Info
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { EventModel, CustomerProfile } from "../types";

// Dynamic colors for the pie slices
const COLORS = ["#10b981", "#6366f1", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6"];

interface TurnReportProps {
  events: EventModel[];
  customers: CustomerProfile[];
  sinceDate: string;
  untilDate: string;
  setSinceDate: (d: string) => void;
  setUntilDate: (d: string) => void;
}

export const TurnReport: React.FC<TurnReportProps> = ({
  events,
  customers,
  sinceDate,
  untilDate,
  setSinceDate,
  setUntilDate
}) => {
  // Turn Analysis filter states
  const [selectedCanchaFilter, setSelectedCanchaFilter] = useState<string>("Todas");
  const [selectedClienteFilter, setSelectedClienteFilter] = useState<string>("Todos");
  const [selectedHorarioFilter, setSelectedHorarioFilter] = useState<string>("Todos");
  const [chartMetric, setChartMetric] = useState<"count" | "earnings">("count");

  // Dynamic lists for dropdown selectors
  const uniqueCanchas = useMemo(() => {
    const canchaSet = new Set<string>();
    events.forEach(e => {
      if (e.fieldNumber) canchaSet.add(e.fieldNumber);
    });
    return ["Todas", ...Array.from(canchaSet).sort()];
  }, [events]);

  const uniqueClientesEvents = useMemo(() => {
    const customerSet = new Set<string>();
    events.forEach(e => {
      if (e.customerName) customerSet.add(e.customerName);
    });
    return ["Todos", ...Array.from(customerSet).sort()];
  }, [events]);

  const uniqueHorarios = useMemo(() => {
    const hourSet = new Set<string>();
    events.forEach(e => {
      if (e.time) hourSet.add(e.time);
    });
    return ["Todos", ...Array.from(hourSet).sort()];
  }, [events]);

  // Days count helper
  const poolDaysCount = useMemo(() => {
    if (!sinceDate || !untilDate) return 1;
    const s = new Date(sinceDate);
    const u = new Date(untilDate);
    const diff = Math.abs(u.getTime() - s.getTime());
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    return isNaN(days) || days <= 0 ? 1 : days;
  }, [sinceDate, untilDate]);

  // Core Turn Report data aggregation
  const stats = useMemo(() => {
    const filtered = events.filter(e => {
      if (!e.date) return false;
      const dateStr = e.date.substring(0, 10);
      if (dateStr < sinceDate || dateStr > untilDate) return false;

      if (selectedCanchaFilter !== "Todas" && e.fieldNumber !== selectedCanchaFilter) return false;
      if (selectedClienteFilter !== "Todos" && e.customerName !== selectedClienteFilter) return false;
      if (selectedHorarioFilter !== "Todos" && e.time !== selectedHorarioFilter) return false;

      return true;
    });

    // 1. Cancha aggregation
    const canchaMap: Record<string, { count: number; earnings: number; usagePct: number }> = {};
    const standardFields = [
      "Cancha 1",
      "Cancha 2"
    ];

    standardFields.forEach(f => {
      canchaMap[f] = { count: 0, earnings: 0, usagePct: 0 };
    });

    filtered.forEach(e => {
      const field = e.fieldNumber || "Cancha 1";
      if (!canchaMap[field]) {
        canchaMap[field] = { count: 0, earnings: 0, usagePct: 0 };
      }
      canchaMap[field].count++;
      canchaMap[field].earnings += e.price || 0;
    });

    // Assume 12 potential games standard slots per day per cancha
    const maxDailySlots = 12;
    const totalPossibleSlots = poolDaysCount * maxDailySlots;

    Object.keys(canchaMap).forEach(field => {
      const count = canchaMap[field].count;
      const pct = (count / (totalPossibleSlots || 1)) * 100;
      canchaMap[field].usagePct = Math.min(Number(pct.toFixed(1)), 100);
    });

    const canchaRanking = Object.entries(canchaMap)
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.count - a.count);

    // 2. Horarios aggregation
    const timeMap: Record<string, { count: number; earnings: number }> = {};
    filtered.forEach(e => {
      const t = e.time || "Sin asignar";
      if (!timeMap[t]) {
        timeMap[t] = { count: 0, earnings: 0 };
      }
      timeMap[t].count++;
      timeMap[t].earnings += e.price || 0;
    });

    const timeRanking = Object.entries(timeMap)
      .map(([slot, val]) => ({ slot, ...val }))
      .sort((a, b) => b.count - a.count);

    const peakTimeSlot = timeRanking.length > 0 ? timeRanking[0].slot : "N/D";
    const peakTimeCount = timeRanking.length > 0 ? timeRanking[0].count : 0;

    // 3. Client ranking aggregation
    const clientMap: Record<string, { count: number; spend: number }> = {};
    filtered.forEach(e => {
      const c = e.customerName || "Cliente Eventual";
      if (!clientMap[c]) {
        clientMap[c] = { count: 0, spend: 0 };
      }
      clientMap[c].count++;
      clientMap[c].spend += e.price || 0;
    });

    const clientRanking = Object.entries(clientMap)
      .map(([name, val]) => {
        const profile = customers.find(cust => cust.fullName.toLowerCase() === name.toLowerCase());
        const tier = profile ? profile.loyaltyTier : "STANDARD TIER";
        const weeks = poolDaysCount / 7 || 1;
        const frequencyPerWeek = val.count / (weeks < 0.1 ? 0.1 : weeks);
        return {
          name,
          tier,
          frequencyPerWeek: Number(frequencyPerWeek.toFixed(2)),
          ...val
        };
      })
      .sort((a, b) => b.count - a.count);

    // 4. Day of the Week aggregation
    const daysName = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const weekdayMap: Record<string, { count: number; earnings: number }> = {};
    daysName.forEach(d => {
      weekdayMap[d] = { count: 0, earnings: 0 };
    });

    filtered.forEach(e => {
      if (e.date) {
        const [y, m, d] = e.date.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayIndex = dateObj.getDay();
        const dayName = daysName[dayIndex] || "N/D";
        if (weekdayMap[dayName]) {
          weekdayMap[dayName].count++;
          weekdayMap[dayName].earnings += e.price || 0;
        }
      }
    });

    const weekdayRanking = Object.entries(weekdayMap)
      .map(([day, val]) => ({ day, ...val }));
    const peakDayObj = [...weekdayRanking].sort((a, b) => b.count - a.count);
    const peakDay = peakDayObj.length > 0 && peakDayObj[0].count > 0 ? peakDayObj[0].day : "N/D";

    // Summary KPIs
    const totalReservas = filtered.length;
    const totalRecaudado = filtered.reduce((acc, c) => acc + (c.price || 0), 0);
    const averageTicketPrice = totalReservas > 0 ? totalRecaudado / totalReservas : 0;
    const confirmedCount = filtered.filter(e => e.status === "Confirmado").length;
    const pendingCount = filtered.filter(e => e.status === "Pendiente").length;
    const canceledCount = filtered.filter(e => e.status === "Cancelado").length;

    return {
      filteredEvents: filtered,
      totalReservas,
      totalRecaudado,
      averageTicketPrice,
      confirmedCount,
      pendingCount,
      canceledCount,
      canchaRanking,
      timeRanking,
      peakTimeSlot,
      peakTimeCount,
      clientRanking,
      weekdayRanking,
      peakDay
    };
  }, [events, sinceDate, untilDate, selectedCanchaFilter, selectedClienteFilter, selectedHorarioFilter, poolDaysCount, customers]);

  return (
    <div className="space-y-6" id="turn-report-workspace">
      {/* 1. TOP INTERACTIVE FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-[#eff4ff] dark:border-slate-800 shadow-3xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-105 dark:border-slate-850 pb-2.5">
          <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-indigo-505" />
            <span>Filtros Específicos del Reporte de Turnos</span>
          </h3>
          <button
            onClick={() => {
              setSelectedCanchaFilter("Todas");
              setSelectedClienteFilter("Todos");
              setSelectedHorarioFilter("Todos");
            }}
            className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline transition uppercase tracking-wider"
          >
            Limpiar Filtros de Turnos
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Filtrar por Cancha
            </label>
            <select
              value={selectedCanchaFilter}
              onChange={(e) => setSelectedCanchaFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-750 dark:text-white cursor-pointer"
            >
              {uniqueCanchas.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Filtrar por Cliente
            </label>
            <select
              value={selectedClienteFilter}
              onChange={(e) => setSelectedClienteFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-750 dark:text-white cursor-pointer"
            >
              {uniqueClientesEvents.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Franja Horaria Inicial
            </label>
            <select
              value={selectedHorarioFilter}
              onChange={(e) => setSelectedHorarioFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-750 dark:text-white cursor-pointer"
            >
              {uniqueHorarios.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. BENTO METRICS BARS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Recaudado */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
              Recaudación Filtrada
            </span>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">
              ${stats.totalRecaudado.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 mt-2 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md w-fit">
            <ArrowUpRight className="w-3 h-3" />
            <span>Turnos Confirmados</span>
          </div>
        </div>

        {/* KPI 2: Total Reservas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
              Turnos Totales Jugados
            </span>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">
              {stats.totalReservas} reservas
            </p>
          </div>
          <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 mt-2 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md w-fit">
            <Activity className="w-3 h-3" />
            <span>En {poolDaysCount} días analizados</span>
          </div>
        </div>

        {/* KPI 3: Ticket Promedio */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
              Valor Promedio de Turno
            </span>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">
              ${stats.averageTicketPrice.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 mt-2">
            <span>Monto promedio cobrado</span>
          </div>
        </div>

        {/* KPI 4: Peak Demand */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
              Pico de Demanda Histórica
            </span>
            <p className="text-lg font-black text-slate-800 dark:text-white mt-1.5 leading-snug">
              {stats.peakDay !== "N/D" ? `${stats.peakDay} — ${stats.peakTimeSlot}` : "N/D"}
            </p>
          </div>
          <div className="flex items-center gap-1 text-[9px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-md w-fit mt-1">
            <Clock className="w-3 h-3" />
            <span>Horarios clave con más reservas</span>
          </div>
        </div>
      </div>

      {/* STATUS SPLIT BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Confirmed */}
        <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/15 rounded-xl border border-emerald-100/40 dark:border-emerald-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-650" />
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-350 uppercase">Confirmados</span>
          </div>
          <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">{stats.confirmedCount}</span>
        </div>
        
        {/* Pending */}
        <div className="p-3 bg-amber-50/40 dark:bg-amber-950/15 rounded-xl border border-amber-100/40 dark:border-amber-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-605" />
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-350 uppercase">Pendientes</span>
          </div>
          <span className="text-sm font-black text-amber-700 dark:text-amber-400 font-mono">{stats.pendingCount}</span>
        </div>

        {/* Canceled */}
        <div className="p-3 bg-rose-50/40 dark:bg-rose-950/15 rounded-xl border border-rose-100/40 dark:border-rose-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-350 uppercase">Cancelaciones</span>
          </div>
          <span className="text-sm font-black text-rose-700 dark:text-rose-455 font-mono">{stats.canceledCount}</span>
        </div>
      </div>

      {/* 3. MAIN TABULAR SEGREGATIONS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* SUB 1: CANCHAS ANALYSIS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs overflow-hidden flex flex-col justify-between">
          <div className="p-4 bg-slate-50/50 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Grid className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              🏟️ Análisis y Rankings de Canchas
            </span>
          </div>
          
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Distribución de Uso de Canchas
              </span>
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button 
                  onClick={() => setChartMetric("count")} 
                  className={`px-3 py-1 rounded-md text-[10px] font-extrabold tracking-wide transition-all ${
                    chartMetric === "count" 
                      ? "bg-indigo-650 text-white shadow-xs" 
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Turnos
                </button>
                <button 
                  onClick={() => setChartMetric("earnings")} 
                  className={`px-3 py-1 rounded-md text-[10px] font-extrabold tracking-wide transition-all ${
                    chartMetric === "earnings" 
                      ? "bg-indigo-650 text-white shadow-xs" 
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Ganancia ($)
                </button>
              </div>
            </div>

            {/* Centered Pie Chart Container */}
            <div className="w-full h-[210px] flex items-center justify-center relative my-2">
              {stats.canchaRanking.every(c => (chartMetric === "count" ? c.count === 0 : c.earnings === 0)) ? (
                <div className="text-center text-slate-400 dark:text-slate-600 text-xs py-10 font-bold border-2 border-dashed border-slate-100 dark:border-slate-800/80 rounded-2xl w-full flex items-center justify-center">
                  Sin reservas en el período para armar el gráfico
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.canchaRanking}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey={chartMetric}
                      nameKey="name"
                      isAnimationActive={false}
                    >
                      {stats.canchaRanking.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        border: '1px solid #1e293b',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        fontFamily: 'sans-serif',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                      }}
                      formatter={(value: any, name: any) => [
                        chartMetric === "count" 
                          ? `${value} turnos` 
                          : `$${value.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`, 
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Custom Modern Cards Legend representing the actual details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stats.canchaRanking.map((c, idx) => {
                const isCount = chartMetric === "count";
                const valStr = isCount 
                  ? `${c.count} turnos` 
                  : `$${c.earnings.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`;
                
                return (
                  <div 
                    key={c.name} 
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-850/50 border border-slate-100 dark:border-slate-800/60 transition-all hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-3xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-3 h-3 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate" title={c.name}>
                        {c.name}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0 pl-1">
                      <span className="text-xs font-extrabold text-slate-850 dark:text-white font-mono block leading-none">
                        {valStr}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block mt-1">
                        {c.usagePct}% uso estimado
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[9.5px] text-slate-450 italic pt-2">
              * El porcentaje de uso estimado se calcula asumiendo una capacidad operativa máxima de 12 horas / slots disponibles por cancha al día de lunes a domingo.
            </p>
          </div>
        </div>

        {/* SUB 2: CLIENTES ACTIVE LIST */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs overflow-hidden flex flex-col justify-between">
          <div className="p-4 bg-slate-50/50 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              👤 Ranking de Clientes más Activos
            </span>
          </div>

          <div className="p-5">
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-slate-900">
                    <th className="py-2.5 font-bold">Usuario / Cliente</th>
                    <th className="py-2.5 text-center font-bold">Total Reservas</th>
                    <th className="py-2.5 text-center font-bold">Frecuencia / Sem</th>
                    <th className="py-2.5 text-right font-bold">Gasto Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-850/60 font-semibold text-slate-705 dark:text-slate-300">
                  {stats.clientRanking.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-420">No se encontraron reservas registradas</td>
                    </tr>
                  ) : (
                    stats.clientRanking.slice(0, 10).map((c, idx) => (
                      <tr key={c.name} className="hover:bg-slate-50/45 dark:hover:bg-slate-850/40">
                        <td className="py-2.5 pr-2">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-850 dark:text-white">{c.name}</span>
                            <span className="text-[8.5px] font-black text-indigo-500 uppercase tracking-widest">{c.tier}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                          {c.count} turnos
                        </td>
                        <td className="py-2.5 text-center font-mono text-slate-500 dark:text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
                            {c.frequencyPerWeek} / sem
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                          ${c.spend.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {stats.clientRanking.length > 10 && (
              <div className="text-center mt-3 pt-2 border-t border-slate-100 dark:border-slate-850 text-[10px] text-slate-400 font-extrabold uppercase">
                Mostrando los 10 clientes con mayor volumen de reservas en esta fecha.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 4. TEMPORAL & DEMAND SLOTS ANALYSIS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* SUB 3: PEAK HOUR DEMAND */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs overflow-hidden flex flex-col justify-between">
          <div className="p-4 bg-slate-50/50 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              ⏰ Franjas Horarias con Mayor Demanda (Picos)
            </span>
          </div>

          <div className="p-5">
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {stats.timeRanking.length === 0 ? (
                <div className="p-8 text-center text-slate-420">No hay información de horarios</div>
              ) : (
                stats.timeRanking.map((t, idx) => {
                  const maxCount = stats.timeRanking[0]?.count || 1;
                  const ratio = Math.max(Math.min((t.count / maxCount) * 100, 100), 5);
                  return (
                    <div key={t.slot} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${idx === 0 ? "bg-rose-500 animate-pulse" : "bg-indigo-450"}`} />
                          <span className="font-extrabold text-slate-800 dark:text-slate-205">{t.slot} hs</span>
                        </div>
                        <span className="text-slate-500 font-mono">
                          <strong className="font-bold text-slate-800 dark:text-white font-mono">{t.count}</strong> turnos (${t.earnings.toLocaleString("es-ES")})
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${idx === 0 ? "bg-rose-500" : "bg-indigo-500"}`}
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* SUB 4: WEEKDAYS ANALYSIS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs overflow-hidden flex flex-col justify-between">
          <div className="p-4 bg-slate-50/50 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              📅 Distribución Reservas por Día de Semana (Histórico)
            </span>
          </div>

          <div className="p-5">
            <div className="space-y-3">
              {stats.weekdayRanking.map((d) => {
                const maxWeekCount = Math.max(...stats.weekdayRanking.map(x => x.count)) || 1;
                const ratio = Math.max(Math.min((d.count / maxWeekCount) * 100, 100), 5);
                const isPeak = d.day === stats.peakDay;
                return (
                  <div key={d.day} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className={`font-extrabold ${isPeak ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-305"}`}>
                        {d.day} {isPeak && "🔥 Pico"}
                      </span>
                      <span className="text-slate-550 font-mono">
                        <strong className="font-bold text-slate-800 dark:text-white">{d.count}</strong> turnos (${d.earnings.toLocaleString("es-ES")})
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${isPeak ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"}`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* 5. DETAILED GENERAL LOG TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs overflow-hidden">
        <div className="p-4 bg-slate-50/50 dark:bg-slate-850 border-b border-slate-105 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Listado Detallado de Turnos Emitidos
            </span>
            <span className="text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-mono">
              {stats.filteredEvents.length} elementos
            </span>
          </div>
          
          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">
            * Orden cronológico de juego
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Fecha / Hora de Turno</th>
                <th className="py-3 px-4 font-bold">Cancha Reservada</th>
                <th className="py-3 px-4 font-bold">Cliente / Jugador</th>
                <th className="py-3 px-4 text-center font-bold">Estado de Turno</th>
                <th className="py-3 px-4 text-right font-bold">Importe Cobrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60 font-semibold text-slate-705 dark:text-slate-300">
              {stats.filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-450">
                    No se encontraron turnos emitidos bajo los parámetros de filtros especificados.
                  </td>
                </tr>
              ) : (
                stats.filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/40">
                    {/* Date/Time */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-850 dark:text-white font-extrabold">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{evt.date}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        <span className="font-mono text-indigo-650 dark:text-indigo-400">{evt.time} hs</span>
                      </div>
                    </td>

                    {/* Cancha */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-405" />
                        <span className="font-extrabold text-[11px] uppercase tracking-wide">{evt.fieldNumber}</span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4 font-black text-slate-800 dark:text-white">
                      {evt.customerName}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        evt.status === "Confirmado"
                          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-250/20"
                          : evt.status === "Pendiente"
                            ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-250/20"
                            : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-250/20"
                      }`}>
                        {evt.status}
                      </span>
                    </td>

                    {/* Price Paid */}
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                      ${evt.price.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

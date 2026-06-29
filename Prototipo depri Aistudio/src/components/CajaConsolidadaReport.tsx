/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Coins, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Printer, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle,
  ChevronDown
} from "lucide-react";
import { SaleTransaction } from "../types";

// Types for Cash Sheet Session
interface CanchaSlot {
  time: string;
  customerId: string;
  customerName: string;
  amount: number;
}

interface CustomEntry {
  id: string;
  quantity: number;
  account: string;
  description: string;
  amount: number;
}

interface CajaV2Session {
  id: string;
  dateStr: string;
  isClosed: boolean;
  isOpen?: boolean;
  cancha1: CanchaSlot[];
  cancha2: CanchaSlot[];
  otrosIngresos: CustomEntry[];
  otrosEgresos: CustomEntry[];
  personalAccount: string;
  personalDescription: string;
  personalAmount: number;
  saldoInicial: number;
  rendicionEfectivo: number;
  rendicionTransferencia: number;
  rendicionTarjetas: number;
}

interface CajaConsolidadaReportProps {
  sales: SaleTransaction[];
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const CajaConsolidadaReport: React.FC<CajaConsolidadaReportProps> = ({ sales, apiFetch }) => {
  // Filter types: 'month_year' | 'range' | 'historical'
  const [filterType, setFilterType] = useState<"month_year" | "range" | "historical">("month_year");
  
  // Month/Year filter states
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-indexed
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Custom Date Range states
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Default to start of current month
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Backend Box sheets history and active box
  const [allHistory, setAllHistory] = useState<CajaV2Session[]>([]);
  const [activeSession, setActiveSession] = useState<CajaV2Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"acumulado" | "promedio">("acumulado");

  // Default time slots to align and accumulate court stats
  const defaultTimes = [
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "0:00", "1:00"
  ];

  const getIsoStr = (d: Date): string => {
    if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
    const tzo = d.getTimezoneOffset();
    const raw = new Date(d.getTime() - (tzo * 60000));
    return raw.toISOString().split("T")[0];
  };

  const parseCustomDateToIso = (text: string): string => {
    if (!text) return getIsoStr(new Date());
    const clean = text.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) return clean.replace(/\//g, "-");
    return clean;
  };

  // Load all boxes (history + active) on component load
  useEffect(() => {
    let active = true;
    const fetchCajas = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        // Fetch active box
        let activeBox: CajaV2Session | null = null;
        try {
          const activeRes = await apiFetch("/api/caja/active");
          if (activeRes.ok) {
            const data = await activeRes.json();
            if (data && data.id) {
              activeBox = data;
              if (active) setActiveSession(data);
            }
          }
        } catch (e) {
          console.warn("Active session fetch went offline:", e);
        }

        // Fetch history
        const historyRes = await apiFetch("/api/caja/history");
        if (historyRes.ok) {
          const serverHist = await historyRes.json();
          if (Array.isArray(serverHist) && active) {
            // Sort by ISO Date Descending
            const sortedHist = [...serverHist].sort((a, b) => {
              const dA = new Date(a.dateStr).getTime() || 0;
              const dB = new Date(b.dateStr).getTime() || 0;
              return dB - dA;
            });
            setAllHistory(sortedHist);
          }
        } else {
          if (active) setErrorMsg("No se pudieron cargar los registros históricos de caja.");
        }
      } catch (err: any) {
        if (active) setErrorMsg("Error de red o conexión al servidor.");
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchCajas();
    return () => {
      active = false;
    };
  }, []);

  // Combine both historical and active boxes into a single list
  const getCombinedBoxes = (): CajaV2Session[] => {
    const combined: CajaV2Session[] = [];
    
    // Add active box if present
    if (activeSession && activeSession.id) {
      combined.push(activeSession);
    }
    
    // Add history items preventing duplicates
    allHistory.forEach(hist => {
      if (!combined.some(c => c.id === hist.id)) {
        combined.push(hist);
      }
    });

    return combined;
  };

  // Filter boxes based on selected range/filters
  const getFilteredBoxes = (): CajaV2Session[] => {
    const all = getCombinedBoxes();
    return all.filter(box => {
      const bIso = parseCustomDateToIso(box.dateStr);
      if (!bIso) return false;

      if (filterType === "historical") {
        return true;
      }
      
      if (filterType === "month_year") {
        const [yearStr, monthStr] = bIso.split("-");
        const boxYear = parseInt(yearStr);
        const boxMonth = parseInt(monthStr);
        return boxYear === selectedYear && boxMonth === selectedMonth;
      }

      if (filterType === "range") {
        return bIso >= startDate && bIso <= endDate;
      }

      return false;
    });
  };

  const filteredBoxes = getFilteredBoxes();

  // Helper calculation function for a single session's totals
  const getSingleSessionTotals = (sess: CajaV2Session) => {
    const subtotalC1 = (sess.cancha1 || []).reduce((sum, slot) => sum + (Number(slot.amount) || 0), 0);
    const subtotalC2 = (sess.cancha2 || []).reduce((sum, slot) => sum + (Number(slot.amount) || 0), 0);
    const totalCanchas = subtotalC1 + subtotalC2;

    const sIso = parseCustomDateToIso(sess.dateStr);
    const sSales = sales.filter(sale => {
      if (sale.origin === "consumo_interno") return false;
      if (sale.origin === "mesa" || sale.origin === "sistema_caja") return false;

      const sysLabelsArr = ["Cancha 1", "Cancha 2", "Otros Ingresos", "Otros Egresos", "Personal Egreso"];
      if (sysLabelsArr.includes(sale.table_number || "")) return false;

      if (sale.caja_session_id && sess.id) {
        return sale.caja_session_id === sess.id;
      }

      try {
        return getIsoStr(new Date(sale.date)) === sIso;
      } catch {
        return false;
      }
    });

    const barTotal = sSales.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0);
    const barQty = sSales.reduce((acc, sale) => acc + (sale.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 0), 0);

    const otrosIngresosTotal = (sess.otrosIngresos || []).reduce((sum, r) => {
      if (r.id === "buffet") return sum;
      return sum + ((Number(r.quantity) || 1) * (Number(r.amount) || 0));
    }, 0);
    const totalIncomes = barTotal + otrosIngresosTotal;

    const personalExp = Number(sess.personalAmount) || 0;
    const otrosEgresosTotal = (sess.otrosEgresos || []).reduce((sum, r) => sum + ((Number(r.quantity) || 1) * (Number(r.amount) || 0)), 0);
    const totalExpenses = personalExp + otrosEgresosTotal;

    const theoreticalCaja = (Number(sess.saldoInicial) || 0) + totalCanchas + totalIncomes - totalExpenses;
    const realRendido = (Number(sess.rendicionEfectivo) || 0) + (Number(sess.rendicionTransferencia) || 0) + (Number(sess.rendicionTarjetas) || 0);
    const discrepancy = realRendido - theoreticalCaja;

    return {
      subtotalC1,
      subtotalC2,
      totalCanchas,
      barTotal,
      barQty,
      otrosIngresosTotal,
      totalIncomes,
      personalExp,
      otrosEgresosTotal,
      totalExpenses,
      theoreticalCaja,
      realRendido,
      discrepancy,
      sSales
    };
  };

  // Perform consolidation calculations across all matching boxes
  const calculateConsolidation = () => {
    // 1. Initial Court times arrays matching default slots
    const cancha1SlotsAccumulated = defaultTimes.map(time => ({ time, count: 0, amount: 0 }));
    const cancha2SlotsAccumulated = defaultTimes.map(time => ({ time, count: 0, amount: 0 }));

    let totalSaldoInicial = 0;
    let totalRendicionEfectivo = 0;
    let totalRendicionTransferencia = 0;
    let totalRendicionTarjetas = 0;

    let totalBarSalesAmount = 0;
    let totalBarItemsQty = 0;

    // Grouping category lists
    const otrosIngresosGrouped: Record<string, { account: string; description: string; quantity: number; amount: number }> = {};
    const otrosEgresosGrouped: Record<string, { account: string; description: string; quantity: number; amount: number }> = {};

    let totalPersonalEgresoAmount = 0;
    let totalPersonalDaysCount = 0;

    filteredBoxes.forEach(box => {
      totalSaldoInicial += Number(box.saldoInicial) || 0;
      totalRendicionEfectivo += Number(box.rendicionEfectivo) || 0;
      totalRendicionTransferencia += Number(box.rendicionTransferencia) || 0;
      totalRendicionTarjetas += Number(box.rendicionTarjetas) || 0;

      // Accumulate Cancha 1
      if (Array.isArray(box.cancha1)) {
        box.cancha1.forEach(slot => {
          const index = defaultTimes.indexOf(slot.time);
          if (index !== -1) {
            if (slot.customerName) {
              cancha1SlotsAccumulated[index].count++;
            }
            cancha1SlotsAccumulated[index].amount += Number(slot.amount) || 0;
          }
        });
      }

      // Accumulate Cancha 2
      if (Array.isArray(box.cancha2)) {
        box.cancha2.forEach(slot => {
          const index = defaultTimes.indexOf(slot.time);
          if (index !== -1) {
            if (slot.customerName) {
              cancha2SlotsAccumulated[index].count++;
            }
            cancha2SlotsAccumulated[index].amount += Number(slot.amount) || 0;
          }
        });
      }

      // Single box individual calculations
      const stats = getSingleSessionTotals(box);
      totalBarSalesAmount += stats.barTotal;
      totalBarItemsQty += stats.barQty;

      // Accumulate Manual Otros Ingresos
      if (Array.isArray(box.otrosIngresos)) {
        box.otrosIngresos.forEach(item => {
          if (item.id === "buffet") return;
          const key = `${item.account || "Ingreso"}-${item.description || "General"}`;
          if (!otrosIngresosGrouped[key]) {
            otrosIngresosGrouped[key] = {
              account: item.account || "Ingreso Ext.",
              description: item.description || "",
              quantity: 0,
              amount: 0
            };
          }
          otrosIngresosGrouped[key].quantity += Number(item.quantity) || 1;
          otrosIngresosGrouped[key].amount += (Number(item.quantity) || 1) * (Number(item.amount) || 0);
        });
      }

      // Accumulate Personal Egresos
      if (Number(box.personalAmount) > 0) {
        totalPersonalEgresoAmount += Number(box.personalAmount);
        totalPersonalDaysCount++;
      }

      // Accumulate Manual Otros Egresos
      if (Array.isArray(box.otrosEgresos)) {
        box.otrosEgresos.forEach(item => {
          const key = `${item.account || "Egreso"}-${item.description || "General"}`;
          if (!otrosEgresosGrouped[key]) {
            otrosEgresosGrouped[key] = {
              account: item.account || "Egreso Gral.",
              description: item.description || "",
              quantity: 0,
              amount: 0
            };
          }
          otrosEgresosGrouped[key].quantity += Number(item.quantity) || 1;
          otrosEgresosGrouped[key].amount += (Number(item.quantity) || 1) * (Number(item.amount) || 0);
        });
      }
    });

    // Subtotals Calculations
    const totalCancha1Amount = cancha1SlotsAccumulated.reduce((sum, s) => sum + s.amount, 0);
    const totalCancha2Amount = cancha2SlotsAccumulated.reduce((sum, s) => sum + s.amount, 0);
    const totalCanchasSum = totalCancha1Amount + totalCancha2Amount;

    const totalOtrosIngresosManualSum = Object.values(otrosIngresosGrouped).reduce((sum, val) => sum + val.amount, 0);
    const grandBonusIncomesSum = totalBarSalesAmount + totalOtrosIngresosManualSum;
    const ultimateIncomeWithCanchasAndOpening = totalSaldoInicial + totalCanchasSum + grandBonusIncomesSum;

    const totalOtrosEgresosManualSum = Object.values(otrosEgresosGrouped).reduce((sum, val) => sum + val.amount, 0);
    const grandEgresosSum = totalPersonalEgresoAmount + totalOtrosEgresosManualSum;

    const expectedCashInDrawer = ultimateIncomeWithCanchasAndOpening - grandEgresosSum;
    const realPhysicallyRendido = totalRendicionEfectivo + totalRendicionTransferencia + totalRendicionTarjetas;
    const globalDiscrepancyAmount = realPhysicallyRendido - expectedCashInDrawer;

    return {
      cancha1SlotsAccumulated,
      cancha2SlotsAccumulated,
      totalCancha1Amount,
      totalCancha2Amount,
      totalCanchasSum,
      totalSaldoInicial,
      totalRendicionEfectivo,
      totalRendicionTransferencia,
      totalRendicionTarjetas,
      totalBarSalesAmount,
      totalBarItemsQty,
      otrosIngresosGrouped: Object.values(otrosIngresosGrouped),
      totalOtrosIngresosManualSum,
      grandBonusIncomesSum,
      ultimateIncomeWithCanchasAndOpening,
      otrosEgresosGrouped: Object.values(otrosEgresosGrouped),
      totalOtrosEgresosManualSum,
      grandEgresosSum,
      totalPersonalEgresoAmount,
      totalPersonalDaysCount,
      expectedCashInDrawer,
      realPhysicallyRendido,
      globalDiscrepancyAmount
    };
  };

  const consolidated = calculateConsolidation();
  const isProm = viewMode === "promedio";
  const div = filteredBoxes.filter(box => box.isClosed).length || 1;

  // Print function designed to mimic the template print-section
  const handlePrintConsolidated = () => {
    const printWindow = window.open("", "_blank", "width=850,height=1100,scrollbars=yes,resizable=yes");
    if (!printWindow) {
      window.print();
      return;
    }

    const isProm = viewMode === "promedio";
    const div = filteredBoxes.filter(box => box.isClosed).length || 1;

    const fmt = (val: number) => (isProm ? val / div : val).toFixed(2);
    const fmtQty = (val: number) => isProm ? (val / div).toFixed(1) : val.toString();

    const titlePeriod = filterType === "historical" 
      ? "Histórico Completo" 
      : filterType === "month_year" 
        ? `Mes: ${selectedMonth}/${selectedYear}`
        : `Rango: ${startDate} al ${endDate}`;

    const dateRangeSpan = `${startDate} — ${endDate}`;
    const modeLabel = isProm ? `PROMEDIO DIARIO (sobre ${div} cajas cerradas)` : "ACUMULADO GENERAL";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <title>Planilla de Caja Consolidada - ${isProm ? 'Promedio' : 'Acumulado'}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
            }
            body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: ui-sans-serif, system-ui, sans-serif !important;
            }
            .title-header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 3px double #1e293b;
              padding-bottom: 10px;
            }
            .sections-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-bottom: 20px;
            }
            .table-box {
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 10px;
            }
            .table-title {
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
              color: #0f172a;
              border-bottom: 2px solid #334155;
              padding-bottom: 4px;
              margin-bottom: 8px;
              margin-top: 0;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              font-size: 10.5px !important;
            }
            th, td {
              padding: 3px 5px !important;
              border-bottom: 1px solid #e2e8f0 !important;
            }
            th {
              color: #64748b;
              font-weight: bold;
              text-align: left;
            }
            .text-right {
              text-align: right !important;
            }
            .font-mono {
              font-family: ui-monospace, SFMono-Regular, monospace !important;
            }
            .bg-gray-table {
              background-color: #f8fafc !important;
              font-weight: bold;
            }
            .total-panel {
              border: 2px solid #94a3b8;
              border-radius: 8px;
              padding: 12px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              background-color: #f8fafc;
            }
            .panel-column {
              font-size: 11px;
            }
            .panel-header {
              font-size: 11px;
              text-transform: uppercase;
              font-weight: bold;
              color: #475569;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 3px;
              margin-bottom: 8px;
            }
            .flex-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
            }
          </style>
        </head>
        <body>
          <div class="title-header">
            <h2 style="margin: 0; text-transform: uppercase; font-size: 18px; tracking: tight;">Planilla Caja Consolidada (${modeLabel})</h2>
            <p style="margin: 4px 0 0; font-size: 11px; color: #475569;">
              <strong>Filtro:</strong> ${titlePeriod} | <strong>Planillas Consolidadas:</strong> ${filteredBoxes.length}
            </p>
          </div>

          <div class="sections-grid">
            <!-- Cancha 1 -->
            <div class="table-box">
              <h4 class="table-title">Cancha 1 (${isProm ? 'Promedio' : 'Acumulado'})</h4>
              <table>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Slots Reservados</th>
                    <th class="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  ${consolidated.cancha1SlotsAccumulated.map(slot => `
                    <tr>
                      <td class="font-mono">${slot.time}</td>
                      <td>${slot.count > 0 ? (isProm ? `${(slot.count / div).toFixed(1)} / día` : `${slot.count} canchas`) : "-"}</td>
                      <td class="text-right font-mono font-bold">$${fmt(slot.amount)}</td>
                    </tr>
                  `).join("")}
                </tbody>
                <tfoot>
                  <tr class="bg-gray-table">
                    <td colspan="2">Subtotal Cancha 1 (${isProm ? 'Promedio' : 'Acumulado'})</td>
                    <td class="text-right font-mono">$${fmt(consolidated.totalCancha1Amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Cancha 2 -->
            <div class="table-box">
              <h4 class="table-title">Cancha 2 (${isProm ? 'Promedio' : 'Acumulado'})</h4>
              <table>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Slots Reservados</th>
                    <th class="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  ${consolidated.cancha2SlotsAccumulated.map(slot => `
                    <tr>
                      <td class="font-mono">${slot.time}</td>
                      <td>${slot.count > 0 ? (isProm ? `${(slot.count / div).toFixed(1)} / día` : `${slot.count} canchas`) : "-"}</td>
                      <td class="text-right font-mono font-bold">$${fmt(slot.amount)}</td>
                    </tr>
                  `).join("")}
                </tbody>
                <tfoot>
                  <tr class="bg-gray-table">
                    <td colspan="2">Subtotal Cancha 2 (${isProm ? 'Promedio' : 'Acumulado'})</td>
                    <td class="text-right font-mono">$${fmt(consolidated.totalCancha2Amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div class="sections-grid">
            <!-- Otros Ingresos -->
            <div class="table-box">
              <h4 class="table-title">Otros Ingresos (Buffet + Extras)</h4>
              <table>
                <thead>
                  <tr>
                    <th>Cant</th>
                    <th>Concepto</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="background-color: rgba(16, 185, 129, 0.05);">
                    <td class="font-mono">${fmtQty(consolidated.totalBarItemsQty)}</td>
                    <td style="color: #15803d; font-weight: bold;">Ventas Buffet (Bar)</td>
                    <td class="text-right font-mono font-bold" style="color: #15803d;">$${fmt(consolidated.totalBarSalesAmount)}</td>
                  </tr>
                  ${consolidated.otrosIngresosGrouped.map(item => `
                    <tr>
                      <td class="font-mono">${fmtQty(item.quantity)}</td>
                      <td>${item.account}${item.description ? ` — ${item.description}` : ""}</td>
                      <td class="text-right font-mono">$${fmt(item.amount)}</td>
                    </tr>
                  `).join("")}
                  ${consolidated.otrosIngresosGrouped.length === 0 ? `
                    <tr>
                      <td colspan="3" style="text-align: center; color: #94a3b8; font-size: 9px; padding: 15px 0 !important;">Sin ingresos extras</td>
                    </tr>
                  ` : ""}
                </tbody>
                <tfoot>
                  <tr class="bg-gray-table">
                    <td colspan="2">Total Otros Ingresos (${isProm ? 'Promedio' : 'Acumulado'})</td>
                    <td class="text-right font-mono" style="color: #166534;">$${fmt(consolidated.grandBonusIncomesSum)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Otros Egresos -->
            <div class="table-box">
              <h4 class="table-title">Otros Egresos (Retiros + Gastos)</h4>
              <table>
                <thead>
                  <tr>
                    <th>Cant</th>
                    <th>Concepto</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${consolidated.totalPersonalEgresoAmount > 0 ? `
                    <tr style="background-color: rgba(244, 63, 94, 0.05);">
                      <td class="font-mono">${fmtQty(consolidated.totalPersonalDaysCount)}</td>
                      <td style="color: #be123c; font-weight: bold;">Retiro Personal (Sueldos)</td>
                      <td class="text-right font-mono font-bold" style="color: #be123c;">-$${fmt(consolidated.totalPersonalEgresoAmount)}</td>
                    </tr>
                  ` : ""}
                  ${consolidated.otrosEgresosGrouped.map(item => `
                    <tr>
                      <td class="font-mono">${fmtQty(item.quantity)}</td>
                      <td>${item.account}${item.description ? ` — ${item.description}` : ""}</td>
                      <td class="text-right font-mono" style="color: #b91c1c;">-$${fmt(item.amount)}</td>
                    </tr>
                  `).join("")}
                  ${(consolidated.totalPersonalEgresoAmount === 0 && consolidated.otrosEgresosGrouped.length === 0) ? `
                    <tr>
                      <td colspan="3" style="text-align: center; color: #94a3b8; font-size: 9px; padding: 15px 0 !important;">Sin egresos registrados</td>
                    </tr>
                  ` : ""}
                </tbody>
                <tfoot>
                  <tr class="bg-gray-table">
                    <td colspan="2">Total Otros Egresos (${isProm ? 'Promedio' : 'Acumulado'})</td>
                    <td class="text-right font-mono" style="color: #991b1b;">-$${fmt(consolidated.grandEgresosSum)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- Total summary block -->
          <div class="total-panel">
            <div class="panel-column">
              <div class="panel-header">Cálculo Teórico en Caja (${isProm ? 'Promedio Diario' : 'Acumulado'})</div>
              <div class="flex-row">
                <span>(+) Apertura / Saldo inicial:</span>
                <strong class="font-mono">$${fmt(consolidated.totalSaldoInicial)}</strong>
              </div>
              <div class="flex-row">
                <span>(+) Recaudación Canchas (1 + 2):</span>
                <strong class="font-mono">$${fmt(consolidated.totalCanchasSum)}</strong>
              </div>
              <div class="flex-row">
                <span>(+) Recaudación Buffet (Bar):</span>
                <strong class="font-mono">$${fmt(consolidated.totalBarSalesAmount)}</strong>
              </div>
              <div class="flex-row">
                <span>(+) Otros Ingresos Extras:</span>
                <strong class="font-mono">$${fmt(consolidated.totalOtrosIngresosManualSum)}</strong>
              </div>
              <div class="flex-row" style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; margin-bottom: 4px;">
                <span>(-) Total de Retiros y Gastos:</span>
                <strong class="font-mono" style="color: #b91c1c;">-$${fmt(consolidated.grandEgresosSum)}</strong>
              </div>
              <div class="flex-row" style="font-weight: bold; font-size: 11.5px; color: #0f172a;">
                <span>(=) Monto Esperado en Caja:</span>
                <span class="font-mono">$${fmt(consolidated.expectedCashInDrawer)}</span>
              </div>
            </div>

            <div class="panel-column">
              <div class="panel-header">Cerrado Real Rendido (${isProm ? 'Promedio Diario' : 'Acumulado'})</div>
              <div class="flex-row">
                <span>(💵) Efectivo Rendido:</span>
                <strong class="font-mono">$${fmt(consolidated.totalRendicionEfectivo)}</strong>
              </div>
              <div class="flex-row">
                <span>(🌐) Transferencias / Bizum:</span>
                <strong class="font-mono">$${fmt(consolidated.totalRendicionTransferencia)}</strong>
              </div>
              <div class="flex-row" style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; margin-bottom: 4px;">
                <span>(💳) Tarjetas de Crédito/Débito:</span>
                <strong class="font-mono">$${fmt(consolidated.totalRendicionTarjetas)}</strong>
              </div>
              <div class="flex-row" style="font-weight: bold; font-size: 11.5px; color: #0f172a;">
                <span>(=) Total Rendido Real:</span>
                <span class="font-mono">$${fmt(consolidated.realPhysicallyRendido)}</span>
              </div>
              <div class="flex-row" style="font-weight: bold; font-size: 11.5px; margin-top: 5px; color: ${consolidated.globalDiscrepancyAmount >= 0 ? "#15803d" : "#b91c1c"};">
                <span>Diferencia (${consolidated.globalDiscrepancyAmount >= 0 ? "Sobrante" : "Faltante"}):</span>
                <span class="font-mono">${consolidated.globalDiscrepancyAmount >= 0 ? "+" : ""}${(isProm ? consolidated.globalDiscrepancyAmount / div : consolidated.globalDiscrepancyAmount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6" id="caja_con_view">
      {/* Upper Panel */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-8 text-white opacity-5 select-none pointer-events-none">
          <Coins className="w-64 h-64" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.55">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-950/60 py-1 px-3 rounded-full border border-emerald-800">
                INFORME AMORTIZADO
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 font-bold uppercase tracking-wide py-1 px-2.5 rounded-full border border-slate-700">
                Consolidación General de Cajas
              </span>
            </div>
            <h2 className="text-xl font-bold font-display uppercase tracking-tight">Caja Consolidada por Período</h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Informe unificado que acumula los ingresos, egresos, ventas de canchas y buffet correspondientes a múltiples planillas de caja registradas en el sistema.
            </p>
          </div>
          
          <div className="md:text-right flex flex-col md:items-end gap-3.5 shrink-0">
            {/* View Mode Switcher */}
            <div className="bg-slate-950/70 p-1 rounded-xl border border-slate-800 inline-flex items-center self-start md:self-auto shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode("acumulado")}
                className={`px-3.5 py-1.5 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer leading-none min-h-[30px] ${
                  viewMode === "acumulado"
                    ? "bg-emerald-500 text-slate-900 shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Acumulado
              </button>
              <button
                type="button"
                onClick={() => setViewMode("promedio")}
                className={`px-3.5 py-1.5 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer leading-none min-h-[30px] ${
                  viewMode === "promedio"
                    ? "bg-emerald-500 text-slate-900 shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Muestra los montos promedio por día registrado de caja cerrada"
              >
                Promedio Diario
              </button>
            </div>

            <button
              onClick={handlePrintConsolidated}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 transition text-white text-xs font-bold rounded-xl shadow-md cursor-pointer inline-flex items-center gap-2"
              title="Exportar consolidación unificada"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Caja de Período</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === "promedio" && (
        <div className="bg-indigo-50 border border-indigo-150 p-4 rounded-2xl text-indigo-950 text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-3xs animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
              <Coins className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black uppercase text-indigo-900 tracking-wider">Modo Promedio Diario Activo</p>
              <p className="text-slate-600 mt-0.5">
                Todos los montos se encuentran divididos por las <strong className="text-indigo-950 font-bold">{filteredBoxes.filter(box => box.isClosed).length}</strong> planillas de cajas cerradas de este período. No se dividen por días calendario sin actividad.
              </p>
            </div>
          </div>
          <div className="bg-indigo-600 text-white font-mono font-black text-xs px-4 py-2 rounded-xl flex items-center justify-center shrink-0 self-start sm:self-auto shadow-xs border border-indigo-700">
            DIVISOR: {filteredBoxes.filter(box => box.isClosed).length || 1} {filteredBoxes.filter(box => box.isClosed).length === 1 ? 'Caja' : 'Cajas'}
          </div>
        </div>
      )}

      {/* Advanced Filters Panel */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
        <h3 className="text-xs font-black tracking-widest text-[#091426] uppercase border-b pb-2 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#10b981]" />
          <span>Filtros de Búsqueda</span>
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section: Select Filter Type */}
          <div className="space-y-2">
            <label className="text-[10.5px] font-black uppercase tracking-wider text-slate-500">Tipo de Agrupamiento</label>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setFilterType("month_year")}
                className={`py-2 px-3 text-left rounded-lg text-xs font-bold transition flex items-center justify-between border ${
                  filterType === "month_year" 
                    ? "bg-[#10b981]/10 text-[#0f5132] border-[#10b981]" 
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                }`}
              >
                <span>Por Año y Mes</span>
                {filterType === "month_year" && <CheckCircle className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>

              <button
                onClick={() => setFilterType("range")}
                className={`py-2 px-3 text-left rounded-lg text-xs font-bold transition flex items-center justify-between border ${
                  filterType === "range" 
                    ? "bg-[#10b981]/10 text-[#0f5132] border-[#10b981]" 
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                }`}
              >
                <span>Rango de Fechas Personalizado</span>
                {filterType === "range" && <CheckCircle className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>

              <button
                onClick={() => setFilterType("historical")}
                className={`py-2 px-3 text-left rounded-lg text-xs font-bold transition flex items-center justify-between border ${
                  filterType === "historical" 
                    ? "bg-[#10b981]/10 text-[#0f5132] border-[#10b981]" 
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                }`}
              >
                <span>Histórico Completo</span>
                {filterType === "historical" && <CheckCircle className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>
            </div>
          </div>

          {/* Section: Active Options */}
          <div className="col-span-1 lg:col-span-2 bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-250 flex items-center justify-center min-h-[100px]">
            {filterType === "month_year" && (
              <div className="w-full grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mes</label>
                  <div className="relative">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="w-full bg-white border border-slate-250 p-2 rounded-lg text-xs font-semibold appearance-none focus:outline-hidden"
                    >
                      <option value={1}>Enero</option>
                      <option value={2}>Febrero</option>
                      <option value={3}>Marzo</option>
                      <option value={4}>Abril</option>
                      <option value={5}>Mayo</option>
                      <option value={6}>Junio</option>
                      <option value={7}>Julio</option>
                      <option value={8}>Agosto</option>
                      <option value={9}>Septiembre</option>
                      <option value={10}>Octubre</option>
                      <option value={11}>Noviembre</option>
                      <option value={12}>Diciembre</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Año</label>
                  <div className="relative">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="w-full bg-white border border-slate-250 p-2 rounded-lg text-xs font-semibold appearance-none focus:outline-hidden"
                    >
                      <option value={2026}>2026</option>
                      <option value={2025}>2025</option>
                      <option value={2024}>2024</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            )}

            {filterType === "range" && (
              <div className="w-full grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Desde (Fecha)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-250 p-2 rounded-lg text-xs font-semibold focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hasta (Fecha)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-250 p-2 rounded-lg text-xs font-semibold focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {filterType === "historical" && (
              <div className="text-center py-2 space-y-1">
                <p className="text-xs font-extrabold text-slate-650">Alineación del Histórico General</p>
                <p className="text-[10.5px] text-slate-400 max-w-sm">
                  Acumula el 100% de los registros diarios disponibles sin límites de corte en el calendario.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Filter Meta Statistics Info */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
          <span>Hilos de Filtros Aplicados</span>
          <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-800 text-[10.5px]">
            Hojas consolidadas: {filteredBoxes.length}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs font-bold text-slate-400 space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
          <p>Consolidando flujos de caja y recalculando...</p>
        </div>
      ) : errorMsg ? (
        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span className="text-xs font-bold">{errorMsg}</span>
        </div>
      ) : filteredBoxes.length === 0 ? (
        <div className="p-8 text-center bg-amber-50/50 border border-amber-200 rounded-2xl flex flex-col items-center justify-center gap-3">
          <AlertTriangle className="w-8 h-8 text-amber-500 flex-shrink-0" />
          <h4 className="text-sm font-black text-amber-900 uppercase">No hay datos para mostrar</h4>
          <p className="text-xs text-amber-800 max-w-md">
            No se encontraron planillas de caja diaria registradas para el período seleccionado. Corrige los filtros o agrega registros en Caja Diaria.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* GRID 1: Cancha 1 and Cancha 2 Bookings side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Cancha 1 Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <h3 className="bg-emerald-800 text-white py-2.5 px-4 font-black font-display tracking-widest text-xs uppercase flex items-center justify-center">
                <span>Cancha 1 ({isProm ? "Promedio Diario" : "Acumulado"})</span>
              </h3>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200 uppercase text-[9px] tracking-wider select-none">
                    <th className="py-2.5 px-4 w-20">Hora</th>
                    <th className="py-2.5 px-4">Turnos Jugados</th>
                    <th className="py-2.5 px-4 text-right">Monto Recaudado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-medium">
                  {consolidated.cancha1SlotsAccumulated.map((slot, idx) => (
                    <tr key={`con-c1-${idx}`} className={slot.count > 0 ? "bg-emerald-50/15" : "text-slate-400"}>
                      <td className="py-1.5 px-4 font-mono font-bold text-slate-600">{slot.time}</td>
                      <td className="py-1.5 px-4 font-bold text-slate-700">
                        {slot.count > 0 ? (
                          isProm 
                            ? `${(slot.count / div).toFixed(1)} / día` 
                            : `${slot.count} reservado(s)`
                        ) : "— Vacío —"}
                      </td>
                      <td className="py-1.5 px-4 text-right font-mono font-extrabold text-slate-800">
                        ${(isProm ? slot.amount / div : slot.amount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={2} className="py-3 px-4 font-extrabold text-[#091426] text-right uppercase text-[10px] tracking-wider">
                      SUBTOTAL CANCHA 1 ({isProm ? "PROMEDIO" : "ACUMULADO"})
                    </td>
                    <td className="py-3 px-4 font-mono font-black text-right text-slate-900 text-xs">
                      ${(isProm ? consolidated.totalCancha1Amount / div : consolidated.totalCancha1Amount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Cancha 2 Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <h3 className="bg-emerald-800 text-white py-2.5 px-4 font-black font-display tracking-widest text-xs uppercase flex items-center justify-center">
                <span>Cancha 2 ({isProm ? "Promedio Diario" : "Acumulado"})</span>
              </h3>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200 uppercase text-[9px] tracking-wider select-none">
                    <th className="py-2.5 px-4 w-20">Hora</th>
                    <th className="py-2.5 px-4">Turnos Jugados</th>
                    <th className="py-2.5 px-4 text-right">Monto Recaudado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-medium">
                  {consolidated.cancha2SlotsAccumulated.map((slot, idx) => (
                    <tr key={`con-c2-${idx}`} className={slot.count > 0 ? "bg-emerald-50/15" : "text-slate-400"}>
                      <td className="py-1.5 px-4 font-mono font-bold text-slate-600">{slot.time}</td>
                      <td className="py-1.5 px-4 font-bold text-slate-700">
                        {slot.count > 0 ? (
                          isProm 
                            ? `${(slot.count / div).toFixed(1)} / día` 
                            : `${slot.count} reservado(s)`
                        ) : "— Vacío —"}
                      </td>
                      <td className="py-1.5 px-4 text-right font-mono font-extrabold text-slate-800">
                        ${(isProm ? slot.amount / div : slot.amount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={2} className="py-3 px-4 font-extrabold text-[#091426] text-right uppercase text-[10px] tracking-wider">
                      SUBTOTAL CANCHA 2 ({isProm ? "PROMEDIO" : "ACUMULADO"})
                    </td>
                    <td className="py-3 px-4 font-mono font-black text-right text-slate-900 text-xs">
                      ${(isProm ? consolidated.totalCancha2Amount / div : consolidated.totalCancha2Amount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

          </div>

          {/* SEQUENTIAL FULL-WIDTH SECTIONS: Otros Ingresos followed by Otros Egresos */}
          <div className="space-y-6">

            {/* Otros Ingresos (Buffet + Extras) */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <h3 className="bg-emerald-800 text-white py-2.5 px-4 font-black font-display tracking-widest text-xs uppercase flex items-center justify-center gap-2">
                <FileText className="w-4 h-4 text-emerald-300" />
                <span>Otros Ingresos (Buffet + Extras) ({isProm ? "Promedio Diario" : "Acumulado"})</span>
              </h3>
              
              <div className="p-4">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="text-slate-400 font-bold border-b border-slate-200 font-display uppercase tracking-widest text-[9.5px]">
                      <th className="py-2 w-16">Cant</th>
                      <th className="py-2">Concepto</th>
                      <th className="py-2 text-right">{isProm ? "Promedio Diario" : "Total Acumulado"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {/* Buffet Sale Block */}
                    <tr className="bg-emerald-50/30 text-slate-900 border-l-4 border-emerald-500 pl-3">
                      <td className="py-3 px-1 font-mono font-bold">
                        {isProm ? (consolidated.totalBarItemsQty / div).toFixed(1) : consolidated.totalBarItemsQty}
                      </td>
                      <td className="py-3 px-1">
                        <strong className="text-emerald-800">Ventas Buffet (Bar)</strong>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                          {isProm ? "Ventas promedio por día" : "Transacciones automáticas consolidadas"}
                        </p>
                      </td>
                      <td className="py-3 px-1 text-right font-mono font-black text-emerald-700 text-sm">
                        ${(isProm ? consolidated.totalBarSalesAmount / div : consolidated.totalBarSalesAmount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {/* Grouped Extras */}
                    {consolidated.otrosIngresosGrouped.map((item, id) => (
                      <tr key={`con-inc-${id}`} className="text-slate-700">
                        <td className="py-3 px-1 font-mono">
                          {isProm ? (item.quantity / div).toFixed(1) : item.quantity}
                        </td>
                        <td className="py-3 px-1 font-semibold">
                          <span className="text-slate-800">{item.account}</span>
                          {item.description && <span className="text-slate-400 font-mono text-[10px] ml-1.5">({item.description})</span>}
                        </td>
                        <td className="py-3 px-1 text-right font-mono font-bold text-slate-800">
                          ${(isProm ? item.amount / div : item.amount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}

                    {consolidated.otrosIngresosGrouped.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-400 font-semibold">
                          No hay ingresos manuales registrados en el período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-200">
                      <td colSpan={2} className="py-3 px-4 font-extrabold uppercase text-[10px] tracking-wider text-right">Total Otros Ingresos ({isProm ? "PROMEDIO" : "ACUMULADO"})</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-800 text-sm">
                        ${(isProm ? consolidated.grandBonusIncomesSum / div : consolidated.grandBonusIncomesSum).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Otros Egresos (Retiros + Gastos) */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <h3 className="bg-rose-800 text-white py-2.5 px-4 font-black font-display tracking-widest text-xs uppercase flex items-center justify-center gap-2">
                <FileText className="w-4 h-4 text-rose-300" />
                <span>Otros Egresos (Retiros + Gastos) ({isProm ? "Promedio Diario" : "Acumulado"})</span>
              </h3>

              <div className="p-4">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="text-slate-400 font-bold border-b border-slate-200 font-display uppercase tracking-widest text-[9.5px]">
                      <th className="py-2 w-16">Cant</th>
                      <th className="py-2">Concepto</th>
                      <th className="py-2 text-right">{isProm ? "Promedio Diario" : "Total Acumulado"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {/* Personal Drawing block */}
                    {consolidated.totalPersonalEgresoAmount > 0 && (
                      <tr className="bg-rose-50/30 text-slate-900 border-l-4 border-rose-500 pl-3">
                        <td className="py-3 px-1 font-mono font-bold">
                          {isProm ? (consolidated.totalPersonalDaysCount / div).toFixed(1) : consolidated.totalPersonalDaysCount}
                        </td>
                        <td className="py-3 px-1">
                          <strong className="text-rose-800">Retiro del Personal (Sueldos)</strong>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                            {isProm ? "Retiros promedio por día" : "Acumulados de retiros para encargados"}
                          </p>
                        </td>
                        <td className="py-3 px-1 text-right font-mono font-black text-rose-700 text-sm">
                          -${(isProm ? consolidated.totalPersonalEgresoAmount / div : consolidated.totalPersonalEgresoAmount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}

                    {/* Grouped Extras */}
                    {consolidated.otrosEgresosGrouped.map((item, id) => (
                      <tr key={`con-exp-${id}`} className="text-slate-700">
                        <td className="py-3 px-1 font-mono">
                          {isProm ? (item.quantity / div).toFixed(1) : item.quantity}
                        </td>
                        <td className="py-3 px-1 font-semibold">
                          <span className="text-slate-800">{item.account}</span>
                          {item.description && <span className="text-slate-400 font-mono text-[10px] ml-1.5">({item.description})</span>}
                        </td>
                        <td className="py-3 px-1 text-right font-mono font-bold text-rose-700">
                          -${(isProm ? item.amount / div : item.amount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}

                    {(consolidated.totalPersonalEgresoAmount === 0 && consolidated.otrosEgresosGrouped.length === 0) && (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-400 font-semibold">
                          No hay egresos registrados en el período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-200">
                      <td colSpan={2} className="py-3 px-4 font-extrabold uppercase text-[10px] tracking-wider text-right">Total Otros Egresos ({isProm ? "PROMEDIO" : "ACUMULADO"})</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-rose-800 text-sm">
                        -${(isProm ? consolidated.grandEgresosSum / div : consolidated.grandEgresosSum).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          </div>

          {/* BOTTOM SECTION: RESUMEN TEÓRICO & RENDICIÓN FÍSICA FRENTE A FRENTE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* RESUMEN TEÓRICO ACUMULADO */}
            <div className="border border-emerald-200 rounded-xl overflow-hidden shadow-3xs bg-slate-50/50">
              <h3 className="bg-emerald-800 text-white py-2.5 px-4 font-black font-display tracking-widest text-xs uppercase flex items-center gap-2 justify-center">
                <FileText className="w-4 h-4 text-emerald-300" />
                <span>Resumen Teórico ({isProm ? "Promedio Diario" : "Acumulado"})</span>
              </h3>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center text-xs pb-1 border-b border-dashed border-slate-200/50 text-slate-700">
                  <span>SALDO INICIAL {isProm ? "PROMEDIO" : "ACUMULADO"}</span>
                  <span className="font-mono font-semibold">${(isProm ? consolidated.totalSaldoInicial / div : consolidated.totalSaldoInicial).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-1 border-b border-dashed border-slate-200/50 text-slate-700">
                  <span>INGRESOS CANCHAS (1 + 2)</span>
                  <span className="font-mono font-semibold">${(isProm ? consolidated.totalCanchasSum / div : consolidated.totalCanchasSum).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-1 border-b border-dashed border-slate-200/50 text-slate-700">
                  <span>INGRESOS EXTRAS (BAR + OTROS)</span>
                  <span className="font-mono font-semibold">${(isProm ? consolidated.grandBonusIncomesSum / div : consolidated.grandBonusIncomesSum).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold pt-1 text-slate-800">
                  <span>TOTAL INGRESOS (+ SALDOS INIC.)</span>
                  <span className="font-mono">${(isProm ? (consolidated.totalSaldoInicial + consolidated.totalCanchasSum + consolidated.grandBonusIncomesSum) / div : (consolidated.totalSaldoInicial + consolidated.totalCanchasSum + consolidated.grandBonusIncomesSum)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-[#ba1a1a] pb-2 border-b border-slate-200">
                  <span>TOTAL EGRESOS {isProm ? "PROMEDIO" : "ACUMULADOS"}</span>
                  <span className="font-mono">-${(isProm ? consolidated.grandEgresosSum / div : consolidated.grandEgresosSum).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-black pt-2 bg-[#091426] text-white p-3 rounded-lg leading-none">
                  <span className="uppercase tracking-wide text-[10px]">A RENDIR {isProm ? "PROMEDIO" : "ACUMULADO"} (Teórico)</span>
                  <span className="font-mono text-base">${(isProm ? consolidated.expectedCashInDrawer / div : consolidated.expectedCashInDrawer).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* RENDICIÓN REAL ACUMULADA */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs bg-slate-50/50 h-fit">
              <h3 className="bg-slate-900 text-white py-2.5 px-4 font-black font-display tracking-widest text-xs uppercase flex items-center gap-2 justify-center border-b border-slate-800">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Rendición Real ({isProm ? "Promedio Diario" : "Acumulado"})</span>
              </h3>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center text-xs pb-1 border-b border-dashed border-slate-200/50 text-slate-700">
                  <span>TOTAL EFECTIVO RENDIDO</span>
                  <span className="font-mono font-semibold">${(isProm ? consolidated.totalRendicionEfectivo / div : consolidated.totalRendicionEfectivo).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-1 border-b border-dashed border-slate-200/50 text-slate-700">
                  <span>TOTAL TRANSFERENCIAS / OTROS</span>
                  <span className="font-mono font-semibold">${(isProm ? consolidated.totalRendicionTransferencia / div : consolidated.totalRendicionTransferencia).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-1 border-b border-dashed border-slate-200/50 text-slate-700">
                  <span>TOTAL TARJETAS RENDIDO</span>
                  <span className="font-mono font-semibold">${(isProm ? consolidated.totalRendicionTarjetas / div : consolidated.totalRendicionTarjetas).toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center text-xs font-bold pt-1 text-indigo-900 pb-2 border-b border-slate-200">
                  <span>TOTAL CIERRE REAL</span>
                  <span className="font-mono">${(isProm ? consolidated.realPhysicallyRendido / div : consolidated.realPhysicallyRendido).toFixed(2)}</span>
                </div>
 
                <div className={`flex justify-between items-center text-sm font-black pt-2 p-3 rounded-lg leading-none ${consolidated.globalDiscrepancyAmount >= 0 ? "bg-emerald-700 text-white" : "bg-rose-700 text-white"}`}>
                  <span className="uppercase tracking-wide text-[10px]">DIFERENCIA ({consolidated.globalDiscrepancyAmount >= 0 ? "SOBRANTE" : "FALTANTE"})</span>
                  <span className="font-mono text-base">{consolidated.globalDiscrepancyAmount >= 0 ? "+" : ""}${(isProm ? consolidated.globalDiscrepancyAmount / div : consolidated.globalDiscrepancyAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};

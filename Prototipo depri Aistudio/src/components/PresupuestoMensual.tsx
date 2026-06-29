import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { 
  PiggyBank, 
  ChevronRight, 
  ChevronDown,
  Plus, 
  Trash2, 
  Copy, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  DollarSign, 
  Layers,
  Printer,
  X,
  Eye
} from "lucide-react";
import { CustomDropdown } from "./CustomDropdown";
// @ts-ignore
import deprimeraLogo from "../assets/images/deprimera_logo_1780923105846.png";
import { getUnifiedAccounts, getUnifiedSubaccounts, saveUnifiedAccounts, saveUnifiedSubaccounts, Account, getUnifiedPlan, fetchMasterPlanFromServer, pushMasterPlanToServer, getAccountLabel, getSubaccountLabel } from "../lib/accountManager";

interface Budget {
  id: string;
  monthStr: string; // e.g., "Junio 2026"
  category: string; // Account ID (Servicios, Sueldos, etc.)
  account: string;  // Account ID
  subaccount: string; // Subaccount ID
  amount: number;       // Budgeted
  dueDate?: string;     // Payment or due date (YYYY-MM-DD or readable)
}

interface LedgerItem {
  id: string;
  date: string;
  periodoImputado: string;
  type: string;
  account: string;
  subaccount: string;
  debe: number;
  haber: number;
}

interface PresupuestoMensualProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const PresupuestoMensual: React.FC<PresupuestoMensualProps> = ({ apiFetch }) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "matrix" | "timeline">("list");
  const [filterState, setFilterState] = useState<"Todos" | "Pagados" | "Pendientes">("Todos");
  const [selectedMonth, setSelectedMonth] = useState("Junio 2026");
  const [groupSubaccounts, setGroupSubaccounts] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Add form fields
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [copyConfirmationOpen, setCopyConfirmationOpen] = useState(false);
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [auditItem, setAuditItem] = useState<{ budget: any; payments: LedgerItem[] } | null>(null);
  const [newCategory, setNewCategory] = useState("Servicios");
  const [newSubaccountVal, setNewSubaccountInner] = useState("");
  const newSubaccount = newSubaccountVal;
  const setNewSubaccount = (val: string) => {
    console.log("AUDIT-SUB-setNewSubaccount called with value:", val, "previous value was:", newSubaccountVal);
    setNewSubaccountInner(val);
  };

  useEffect(() => {
    console.log("AUDIT-SUB-useEffect: newCategory state changed to:", newCategory);
  }, [newCategory]);

  useEffect(() => {
    console.log("AUDIT-SUB-useEffect: newSubaccount state updated to:", newSubaccountVal);
  }, [newSubaccountVal]);

  const [newAmount, setNewAmount] = useState<number>(0);
  const [newAmountStr, setNewAmountStr] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [typedCategory, setTypedCategory] = useState("");
  const [typedSubaccount, setTypedSubaccount] = useState("");

  // Helper to get last day of month
  const getLastDayOfMonth = (monthYear: string) => {
    const parts = monthYear.split(" ");
    if (parts.length !== 2) return "";
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const monthIdx = monthNames.indexOf(parts[0]);
    const year = parseInt(parts[1]);
    if (monthIdx === -1) return "";
    
    // Day 0 of next month is last day of current month
    const date = new Date(year, monthIdx + 1, 0);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    if (addFormOpen && !newDueDate) {
      setNewDueDate(getLastDayOfMonth(selectedMonth));
    }
  }, [addFormOpen, selectedMonth]);

  // Format currency with thousands separator for display/input
  const formatAmountInput = (val: string) => {
    // Remove non-digit characters
    const clean = val.replace(/\D/g, "");
    if (!clean) return "";
    const num = parseInt(clean);
    return num.toLocaleString("es-ES");
  };

  const handlePrint = () => {
    setPrintPreviewOpen(true);
  };

  const getPrintContentHTML = () => {
    const customLogo = localStorage.getItem("barstock_app_custom_logo") || deprimeraLogo;
    const logoImgHtml = `<img src="${customLogo}" alt="Logo" class="max-h-16 object-contain inline-block" onError="this.src='${deprimeraLogo}';" />`;

    // 1. Build Header
    let html = `
      <div class="flex flex-col sm:flex-row justify-between items-center mb-8 border-b-2 border-slate-900 pb-4 gap-4">
        <div class="flex items-center gap-4">
          ${logoImgHtml}
          <div>
            <p class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Reporte de Gestión</p>
            <h1 class="text-2xl font-black uppercase tracking-tighter leading-none text-slate-950">Presupuesto Mensual</h1>
            <p class="text-sm font-bold text-indigo-600 mt-1 uppercase tracking-wider">${selectedMonth}</p>
          </div>
        </div>
        <div class="text-right space-y-2">
          <div>
            <p class="text-[9px] font-black uppercase text-slate-400 tracking-widest">Documento Original</p>
            <p class="text-xs font-bold font-mono text-slate-700">${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div class="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl text-right inline-block">
            <p class="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none">Importe Total Presupuesto</p>
            <p class="text-base font-black text-indigo-950 font-mono leading-none mt-1">$${totalBudgeted.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>
    `;

    // 2. Build Table
    if (viewMode === "list") {
      html += `
        <div class="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
          <table class="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr class="bg-slate-900 text-slate-200 uppercase tracking-wider text-[9px] font-black">
                <th class="p-3 pl-4">Categoría Principal (Cuenta)</th>
                <th class="p-3">Concepto/Detalle (Subcuenta)</th>
                <th class="p-3 text-center">Vencimiento</th>
                <th class="p-3 text-right">Límite Estimado ($)</th>
                <th class="p-3 text-right">Outlays Reales Libres ($)</th>
                <th class="p-3 text-right">Delta / Desvío ($)</th>
                <th class="p-3 text-center">Estado del Obligado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
      `;

      if (groupSubaccounts) {
        if (groupedExecution.length === 0) {
          html += `
            <tr>
              <td colSpan="7" class="p-8 text-center text-slate-400 text-xs font-mono uppercase">
                No hay partidas presupuestarias creadas para ${selectedMonth}.
              </td>
            </tr>
          `;
        } else {
          groupedExecution.forEach(g => {
            const isExpanded = expandedCategories[g.category] !== false;
            const stateBg = g.state === "Pagado"
              ? "bg-emerald-100/50 text-emerald-800 border-emerald-300"
              : g.state === "Parcialmente Pagado"
              ? "bg-amber-100/50 text-amber-800 border-amber-300"
              : "bg-rose-100 text-rose-800 border-rose-300";

            html += `
              <tr class="bg-slate-100/80 font-bold">
                <td class="p-3 pl-4 font-black border-r border-slate-100/50 text-slate-900">
                  📁 ${getAccountLabel(g.category)} (${g.subaccounts.length} sub.)
                </td>
                <td class="p-3 text-slate-400 font-mono text-[9.5px] uppercase font-bold border-r border-slate-100/50">Todas las subcuentas</td>
                <td class="p-3 text-center font-mono text-[10px] text-slate-400 border-r border-slate-100/50">-</td>
                <td class="p-3 text-right font-mono font-black text-slate-900">$${g.totalAmount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-right font-mono font-black text-emerald-800 border-r border-slate-100/50">$${g.totalRealPaid.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-right font-mono font-black border-r border-slate-100/50">
                  <span class="${g.totalDeviation >= 0 ? "text-emerald-700" : "text-rose-700"}">
                    ${g.totalDeviation >= 0 ? "+" : ""}$${g.totalDeviation.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td class="p-3 text-center">
                  <span class="px-2.5 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-wider ${stateBg} whitespace-nowrap">
                    ${g.state}
                  </span>
                </td>
              </tr>
            `;

            if (isExpanded) {
              g.subaccounts.forEach(b => {
                const isPaid = b.state === "Pagado";
                const isPartial = b.state === "Parcialmente Pagado";
                const childStateBg = isPaid 
                  ? "bg-emerald-100/50 text-emerald-800 border-emerald-300" 
                  : isPartial
                  ? "bg-amber-100/50 text-amber-800 border-amber-300"
                  : "bg-rose-100 text-rose-800 border-rose-300";

                const childRowBg = isPaid 
                  ? "bg-emerald-50/10 text-emerald-950/60" 
                  : isPartial
                  ? "bg-amber-50/5 text-amber-950"
                  : "bg-rose-50/10 text-rose-950";

                html += `
                  <tr class="${childRowBg}">
                    <td class="p-3 pl-8 border-r border-slate-100/50 text-slate-400 text-[10px]">
                      &nbsp;&nbsp;└─ ${getAccountLabel(b.category)}
                    </td>
                    <td class="p-3 font-semibold border-r border-slate-100/50 ${isPaid ? "text-slate-400 font-normal" : "text-slate-800"}">${getSubaccountLabel(b.category, b.subaccount)}</td>
                    <td class="p-3 text-center font-mono text-[10px] text-slate-500 border-r border-slate-100/50">${formatDateSafe(b.dueDate)}</td>
                    <td class="p-3 text-right font-mono font-bold text-slate-800">$${b.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</td>
                    <td class="p-3 text-right font-mono font-black text-emerald-700">$${b.realPaid.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</td>
                    <td class="p-3 text-right font-mono font-bold border-r border-slate-100/50">
                      <span class="${b.deviation >= 0 ? (isPaid ? "text-emerald-600/40" : "text-emerald-700") : "text-rose-700 font-black"}">
                        ${b.deviation >= 0 ? "+" : ""}$${b.deviation.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td class="p-3 text-center">
                      <span class="px-2.5 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-wider ${childStateBg} whitespace-nowrap">
                        ${b.state}
                      </span>
                    </td>
                  </tr>
                `;
              });
            }
          });
        }
      } else {
        if (filteredExecution.length === 0) {
          html += `
            <tr>
              <td colSpan="7" class="p-8 text-center text-slate-400 text-xs font-mono uppercase">
                No hay partidas presupuestarias creadas para ${selectedMonth}.
              </td>
            </tr>
          `;
        } else {
          filteredExecution.forEach(b => {
            const isPaid = b.state === "Pagado";
            const isPartial = b.state === "Parcialmente Pagado";
            const stateBg = isPaid 
              ? "bg-emerald-100/50 text-emerald-800 border-emerald-300" 
              : isPartial
              ? "bg-amber-100/50 text-amber-800 border-amber-300"
              : "bg-rose-100 text-rose-800 border-rose-300";

            const rowBg = isPaid 
              ? "bg-emerald-50/20 text-emerald-950/60" 
              : isPartial
              ? "bg-amber-50/10 text-amber-950"
              : "bg-rose-50/20 text-rose-950";

            html += `
              <tr class="${rowBg}">
                <td class="p-3 pl-4 font-bold border-r border-slate-100/50 ${isPaid ? "text-slate-400" : "text-slate-900"}">${getAccountLabel(b.category)}</td>
                <td class="p-3 font-semibold border-r border-slate-100/50 ${isPaid ? "text-slate-400 font-normal" : "text-slate-800"}">${getSubaccountLabel(b.category, b.subaccount)}</td>
                <td class="p-3 text-center font-mono text-[10px] text-slate-500 border-r border-slate-100/50">${formatDateSafe(b.dueDate)}</td>
                <td class="p-3 text-right font-mono font-bold text-slate-800">$${b.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-right font-mono font-black text-emerald-700">$${b.realPaid.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-right font-mono font-bold border-r border-slate-100/50">
                  <span class="${b.deviation >= 0 ? (isPaid ? "text-emerald-600/40" : "text-emerald-700") : "text-rose-700 font-black"}">
                    ${b.deviation >= 0 ? "+" : ""}$${b.deviation.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td class="p-3 text-center">
                  <span class="px-2.5 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-wider ${stateBg} whitespace-nowrap">
                    ${b.state}
                  </span>
                </td>
              </tr>
            `;
          });
        }
      }

      html += `
            </tbody>
          </table>
        </div>
      `;

      if (unbudgetedExpenses.length > 0) {
        html += `
          <div class="mt-8">
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-xs font-black uppercase text-amber-800 tracking-wider">Egresos No Presupuestados (Desvíos Adicionales)</h3>
              <span class="text-[10px] font-black font-mono bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
                TOTAL: $${totalUnbudgeted.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div class="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
              <table class="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr class="bg-amber-700 text-white uppercase tracking-wider text-[9px] font-black">
                    <th class="p-3 pl-4">Categoría Principal (Cuenta)</th>
                    <th class="p-3">Concepto/Detalle (Subcuenta)</th>
                    <th class="p-3 text-center">Registros</th>
                    <th class="p-3 text-right">Límite Estimado ($)</th>
                    <th class="p-3 text-right">Outlays Reales No Planificados ($)</th>
                    <th class="p-3 text-right">Delta / Desvío ($)</th>
                    <th class="p-3 text-center">Estado del Obligado</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-150 font-medium">
        `;

        unbudgetedExpenses.forEach(e => {
          html += `
            <tr class="bg-amber-50/10">
              <td class="p-3 pl-4 font-bold border-r border-slate-100 text-slate-900">${e.account}</td>
              <td class="p-3 font-semibold border-r border-slate-100 text-slate-800">${e.subaccount}</td>
              <td class="p-3 text-center font-mono text-[10px] text-slate-500 border-r border-slate-100">${e.items.length} mov.</td>
              <td class="p-3 text-right font-mono font-bold text-slate-400 border-r border-slate-100">$0,00</td>
              <td class="p-3 text-right font-mono font-black text-rose-700 border-r border-slate-100">$${e.spent.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</td>
              <td class="p-3 text-right font-mono font-bold border-r border-slate-100 text-rose-700 font-black">-$${e.spent.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</td>
              <td class="p-3 text-center">
                <span class="px-2.5 py-0.5 border border-rose-300 bg-rose-50 text-rose-700 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                  No Planificado
                </span>
              </td>
            </tr>
          `;
        });

        html += `
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    } else {
      // Matrix / Gantt view
      const uniqueDates = Array.from<string>(new Set(filteredExecution.map(b => (b.dueDate || "S/F") as string))).sort((a: string, b: string) => {
        if (a === "S/F") return 1;
        if (b === "S/F") return -1;
        return a.localeCompare(b);
      });
      
      const rows: Record<string, { label: string, sub: string, amounts: Record<string, number>, total: number, state: string }> = {};
      
      filteredExecution.forEach(b => {
        const key = `${b.category}-${b.subaccount}`;
        if (!rows[key]) {
          rows[key] = {
            label: getAccountLabel(b.category),
            sub: getSubaccountLabel(b.category, b.subaccount),
            amounts: {},
            total: 0,
            state: b.state
          };
        }
        const dateKey = (b.dueDate || "S/F") as string;
        rows[key].amounts[dateKey] = (rows[key].amounts[dateKey] || 0) + b.amount;
        rows[key].total += b.amount;
      });

      const colSums: Record<string, number> = {};
      uniqueDates.forEach(d => {
        colSums[d] = Object.values(rows).reduce((sum, r) => sum + (r.amounts[d] || 0), 0);
      });
      const grandTotal = Object.values(colSums).reduce((a, b) => a + b, 0);

      const sortedRows = Object.values(rows).sort((a, b) => {
        if (a.label !== b.label) return a.label.localeCompare(b.label);
        return a.sub.localeCompare(b.sub);
      });

      html += `
        <div class="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-3xs">
          <table class="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr class="bg-slate-900 text-slate-200 uppercase tracking-wider text-[9px] font-black">
                <th class="p-3 pl-4 border-r border-slate-700 min-w-[200px]">Cuenta / Subcuenta</th>
                ${uniqueDates.map(date => `
                  <th class="p-3 text-center border-r border-slate-700 min-w-[100px]">${formatDateSafe(date)}</th>
                `).join('')}
                <th class="p-3 text-right pr-4 bg-indigo-900 min-w-[120px]">Sub-total Fila</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium bg-white">
      `;

      if (sortedRows.length === 0) {
        html += `
          <tr>
            <td colSpan="${uniqueDates.length + 2}" class="p-10 text-center text-slate-400 font-mono italic uppercase text-[10px] tracking-widest">
              No hay vencimientos programados para este período
            </td>
          </tr>
        `;
      } else {
        sortedRows.forEach(row => {
          const isPaid = row.state === "Pagado";
          const rowColorClass = isPaid ? "text-emerald-800/60 bg-emerald-50/5" : "text-rose-800 bg-white";
          const rowSubLabelColor = isPaid ? "text-slate-300" : "text-slate-400";
          const cellBoldValColor = isPaid ? "text-emerald-600/30" : "";
          const grandSubtotalBg = isPaid ? "text-emerald-600/40 bg-emerald-50/20" : "text-indigo-600 bg-indigo-50/20";

          html += `
            <tr class="${rowColorClass}">
              <td class="p-3 pl-4 border-r border-slate-100">
                <div class="flex flex-col">
                  <span class="text-[11px] font-bold leading-tight">${row.label}</span>
                  <span class="text-[9px] font-semibold italic font-mono uppercase truncate max-w-[180px] ${rowSubLabelColor}">${row.sub}</span>
                </div>
              </td>
              ${uniqueDates.map(date => {
                const amt = row.amounts[date];
                return `
                  <td class="p-3 text-center border-r border-slate-50 font-mono ${cellBoldValColor}">
                    ${amt ? `<span class="text-[11px] font-black">$${amt.toLocaleString()}</span>` : `<span class="text-slate-200 text-[10px] opacity-30 select-none">•</span>`}
                  </td>
                `;
              }).join('')}
              <td class="p-3 text-right pr-4 font-black ${grandSubtotalBg}">
                $${row.total.toLocaleString()}
              </td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
      `;

      if (sortedRows.length > 0) {
        html += `
          <tfoot>
            <tr class="bg-slate-50 border-t-2 border-slate-200 font-black text-[10px]">
              <td class="p-4 border-r border-slate-200 text-slate-900 uppercase tracking-widest">Sub-totales Columna</td>
              ${uniqueDates.map(date => `
                <td class="p-4 text-center border-r border-slate-200 text-slate-900 font-mono">$${colSums[date].toLocaleString()}</td>
              `).join('')}
              <td class="p-4 text-right pr-4 font-black text-lg text-emerald-700 bg-emerald-50 font-mono font-bold">
                $${grandTotal.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        `;
      }

      html += `
          </table>
        </div>
      `;
    }

    return html;
  };

  const executeFinalPrint = () => {
    const windowPrint = window.open("", "", "left=0,top=0,width=1100,height=900,toolbar=0,scrollbars=1,status=0");
    if (!windowPrint) return;

    const htmlContent = getPrintContentHTML();

    windowPrint.document.write(`
      <html>
        <head>
          <title>Presupuesto - ${selectedMonth}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono:wght@500&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              padding: 0;
              margin: 0;
              color: #0f172a;
              background-color: #ffffff;
            }
            @media print {
              .no-print { display: none !important; }
              table { page-break-inside: auto; width: 100% !important; border-collapse: collapse !important; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              body { padding: 0; margin: 0; }
              .print-container { padding: 0; }
              .bg-slate-900 { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
              .bg-indigo-900 { background-color: #312e81 !important; color: white !important; -webkit-print-color-adjust: exact; }
              .bg-indigo-50\\/20 { background-color: rgba(238, 242, 255, 0.2) !important; -webkit-print-color-adjust: exact; }
              .bg-slate-50 { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
              .bg-emerald-50 { background-color: #ecfdf5 !important; -webkit-print-color-adjust: exact; }
              .border-slate-700 { border-color: #334155 !important; }
              .text-indigo-600 { color: #4f46e5 !important; }
              .text-emerald-700 { color: #047857 !important; }
              .sticky { position: static !important; }
              .shadow-3xs { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
              
              /* Force showing background colors in Chrome/Safari */
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            .font-mono { font-family: 'JetBrains Mono', monospace; }
          </style>
        </head>
        <body>
          <div class="print-container p-8">
            <div class="printable-content">
              <style>
                /* Print specific overrides */
                @media print {
                  .state-pagado { 
                    color: #94a3b8 !important; /* slate-400 */
                    font-weight: 300 !important;
                    opacity: 0.5 !important;
                  }
                  .state-pagado td { color: #94a3b8 !important; border-bottom: 1px solid #f1f5f9 !important; }
                  .state-pagado * { color: #94a3b8 !important; }
                  .state-pendiente { 
                    color: #000000 !important;
                    background-color: #fafafa !important;
                  }
                  .state-pendiente td { 
                    border-bottom: 2px solid #334155 !important;
                    font-weight: bold !important;
                  }
                  .state-label { display: none !important; }
                  
                  /* Table borders for print */
                  table, th, td { border: 1px solid #e2e8f0 !important; }
                  
                  /* Differential for paid/pending in print */
                  .print-low-opacity { color: #cbd5e1 !important; }
                  .print-bold { font-weight: 900 !important; text-decoration: underline; }
                }
              </style>
              ${htmlContent}
            </div>
            <div class="mt-12 pt-8 border-t border-slate-100 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>Firmado: __________________________</span>
              <span>Sello de Oficina</span>
              <span>Página 1 de 1</span>
            </div>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 1200);
            };
          </script>
        </body>
      </html>
    `);
    windowPrint.document.close();
    windowPrint.focus();
    setPrintPreviewOpen(false);
  };

  // Safe date formatter to avoid timezone issues
  const formatDateSafe = (dateStr: string | undefined) => {
    if (!dateStr) return "10/06/2026"; // Fallback for legacy records
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      // YYYY-MM-DD -> DD/MM/YYYY
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);

  // Copy trigger
  const [copyFromMonth, setCopyFromMonth] = useState("Mayo 2026");

  // Helper to update budget field
  const handleUpdateBudget = async (id: string, updates: Partial<Budget>) => {
    try {
      const res = await apiFetch(`/api/budgets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setBudgets(prev => prev.map(b => b.id === id ? updated : b));
        setEditId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAudit = (b: any) => {
    if (!b || b.realPaid <= 0) return;
    
    const categoryLabel = getAccountLabel(b.category).toLowerCase();
    const subLabel = getSubaccountLabel(b.category, b.subaccount).toLowerCase();

    const matchingSpentEntries = ledger.filter(l => {
      const matchesMonth = l.periodoImputado === selectedMonth;
      
      const accountMatch = 
        l.account?.toLowerCase() === b.category?.toLowerCase() || 
        l.account?.toLowerCase() === categoryLabel;

      const subMatch = 
        l.subaccount?.toLowerCase() === b.subaccount?.toLowerCase() ||
        l.subaccount?.toLowerCase() === subLabel;

      return matchesMonth && accountMatch && subMatch;
    });

    setAuditItem({
      budget: b,
      payments: matchingSpentEntries
    });
  };

  const monthOptions = [
    "Enero 2026", "Febrero 2026", "Marzo 2026", "Abril 2026", "Mayo 2026", "Junio 2026",
    "Julio 2026", "Agosto 2026", "Septiembre 2026", "Octubre 2026", "Noviembre 2026", "Diciembre 2026"
  ];

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 0. Load master plan
      await fetchMasterPlanFromServer(apiFetch).catch(err => console.error("Error syncing master plan:", err));

      // 1. Load budgets
      const resB = await apiFetch("/api/budgets");
      if (resB.ok) {
        const dataB = await resB.json();
        if (Array.isArray(dataB)) {
          // Identify budgets without dueDate - we will handle them in display/update, no recursive loop
          setBudgets(dataB);
        }
      } else {
        const errData = await resB.json();
        if (errData.isQuotaExceeded) {
          setError("Cuota de base de datos excedida. El servicio se restablecerá mañana. Los datos están a salvo.");
        }
      }

      // 2. Load manual ledger to calculate real outlays
      const resL = await apiFetch("/api/ledger-manual");
      let allLedgerItems: LedgerItem[] = [];
      if (resL.ok) {
        const dataL = await resL.json();
        if (Array.isArray(dataL)) allLedgerItems = [...dataL];
      } else {
        const errData = await resL.json();
        if (errData.isQuotaExceeded) {
          setError("Cuota de base de datos excedida. El servicio se restablecerá mañana. Los datos están a salvo.");
        }
      }

      // 3. Load daily boxes history to include automatic outlays too
      const resH = await apiFetch("/api/caja/history");
      if (resH.ok) {
        const histData = await resH.json();
        if (Array.isArray(histData)) {
          setHistory(histData);
          const masterAccounts = getUnifiedAccounts();
          // Map historical box outlays to ledger-like structure to calculate spent totals
          histData.forEach(box => {
            const bDate = box.dateStr;
            let imputed = "";
            try {
              const dateObj = new Date(bDate + "T12:00:00");
              const monthName = dateObj.toLocaleString("es-ES", { month: "long" });
              imputed = monthName[0].toUpperCase() + monthName.substring(1) + " " + dateObj.getFullYear();
            } catch {
              imputed = "";
            }

            if (box.personalAmount > 0) {
              allLedgerItems.push({
                id: `sys_pers_${box.id}`,
                date: bDate,
                periodoImputado: box.personalPeriodoImputado || imputed,
                type: "Egreso",
                account: box.personalAccount || "Sueldos",
                subaccount: box.personalDescription || "Encargado",
                debe: 0,
                haber: box.personalAmount
              });
            }
            if (Array.isArray(box.otrosEgresos)) {
              box.otrosEgresos.forEach((oe: any) => {
                const matchedAcc = masterAccounts.find((a: any) => a.id === oe.accountId);
                const accountLabel = matchedAcc ? matchedAcc.label : (oe.account || "Otros Egresos");
                const matchedSub = matchedAcc?.subaccounts.find((s: any) => s.id === oe.subaccountId);
                const subaccountLabel = matchedSub ? matchedSub.label : (oe.suggestedSubaccount || oe.description || "Egreso Extra");

                allLedgerItems.push({
                  id: `sys_oe_${oe.id}`,
                  date: bDate,
                  periodoImputado: oe.periodoImputado || imputed,
                  type: "Egreso",
                  account: accountLabel,
                  subaccount: subaccountLabel,
                  debe: 0,
                  haber: oe.amount * (oe.quantity || 1)
                });
              });
            }
          });
        }
      }

      setLedger(allLedgerItems);
    } catch (e: any) {
      console.error(e);
      setError("Error de conexión al servidor.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Filter budgets for the active month, sorted alphabetically by Account and then Subaccount
  const activeBudgets = useMemo(() => {
    return budgets
      .filter(b => b.monthStr === selectedMonth)
      .sort((a, b) => {
        const catA = getAccountLabel(a.category).toLowerCase();
        const catB = getAccountLabel(b.category).toLowerCase();
        if (catA !== catB) return catA.localeCompare(catB);
        
        const subA = getSubaccountLabel(a.category, a.subaccount).toLowerCase();
        const subB = getSubaccountLabel(b.category, b.subaccount).toLowerCase();
        return subA.localeCompare(subB);
      });
  }, [budgets, selectedMonth]);

  // Aggregate expenditures matching current month and budget criteria (Exact Account & Subaccount name matching)
  const budgetExecution = useMemo(() => {
    return activeBudgets.map(b => {
      // Find all Egresos matching selected month, account category, and subaccount
      const matchingSpentEntries = ledger.filter(l => {
        const matchesMonth = l.periodoImputado === selectedMonth;
        
        // Robust matching: check both ID and Label for legacy compatibility
        const categoryLabel = getAccountLabel(b.category).toLowerCase();
        const accountMatch = 
          l.account?.toLowerCase() === b.category?.toLowerCase() || 
          l.account?.toLowerCase() === categoryLabel;

        const subLabel = getSubaccountLabel(b.category, b.subaccount).toLowerCase();
        const subMatch = 
          l.subaccount?.toLowerCase() === b.subaccount?.toLowerCase() ||
          l.subaccount?.toLowerCase() === subLabel;

        return matchesMonth && accountMatch && subMatch;
      });

      const totalHaber = matchingSpentEntries.reduce((sum, e) => sum + (Number(e.haber) || 0), 0);
      const totalDebe = matchingSpentEntries.reduce((sum, e) => sum + (Number(e.debe) || 0), 0);
      
      // Spent refers to outgoing disbursements
      const spent = totalHaber - totalDebe; 
      const finalSpent = spent > 0 ? spent : 0;
      
      const deviation = b.amount - finalSpent;

      // Classify state
      let state: "Pendiente" | "Parcialmente Pagado" | "Pagado" = "Pendiente";
      if (finalSpent >= b.amount) {
        state = "Pagado";
      } else if (finalSpent > 0) {
        state = "Parcialmente Pagado";
      }

      return {
        ...b,
        realPaid: finalSpent,
        deviation,
        state
      };
    });
  }, [activeBudgets, ledger, selectedMonth]);

  // Totals
  const totalBudgeted = useMemo(() => budgetExecution.reduce((sum, b) => sum + b.amount, 0), [budgetExecution]);
  const totalPaidReal = useMemo(() => budgetExecution.reduce((sum, b) => sum + b.realPaid, 0), [budgetExecution]);
  const totalPending = useMemo(() => budgetExecution.reduce((sum, b) => sum + (b.state !== "Pagado" ? b.amount - b.realPaid : 0), 0), [budgetExecution]);

  // Aggregate expenditures that do NOT match any budget entry (excluding merchandise purchases)
  const unbudgetedExpenses = useMemo(() => {
    const map: Record<string, { account: string; subaccount: string; spent: number; items: LedgerItem[] }> = {};
    
    ledger.forEach(l => {
      if (l.periodoImputado !== selectedMonth) return;
      
      const acc = l.account || "Otros Egresos";
      const sub = l.subaccount || "Egreso Extra";
      
      // Check if it is merchandise purchase
      const accLower = acc.toLowerCase();
      const subLower = sub.toLowerCase();
      const isMerch = 
        accLower.includes("compra de mercader") ||
        accLower.includes("mercaderia") ||
        accLower.includes("mercadería") ||
        subLower.includes("compra de mercader") ||
        subLower.includes("mercaderia") ||
        subLower.includes("mercadería");
        
      if (isMerch) return;
      
      const spent = (Number(l.haber) || 0) - (Number(l.debe) || 0);
      if (spent <= 0) return;
      
      // Check if matches budgeted item
      const isBudg = activeBudgets.some(b => {
        const categoryLabel = getAccountLabel(b.category).toLowerCase();
        const subLabel = getSubaccountLabel(b.category, b.subaccount).toLowerCase();
        
        const accountMatch = 
          acc.toLowerCase() === b.category.toLowerCase() || 
          acc.toLowerCase() === categoryLabel;

        const subMatch = 
          sub.toLowerCase() === b.subaccount.toLowerCase() ||
          sub.toLowerCase() === subLabel;

        return accountMatch && subMatch;
      });
      
      if (!isBudg) {
        const key = `${acc.trim()}||${sub.trim()}`;
        if (!map[key]) {
          map[key] = {
            account: acc,
            subaccount: sub,
            spent: 0,
            items: []
          };
        }
        map[key].spent += spent;
        map[key].items.push(l);
      }
    });
    
    return Object.values(map).sort((a, b) => a.account.localeCompare(b.account) || a.subaccount.localeCompare(b.subaccount));
  }, [ledger, activeBudgets, selectedMonth]);

  const totalUnbudgeted = useMemo(() => {
    return unbudgetedExpenses.reduce((sum, e) => sum + e.spent, 0);
  }, [unbudgetedExpenses]);

  const totalRealEgresadoCompleto = useMemo(() => {
    return totalPaidReal + totalUnbudgeted;
  }, [totalPaidReal, totalUnbudgeted]);

  // Handles adding budget
  const filteredExecution = useMemo(() => {
    if (filterState === "Todos") return budgetExecution;
    if (filterState === "Pagados") return budgetExecution.filter(b => b.state === "Pagado");
    if (filterState === "Pendientes") return budgetExecution.filter(b => b.state !== "Pagado");
    return budgetExecution;
  }, [budgetExecution, filterState]);

  // Group filteredExecution by category when in grouped mode
  const groupedExecution = useMemo(() => {
    const map: Record<string, {
      category: string;
      subaccounts: typeof filteredExecution;
      totalAmount: number;
      totalRealPaid: number;
      totalDeviation: number;
      state: "Pendiente" | "Parcialmente Pagado" | "Pagado";
    }> = {};

    filteredExecution.forEach(item => {
      const cat = item.category;
      if (!map[cat]) {
        map[cat] = {
          category: cat,
          subaccounts: [],
          totalAmount: 0,
          totalRealPaid: 0,
          totalDeviation: 0,
          state: "Pendiente"
        };
      }
      map[cat].subaccounts.push(item);
      map[cat].totalAmount += item.amount;
      map[cat].totalRealPaid += item.realPaid;
    });

    return Object.values(map).map(g => {
      const totalDeviation = g.totalAmount - g.totalRealPaid;
      
      // Classify consolidated state
      const allPagado = g.subaccounts.every(s => s.state === "Pagado");
      const allPendiente = g.subaccounts.every(s => s.state === "Pendiente");
      let state: "Pendiente" | "Parcialmente Pagado" | "Pagado" = "Parcialmente Pagado";
      if (allPagado) {
        state = "Pagado";
      } else if (allPendiente) {
        state = "Pendiente";
      }

      return {
        ...g,
        totalDeviation,
        state
      };
    }).sort((a, b) => getAccountLabel(a.category).localeCompare(getAccountLabel(b.category)));
  }, [filteredExecution]);

  // Aggregate monthly data for the 12-month timeline desvíos chart
  const timelineData = useMemo(() => {
    return monthOptions.map(m => {
      const monthBudgets = budgets.filter(b => b.monthStr === m);
      const totalBudget = monthBudgets.reduce((sum, b) => sum + b.amount, 0);

      const totalSpent = ledger.reduce((sum, l) => {
        if (l.periodoImputado !== m) return sum;
        
        const acc = l.account || "";
        const sub = l.subaccount || "";
        
        const accLower = acc.toLowerCase();
        const subLower = sub.toLowerCase();
        const isMerch = 
          accLower.includes("compra de mercader") ||
          accLower.includes("mercaderia") ||
          accLower.includes("mercadería") ||
          subLower.includes("compra de mercader") ||
          subLower.includes("mercaderia") ||
          subLower.includes("mercadería");
          
        if (isMerch) return sum;

        const spent = (Number(l.haber) || 0) - (Number(l.debe) || 0);
        return sum + (spent > 0 ? spent : 0);
      }, 0);

      const deviation = totalBudget - totalSpent;
      return {
        monthStr: m,
        budgeted: totalBudget,
        spent: totalSpent,
        deviation
      };
    });
  }, [budgets, ledger, monthOptions]);

  // Totals based on filtered data (or keep global totals?)
  // The user didn't specify if totals should filter too, but usually it's better if they do.
  // Actually, I'll keep global totals for the dashboard cards if they exist, 
  // but the table totals should probably reflect filters? 
  // User just asked for a selector to show/hide.
  
  const [isSaving, setIsSaving] = useState(false);
  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("LOG-1 click detectado", { newCategory, newSubaccount, newAmount, newDueDate, typedCategory, typedSubaccount });

    let finalCategory = newCategory;
    // Auto-create/resolve category from typed value if none is selected
    if (!finalCategory && typedCategory.trim()) {
      const label = typedCategory.trim();
      const accounts = getUnifiedAccounts();
      const existing = accounts.find(a => a.label.toLowerCase() === label.toLowerCase());
      if (existing) {
        finalCategory = existing.id;
      } else {
        const newAcc: Account = { id: label, label: label, subaccounts: [] };
        saveUnifiedAccounts([...accounts, newAcc]);
        finalCategory = label;
        // background sync plan to server
        await pushMasterPlanToServer(apiFetch, getUnifiedPlan()).catch(err => console.error(err));
      }
    }

    // fallback to default if still empty
    if (!finalCategory) {
      finalCategory = "Servicios";
      const accounts = getUnifiedAccounts();
      if (!accounts.find(a => a.id === "Servicios")) {
        saveUnifiedAccounts([...accounts, { id: "Servicios", label: "Servicios", subaccounts: [] }]);
        await pushMasterPlanToServer(apiFetch, getUnifiedPlan()).catch(err => console.error(err));
      }
    }

    console.log("AUDIT-SUB-handleAddBudget BEFORE finalSubaccount check:", {
      newCategory,
      finalCategory,
      newSubaccount,
      newSubaccountLabel: getSubaccountLabel(finalCategory, newSubaccount),
      typedSubaccount,
      allSubaccountsForCategory: getUnifiedSubaccounts(finalCategory)
    });

    console.log(
      "[DD-4 before finalSubaccount]",
      {
        newSubaccount,
        typedSubaccount
      }
    );

    let finalSubaccount = newSubaccount;
    if (!finalSubaccount && typedSubaccount.trim()) {
      const label = typedSubaccount.trim();
      const subs = getUnifiedSubaccounts(finalCategory);
      console.log("AUDIT-SUB-Resolving typed subaccount, current subs list for category:", JSON.stringify(subs), "finding exact/fuzzy label:", label);
      const existing = subs.find(s => s.label.toLowerCase() === label.toLowerCase());
      if (existing) {
        console.log("AUDIT-SUB-Found existing matched subaccount:", existing);
        finalSubaccount = existing.id;
      } else {
        const newSub = { id: label, label: label };
        console.log("AUDIT-SUB-No existing subaccount found. Creating new:", newSub);
        saveUnifiedSubaccounts(finalCategory, [...subs, newSub]);
        finalSubaccount = label;
        // background sync plan to server
        await pushMasterPlanToServer(apiFetch, getUnifiedPlan()).catch(err => console.error(err));
      }
    }

    console.log(
      "[DD-5 finalSubaccount]",
      {
        finalSubaccount
      }
    );

    console.log("AUDIT-SUB-handleAddBudget AFTER finalSubaccount calculation. finalSubaccount:", finalSubaccount);

    if (!finalSubaccount) {
      console.log("LOG-Aborted finalSubaccount is empty");
      alert("⚠️ ERROR: No has seleccionado ni ingresado un Concepto / Partida Fija.");
      return;
    }

    if (newAmount <= 0) {
      console.log("LOG-Aborted amount is 0 or negative", newAmount);
      alert("⚠️ ERROR: El importe debe ser mayor a 0.");
      return;
    }

    console.log("LOG-2 validación superada", { finalCategory, finalSubaccount, newAmount });

    setIsSaving(true);
    console.log("Starting save process for month:", selectedMonth);
    
    const payload = {
      monthStr: selectedMonth,
      category: finalCategory,
      account: finalCategory,
      subaccount: finalSubaccount,
      amount: newAmount,
      dueDate: newDueDate,
      paidAmount: 0,
      state: "Pendiente"
    };

    console.log("LOG-3 objeto construido", payload);

    try {
      console.log("LOG-4 llamada Firestore iniciada", payload);
      const res = await apiFetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res && res.ok) {
        const saved = await res.json();
        console.log("LOG-5 Firestore respondió OK", saved);
        setBudgets(prev => [...prev, saved]);
        setNewSubaccount("");
        setTypedSubaccount("");
        setNewAmount(0);
        setNewAmountStr("");
        setAddFormOpen(false);
        console.log("LOG-6 estado actualizado");
        alert("✅ Partida guardada con éxito.");
      } else if (res) {
        const errData = await res.json().catch(() => ({}));
        console.log("LOG-Error response from server", res.status, errData);
        alert("❌ Error del servidor (" + res.status + "): " + (errData.error || "Problema interno"));
      }
    } catch (err: any) {
      console.error("LOG-Catch block error handleAddBudget:", err);
      alert("⚠️ NO SE PUDO GUARDAR: " + (err.message || "Error de red"));
    } finally {
      setIsSaving(false);
    }
  };

  // Synchronized plan update wrappers for custom dropdowns
  const handleAddCategory = async (label: string) => {
    const accounts = getUnifiedAccounts();
    const newAcc: Account = { id: label, label: label, subaccounts: [] };
    saveUnifiedAccounts([...accounts, newAcc]);
    setNewCategory(label);
    await pushMasterPlanToServer(apiFetch, getUnifiedPlan()).catch(err => console.error(err));
  };

  const handleEditCategory = async (id: string, label: string) => {
    const accounts = getUnifiedAccounts();
    saveUnifiedAccounts(accounts.map(a => a.id === id ? { ...a, label } : a));
    await pushMasterPlanToServer(apiFetch, getUnifiedPlan()).catch(err => console.error(err));
  };

  const handleDeleteCategory = async (id: string) => {
    const accounts = getUnifiedAccounts();
    saveUnifiedAccounts(accounts.filter(a => a.id !== id));
    await pushMasterPlanToServer(apiFetch, getUnifiedPlan()).catch(err => console.error(err));
  };

  const handleAddSub = async (cat: string, label: string) => {
    const subs = getUnifiedSubaccounts(cat);
    const newSub = { id: label, label: label };
    saveUnifiedSubaccounts(cat, [...subs, newSub]);
    setNewSubaccount(label);
    await pushMasterPlanToServer(apiFetch, getUnifiedPlan()).catch(err => console.error(err));
  };

  const handleEditSub = async (cat: string, id: string, label: string) => {
    const subs = getUnifiedSubaccounts(cat);
    saveUnifiedSubaccounts(cat, subs.map(s => s.id === id ? { ...s, label } : s));
    await pushMasterPlanToServer(apiFetch, getUnifiedPlan()).catch(err => console.error(err));
  };

  const handleDeleteSub = async (cat: string, id: string) => {
    const subs = getUnifiedSubaccounts(cat);
    saveUnifiedSubaccounts(cat, subs.filter(s => s.id !== id));
    await pushMasterPlanToServer(apiFetch, getUnifiedPlan()).catch(err => console.error(err));
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAll();
    setIsRefreshing(false);
  };

  // Delete budget row selection
  const handleDeleteBudget = (id: string) => {
    setDeleteConfirmationId(id);
  };

  // Perform secure delete budget
  const executeDeleteBudget = async (id: string) => {
    try {
      const res = await apiFetch(`/api/budgets/${id}`, { method: "DELETE" });
      if (res.ok) {
        setBudgets(prev => prev.filter(b => b.id !== id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteConfirmationId(null);
    }
  };

  // Copy month
  const handleCopyMonth = () => {
    if (copyFromMonth === selectedMonth) {
      alert("El período de origen debe ser distinto al actual.");
      return;
    }
    setCopyConfirmationOpen(true);
  };

  // Perform secure copy month
  const executeCopyMonth = async () => {
    try {
      const res = await apiFetch("/api/budgets/copiar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromMonth: copyFromMonth, toMonth: selectedMonth })
      });
      if (res.ok) {
        alert("Estructura presupuestaria duplicada con éxito!");
        loadAll();
      } else {
        const err = await res.json();
        alert("Error al copiar: " + (err.error || "No se encontraron elementos de origen"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCopyConfirmationOpen(false);
    }
  };

  const executeClearMonth = async () => {
    setIsClearing(true);
    try {
      const res = await apiFetch(`/api/budgets/clear/${encodeURIComponent(selectedMonth)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        alert(`Se han eliminado con éxito todas las partidas presupuestarias de ${selectedMonth}.`);
        loadAll();
      } else {
        const err = await res.json();
        alert("Error al vaciar presupuesto: " + (err.error || "Ocurrió un error"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsClearing(false);
      setClearConfirmationOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-xs text-slate-500 font-mono">Consolidando estructura de costos fijos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {error && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-800 font-medium">{error}</p>
        </div>
      )}
      
      {/* 1. Header Selectors */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-indigo-600" />
            Gestión de Costos Fijos y Presupuestos
          </h2>
          <p className="text-[10px] text-slate-400 tracking-wider font-mono">
            PLANIFICACIÓN PERIODICA Y SEGUIMIENTO DE OBLIGACIONES ECONÓMICAS
          </p>
          
          <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100 mt-2 w-fit gap-1 flex-wrap">
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                viewMode === "list" 
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
                : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode("matrix")}
              className={`px-4 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                viewMode === "matrix" 
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
                : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Gantt / Matriz
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-4 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                viewMode === "timeline" 
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
                : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Línea de Tiempo (Desvíos)
            </button>
            
            {viewMode !== "timeline" && (
              <>
                <div className="h-4 w-px bg-slate-200 self-center mx-1" />
                {(["Todos", "Pagados", "Pendientes"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterState(f)}
                    className={`px-4 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                      filterState === f 
                      ? "bg-indigo-600 text-white shadow-sm border border-indigo-700" 
                      : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {f}
                  </button>
                ))}

                {viewMode === "list" && (
                  <>
                    <div className="h-4 w-px bg-slate-200 self-center mx-2" />
                    <button
                      type="button"
                      onClick={() => setGroupSubaccounts(false)}
                      className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                        !groupSubaccounts 
                        ? "bg-slate-800 text-white shadow-sm border border-slate-900" 
                        : "text-slate-400 hover:text-slate-600"
                      }`}
                      title="Ver cuentas + subcuentas desagregadas"
                    >
                      Vista Plana
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGroupSubaccounts(true);
                        // Expand all by default when enabling
                        const initialExpanded: Record<string, boolean> = {};
                        filteredExecution.forEach(b => {
                          initialExpanded[b.category] = true;
                        });
                        setExpandedCategories(initialExpanded);
                      }}
                      className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                        groupSubaccounts 
                        ? "bg-slate-800 text-white shadow-sm border border-slate-900" 
                        : "text-slate-400 hover:text-slate-600"
                      }`}
                      title="Ver subcuentas agrupadas por cuenta (Colapsable)"
                    >
                      Vista Agrupada
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all ${isRefreshing ? "animate-spin" : ""}`}
            title="Sincronizar Datos"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <div className="h-6 w-px bg-slate-100 hidden md:block" />
          <span className="text-[11px] font-black uppercase text-slate-500 font-mono">Período:</span>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="p-1 px-3 border border-slate-200 bg-slate-50 font-black tracking-wider text-slate-800 text-[11px] rounded-lg tracking-wider focus:ring-2 focus:ring-indigo-500/20 outline-none"
          >
            {monthOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          
          <button
            onClick={handlePrint}
            className="p-2 px-4 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all flex items-center gap-2"
            title="Imprimir vista actual"
          >
            <Printer className="w-4 h-4" />
            <span className="text-[11px] font-black uppercase tracking-wider">Imprimir</span>
          </button>

          <button
            onClick={() => setAddFormOpen(!addFormOpen)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Presupuestar Fijo
          </button>
        </div>
      </div>

      {/* 2. Presupuestar Fijo Form */}
      {addFormOpen && (
        <form onSubmit={handleAddBudget} className="bg-indigo-50/20 border border-indigo-100 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-4 border-b border-indigo-100/50 pb-2 mb-1 flex justify-between items-center">
            <h4 className="text-[11px] font-black uppercase text-indigo-900 tracking-wider">Agregar Partida Presupuestaria ({selectedMonth})</h4>
            <button type="button" onClick={() => setAddFormOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs">Cerrar</button>
          </div>

          <div className="space-y-1">
            <label className="block text-[9px] uppercase font-black text-indigo-950">Categoría (Cuenta Madre)</label>
            <CustomDropdown
                value={newCategory}
                onChange={(val) => {
                  setNewCategory(val);
                  setNewSubaccount("");
                }}
                options={getUnifiedAccounts()}
                placeholder="Selecciona Categoría..."
                searchable
                onSearchChange={setTypedCategory}
                onAdd={handleAddCategory}
                onEdit={handleEditCategory}
                onDelete={handleDeleteCategory}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-[9px] uppercase font-black text-indigo-950">Concepto / Partida Fija (Subcuenta)</label>
            {(() => {
              const opts = getUnifiedSubaccounts(newCategory);
              console.log("AUDIT-SUB-Render of Subaccount Selector in PresupuestoMensual. active category:", newCategory, "options to render:", JSON.stringify(opts), "current value (newSubaccount):", newSubaccount);
              console.log(
                "[DD-3 render subaccount selector]",
                {
                  newCategory,
                  newSubaccount,
                  typedSubaccount,
                  options: getUnifiedSubaccounts(newCategory)
                }
              );
              return (
                <CustomDropdown
                    value={newSubaccount}
                    onChange={(value) => {
                      console.log("[DD-2 onChange]", value);
                      setNewSubaccount(value);
                    }}
                    options={opts}
                    placeholder="Ej: Internet Fibra Movistar, Abono Electricidad Edesur"
                    searchable
                    onSearchChange={setTypedSubaccount}
                    onAdd={(label) => handleAddSub(newCategory, label)}
                    onEdit={(id, label) => handleEditSub(newCategory, id, label)}
                    onDelete={(id) => handleDeleteSub(newCategory, id)}
                />
              );
            })()}
          </div>

          <div className="space-y-1">
            <label className="block text-[9px] uppercase font-black text-indigo-950">Vencimiento / Pago Est.</label>
            <input
              type="date"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white text-slate-800"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[9px] uppercase font-black text-indigo-950">Importe Límite / Estimado ($ ARS)</label>
            <input
              type="text"
              required
              placeholder="0"
              value={newAmountStr}
              onChange={e => {
                const formatted = formatAmountInput(e.target.value);
                setNewAmountStr(formatted);
                const raw = parseInt(e.target.value.replace(/\D/g, "")) || 0;
                setNewAmount(raw);
              }}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white text-slate-800"
            />
          </div>

          <div className="md:col-span-4 text-right pt-2 border-t border-indigo-100/30 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddFormOpen(false)}
              className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all ${
                isSaving 
                ? "bg-slate-300 text-slate-500 cursor-not-allowed" 
                : "bg-indigo-700 text-white hover:bg-indigo-800 active:scale-95"
              }`}
            >
              {isSaving ? "Salvando..." : "Salvar Partida Fija"}
            </button>
          </div>
        </form>
      )}

      {/* 3. Herramientas de Planificación Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Copiar Estructura */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-200 text-slate-700 rounded-lg">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-800">Duplicar presupuesto de otro mes</h4>
              <p className="text-[10px] text-slate-500 font-mono">Copia partidas, cuentas y montos sin duplicar pagos ni ejecuciones.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">De:</span>
            <select
              value={copyFromMonth}
              onChange={e => setCopyFromMonth(e.target.value)}
              className="p-1 px-2 border border-slate-200 bg-white rounded-lg text-[10.5px] font-medium"
            >
              {monthOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCopyMonth}
              className="px-3 py-1 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-[10.5px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
            >
              Copiar
            </button>
          </div>
        </div>

        {/* Limpiar Estructura */}
        <div className="bg-rose-50/35 border border-rose-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-rose-950">Vaciar presupuesto actual</h4>
              <p className="text-[10px] text-rose-600/70 font-mono">Elimina permanentemente partidas de {selectedMonth} para empezar de cero.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setClearConfirmationOpen(true)}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10.5px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap shadow-xs transition-all shrink-0"
          >
            Vaciar {selectedMonth}
          </button>
        </div>
      </div>

      {/* 4. Statistics Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-3xs flex justify-between items-center">
          <div>
            <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 font-mono">Plan Total Presupuestado</span>
            <span className="block text-xl font-bold font-mono text-slate-900">${totalBudgeted.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-indigo-50 p-3 rounded-xl text-indigo-700">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-3xs flex justify-between items-center">
          <div>
            <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 font-mono">Real Egresado (Total)</span>
            <span className="block text-xl font-bold font-mono text-emerald-700">${totalRealEgresadoCompleto.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            <span className="block text-[8.5px] text-slate-400 font-medium font-mono leading-none mt-1">
              ${totalPaidReal.toLocaleString("es-ES")} plan. + ${totalUnbudgeted.toLocaleString("es-ES")} extra
            </span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl text-emerald-700">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-3xs flex justify-between items-center">
          <div>
            <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 font-mono">Egresos No Presupuestados</span>
            <span className="block text-xl font-bold font-mono text-amber-600">${totalUnbudgeted.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            <span className="block text-[8.5px] text-slate-400 font-medium font-mono leading-none mt-1">
              Desvíos fuera de plan
            </span>
          </div>
          <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-3xs flex justify-between items-center">
          <div>
            <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 font-mono font-mono">Saldo Pendiente Obligado</span>
            <span className="block text-xl font-bold font-mono text-rose-700">${totalPending.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            <span className="block text-[8.5px] text-slate-400 font-medium font-mono leading-none mt-1">
              Por pagar
            </span>
          </div>
          <div className="bg-rose-50 p-3 rounded-xl text-rose-700">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 5. Main Budget Planner Table or Matrix */}
      <div id="presupuesto-print-section">
        {viewMode === "list" ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-3xs p-6 space-y-4">
        <div>
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Planificación Ejecutada y Desvíos de {selectedMonth}</h3>
          <p className="text-[10px] text-slate-400 font-mono uppercase">Comparativa de estimaciones contra outlays consolidados de caja diario</p>
        </div>

        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-200 uppercase tracking-wider text-[9px] font-black">
                <th className="p-3 pl-4">Categoría Principal (Cuenta)</th>
                <th className="p-3">Concepto/Detalle (Subcuenta)</th>
                <th className="p-3 text-center">Vencimiento</th>
                <th className="p-3 text-right">Límite Estimado ($)</th>
                <th className="p-3 text-right">Outlays Reales Libres ($)</th>
                <th className="p-3 text-right">Delta / Desvío ($)</th>
                <th className="p-3 text-center">Estado del Obligado</th>
                <th className="p-3 text-center pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(() => {
                const getStatusStyle = (state: string) => {
                  if (state === "Pagado") return "bg-emerald-100/50 text-emerald-800 border-emerald-300";
                  if (state === "Parcialmente Pagado") return "bg-amber-100/50 text-amber-800 border-amber-300";
                  return "bg-rose-100 text-rose-800 border-rose-300 animate-pulse font-black";
                };

                if (groupSubaccounts) {
                  if (groupedExecution.length === 0) {
                    return (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 text-xs font-mono uppercase">
                          No hay partidas presupuestarias creadas para {selectedMonth}.
                        </td>
                      </tr>
                    );
                  }

                  return groupedExecution.map((g) => {
                    const isExpanded = expandedCategories[g.category] !== false;

                    return (
                      <React.Fragment key={"group_" + g.category}>
                        {/* Parent Group Row */}
                        <tr className="bg-slate-50/80 hover:bg-slate-100/80 transition-colors border-b border-slate-200/50">
                          <td 
                            onClick={() => setExpandedCategories({
                              ...expandedCategories,
                              [g.category]: !isExpanded
                            })}
                            className="p-3 pl-4 font-black text-slate-900 border-r border-slate-100/50 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                              )}
                              <span>{getAccountLabel(g.category)}</span>
                              <span className="text-[9px] bg-slate-200 text-slate-600 font-black px-1.5 py-0.5 rounded-full font-mono">
                                {g.subaccounts.length} sub.
                              </span>
                            </div>
                          </td>
                          <td 
                            onClick={() => setExpandedCategories({
                              ...expandedCategories,
                              [g.category]: !isExpanded
                            })}
                            className="p-3 text-slate-400 font-mono text-[9.5px] uppercase font-bold border-r border-slate-100/50 cursor-pointer select-none"
                          >
                            Todas las subcuentas
                          </td>
                          <td className="p-3 text-center font-mono text-[10px] text-slate-400 border-r border-slate-100/50">-</td>
                          <td className="p-3 text-right font-mono font-black text-slate-900">
                            ${g.totalAmount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-emerald-800 border-r border-slate-100/50">
                            ${g.totalRealPaid.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-right font-mono font-black space-x-1 border-r border-slate-100/50">
                            <span className={g.totalDeviation >= 0 ? "text-emerald-700" : "text-rose-700"}>
                              {g.totalDeviation >= 0 ? "+" : ""}${g.totalDeviation.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="p-3 text-center border-r border-slate-100/50">
                            <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-wider state-label ${getStatusStyle(g.state)} whitespace-nowrap`}>
                              {g.state}
                            </span>
                          </td>
                          <td className="p-3 text-center pr-4">
                            <button
                              type="button"
                              onClick={() => setExpandedCategories({
                                ...expandedCategories,
                                [g.category]: !isExpanded
                              })}
                              className="px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-colors font-bold text-[9px] uppercase tracking-wider cursor-pointer"
                            >
                              {isExpanded ? "Cerrar" : "Desplegar"}
                            </button>
                          </td>
                        </tr>

                        {/* Child Rows (Subaccounts) */}
                        {isExpanded && g.subaccounts.map((b) => {
                          const isPaid = b.state === "Pagado";
                          const isPartial = b.state === "Parcialmente Pagado";

                          return (
                            <tr key={b.id} className={`hover:bg-indigo-500/[0.02] transition-colors ${
                              isPaid 
                              ? "state-pagado bg-emerald-50/10 text-emerald-900/60" 
                              : isPartial
                              ? "bg-amber-50/5 text-amber-900"
                              : "state-pendiente bg-rose-50/10 text-rose-900"
                            }`}>
                              <td className="p-3 pl-8 font-semibold border-r border-slate-100/50 text-slate-400">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-300 font-mono select-none">└─</span>
                                  <span className="text-[10px] uppercase tracking-wider font-bold">{getAccountLabel(b.category)}</span>
                                </div>
                              </td>
                              <td className={`p-3 font-semibold border-r border-slate-100/50 ${isPaid ? "text-slate-400 font-normal" : "text-slate-800"}`}>
                                {getSubaccountLabel(b.category, b.subaccount)}
                              </td>
                              <td className="p-3 text-center font-mono text-[10px] text-slate-500 border-r border-slate-100/50">
                                {editId === b.id && editValue?.type === 'dueDate' ? (
                                  <input 
                                    type="date"
                                    value={editValue.val}
                                    onChange={(e) => setEditValue({ ...editValue, val: e.target.value })}
                                    onBlur={() => handleUpdateBudget(b.id, { dueDate: editValue.val })}
                                    autoFocus
                                    className="p-1 border border-indigo-200 rounded bg-white text-[10px] w-24"
                                  />
                                ) : (
                                  <span 
                                    onClick={() => {
                                      setEditId(b.id);
                                      setEditValue({ type: 'dueDate', val: b.dueDate || "" });
                                    }}
                                    className="cursor-pointer hover:bg-slate-100 px-1 rounded transition-colors"
                                    title="Click para editar fecha"
                                  >
                                    {formatDateSafe(b.dueDate)}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-800">
                                {editId === b.id && editValue?.type === 'amount' ? (
                                  <input 
                                    type="text"
                                    value={editValue.display}
                                    onChange={(e) => {
                                      const formatted = formatAmountInput(e.target.value);
                                      const raw = parseInt(e.target.value.replace(/\D/g, "")) || 0;
                                      setEditValue({ ...editValue, display: formatted, val: raw });
                                    }}
                                    onBlur={() => handleUpdateBudget(b.id, { amount: editValue.val })}
                                    autoFocus
                                    className="p-1 border border-indigo-200 rounded bg-white text-[11px] text-right w-24 font-mono font-bold"
                                  />
                                ) : (
                                  <span 
                                    onClick={() => {
                                      setEditId(b.id);
                                      setEditValue({ type: 'amount', display: b.amount.toLocaleString("es-ES"), val: b.amount });
                                    }}
                                    className="cursor-pointer hover:bg-slate-100 px-1 rounded transition-colors"
                                  >
                                    ${b.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono font-black border-r border-slate-100/50">
                                {b.realPaid > 0 ? (
                                  <button
                                    onClick={() => handleOpenAudit(b)}
                                    className="w-full text-right text-emerald-700 hover:text-indigo-600 hover:underline cursor-pointer flex items-center justify-end gap-1.5 focus:outline-none transition-all group"
                                    title="Click para auditar detalle de pagos"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                    <span>${b.realPaid.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-400 font-normal">${b.realPaid.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono font-bold space-x-1 border-r border-slate-100/50">
                                <span className={b.deviation >= 0 ? (isPaid ? "text-emerald-600/40" : "text-emerald-700") : "text-rose-700 font-black"}>
                                  {b.deviation >= 0 ? "+" : ""}${b.deviation.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                                </span>
                              </td>
                              <td className="p-3 text-center border-r border-slate-100/50">
                                <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-wider state-label ${getStatusStyle(b.state)} whitespace-nowrap`}>
                                  {b.state}
                                </span>
                              </td>
                              <td className="p-3 text-center pr-4">
                                <button
                                  onClick={() => handleDeleteBudget(b.id)}
                                  className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded transition mx-auto block cursor-pointer"
                                  title="Eliminar partida presupuestaria"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  });
                } else {
                  // Original flat view
                  if (filteredExecution.length === 0) {
                    return (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 text-xs font-mono uppercase">
                          {filterState === "Todos" 
                            ? `No hay partidas presupuestarias creadas para ${selectedMonth}.`
                            : `No hay partidas con estado "${filterState}" para este período.`
                          }
                        </td>
                      </tr>
                    );
                  }

                  return filteredExecution.map((b) => {
                    const isPaid = b.state === "Pagado";
                    const isPartial = b.state === "Parcialmente Pagado";

                    return (
                      <tr key={b.id} className={`hover:bg-slate-50/50 transition-colors ${
                        isPaid 
                        ? "state-pagado bg-emerald-50/20 text-emerald-900/60" 
                        : isPartial
                        ? "bg-amber-50/10 text-amber-900"
                        : "state-pendiente bg-rose-50/20 text-rose-900"
                      }`}>
                        <td className={`p-3 pl-4 font-bold border-r border-slate-100/50 ${isPaid ? "text-slate-400" : "text-slate-900"}`}>{getAccountLabel(b.category)}</td>
                        <td className={`p-3 font-semibold border-r border-slate-100/50 ${isPaid ? "text-slate-400 font-normal" : "text-slate-800"}`}>{getSubaccountLabel(b.category, b.subaccount)}</td>
                        <td className="p-3 text-center font-mono text-[10px] text-slate-500 border-r border-slate-100/50">
                          {editId === b.id && editValue?.type === 'dueDate' ? (
                            <input 
                              type="date"
                              value={editValue.val}
                              onChange={(e) => setEditValue({ ...editValue, val: e.target.value })}
                              onBlur={() => handleUpdateBudget(b.id, { dueDate: editValue.val })}
                              autoFocus
                              className="p-1 border border-indigo-200 rounded bg-white text-[10px] w-24"
                            />
                          ) : (
                            <span 
                              onClick={() => {
                                setEditId(b.id);
                                setEditValue({ type: 'dueDate', val: b.dueDate || "" });
                              }}
                              className="cursor-pointer hover:bg-slate-100 px-1 rounded transition-colors"
                              title="Click para editar fecha"
                            >
                              {formatDateSafe(b.dueDate)}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800">
                          {editId === b.id && editValue?.type === 'amount' ? (
                            <input 
                              type="text"
                              value={editValue.display}
                              onChange={(e) => {
                                const formatted = formatAmountInput(e.target.value);
                                const raw = parseInt(e.target.value.replace(/\D/g, "")) || 0;
                                setEditValue({ ...editValue, display: formatted, val: raw });
                              }}
                              onBlur={() => handleUpdateBudget(b.id, { amount: editValue.val })}
                              autoFocus
                              className="p-1 border border-indigo-200 rounded bg-white text-[11px] text-right w-24 font-mono font-bold"
                            />
                          ) : (
                            <span 
                              onClick={() => {
                                setEditId(b.id);
                                setEditValue({ type: 'amount', display: b.amount.toLocaleString("es-ES"), val: b.amount });
                              }}
                              className="cursor-pointer hover:bg-slate-100 px-1 rounded transition-colors"
                            >
                              ${b.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-black border-r border-slate-100/50">
                          {b.realPaid > 0 ? (
                            <button
                              onClick={() => handleOpenAudit(b)}
                              className="w-full text-right text-emerald-700 hover:text-indigo-600 hover:underline cursor-pointer flex items-center justify-end gap-1.5 focus:outline-none transition-all group"
                              title="Click para auditar detalle de pagos"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                              <span>${b.realPaid.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 font-normal">${b.realPaid.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold space-x-1 border-r border-slate-100/50">
                          <span className={b.deviation >= 0 ? (isPaid ? "text-emerald-600/40" : "text-emerald-700") : "text-rose-700 font-black"}>
                            {b.deviation >= 0 ? "+" : ""}${b.deviation.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="p-3 text-center border-r border-slate-100/50">
                          <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-wider state-label ${getStatusStyle(b.state)} whitespace-nowrap`}>
                            {b.state}
                          </span>
                        </td>
                        <td className="p-3 text-center pr-4">
                          <button
                            onClick={() => handleDeleteBudget(b.id)}
                            className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded transition mx-auto block cursor-pointer"
                            title="Eliminar partida presupuestaria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  });
                }
              })()}
            </tbody>
          </table>
        </div>

        {/* Unbudgeted Expenses Section */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-xs font-black uppercase text-amber-700 dark:text-amber-500 tracking-wider flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-650" />
                Egresos No Presupuestados (Desvíos Adicionales de {selectedMonth})
              </h3>
              <p className="text-[10px] text-slate-400 font-mono uppercase">Gastos liquidados en caja o registros de gestión que no tienen partida asignada (Excluye compras de mercadería)</p>
            </div>
            <span className="text-[10px] font-black font-mono bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 px-2.5 py-1 rounded-full whitespace-nowrap">
              TOTAL EXTRA: ${totalUnbudgeted.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="border border-slate-100 rounded-xl overflow-hidden bg-amber-500/[0.02]">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-amber-700 text-white uppercase tracking-wider text-[9px] font-black">
                  <th className="p-3 pl-4">Categoría Principal (Cuenta)</th>
                  <th className="p-3">Concepto/Detalle (Subcuenta)</th>
                  <th className="p-3 text-center">Registros</th>
                  <th className="p-3 text-right">Límite Estimado ($)</th>
                  <th className="p-3 text-right">Outlays Reales No Planificados ($)</th>
                  <th className="p-3 text-right">Delta / Desvío ($)</th>
                  <th className="p-3 text-center">Estado del Obligado</th>
                  <th className="p-3 text-center pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {unbudgetedExpenses.map((e) => {
                  const mockBudgetForAudit = {
                    id: `unbudg_${e.account}_${e.subaccount}`,
                    category: e.account,
                    subaccount: e.subaccount,
                    amount: 0,
                    realPaid: e.spent,
                    deviation: -e.spent,
                    state: "No Presupuestado"
                  };

                  return (
                    <tr key={e.account + "||" + e.subaccount} className="bg-amber-500/[0.01] hover:bg-amber-500/[0.03] text-slate-800 transition-colors">
                      <td className="p-3 pl-4 font-bold border-r border-slate-100 text-slate-900">{e.account}</td>
                      <td className="p-3 font-semibold border-r border-slate-100 text-slate-800">{e.subaccount}</td>
                      <td className="p-3 text-center font-mono text-[10px] text-slate-500 border-r border-slate-100">
                        {e.items.length} mov.
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-400 border-r border-slate-100">$0,00</td>
                      <td className="p-3 text-right font-mono font-black text-rose-700 border-r border-slate-100">
                        ${e.spent.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono font-bold border-r border-slate-100">
                        <span className="text-rose-700 font-black">
                          -${e.spent.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-3 text-center border-r border-slate-100">
                        <span className="px-2 py-0.5 border border-rose-300 bg-rose-50 text-rose-700 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                          No Planificado
                        </span>
                      </td>
                      <td className="p-3 text-center pr-4">
                        <button
                          type="button"
                          onClick={() => setAuditItem({ budget: mockBudgetForAudit, payments: e.items })}
                          className="px-2 py-0.5 text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-300 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider cursor-pointer"
                          title="Auditar Movimientos"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Auditar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {unbudgetedExpenses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-xs font-mono uppercase bg-white">
                      No se detectaron egresos no presupuestados para {selectedMonth}. ¡Excelente control!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ) : viewMode === "matrix" ? (
      /* 6. Matrix / Gantt View Implementation */
      <div className="bg-white rounded-2xl border border-slate-100 shadow-3xs p-6 space-y-4">
        <div>
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Cronograma de Pagos y Distribución Salarial</h3>
          <p className="text-[10px] text-slate-400 font-mono uppercase">Vista matricial de compromisos financieros por fecha de vencimiento</p>
        </div>

        <div className="border border-slate-100 rounded-xl overflow-x-auto overflow-y-auto max-h-[600px]">
          {(() => {
            // 1. Get unique sorted dates
            const uniqueDates = Array.from<string>(new Set(filteredExecution.map(b => (b.dueDate || "S/F") as string))).sort((a: string, b: string) => {
              if (a === "S/F") return 1;
              if (b === "S/F") return -1;
              return a.localeCompare(b);
            });
            
            // 2. Group data by Account + Subaccount
            const rows: Record<string, { label: string, sub: string, amounts: Record<string, number>, total: number, state: string }> = {};
            
            filteredExecution.forEach(b => {
              const key = `${b.category}-${b.subaccount}`;
              if (!rows[key]) {
                rows[key] = {
                  label: getAccountLabel(b.category),
                  sub: getSubaccountLabel(b.category, b.subaccount),
                  amounts: {},
                  total: 0,
                  state: b.state
                };
              }
              const dateKey = (b.dueDate || "S/F") as string;
              rows[key].amounts[dateKey] = (rows[key].amounts[dateKey] || 0) + b.amount;
              rows[key].total += b.amount;
              // If any underlying budget is pending, the row should probably show as pending?
              // But here filteredExecution already has the state.
            });

            // 3. Column (date) sums
            const colSums: Record<string, number> = {};
            uniqueDates.forEach(d => {
              colSums[d] = Object.values(rows).reduce((sum, r) => sum + (r.amounts[d] || 0), 0);
            });
            const grandTotal = Object.values(colSums).reduce((a, b) => a + b, 0);

            const sortedRows = Object.values(rows).sort((a, b) => {
              if (a.label !== b.label) return a.label.localeCompare(b.label);
              return a.sub.localeCompare(b.sub);
            });

            return (
              <table className="w-full text-left text-[11px] border-collapse relative">
                <thead className="sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  <tr className="bg-slate-900 text-slate-200 uppercase tracking-wider text-[9px] font-black">
                    <th className="p-3 pl-4 sticky left-0 bg-slate-900 border-r border-slate-700 min-w-[200px]">Cuenta / Subcuenta</th>
                    {uniqueDates.map((date, idx) => (
                      <th key={idx} className="p-3 text-center border-r border-slate-700 min-w-[100px]">
                        {formatDateSafe(date)}
                      </th>
                    ))}
                    <th className="p-3 text-right pr-4 bg-indigo-900 min-w-[120px]">Sub-total Fila</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium bg-white">
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={uniqueDates.length + 2} className="p-10 text-center text-slate-400 font-mono italic uppercase text-[10px] tracking-widest">
                        No hay vencimientos programados para este período
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((row, rIdx) => {
                      const isPaid = row.state === "Pagado";
                      return (
                        <tr key={rIdx} className={`hover:bg-slate-50 transition-colors group ${isPaid ? "state-pagado text-emerald-800/60" : "state-pendiente text-rose-800"}`}>
                          <td className={`p-3 pl-4 sticky left-0 z-10 border-r border-slate-100 group-hover:bg-slate-50 shadow-[2px_0_4px_rgba(0,0,0,0.02)] ${isPaid ? "bg-emerald-50/10 text-slate-400" : "bg-white text-slate-800"}`}>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold leading-tight">{row.label}</span>
                              <span className={`text-[9px] font-semibold italic font-mono uppercase truncate max-w-[180px] ${isPaid ? "text-slate-300" : "text-slate-400"}`} title={row.sub}>
                                {row.sub}
                              </span>
                            </div>
                          </td>
                          {uniqueDates.map((date, dIdx) => (
                            <td key={dIdx} className={`p-3 text-center border-r border-slate-50 font-mono ${isPaid ? "text-emerald-600/30" : ""}`}>
                              {row.amounts[date] ? (
                                <span className="text-[11px] font-black">
                                  ${row.amounts[date].toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-slate-200 text-[10px] opacity-30 select-none">•</span>
                              )}
                            </td>
                          ))}
                          <td className={`p-3 text-right pr-4 font-black ${isPaid ? "text-emerald-600/40 bg-emerald-50/20" : "text-indigo-600 bg-indigo-50/20"}`}>
                            ${row.total.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {sortedRows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-black text-[10px]">
                      <td className="p-4 sticky left-0 bg-slate-50 z-10 border-r border-slate-200 text-slate-900 uppercase tracking-widest">
                        Sub-totales Columna
                      </td>
                      {uniqueDates.map((date, idx) => (
                        <td key={idx} className="p-4 text-center border-r border-slate-200 text-slate-900 font-mono">
                          ${colSums[date].toLocaleString()}
                        </td>
                      ))}
                      <td className="p-4 text-right pr-4 font-black text-lg text-emerald-700 bg-emerald-50 font-mono">
                        ${grandTotal.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            );
          })()}
        </div>
      </div>
    ) : (
      /* 7. Timeline / Deviation View Implementation */
      <div className="bg-white rounded-2xl border border-slate-100 shadow-3xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Línea de Tiempo de Desvíos Presupuestarios</h3>
            <p className="text-[10px] text-slate-400 font-mono uppercase">Evolución mensual del presupuesto versus gastos reales y ahorros generados</p>
          </div>
          <div className="text-[9px] text-slate-500 font-mono bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 flex items-center gap-4 select-none">
            <span className="flex items-center gap-1.5 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block"></span> Exceso (Gastado &gt; Ppto)
            </span>
            <span className="flex items-center gap-1.5 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span> Ahorro (Gastado &lt; Ppto)
            </span>
          </div>
        </div>

        {/* Timeline Container */}
        <div className="overflow-x-auto pb-6 pt-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 scrollbar-track-transparent">
          <div className="min-w-[1900px] h-[420px] relative flex items-center px-8">
            {/* The Horizontal Baseline */}
            <div className="absolute left-0 right-0 h-1 bg-slate-200 dark:bg-slate-800 rounded-full"></div>

            {/* Render months along the line */}
            <div className="w-full flex justify-between relative z-10">
              {timelineData.map((m, idx) => {
                const isSelected = selectedMonth === m.monthStr;
                const hasData = m.budgeted > 0 || m.spent > 0;
                
                // Let's compute heights
                // Max absolute deviation in the year
                const maxDeviationVal = Math.max(...timelineData.map(item => Math.abs(item.deviation)), 1);
                
                // Absolute deviation height percentage
                const barHeightPercent = Math.min((Math.abs(m.deviation) / maxDeviationVal) * 110, 110);
                
                // Deviation percentage
                const deviationPercentage = m.budgeted > 0 ? ((m.spent - m.budgeted) / m.budgeted) * 100 : 0;
                
                const isOverspent = m.spent > m.budgeted;
                const isSavings = m.spent < m.budgeted && m.budgeted > 0;
                const isZero = m.spent === m.budgeted && hasData;

                return (
                  <div 
                    key={m.monthStr} 
                    onClick={() => setSelectedMonth(m.monthStr)}
                    className={`flex flex-col items-center w-[150px] cursor-pointer transition-all duration-300 relative ${
                      isSelected ? "scale-105" : "hover:scale-102 opacity-80 hover:opacity-100"
                    }`}
                  >
                    {/* Top half: Spent > Budgeted (Red bar going UP) */}
                    <div className="h-[150px] w-full flex flex-col justify-end items-center pb-1 relative">
                      {isOverspent && (
                        <>
                          {/* Floating Data Card */}
                          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-1.5 rounded-lg shadow-3xs text-center text-[9px] font-black w-28 mb-1 flex flex-col gap-0.5 z-10 animate-fade-in">
                            <span className="text-rose-700 dark:text-rose-400 font-mono">Real: ${m.spent.toLocaleString("es-ES")}</span>
                            <span className="text-rose-800 dark:text-rose-300 bg-rose-100/50 dark:bg-rose-900/30 px-1 py-0.5 rounded-sm font-mono">
                              +{Math.abs(m.deviation).toLocaleString("es-ES")} (+{deviationPercentage.toFixed(0)}%)
                            </span>
                          </div>
                          {/* Red Bar */}
                          <div 
                            style={{ height: `${barHeightPercent}px` }}
                            className="w-4 bg-red-500 rounded-t-lg shadow-sm border border-red-600 transition-all duration-500 ease-out"
                          />
                        </>
                      )}
                    </div>

                    {/* Center area: Period & Budgeted Amount on the same line */}
                    <div className="h-[60px] flex flex-col justify-center items-center relative w-full">
                      {/* Connecting Node on the timeline */}
                      <div className={`w-4 h-4 rounded-full border-4 absolute ${
                        isSelected 
                        ? "bg-indigo-600 border-white dark:border-slate-900 ring-2 ring-indigo-500 scale-125 shadow-md" 
                        : hasData 
                        ? isOverspent 
                          ? "bg-red-500 border-white dark:border-slate-900 shadow-3xs" 
                          : isSavings 
                          ? "bg-emerald-500 border-white dark:border-slate-900 shadow-3xs" 
                          : "bg-indigo-400 border-white dark:border-slate-900 shadow-3xs"
                        : "bg-slate-300 dark:bg-slate-700 border-white dark:border-slate-900"
                      }`} />

                      {/* Inline label: Month + Budgeted */}
                      <div className={`mt-5 text-[10.5px] font-black text-center whitespace-nowrap p-1.5 rounded-lg border tracking-wide transition-all ${
                        isSelected 
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-xs scale-105" 
                        : "bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:border-indigo-400 shadow-3xs"
                      }`}>
                        <span className="block">{m.monthStr}</span>
                        <span className="block text-[9.5px] font-mono opacity-90 mt-0.5">Ppto: ${m.budgeted.toLocaleString("es-ES")}</span>
                      </div>
                    </div>

                    {/* Bottom half: Spent < Budgeted (Green bar going DOWN) */}
                    <div className="h-[150px] w-full flex flex-col justify-start items-center pt-1 relative">
                      {isSavings && (
                        <>
                          {/* Green Bar */}
                          <div 
                            style={{ height: `${barHeightPercent}px` }}
                            className="w-4 bg-emerald-500 rounded-b-lg shadow-sm border border-emerald-600 transition-all duration-500 ease-out"
                          />
                          {/* Floating Data Card */}
                          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-1.5 rounded-lg shadow-3xs text-center text-[9px] font-black w-28 mt-1 flex flex-col gap-0.5 z-10 animate-fade-in">
                            <span className="text-emerald-700 dark:text-emerald-400 font-mono">Real: ${m.spent.toLocaleString("es-ES")}</span>
                            <span className="text-emerald-800 dark:text-emerald-300 bg-emerald-100/50 dark:bg-emerald-900/30 px-1 py-0.5 rounded-sm font-mono">
                              Ahorro: -${Math.abs(m.deviation).toLocaleString("es-ES")} ({Math.abs(deviationPercentage).toFixed(0)}%)
                            </span>
                          </div>
                        </>
                      )}
                      {isZero && (
                        <div className="text-[9px] font-bold text-slate-500 mt-2 italic font-mono bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                          Cuadre Perfecto ($0)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Guidance Notice */}
        <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 p-3.5 rounded-xl flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-indigo-600 flex-shrink-0 animate-pulse" />
          <p className="text-[10.5px] text-indigo-950 dark:text-indigo-250 leading-relaxed font-bold">
            💡 <strong>Interactividad de Navegación</strong>: Haz clic en cualquier período de la línea de tiempo para seleccionarlo de forma activa. El listado operativo y las tarjetas estadísticas de arriba se actualizarán de inmediato para mostrar la planificación ejecutada y el detalle de dicho mes.
          </p>
        </div>
      </div>
    )}
      </div>

      {/* Custom Confirmation Modals for iFrame compatibility */}
      {deleteConfirmationId && (() => {
        const itemToDelete = budgets.find(b => b.id === deleteConfirmationId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150 text-left">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-full shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="text-sm font-black uppercase text-slate-900 tracking-wider">Confirmar Eliminación</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    ¿Estás seguro de que deseas eliminar esta partida presupuestaria del mes de {selectedMonth}? Esta acción es permanente y no se puede deshacer.
                  </p>
                  {itemToDelete && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-[10.5px] text-slate-700 space-y-1">
                      <div><strong className="text-slate-900">Categoría:</strong> {getAccountLabel(itemToDelete.category)}</div>
                      <div><strong className="text-slate-900">Concepto:</strong> {getSubaccountLabel(itemToDelete.category, itemToDelete.subaccount)}</div>
                      <div><strong className="text-slate-900">Monto:</strong> ${itemToDelete.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmationId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => executeDeleteBudget(deleteConfirmationId)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  Sí, Eliminar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {copyConfirmationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full shrink-0">
                <Copy className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-sm font-black uppercase text-slate-900 tracking-wider">Copiar Presupuesto</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  ¿Estás seguro de que deseas copiar todos los elementos presupuestados del período <strong className="text-indigo-950 font-black">{copyFromMonth}</strong> hacia <strong className="text-indigo-950 font-black">{selectedMonth}</strong>?
                </p>
                <p className="text-[10px] text-indigo-600 font-medium">
                  Atención: Se duplicará la estructura completa. Esto facilitará tu planificación del nuevo mes.
                </p>
              </div>
            </div>
            <div class="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCopyConfirmationOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeCopyMonth}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Sí, Duplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {clearConfirmationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-full shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-sm font-black uppercase text-slate-900 tracking-wider">Vaciar Presupuesto</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  ¿Estás seguro de que deseas vaciar permanentemente todo el presupuesto del período <strong className="text-rose-950 font-black">{selectedMonth}</strong>?
                </p>
                <p className="text-[10px] text-rose-600 font-medium">
                  Atención: Se eliminarán todas las partidas presupuestarias fíjadas para este mes. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setClearConfirmationOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={executeClearMonth}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {isClearing ? "Eliminando..." : "Sí, Vaciar Presupuesto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {printPreviewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col h-[90vh] overflow-hidden text-left">
            
            {/* Modal Header Bar */}
            <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex justify-between items-center z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-white tracking-widest leading-none">Vista Previa de Impresión</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase">Revisa el formato antes del envío al periférico físico</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintPreviewOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={executeFinalPrint}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10.5px] font-black uppercase tracking-wider rounded-xl transition-all shadow-lg hover:shadow-indigo-500/10 cursor-pointer flex items-center gap-1.5 font-black"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Confirmar e Imprimir
                </button>
              </div>
            </div>

            {/* Scrollable Document Container */}
            <div className="flex-1 bg-slate-950 p-6 md:p-12 overflow-y-auto">
              <div className="bg-white text-slate-950 rounded-2xl p-8 max-w-4xl mx-auto shadow-2xl border border-slate-100 min-h-[11in]">
                <div 
                  className="printable-preview-content"
                  dangerouslySetInnerHTML={{ __html: getPrintContentHTML() }} 
                />
                
                <div className="mt-16 pt-8 border-t border-slate-100 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Firmado: __________________________</span>
                  <span>Sello de Oficina</span>
                  <span>Página 1 de 1</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Audit Payments Modal */}
      {auditItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
            {/* Header bar */}
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl">
                  <Eye className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-white tracking-widest leading-none">Auditoría de Pagos Realizados</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase">Detalle para el período imputado: <strong className="text-indigo-400">{selectedMonth}</strong></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditItem(null)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content area */}
            <div className="p-6 space-y-6">
              {/* Summary cards */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 font-mono block">Partida Presupuestaria</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{getAccountLabel(auditItem.budget.category)}</span>
                  <span className="text-xs font-mono text-slate-500">{getSubaccountLabel(auditItem.budget.category, auditItem.budget.subaccount)}</span>
                </div>
                <div className="text-right flex flex-col justify-center">
                  <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 font-mono block">Resumen Ejecución</span>
                  <div className="mt-0.5 space-y-1">
                    <p className="text-xs text-slate-600">Estimado: <strong className="font-mono text-slate-900 font-black">${auditItem.budget.amount?.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong></p>
                    <p className="text-xs text-emerald-700">Real Egresado: <strong className="font-mono font-black">${auditItem.budget.realPaid?.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong></p>
                  </div>
                </div>
              </div>

              {/* Payments table list */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Asientos y Movimientos Vinculados ({auditItem.payments.length})</h4>
                
                <div className="border border-slate-150 rounded-2xl overflow-hidden max-h-64 overflow-y-auto shadow-3xs bg-white">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-200 uppercase tracking-wider text-[9px] font-black border-b border-slate-800">
                        <th className="p-3 pl-4">Fecha</th>
                        <th className="p-3">Detalle / Concepto</th>
                        <th className="p-3">Origen del Registro</th>
                        <th className="p-3 text-right pr-4">Haber ($ Egreso)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 font-medium">
                      {auditItem.payments.map((p, idx) => {
                        return (
                          <tr key={p.id || idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 pl-4 font-mono text-[10px] text-slate-500">
                              {formatDateSafe(p.date)}
                            </td>
                            <td className="p-3 text-slate-800">
                              <div>
                                <span className="font-bold text-slate-900">{p.subaccount || "S/D"}</span>
                                {p.account && (
                                  <span className="block text-[9px] text-slate-400 uppercase font-mono font-bold mt-0.5">
                                    Cuenta: {p.account}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-slate-500">
                              <span className="inline-flex items-center px-2.5 py-0.5 text-[9px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full">
                                {p.id?.startsWith("sys_oe_") 
                                  ? "Gasto de Caja" 
                                  : p.id?.startsWith("sys_pers_") 
                                  ? "Pago Sueldo Caja" 
                                  : "Libro de Gestión"}
                              </span>
                            </td>
                            <td className="p-3 text-right pr-4 font-mono font-black text-rose-600">
                              ${(p.haber || p.debe || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}

                      {auditItem.payments.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-400 font-mono italic uppercase">
                            No se encontraron asientos reales vinculados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setAuditItem(null)}
                className="px-5 py-2 bg-slate-900 border border-slate-200 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 hover:border-slate-300 transition-colors shadow-xs cursor-pointer min-h-[44px] flex items-center justify-center font-black"
              >
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

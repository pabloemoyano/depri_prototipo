import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  FileText, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Coins, 
  Calendar, 
  Layers,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Check
} from "lucide-react";
import { CustomDropdown } from "./CustomDropdown";
import { getUnifiedAccounts, getUnifiedSubaccounts, saveUnifiedAccounts, saveUnifiedSubaccounts, Account } from "../lib/accountManager";

interface CajaV2Session {
  id: string;
  dateStr: string;
  isClosed: boolean;
  cancha1: { time: string; customerId: string; customerName: string; amount: number }[];
  cancha2: { time: string; customerId: string; customerName: string; amount: number }[];
  otrosIngresos: { id: string; quantity: number; account: string; description: string; amount: number; periodoImputado?: string }[];
  otrosEgresos: { id: string; quantity: number; account: string; description: string; amount: number; periodoImputado?: string }[];
  personalAccount: string;
  personalDescription: string;
  personalAmount: number;
  personalPeriodoImputado?: string;
  saldoInicial: number;
}

interface ManualLedgerEntry {
  id: string;
  date: string;
  periodoImputado: string; // e.g. "Junio 2026" or ""
  origin: string; // e.g. "Administrador"
  type: "Ingreso" | "Egreso";
  account: string; // Cuenta
  subaccount: string; // Subcuenta
  description: string;
  debe: number;
  haber: number;
  linkedBudgetId?: string;
  isSystem?: boolean;
}

interface LibroGestionProps {
  sales: any[];
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const LibroGestion: React.FC<LibroGestionProps> = ({ sales, apiFetch }) => {
  const [history, setHistory] = useState<CajaV2Session[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [filterPeriod, setFilterPeriod] = useState<string>("TODOS");
  const [filterAccount, setFilterAccount] = useState<string>("TODOS");

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newPeriod, setNewPeriod] = useState("Junio 2026");
  const [newType, setNewType] = useState<"Ingreso" | "Egreso">("Egreso");
  const [newAccount, setNewAccount] = useState("");
  const [newSubaccount, setNewSubaccount] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newOrigin, setNewOrigin] = useState("Administrador");

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch boxes history
      const historyRes = await apiFetch("/api/caja/history");
      if (historyRes.ok) {
        const histData = await historyRes.json();
        if (Array.isArray(histData)) {
          setHistory(histData);
        }
      }

      // 2. Fetch manual ledger items
      const ledgerRes = await apiFetch("/api/ledger-manual");
      if (ledgerRes.ok) {
        const ledData = await ledgerRes.json();
        if (Array.isArray(ledData)) {
          setManualEntries(ledData);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Error cargando los libros de caja.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync / Impute tasks
  const handleAssignPeriodToDailyEntry = async (
    boxId: string, 
    entryType: "otrosIngresos" | "otrosEgresos" | "personal", 
    entryId: string, 
    period: string
  ) => {
    const box = history.find(h => h.id === boxId);
    if (!box) return;

    let updatedBox = { ...box };
    if (entryType === "otrosIngresos") {
      updatedBox.otrosIngresos = box.otrosIngresos.map(e => 
        e.id === entryId ? { ...e, periodoImputado: period } : e
      );
    } else if (entryType === "otrosEgresos") {
      updatedBox.otrosEgresos = box.otrosEgresos.map(e => 
        e.id === entryId ? { ...e, periodoImputado: period } : e
      );
    } else if (entryType === "personal") {
      updatedBox.personalPeriodoImputado = period;
    }

    try {
      const res = await apiFetch("/api/caja/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedBox)
      });
      if (res.ok) {
        // Refresh local state
        setHistory(prev => prev.map(h => h.id === boxId ? updatedBox : h));
      } else {
        alert("Error al imputar período en servidor");
      }
    } catch (e) {
      console.error(e);
      alert("Error de red al imputar período");
    }
  };

  // Impute manual entries
  const handleAssignPeriodToManualEntry = async (entryId: string, period: string) => {
    const item = manualEntries.find(m => m.id === entryId);
    if (!item) return;

    const updatedItem = { ...item, periodoImputado: period };
    try {
      const res = await apiFetch("/api/ledger-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedItem)
      });
      if (res.ok) {
        setManualEntries(prev => prev.map(m => m.id === entryId ? updatedItem : m));
      } else {
        alert("Error al imputar asiento manual");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add manual entry
  const handleAddManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount || !newSubaccount || newAmount <= 0) {
      alert("Por favor completa Cuenta, Subcuenta y un Importe de valor mayor a 0.");
      return;
    }

    const newDoc: Partial<ManualLedgerEntry> = {
      date: newDate,
      periodoImputado: newPeriod,
      origin: newOrigin || "Administrador",
      type: newType,
      account: newAccount,
      subaccount: newSubaccount,
      description: newDescription,
      debe: newType === "Ingreso" ? newAmount : 0,
      haber: newType === "Egreso" ? newAmount : 0,
      isSystem: false
    };

    try {
      const res = await apiFetch("/api/ledger-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDoc)
      });
      if (res.ok) {
        const saved = await res.json();
        setManualEntries(prev => [...prev, saved]);
        setShowAddForm(false);
        // Clear fields
        setNewAccount("");
        setNewSubaccount("");
        setNewDescription("");
        setNewAmount(0);
      } else {
        alert("Error guardando el movimiento.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete manual entry
  const handleDeleteManualEntry = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este movimiento manual del libro?")) return;
    try {
      const res = await apiFetch(`/api/ledger-manual/${id}`, { method: "DELETE" });
      if (res.ok) {
        setManualEntries(prev => prev.filter(m => m.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Compile unified entries list
  const compiledLedger = useMemo(() => {
    let list: ManualLedgerEntry[] = [];
    const masterAccounts = getUnifiedAccounts();

    // 1. Process box history (closed daily boxes)
    history.forEach(box => {
      const boxDate = box.dateStr;
      let imputed = "";
      try {
        const dateObj = new Date(boxDate + "T12:00:00");
        const monthName = dateObj.toLocaleString("es-ES", { month: "long" });
        imputed = monthName[0].toUpperCase() + monthName.substring(1) + " " + dateObj.getFullYear();
      } catch {
        imputed = "";
      }
      
      // Turn courts (Cancha 1 & Cancha 2) totals
      const c1Total = box.cancha1 ? box.cancha1.reduce((sum, s) => sum + (s.amount || 0), 0) : 0;
      const c2Total = box.cancha2 ? box.cancha2.reduce((sum, s) => sum + (s.amount || 0), 0) : 0;

      if (c1Total > 0) {
        list.push({
          id: `sys_c1_box_${box.id}`,
          date: boxDate,
          periodoImputado: imputed,
          origin: `Caja Diaria ${boxDate}`,
          type: "Ingreso",
          account: "Turnos",
          subaccount: "Cancha 1",
          description: "Venta de turnos (Cancha 1)",
          debe: c1Total,
          haber: 0,
          isSystem: true
        });
      }

      if (c2Total > 0) {
        list.push({
          id: `sys_c2_box_${box.id}`,
          date: boxDate,
          periodoImputado: imputed,
          origin: `Caja Diaria ${boxDate}`,
          type: "Ingreso",
          account: "Turnos",
          subaccount: "Cancha 2",
          description: "Venta de turnos (Cancha 2)",
          debe: c2Total,
          haber: 0,
          isSystem: true
        });
      }

      // Buffet totals for that specific Caja box
      let buffetSales = 0;
      try {
        const hIso = boxDate;
        const histSales = sales.filter(sale => {
          if (sale.origin === "consumo_interno") return false;
          if (sale.origin === "mesa" || sale.origin === "sistema_caja") return false;
          const sysLa = ["Cancha 1", "Cancha 2", "Otros Ingresos", "Otros Egresos", "Personal Egreso"];
          if (sysLa.includes(sale.table_number || "")) return false;
          if (sale.caja_session_id && box.id) {
            return sale.caja_session_id === box.id;
          }
          try { 
            return new Date(sale.date).toISOString().split("T")[0] === hIso; 
          } catch { 
            return false; 
          }
        });
        buffetSales = histSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      } catch (e) {
        console.error("Buffet sales compile error in generic ledger:", e);
      }

      if (buffetSales > 0) {
        list.push({
          id: `sys_buffet_box_${box.id}`,
          date: boxDate,
          periodoImputado: imputed,
          origin: `Caja Diaria ${boxDate}`,
          type: "Ingreso",
          account: "Buffet",
          subaccount: "Ventas",
          description: "Recaudación ventas Buffet (Bar)",
          debe: buffetSales,
          haber: 0,
          isSystem: true
        });
      }

      // Personal payment
      if (box.personalAmount > 0) {
        list.push({
          id: `sys_personal_${box.id}`,
          date: boxDate,
          periodoImputado: box.personalPeriodoImputado || imputed,
          origin: `Caja Diaria ${boxDate}`,
          type: "Egreso",
          account: box.personalAccount || "Sueldos",
          subaccount: box.personalDescription || "Encargado",
          description: `Pago Personal: ${box.personalDescription || "Encargado"}`,
          debe: 0,
          haber: box.personalAmount,
          isSystem: true
        });
      }

      // Manual Otros Ingresos
      if (Array.isArray(box.otrosIngresos)) {
        box.otrosIngresos.forEach(item => {
          if (item.amount > 0) {
            const matchedAcc = masterAccounts.find(a => a.id === item.accountId);
            const accountLabel = matchedAcc ? matchedAcc.label : (item.account || "Otros Ingresos");
            const matchedSub = matchedAcc?.subaccounts.find(s => s.id === item.subaccountId);
            const subaccountLabel = matchedSub ? matchedSub.label : (item.suggestedSubaccount || item.description || "Ingreso Extra");

            list.push({
              id: `sys_oi_${item.id}`,
              date: boxDate,
              periodoImputado: item.periodoImputado || imputed,
              origin: `Caja Diaria ${boxDate}`,
              type: "Ingreso",
              account: accountLabel,
              subaccount: subaccountLabel,
              description: `Ingreso Caja: ${item.description || "Manual"}`,
              debe: item.amount * (item.quantity || 1),
              haber: 0,
              isSystem: true
            });
          }
        });
      }

      // Manual Otros Egresos
      if (Array.isArray(box.otrosEgresos)) {
        box.otrosEgresos.forEach(item => {
          if (item.amount > 0) {
            const matchedAcc = masterAccounts.find(a => a.id === item.accountId);
            const accountLabel = matchedAcc ? matchedAcc.label : (item.account || "Otros Egresos");
            const matchedSub = matchedAcc?.subaccounts.find(s => s.id === item.subaccountId);
            const subaccountLabel = matchedSub ? matchedSub.label : (item.suggestedSubaccount || item.description || "Egreso Extra");

            list.push({
              id: `sys_oe_${item.id}`,
              date: boxDate,
              periodoImputado: item.periodoImputado || imputed,
              origin: `Caja Diaria ${boxDate}`,
              type: "Egreso",
              account: accountLabel,
              subaccount: subaccountLabel,
              description: `Gasto Caja: ${item.description || "Manual"}`,
              debe: 0,
              haber: item.amount * (item.quantity || 1),
              isSystem: true
            });
          }
        });
      }
    });

    // 2. Process manual adjustments/entries
    manualEntries.forEach(sub => {
      list.push(sub);
    });

    // Sort chronologically (date ascending) for cumulative calculation
    list.sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      // If dates match, sort systems before manual or by structure
      return a.id.localeCompare(b.id);
    });

    // Calculate moving/cumulative balances
    let currentBalance = 0;
    const finalWithBalances = list.map(item => {
      const itemDebe = Number(item.debe) || 0;
      const itemHaber = Number(item.haber) || 0;
      currentBalance = currentBalance + itemDebe - itemHaber;

      return {
        ...item,
        saldo: currentBalance
      };
    });

    return finalWithBalances;
  }, [history, manualEntries, sales]);

  // Tasks tray: Items pending allocation/imputation
  const pendingImputationItems = useMemo(() => {
    const list: {
      id: string;
      boxId?: string;
      entryId: string;
      entryType: "otrosIngresos" | "otrosEgresos" | "personal" | "manual";
      date: string;
      source: string;
      account: string;
      subaccount: string;
      description: string;
      amount: number;
    }[] = [];

    const masterAccounts = getUnifiedAccounts();

    // From Caja Boxes
    history.forEach(box => {
      const boxDate = box.dateStr;

      // Personal wages: has standard account/subaccount and is auto-imputed from box date.
      // So it is only pending if explicitly asked, but we treat it as auto-complete to keep Tray clean.

      if (Array.isArray(box.otrosIngresos)) {
        box.otrosIngresos.forEach(item => {
          const hasAccountAndSubaccount = item.accountId && item.subaccountId;
          // If it doesn't have an explicit period AND it's missing category, it's pending.
          if (item.amount > 0 && !item.periodoImputado && !hasAccountAndSubaccount) {
            const matchedAcc = masterAccounts.find(a => a.id === item.accountId);
            const accountLabel = matchedAcc ? matchedAcc.label : (item.account || "Otros Ingresos");
            const matchedSub = matchedAcc?.subaccounts.find(s => s.id === item.subaccountId);
            const subaccountLabel = matchedSub ? matchedSub.label : (item.suggestedSubaccount || item.description || "Ingreso Extra");

            list.push({
              id: `caja_oi_${item.id}`,
              boxId: box.id,
              entryId: item.id,
              entryType: "otrosIngresos",
              date: boxDate,
              source: `Caja Diaria ${boxDate}`,
              account: accountLabel,
              subaccount: subaccountLabel,
              description: item.description || "Manual",
              amount: item.amount * (item.quantity || 1)
            });
          }
        });
      }

      if (Array.isArray(box.otrosEgresos)) {
        box.otrosEgresos.forEach(item => {
          const hasAccountAndSubaccount = item.accountId && item.subaccountId;
          // If it doesn't have an explicit period AND it's missing category, it's pending.
          if (item.amount > 0 && !item.periodoImputado && !hasAccountAndSubaccount) {
            const matchedAcc = masterAccounts.find(a => a.id === item.accountId);
            const accountLabel = matchedAcc ? matchedAcc.label : (item.account || "Otros Egresos");
            const matchedSub = matchedAcc?.subaccounts.find(s => s.id === item.subaccountId);
            const subaccountLabel = matchedSub ? matchedSub.label : (item.suggestedSubaccount || item.description || "Egreso Extra");

            list.push({
              id: `caja_oe_${item.id}`,
              boxId: box.id,
              entryId: item.id,
              entryType: "otrosEgresos",
              date: boxDate,
              source: `Caja Diaria ${boxDate}`,
              account: accountLabel,
              subaccount: subaccountLabel,
              description: item.description || "Manual",
              amount: item.amount * (item.quantity || 1)
            });
          }
        });
      }
    });

    // From Manual Entries
    manualEntries.forEach(item => {
      if (!item.periodoImputado) {
        list.push({
          id: `man_${item.id}`,
          entryId: item.id,
          entryType: "manual",
          date: item.date,
          source: "Registro Manual Admin",
          account: item.account,
          subaccount: item.subaccount,
          description: item.description,
          amount: item.debe || item.haber
        });
      }
    });

    return list;
  }, [history, manualEntries]);

  // Unique list of periods & accounts for filter option lists
  const periodsList = useMemo(() => {
    const list = new Set<string>();
    compiledLedger.forEach(item => {
      if (item.periodoImputado) list.add(item.periodoImputado);
    });
    return Array.from(list).sort();
  }, [compiledLedger]);

  const accountsList = useMemo(() => {
    const list = new Set<string>();
    compiledLedger.forEach(item => {
      if (item.account) list.add(item.account);
    });
    return Array.from(list).sort();
  }, [compiledLedger]);

  const filteredLedger = useMemo(() => {
    let items = [...compiledLedger];
    if (filterPeriod !== "TODOS") {
      items = items.filter(i => i.periodoImputado === filterPeriod);
    }
    if (filterAccount !== "TODOS") {
      items = items.filter(i => i.account === filterAccount);
    }
    return items;
  }, [compiledLedger, filterPeriod, filterAccount]);

  // Math totals for filtered selection
  const totalDebe = useMemo(() => filteredLedger.reduce((sum, i) => sum + (Number(i.debe) || 0), 0), [filteredLedger]);
  const totalHaber = useMemo(() => filteredLedger.reduce((sum, i) => sum + (Number(i.haber) || 0), 0), [filteredLedger]);
  const currentNetSol = totalDebe - totalHaber;

  // Single dynamic list of Spanish months for allocations dropdown
  const monthOptions = [
    "Enero 2026", "Febrero 2026", "Marzo 2026", "Abril 2026", "Mayo 2026", "Junio 2026",
    "Julio 2026", "Agosto 2026", "Septiembre 2026", "Octubre 2026", "Noviembre 2026", "Diciembre 2026"
  ];

  if (loading) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-xs text-slate-500 font-mono">Consolidando libro de sumas y saldos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Alertas de Imputacion / Bandeja de Pendientes */}
      {pendingImputationItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-800">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-900">
                Bandeja de Tareas Administrativas
              </h3>
              <p className="text-[11px] text-amber-700 font-medium">
                Hay <strong className="font-bold">{pendingImputationItems.length}</strong> movimientos registrados que no tienen un período económico imputado.
              </p>
            </div>
          </div>

          <div className="border border-amber-200/60 rounded-xl overflow-hidden bg-white max-h-[220px] overflow-y-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-dashed border-slate-100">
                  <th className="p-2.5">Fecha</th>
                  <th className="p-2.5">Origen / Tipo</th>
                  <th className="p-2.5">Cuenta (Subcuenta)</th>
                  <th className="p-2.5">Descripción</th>
                  <th className="p-2.5 text-right">Importe</th>
                  <th className="p-2.5 text-center w-[180px]">Imputar Período</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingImputationItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="p-2.5 font-mono text-slate-500">{item.date}</td>
                    <td className="p-2.5 font-semibold text-slate-700 truncate max-w-[120px]" title={item.source}>
                      {item.source}
                    </td>
                    <td className="p-2.5">
                      <span className="font-bold text-slate-800">{item.account}</span>
                      <span className="block text-[9px] text-slate-400 capitalize">{item.subaccount}</span>
                    </td>
                    <td className="p-2.5 text-slate-600 truncate max-w-[160px]" title={item.description}>
                      {item.description}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-800">${item.amount.toFixed(2)}</td>
                    <td className="p-2.5 text-center">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          if (item.entryType === "manual") {
                            handleAssignPeriodToManualEntry(item.entryId, e.target.value);
                          } else {
                            handleAssignPeriodToDailyEntry(item.boxId || "", item.entryType as any, item.entryId, e.target.value);
                          }
                        }}
                        className="p-1 px-1.5 border border-slate-200 rounded-lg text-[10.5px] bg-slate-50 text-slate-700 focus:outline-hidden font-medium"
                      >
                        <option value="">Selecciona...</option>
                        {monthOptions.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Filtros y Running Ledger Block */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-3xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
              Libro de Gestión de Sumas y Saldos
            </h2>
            <p className="text-[10px] text-slate-400 tracking-wider font-mono">
              EVOLUCIÓN TEMPORAL DE SALDOS Y CLASIFICACIONES DE CUENTAS
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nuevo Asiento Manual
            </button>
            <button
              onClick={loadData}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10.5px] font-black rounded-lg uppercase tracking-wider"
            >
              Sincronizar
            </button>
          </div>
        </div>

        {/* 3. Add Manual Entry Form Drawer/Form */}
        {showAddForm && (
          <form onSubmit={handleAddManualEntry} className="bg-slate-55 bg-indigo-50/20 border border-indigo-100 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-4 border-b border-indigo-100/50 pb-2 mb-1 flex justify-between items-center">
              <h4 className="text-[11px] font-black uppercase text-indigo-900 tracking-wider">Crear Movimiento Administrativo Manual</h4>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600 text-xs">Cerrar</button>
            </div>
            
            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-black text-indigo-950">Fecha</label>
              <input
                type="date"
                required
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="w-full p-1.5 px-2.5 border border-slate-200 rounded-lg text-xs font-mono bg-white text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-black text-indigo-950">Período Imputado</label>
              <select
                value={newPeriod}
                onChange={e => setNewPeriod(e.target.value)}
                className="w-full p-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium"
              >
                <option value="">-- Sin Período --</option>
                {monthOptions.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-black text-indigo-950">Origen de Movimiento</label>
              <input
                type="text"
                required
                placeholder="Aporte de socios, Caja Chica, Banco..."
                value={newOrigin}
                onChange={e => setNewOrigin(e.target.value)}
                className="w-full p-1.5 px-2.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-black text-indigo-950">Tipo de Operación</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as any)}
                className="w-full p-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium"
              >
                <option value="Ingreso">Ingreso (Entrada / Debe)</option>
                <option value="Egreso">Egreso (Salida / Haber)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-black text-indigo-950">Cuenta</label>
              <CustomDropdown
                value={newAccount}
                onChange={(val) => {
                  setNewAccount(val);
                  setNewSubaccount(""); // Reset subaccount when account changes
                }}
                options={getUnifiedAccounts()}
                placeholder="Selecciona Cuenta..."
                searchable
                onAdd={(label) => {
                  const accounts = getUnifiedAccounts();
                  const newAcc: Account = { id: label, label: label, subaccounts: [] };
                  saveUnifiedAccounts([...accounts, newAcc]);
                  setNewAccount(label);
                }}
                onEdit={(id, label) => {
                  const accounts = getUnifiedAccounts();
                  saveUnifiedAccounts(accounts.map(a => a.id === id ? { ...a, label } : a));
                }}
                onDelete={(id) => {
                  const accounts = getUnifiedAccounts();
                  saveUnifiedAccounts(accounts.filter(a => a.id !== id));
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-black text-indigo-950">Subcuenta (Detalle)</label>
              <CustomDropdown
                value={newSubaccount}
                onChange={setNewSubaccount}
                options={getUnifiedSubaccounts(newAccount)}
                placeholder="Selecciona Subcuenta..."
                searchable
                onAdd={(label) => {
                  const subs = getUnifiedSubaccounts(newAccount);
                  const newSub = { id: label, label: label };
                  saveUnifiedSubaccounts(newAccount, [...subs, newSub]);
                  setNewSubaccount(label);
                }}
                onEdit={(id, label) => {
                  const subs = getUnifiedSubaccounts(newAccount);
                  saveUnifiedSubaccounts(newAccount, subs.map(s => s.id === id ? { ...s, label } : s));
                }}
                onDelete={(id) => {
                  const subs = getUnifiedSubaccounts(newAccount);
                  saveUnifiedSubaccounts(newAccount, subs.filter(s => s.id !== id));
                }}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="block text-[9px] uppercase font-black text-indigo-950">Glosa / Notas largas</label>
              <input
                type="text"
                placeholder="Descripción complementaria del movimiento..."
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                className="w-full p-1.5 px-2.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] uppercase font-black text-indigo-950">Importe ($ ARS)</label>
              <input
                type="number"
                required
                min="1"
                placeholder="0.00"
                value={newAmount || ""}
                onChange={e => setNewAmount(Number(e.target.value) || 0)}
                className="w-full p-1.5 px-2.5 border border-slate-200 rounded-lg text-xs font-mono font-bold bg-white text-slate-800"
              />
            </div>

            <div className="md:col-span-4 text-right pt-2 border-t border-indigo-100/30 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-indigo-850"
              >
                Guardar en Libro
              </button>
            </div>
          </form>
        )}

        {/* 4. Filtros Tabla */}
        <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between text-xs">
          <div className="flex gap-4 items-center w-full md:w-auto">
            <span className="font-bold flex items-center gap-1.5 text-slate-500 text-[11px] uppercase">
              <Filter className="w-3.5 h-3.5" /> Filtrar Períodos:
            </span>
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value)}
              className="p-1 px-2 border border-slate-200 bg-white rounded-lg text-[11px] font-medium text-slate-705 focus:outline-hidden"
            >
              <option value="TODOS">Todos los Períodos</option>
              {periodsList.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              value={filterAccount}
              onChange={e => setFilterAccount(e.target.value)}
              className="p-1 px-2 border border-slate-200 bg-white rounded-lg text-[11px] font-medium text-slate-705 focus:outline-hidden"
            >
              <option value="TODOS">Todas las Cuentas</option>
              {accountsList.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-5 font-mono text-center text-[11px] font-bold w-full md:w-auto justify-end">
            <div>
              <span className="text-slate-400 block text-[8px] uppercase tracking-wider">Total Debe (+)</span>
              <span className="text-indigo-650 font-black text-xs">${totalDebe.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[8px] uppercase tracking-wider">Total Haber (-)</span>
              <span className="text-rose-650 font-black text-xs">${totalHaber.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="pl-3 border-l border-slate-200">
              <span className="text-slate-400 block text-[8px] uppercase tracking-wider">Saldo Período</span>
              <span className={`font-black text-xs ${currentNetSol >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                ${currentNetSol.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Main Ledgers Running Table */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white max-h-[600px] flex flex-col">
          <div className="overflow-y-auto w-full">
            <table className="w-full text-left text-[11px] border-collapse relative">
              <thead className="sticky top-0 bg-[#091426] text-[#bcc7de] uppercase tracking-wider text-[9px] font-black z-10">
                <tr>
                  <th className="p-3">S.No</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Período</th>
                  <th className="p-3">Origen</th>
                  <th className="p-3">Cuenta (Subcuenta)</th>
                  <th className="p-3">Descripción / Glosa</th>
                  <th className="p-3 text-right">Debe (+)</th>
                  <th className="p-3 text-right">Haber (-)</th>
                  <th className="p-3 text-right pr-4 bg-slate-900 text-[#10b981]">Saldo Acumulado</th>
                  <th className="p-3 text-center print:hidden">Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredLedger.map((item, index) => {
                  const isManual = !item.isSystem;
                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/50 ${index % 2 === 0 ? 'bg-slate-50/10' : ''}`}>
                      <td className="p-3 text-slate-400 font-mono text-[9px]">{index + 1}</td>
                      <td className="p-3 font-mono text-slate-600 space-y-0.5">
                        <span className="block">{item.date}</span>
                      </td>
                      <td className="p-3">
                        {item.periodoImputado ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full text-[9px] font-bold">
                            {item.periodoImputado}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-100 rounded-full text-[9px] font-bold animate-pulse">
                            PENDIENTE
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-slate-700 italic block leading-none">{item.origin}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block leading-tight">{item.account}</span>
                        <span className="text-slate-400 text-[9px] capitalize">{item.subaccount}</span>
                      </td>
                      <td className="p-3 text-slate-500 max-w-[180px] truncate" title={item.description}>
                        {item.description || "-"}
                      </td>
                      <td className="p-3 text-right text-indigo-600 font-bold font-mono">
                        {item.debe > 0 ? `$${item.debe.toFixed(2)}` : "-"}
                      </td>
                      <td className="p-3 text-right text-rose-600 font-bold font-mono">
                        {item.haber > 0 ? `$${item.haber.toFixed(2)}` : "-"}
                      </td>
                      <td className="p-3 text-right font-bold font-mono bg-slate-50 text-emerald-850 bg-emerald-50/10 text-xs pr-4">
                        ${(item as any).saldo?.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center print:hidden">
                        <div className="flex justify-center items-center gap-1">
                          {isManual ? (
                            <button
                              onClick={() => handleDeleteManualEntry(item.id)}
                              className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded transition"
                              title="Eliminar asiento manual"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[9px] tracking-wider uppercase font-black p-0.5 bg-slate-100 text-slate-400 rounded px-1" title="Generado automáticamente por cierre de caja">
                              Auto
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredLedger.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 text-xs font-mono">
                      No se encontraron asientos ni movimientos de caja correspondientes a los filtros indicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

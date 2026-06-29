import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Briefcase, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Coins, 
  DollarSign, 
  Layers, 
  PieChart, 
  AlertCircle,
  X,
  Search,
  FileText,
  Calendar,
  Info
} from "lucide-react";
import { getUnifiedAccounts, getAccountLabel, getSubaccountLabel } from "../lib/accountManager";

interface CajaV2Session {
  id: string;
  dateStr: string;
  isClosed: boolean;
  cancha1: any[];
  cancha2: any[];
  otrosIngresos: any[];
  otrosEgresos: any[];
  personalAccount: string;
  personalDescription: string;
  personalAmount: number;
  personalPeriodoImputado?: string;
  saldoInicial: number;
}

interface ManualLedgerEntry {
  id: string;
  date: string;
  periodoImputado: string;
  origin: string;
  type: string;
  account: string;
  subaccount: string;
  description: string;
  debe: number;
  haber: number;
}

interface ResultadoEconomicoProps {
  sales: any[];
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const ResultadoEconomico: React.FC<ResultadoEconomicoProps> = ({ sales, apiFetch }) => {
  const [history, setHistory] = useState<CajaV2Session[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("Junio 2026");
  const [selectedAuditItem, setSelectedAuditItem] = useState<any | null>(null);
  const [drilldownCategory, setDrilldownCategory] = useState<{ title: string; items: any[]; isIncome: boolean } | null>(null);
  const [drilldownSearch, setDrilldownSearch] = useState("");

  const monthOptions = [
    "Enero 2026", "Febrero 2026", "Marzo 2026", "Abril 2026", "Mayo 2026", "Junio 2026",
    "Julio 2026", "Agosto 2026", "Septiembre 2026", "Octubre 2026", "Noviembre 2026", "Diciembre 2026"
  ];

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const resH = await apiFetch("/api/caja/history");
      if (resH.ok) {
        const d = await resH.json();
        if (Array.isArray(d)) setHistory(d);
      }
      const resM = await apiFetch("/api/ledger-manual");
      if (resM.ok) {
        const d = await resM.json();
        if (Array.isArray(d)) setManualEntries(d);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Compute economic result of the selected month using IMPUTED movements only
  const economicData = useMemo(() => {
    let ingresosTurnos = 0;
    let ingresosBuffet = 0;
    let ingresosOtros = 0;

    let egresosSueldos = 0;
    let egresosServicios = 0;
    let egresosAlquiler = 0;
    let egresosMantenimiento = 0;
    let egresosMarketing = 0;
    let egresosFinanciero = 0;
    let egresosOtros = 0;

    // List of matches for detailed grid view
    const matchedIncomesList: any[] = [];
    const matchedExpensesList: any[] = [];

    // Helper: matches period string with selected period
    const isPeriodMatched = (p?: string) => p === selectedPeriod;

    // Helper: auto-imputed period for box session (turns are auto-imputed to month of date)
    const getAutoImputedPeriodForSession = (dateStr: string) => {
      try {
        const dateObj = new Date(dateStr + "T12:00:00");
        const monthName = dateObj.toLocaleString("es-ES", { month: "long" });
        return monthName[0].toUpperCase() + monthName.substring(1) + " " + dateObj.getFullYear();
      } catch {
        return "";
      }
    };

    const masterAccounts = getUnifiedAccounts();

    // 1. Process box history (closed boxes)
    history.forEach(box => {
      const boxPeriod = getAutoImputedPeriodForSession(box.dateStr);
      const isAutoImputed = isPeriodMatched(boxPeriod);

      // Turn court sales (Turnos) are auto imputed to their month
      if (isAutoImputed) {
        const c1 = Array.isArray(box.cancha1) ? box.cancha1.reduce((sum, s) => sum + (s.amount || 0), 0) : 0;
        const c2 = Array.isArray(box.cancha2) ? box.cancha2.reduce((sum, s) => sum + (s.amount || 0), 0) : 0;
        
        if (c1 > 0) {
          ingresosTurnos += c1;
          matchedIncomesList.push({
            date: box.dateStr,
            source: `Caja Diaria ${box.dateStr}`,
            account: "Turnos",
            subaccount: "Cancha 1",
            amount: c1,
            desc: "Recaudación Cancha 1",
            originType: "caja_session",
            rawItem: box,
            isIncome: true
          });
        }
        if (c2 > 0) {
          ingresosTurnos += c2;
          matchedIncomesList.push({
            date: box.dateStr,
            source: `Caja Diaria ${box.dateStr}`,
            account: "Turnos",
            subaccount: "Cancha 2",
            amount: c2,
            desc: "Recaudación Cancha 2",
            originType: "caja_session",
            rawItem: box,
            isIncome: true
          });
        }

        // Buffet sales
        let buffetSum = 0;
        try {
          const bRes = sales.filter(sale => {
            if (sale.origin === "consumo_interno" || sale.origin === "mesa" || sale.origin === "sistema_caja") return false;
            const sysKeys = ["Cancha 1", "Cancha 2", "Otros Ingresos", "Otros Egresos", "Personal Egreso"];
            if (sysKeys.includes(sale.table_number || "")) return false;
            // Link to box
            if (sale.caja_session_id) return sale.caja_session_id === box.id;
            return new Date(sale.date).toISOString().split("T")[0] === box.dateStr;
          });
          buffetSum = bRes.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
        } catch {
          buffetSum = 0;
        }

        if (buffetSum > 0) {
          ingresosBuffet += buffetSum;
          matchedIncomesList.push({
            date: box.dateStr,
            source: `Caja Diaria ${box.dateStr}`,
            account: "Buffet",
            subaccount: "Ventas",
            amount: buffetSum,
            desc: "Recaudación buffet consolidada para esta sesión de caja",
            originType: "caja_session",
            rawItem: box,
            isIncome: true
          });
        }
      }

      // Box Custom entries (Otros Ingresos & Otros Egresos) are included only if IMPUTED period matches
      if (Array.isArray(box.otrosIngresos)) {
        box.otrosIngresos.forEach(item => {
          if (item.id === "buffet") return;
          const itemPeriod = item.periodoImputado || boxPeriod;
          if (item.amount > 0 && isPeriodMatched(itemPeriod)) {
            const matchedAcc = masterAccounts.find(a => a.id === item.accountId);
            const accountLabel = matchedAcc ? matchedAcc.label : (item.account || "Otros Ingresos");
            const matchedSub = matchedAcc?.subaccounts.find(s => s.id === item.subaccountId);
            const subaccountLabel = matchedSub ? matchedSub.label : (item.suggestedSubaccount || item.description || "Ingreso Extra");

            const sum = item.amount * (item.quantity || 1);
            ingresosOtros += sum;
            matchedIncomesList.push({
              date: box.dateStr,
              source: `Caja Diaria ${box.dateStr}`,
              account: accountLabel,
              subaccount: subaccountLabel,
              amount: sum,
              desc: `Ingreso Caja: ${item.description || "Manual"}`,
              originType: "caja_ingreso",
              rawItem: item,
              parentBox: box,
              isIncome: true
            });
          }
        });
      }

      if (Array.isArray(box.otrosEgresos)) {
        box.otrosEgresos.forEach(item => {
          const itemPeriod = item.periodoImputado || boxPeriod;
          if (item.amount > 0 && isPeriodMatched(itemPeriod)) {
            const matchedAcc = masterAccounts.find(a => a.id === item.accountId);
            const accountLabel = matchedAcc ? matchedAcc.label : (item.account || "Otros Egresos");
            const matchedSub = matchedAcc?.subaccounts.find(s => s.id === item.subaccountId);
            const subaccountLabel = matchedSub ? matchedSub.label : (item.suggestedSubaccount || item.description || "Egreso Extra");

            const sum = item.amount * (item.quantity || 1);
            const acc = accountLabel.toLowerCase();

            if (acc.includes("sueldo") || acc.includes("pago personal")) egresosSueldos += sum;
            else if (acc.includes("servicio") || acc.includes("luz") || acc.includes("internet")) egresosServicios += sum;
            else if (acc.includes("alquiler")) egresosAlquiler += sum;
            else if (acc.includes("mantenimiento") || acc.includes("reparacion")) egresosMantenimiento += sum;
            else if (acc.includes("marketing") || acc.includes("redes")) egresosMarketing += sum;
            else if (acc.includes("financiero") || acc.includes("impuesto")) egresosFinanciero += sum;
            else egresosOtros += sum;

            matchedExpensesList.push({
              date: box.dateStr,
              source: `Caja Diaria ${box.dateStr}`,
              account: accountLabel,
              subaccount: subaccountLabel,
              amount: sum,
              desc: `Gasto Caja: ${item.description || "Manual"}`,
              originType: "caja_egreso",
              rawItem: item,
              parentBox: box,
              isIncome: false
            });
          }
        });
      }

      // Box personal wage payment
      const pPeriod = box.personalPeriodoImputado || boxPeriod;
      if (box.personalAmount > 0 && isPeriodMatched(pPeriod)) {
        egresosSueldos += box.personalAmount;
        matchedExpensesList.push({
          date: box.dateStr,
          source: `Caja Diaria ${box.dateStr}`,
          account: box.personalAccount || "Sueldos",
          subaccount: box.personalDescription || "Encargado",
          amount: box.personalAmount,
          desc: `Pago personal egreso: ${box.personalDescription}`,
          originType: "caja_personal",
          rawItem: box,
          isIncome: false
        });
      }
    });

    // 2. Process manual adjustments/entries (Manual Ledger)
    manualEntries.forEach(item => {
      if (isPeriodMatched(item.periodoImputado)) {
        const isDebe = Number(item.debe) || 0;
        const isHaber = Number(item.haber) || 0;

        if (isDebe > 0) {
          const acc = (item.account || "").toLowerCase();
          if (acc.includes("turno")) ingresosTurnos += isDebe;
          else if (acc.includes("buffet")) ingresosBuffet += isDebe;
          else ingresosOtros += isDebe;

          matchedIncomesList.push({
            date: item.date,
            source: "Registro Manual Admin",
            account: item.account,
            subaccount: item.subaccount,
            amount: isDebe,
            desc: item.description,
            originType: "manual_ledger",
            rawItem: item,
            isIncome: true
          });
        }

        if (isHaber > 0) {
          const acc = (item.account || "").toLowerCase();
          if (acc.includes("sueldo")) egresosSueldos += isHaber;
          else if (acc.includes("servicio") || acc.includes("luz") || acc.includes("internet")) egresosServicios += isHaber;
          else if (acc.includes("alquiler")) egresosAlquiler += isHaber;
          else if (acc.includes("mantenimiento") || acc.includes("reparacion")) egresosMantenimiento += isHaber;
          else if (acc.includes("marketing") || acc.includes("redes")) egresosMarketing += isHaber;
          else if (acc.includes("financiero") || acc.includes("impuesto")) egresosFinanciero += isHaber;
          else egresosOtros += isHaber;

          matchedExpensesList.push({
            date: item.date,
            source: "Registro Manual Admin",
            account: item.account,
            subaccount: item.subaccount,
            amount: isHaber,
            desc: item.description,
            originType: "manual_ledger",
            rawItem: item,
            isIncome: false
          });
        }
      }
    });

    const totalIngresos = ingresosTurnos + ingresosBuffet + ingresosOtros;
    const totalEgresos = egresosSueldos + egresosServicios + egresosAlquiler + egresosMantenimiento + egresosMarketing + egresosFinanciero + egresosOtros;
    const netResultNum = totalIngresos - totalEgresos;

    return {
      ingresosTurnos,
      ingresosBuffet,
      ingresosOtros,
      totalIngresos,
      
      egresosSueldos,
      egresosServicios,
      egresosAlquiler,
      egresosMantenimiento,
      egresosMarketing,
      egresosFinanciero,
      egresosOtros,
      totalEgresos,

      netResultNum,
      matchedIncomesList,
      matchedExpensesList
    };
  }, [history, manualEntries, sales, selectedPeriod]);

  const handleViewIncomesTurnos = () => {
    const items = economicData.matchedIncomesList.filter(item => {
      const acc = (item.account || "").toLowerCase();
      return acc.includes("turno") || item.account === "Turnos";
    });
    setDrilldownSearch("");
    setDrilldownCategory({
      title: "Turnos de Cancha (Cancha 1 y Cancha 2)",
      items,
      isIncome: true
    });
  };

  const handleViewIncomesBuffet = () => {
    const items = economicData.matchedIncomesList.filter(item => {
      const acc = (item.account || "").toLowerCase();
      return acc.includes("buffet") || item.account === "Buffet";
    });
    setDrilldownSearch("");
    setDrilldownCategory({
      title: "Buffet & Buffet Ventas Bar",
      items,
      isIncome: true
    });
  };

  const handleViewIncomesOtros = () => {
    const items = economicData.matchedIncomesList.filter(item => {
      const acc = (item.account || "").toLowerCase();
      return !(acc.includes("turno") || item.account === "Turnos" || acc.includes("buffet") || item.account === "Buffet");
    });
    setDrilldownSearch("");
    setDrilldownCategory({
      title: "Otros Ingresos Imputados",
      items,
      isIncome: true
    });
  };

  const handleViewExpensesSueldos = () => {
    const items = economicData.matchedExpensesList.filter(item => {
      const acc = (item.account || "").toLowerCase();
      return acc.includes("sueldo") || acc.includes("pago personal") || item.originType === "caja_personal" || item.account === "Sueldos";
    });
    setDrilldownSearch("");
    setDrilldownCategory({
      title: "Sueldos & Pago Personal",
      items,
      isIncome: false
    });
  };

  const handleViewExpensesServicios = () => {
    const items = economicData.matchedExpensesList.filter(item => {
      const acc = (item.account || "").toLowerCase();
      return acc.includes("servicio") || acc.includes("luz") || acc.includes("internet");
    });
    setDrilldownSearch("");
    setDrilldownCategory({
      title: "Servicios Generales (Luz, Internet, etc)",
      items,
      isIncome: false
    });
  };

  const handleViewExpensesAlquiler = () => {
    const items = economicData.matchedExpensesList.filter(item => {
      const acc = (item.account || "").toLowerCase();
      return acc.includes("alquiler");
    });
    setDrilldownSearch("");
    setDrilldownCategory({
      title: "Alquileres de Local/Canchas",
      items,
      isIncome: false
    });
  };

  const handleViewExpensesMantenimiento = () => {
    const items = economicData.matchedExpensesList.filter(item => {
      const acc = (item.account || "").toLowerCase();
      return acc.includes("mantenimiento") || acc.includes("reparacion");
    });
    setDrilldownSearch("");
    setDrilldownCategory({
      title: "Mantenimiento y Arreglos",
      items,
      isIncome: false
    });
  };

  const handleViewExpensesMarketing = () => {
    const items = economicData.matchedExpensesList.filter(item => {
      const acc = (item.account || "").toLowerCase();
      return acc.includes("marketing") || acc.includes("redes");
    });
    setDrilldownSearch("");
    setDrilldownCategory({
      title: "Marketing y Publicidad",
      items,
      isIncome: false
    });
  };

  const handleViewExpensesFinancieros = () => {
    const items = economicData.matchedExpensesList.filter(item => {
      const acc = (item.account || "").toLowerCase();
      return acc.includes("financiero") || acc.includes("impuesto");
    });
    setDrilldownSearch("");
    setDrilldownCategory({
      title: "Financieros e Impuestos",
      items,
      isIncome: false
    });
  };

  const handleViewExpensesOtros = () => {
    const items = economicData.matchedExpensesList.filter(item => {
      const acc = (item.account || "").toLowerCase();
      return !(
        acc.includes("sueldo") || acc.includes("pago personal") || item.originType === "caja_personal" || item.account === "Sueldos" ||
        acc.includes("servicio") || acc.includes("luz") || acc.includes("internet") ||
        acc.includes("alquiler") ||
        acc.includes("mantenimiento") || acc.includes("reparacion") ||
        acc.includes("marketing") || acc.includes("redes") ||
        acc.includes("financiero") || acc.includes("impuesto")
      );
    });
    setDrilldownSearch("");
    setDrilldownCategory({
      title: "Otros Gastos/Costos Generales",
      items,
      isIncome: false
    });
  };

  const filteredDrilldownItems = useMemo(() => {
    if (!drilldownCategory) return [];
    const search = drilldownSearch.trim().toLowerCase();
    if (!search) return drilldownCategory.items;
    return drilldownCategory.items.filter(item => {
      const dateVal = (item.date || "").toLowerCase();
      const accountVal = getAccountLabel(item.account).toLowerCase();
      const subaccountVal = getSubaccountLabel(item.account, item.subaccount).toLowerCase();
      const descVal = (item.desc || "").toLowerCase();
      const sourceVal = (item.source || "").toLowerCase();
      return dateVal.includes(search) || accountVal.includes(search) || subaccountVal.includes(search) || descVal.includes(search) || sourceVal.includes(search);
    });
  }, [drilldownCategory, drilldownSearch]);

  if (loading) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-xs text-slate-500 font-mono">Consolidando resultado del ejercicio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Header Selectors */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-600" />
            Estado de Resultado Económico
          </h2>
          <p className="text-[10px] text-slate-400 tracking-wider font-mono">
            RESULTADOS OPERATIVOS REALES Y CONTENIDO ECONÓMICO IMPUTADO EXCLUSIVO
          </p>
        </div>

        <div className="flex gap-2.5 items-center">
          <span className="text-[10.5px] font-black uppercase text-slate-550 font-mono">Período Fiscal:</span>
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="p-1 px-3 border border-slate-200 bg-slate-50 font-black text-slate-800 text-[11px] rounded-lg tracking-wider"
          >
            {monthOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Outcome Status Card */}
      <div className={`border rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-3xs ${economicData.netResultNum >= 0 ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"}`}>
        <div className="flex gap-4 items-center">
          <div className={`p-3 rounded-full ${economicData.netResultNum >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
            {economicData.netResultNum >= 0 ? <TrendingUp className="w-8 h-8" /> : <TrendingDown className="w-8 h-8" />}
          </div>
          <div>
            <span className="text-[9px] uppercase font-black tracking-widest text-slate-450 font-mono">Superávit del Período ({selectedPeriod})</span>
            <h3 className={`text-2xl font-black font-mono leading-none ${economicData.netResultNum >= 0 ? "text-emerald-800" : "text-rose-850"}`}>
              ${economicData.netResultNum.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[9.5px] text-slate-500 font-medium mt-1 uppercase">
              Resultado basado en <strong>{economicData.matchedIncomesList.length + economicData.matchedExpensesList.length}</strong> movimientos validados e imputables.
            </p>
          </div>
        </div>

        <div className="flex gap-6 font-mono font-bold text-[11px] divide-x divide-slate-200 pr-4">
          <div className="px-3">
            <span className="text-slate-400 block text-[8px] uppercase tracking-wider">Ingresos Imputados</span>
            <span className="text-emerald-700 font-black text-base">${economicData.totalIngresos.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="pl-6 px-3">
            <span className="text-slate-400 block text-[8px] uppercase tracking-wider">Costos Imputados</span>
            <span className="text-rose-700 font-black text-base">${economicData.totalEgresos.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* 3. Cost Center Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* INCOMES Breakdown */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4 shadow-3xs">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Ingresos por Centro de Costo</h3>
            <span className="text-[9px] text-indigo-600 bg-indigo-50 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Click para Auditar</span>
          </div>
          <div className="border border-slate-100 rounded-xl divide-y divide-slate-50 text-xs overflow-hidden">
            <div 
              onClick={handleViewIncomesTurnos}
              className="p-3 flex justify-between items-center bg-slate-50/25 hover:bg-indigo-50/50 cursor-pointer transition-all group"
              title="Ver desglose de Turnos de Cancha"
            >
              <span className="font-bold text-slate-800 group-hover:text-indigo-900">1. Turnos de Cancha (Cancha 1 y Cancha 2)</span>
              <span className="font-bold font-mono text-slate-800 group-hover:text-indigo-950 flex items-center gap-1.5">
                ${economicData.ingresosTurnos.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                <Search className="w-3.5 h-3.5 text-indigo-500 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </span>
            </div>
            <div 
              onClick={handleViewIncomesBuffet}
              className="p-3 flex justify-between items-center hover:bg-indigo-50/50 cursor-pointer transition-all group"
              title="Ver desglose de Buffet & Bar"
            >
              <span className="font-bold text-slate-800 group-hover:text-indigo-900">2. Buffet & Buffet Ventas Bar</span>
              <span className="font-bold font-mono text-slate-800 group-hover:text-indigo-950 flex items-center gap-1.5">
                ${economicData.ingresosBuffet.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                <Search className="w-3.5 h-3.5 text-indigo-500 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </span>
            </div>
            <div 
              onClick={handleViewIncomesOtros}
              className="p-3 flex justify-between items-center bg-slate-50/25 hover:bg-indigo-50/50 cursor-pointer transition-all group"
              title="Ver desglose de Otros Ingresos"
            >
              <span className="font-bold text-slate-800 group-hover:text-indigo-900">3. Otros Ingresos Imputados</span>
              <span className="font-bold font-mono text-slate-800 group-hover:text-indigo-950 flex items-center gap-1.5">
                ${economicData.ingresosOtros.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                <Search className="w-3.5 h-3.5 text-indigo-500 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </span>
            </div>
            <div className="p-3 bg-indigo-50/20 text-indigo-900 flex justify-between items-center font-black">
              <span>Suma Total De Ingresos</span>
              <span className="font-mono text-indigo-750">${economicData.totalIngresos.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* EXPENSES Breakdown */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4 shadow-3xs">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Costos Egresados por Cuenta</h3>
            <span className="text-[9px] text-rose-600 bg-rose-50 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Click para Auditar</span>
          </div>
          <div className="border border-slate-100 rounded-xl divide-y divide-slate-50 text-xs overflow-hidden">
            <div 
              onClick={handleViewExpensesSueldos}
              className="p-2.5 flex justify-between items-center hover:bg-rose-50/55 cursor-pointer transition-all group"
              title="Ver desglose de Sueldos & Personal"
            >
              <span className="font-bold text-slate-800 group-hover:text-rose-900">1. Sueldos & Pago Personal</span>
              <span className="font-semibold font-mono text-slate-800 group-hover:text-rose-950 flex items-center gap-1.5">
                ${economicData.egresosSueldos.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                <Search className="w-3.5 h-3.5 text-rose-500 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </span>
            </div>
            <div 
              onClick={handleViewExpensesServicios}
              className="p-2.5 flex justify-between items-center bg-slate-50/25 hover:bg-rose-50/55 cursor-pointer transition-all group"
              title="Ver desglose de Servicios Generales"
            >
              <span className="font-bold text-slate-800 group-hover:text-rose-900">2. Servicios Generales (Luz, Internet, etc)</span>
              <span className="font-semibold font-mono text-slate-800 group-hover:text-rose-950 flex items-center gap-1.5">
                ${economicData.egresosServicios.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                <Search className="w-3.5 h-3.5 text-rose-500 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </span>
            </div>
            <div 
              onClick={handleViewExpensesAlquiler}
              className="p-2.5 flex justify-between items-center hover:bg-rose-50/55 cursor-pointer transition-all group"
              title="Ver desglose de Alquileres"
            >
              <span className="font-bold text-slate-800 group-hover:text-rose-900">3. Alquileres de Local/Canchas</span>
              <span className="font-semibold font-mono text-slate-800 group-hover:text-rose-950 flex items-center gap-1.5">
                ${economicData.egresosAlquiler.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                <Search className="w-3.5 h-3.5 text-rose-500 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </span>
            </div>
            <div 
              onClick={handleViewExpensesMantenimiento}
              className="p-2.5 flex justify-between items-center bg-slate-50/25 hover:bg-rose-50/55 cursor-pointer transition-all group"
              title="Ver desglose de Mantenimiento"
            >
              <span className="font-bold text-slate-800 group-hover:text-rose-900">4. Mantenimiento y Arreglos</span>
              <span className="font-semibold font-mono text-slate-800 group-hover:text-rose-950 flex items-center gap-1.5">
                ${economicData.egresosMantenimiento.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                <Search className="w-3.5 h-3.5 text-rose-500 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </span>
            </div>
            <div 
              onClick={handleViewExpensesMarketing}
              className="p-2.5 flex justify-between items-center hover:bg-rose-50/55 cursor-pointer transition-all group"
              title="Ver desglose de Marketing y Publicidad"
            >
              <span className="font-bold text-slate-800 group-hover:text-rose-900">5. Marketing y Publicidad</span>
              <span className="font-semibold font-mono text-slate-800 group-hover:text-rose-950 flex items-center gap-1.5">
                ${economicData.egresosMarketing.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                <Search className="w-3.5 h-3.5 text-rose-500 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </span>
            </div>
            <div 
              onClick={handleViewExpensesFinancieros}
              className="p-2.5 flex justify-between items-center bg-slate-50/25 hover:bg-rose-50/55 cursor-pointer transition-all group"
              title="Ver desglose de Financieros e Impuestos"
            >
              <span className="font-bold text-slate-800 group-hover:text-rose-900">6. Financieros e Impuestos</span>
              <span className="font-semibold font-mono text-slate-800 group-hover:text-rose-950 flex items-center gap-1.5">
                ${economicData.egresosFinanciero.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                <Search className="w-3.5 h-3.5 text-rose-500 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </span>
            </div>
            <div 
              onClick={handleViewExpensesOtros}
              className="p-2.5 flex justify-between items-center hover:bg-rose-50/55 cursor-pointer transition-all group"
              title="Ver desglose de Otros Gastos Generales"
            >
              <span className="font-bold text-slate-800 group-hover:text-rose-900">7. Otros Gastos/Costos Generales</span>
              <span className="font-semibold font-mono text-slate-800 group-hover:text-rose-950 flex items-center gap-1.5">
                ${economicData.egresosOtros.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                <Search className="w-3.5 h-3.5 text-rose-500 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </span>
            </div>
            <div className="p-3 bg-rose-50/20 text-rose-900 flex justify-between items-center font-black">
              <span>Suma Total De Costos</span>
              <span className="font-mono text-rose-750">${economicData.totalEgresos.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Movements ledger of participating elements */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
        <div>
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Movimientos Imputados que Participan en el Cálculo</h3>
          <p className="text-[10px] text-slate-400 font-mono uppercase">Resumen analítico de partidas consideradas exclusivamente en el período tributario {selectedPeriod}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Matched Incomes Table */}
          <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
            <div className="bg-slate-900 p-3 text-[#10b981] font-black text-[9px] uppercase tracking-wider">
              Ingresos Considerados ({economicData.matchedIncomesList.length})
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-[10.5px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-500 uppercase">
                    <th className="p-2 pl-3">Fecha</th>
                    <th className="p-2">Detalle Cuenta</th>
                    <th className="p-2 text-right pr-3">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {economicData.matchedIncomesList.map((item, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => setSelectedAuditItem(item)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                      title="Haz clic para auditar este movimiento"
                    >
                      <td className="p-2.5 pl-3 font-mono text-slate-500">{item.date}</td>
                      <td className="p-2.5 text-slate-700">
                        <span className="font-bold text-slate-900 block group-hover:text-indigo-900">{getAccountLabel(item.account)}</span>
                        <span className="text-[8.5px] text-slate-400 capitalize">{getSubaccountLabel(item.account, item.subaccount)}</span>
                      </td>
                      <td className="p-2.5 text-right pr-3 font-bold font-mono text-emerald-600 group-hover:scale-105 transition-transform flex items-center justify-end gap-1.5">
                        <span>${item.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                        <Search className="w-3 h-3 text-slate-450 group-hover:text-indigo-600 transition-colors" />
                      </td>
                    </tr>
                  ))}
                  {economicData.matchedIncomesList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-400 text-xs font-mono">Sin ingresos imputados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Matched Expenses Table */}
          <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
            <div className="bg-slate-900 p-3 text-rose-500 font-black text-[9px] uppercase tracking-wider">
              Costos Considerados ({economicData.matchedExpensesList.length})
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-[10.5px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-500 uppercase">
                    <th className="p-2 pl-3">Fecha</th>
                    <th className="p-2">Detalle Cuenta</th>
                    <th className="p-2 text-right pr-3">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {economicData.matchedExpensesList.map((item, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => setSelectedAuditItem(item)}
                      className="hover:bg-rose-50/40 cursor-pointer transition-colors group"
                      title="Haz clic para auditar este movimiento"
                    >
                      <td className="p-2.5 pl-3 font-mono text-slate-500">{item.date}</td>
                      <td className="p-2.5 text-slate-700">
                        <span className="font-bold text-rose-900 block group-hover:text-rose-950">{getAccountLabel(item.account)}</span>
                        <span className="text-[8.5px] text-slate-400 capitalize">{getSubaccountLabel(item.account, item.subaccount)}</span>
                      </td>
                      <td className="p-2.5 text-right pr-3 font-bold font-mono text-rose-600 group-hover:scale-105 transition-transform flex items-center justify-end gap-1.5">
                        <span>${item.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
                        <Search className="w-3 h-3 text-slate-450 group-hover:text-rose-600 transition-colors" />
                      </td>
                    </tr>
                  ))}
                  {economicData.matchedExpensesList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-400 text-xs font-mono">Sin costos fijos imputados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* Drilldown Category Modal */}
      {drilldownCategory && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-left flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className={`p-5 text-white flex justify-between items-center ${drilldownCategory.isIncome ? "bg-slate-900 border-b-2 border-emerald-500" : "bg-slate-900 border-b-2 border-rose-500"}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${drilldownCategory.isIncome ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-mono block">Detalle de Cuenta</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">{drilldownCategory.title}</h4>
                </div>
              </div>
              <button 
                onClick={() => setDrilldownCategory(null)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search and Summary Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 font-mono">Consolidado ({drilldownCategory.items.length} movs):</span>
                <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-md ${drilldownCategory.isIncome ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                  ${drilldownCategory.items.reduce((sum, x) => sum + (x.amount || 0), 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              {/* Search Bar */}
              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  placeholder="Buscar movimiento..."
                  value={drilldownSearch}
                  onChange={e => setDrilldownSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 text-xs rounded-lg placeholder-slate-400 font-medium text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {/* Modal Content - List of matching movements */}
            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="p-3 pl-4">Fecha</th>
                    <th className="p-3">Cuenta/Subcuenta</th>
                    <th className="p-3">Descripción / Origen</th>
                    <th className="p-3 text-right pr-4">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredDrilldownItems.map((item, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => setSelectedAuditItem(item)}
                      className="cursor-pointer transition-all hover:bg-slate-50 group"
                      title="Ver detalle de auditoría"
                    >
                      <td className="p-3 pl-4 font-mono text-slate-500 text-[10.5px]">{item.date}</td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800 block">{getAccountLabel(item.account)}</span>
                        <span className="text-[8.5px] text-slate-400 block capitalize">{getSubaccountLabel(item.account, item.subaccount)}</span>
                      </td>
                      <td className="p-3 text-slate-550 max-w-[200px] truncate">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-indigo-700 block">{item.source}</span>
                        <span className="text-[10.5px] italic text-slate-500">"{item.desc || "Sin descripción"}"</span>
                      </td>
                      <td className={`p-3 text-right pr-4 font-bold font-mono text-[11.5px] ${drilldownCategory.isIncome ? "text-emerald-600 group-hover:text-emerald-700" : "text-rose-600 group-hover:text-rose-700"}`}>
                        <span className="flex items-center justify-end gap-1.5">
                          ${item.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                          <Search className="w-3 h-3 text-slate-350 opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredDrilldownItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 text-xs font-mono">
                        No se encontraron movimientos que coincidan con la búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-medium">
              <span>Haz clic en cualquier fila para ver el análisis de procedencia.</span>
              <button
                type="button"
                onClick={() => setDrilldownCategory(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Audit Modal */}
      {selectedAuditItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-left">
            
            {/* Modal Header */}
            <div className={`p-5 text-white flex justify-between items-center ${selectedAuditItem.isIncome ? "bg-slate-900 border-b-2 border-emerald-500" : "bg-slate-900 border-b-2 border-rose-500"}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedAuditItem.isIncome ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-mono block">Auditoría del Resultado Económico</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">Detalles del Movimiento Imputado</h4>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAuditItem(null)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              
              {/* Highlight Card */}
              <div className={`p-4 rounded-xl flex items-center justify-between gap-4 ${selectedAuditItem.isIncome ? "bg-emerald-50 border border-emerald-100" : "bg-rose-50 border border-rose-100"}`}>
                <div>
                  <span className="text-[8px] uppercase font-black tracking-wider text-slate-500 block">Monto Total Imputado</span>
                  <span className={`text-xl font-black font-mono ${selectedAuditItem.isIncome ? "text-emerald-800" : "text-rose-800"}`}>
                    ${selectedAuditItem.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md font-mono ${selectedAuditItem.isIncome ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                  {selectedAuditItem.isIncome ? "Ingreso (+)" : "Costo (-)"}
                </div>
              </div>

              {/* Technical breakdown */}
              <div className="space-y-3.5 text-xs">
                
                <div className="grid grid-cols-3 py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-black uppercase text-[9px]">Cuenta General:</span>
                  <span className="col-span-2 text-slate-800 font-bold">{getAccountLabel(selectedAuditItem.account)}</span>
                </div>

                <div className="grid grid-cols-3 py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-black uppercase text-[9px]">Subcuenta / Detalle:</span>
                  <span className="col-span-2 text-slate-800 font-medium capitalize">{getSubaccountLabel(selectedAuditItem.account, selectedAuditItem.subaccount)}</span>
                </div>

                <div className="grid grid-cols-3 py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-black uppercase text-[9px]">Fecha Imputada:</span>
                  <span className="col-span-2 text-slate-800 font-mono font-bold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {selectedAuditItem.date}
                  </span>
                </div>

                <div className="grid grid-cols-3 py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-black uppercase text-[9px]">Procedencia / Origen:</span>
                  <span className="col-span-2 text-slate-800 font-mono font-bold">{selectedAuditItem.source}</span>
                </div>

                <div className="grid grid-cols-3 py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-black uppercase text-[9px]">Descripción / Glosa:</span>
                  <span className="col-span-2 text-slate-600 font-medium italic">"{selectedAuditItem.desc || "Sin descripción adicional"}"</span>
                </div>

                {/* Additional context information explaining exactly how the math works */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-900 font-black text-[9px] uppercase tracking-wider">
                    <Info className="w-3.5 h-3.5 text-indigo-600" />
                    Procedencia Explicada
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed font-medium">
                    {selectedAuditItem.originType === "caja_session" && (
                      "Este movimiento representa la facturación automática calculada al realizar el cierre de caja diaria de esa fecha. No es editable manualmente desde aquí, ya que proviene directamente de transacciones de caja física validadas."
                    )}
                    {selectedAuditItem.originType === "caja_ingreso" && (
                      "Este movimiento fue declarado como un ingreso extraordinario o de caja chica en la jornada correspondiente de caja diaria. Se consolida en el balance general bajo el centro de costo indicado."
                    )}
                    {selectedAuditItem.originType === "caja_egreso" && (
                      "Este movimiento corresponde a un gasto extraordinario registrado por el encargado de turno de la caja diaria. Se incluye aquí al haber sido asignado su período fiscal de imputación al mes analizado."
                    )}
                    {selectedAuditItem.originType === "caja_personal" && (
                      "Este movimiento registra un desembolso por pago de sueldo, viáticos o adelantos al personal encargado del club, realizado durante la jornada de caja de ese día."
                    )}
                    {selectedAuditItem.originType === "manual_ledger" && (
                      "Este movimiento es un asiento administrativo manual generado desde el Libro de Gestión por la administración central. Puede ser modificado o eliminado directamente desde el módulo del Libro de Gestión."
                    )}
                  </p>
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAuditItem(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

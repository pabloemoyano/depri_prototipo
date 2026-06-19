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
  AlertCircle 
} from "lucide-react";
import { getUnifiedAccounts } from "../lib/accountManager";

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
          matchedIncomesList.push({ date: box.dateStr, source: `Caja Diaria ${box.dateStr}`, account: "Turnos", subaccount: "Cancha 1", amount: c1, desc: "Recaudación Cancha 1" });
        }
        if (c2 > 0) {
          ingresosTurnos += c2;
          matchedIncomesList.push({ date: box.dateStr, source: `Caja Diaria ${box.dateStr}`, account: "Turnos", subaccount: "Cancha 2", amount: c2, desc: "Recaudación Cancha 2" });
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
          matchedIncomesList.push({ date: box.dateStr, source: `Caja Diaria ${box.dateStr}`, account: "Buffet", subaccount: "Ventas", amount: buffetSum, desc: "Recaudación buffet" });
        }
      }

      // Box Custom entries (Otros Ingresos & Otros Egresos) are included only if IMPUTED period matches
      if (Array.isArray(box.otrosIngresos)) {
        box.otrosIngresos.forEach(item => {
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
              desc: `Ingreso Caja: ${item.description || "Manual"}`
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
              desc: `Gasto Caja: ${item.description || "Manual"}`
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
          desc: `Pago personal egreso: ${box.personalDescription}`
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
            desc: item.description
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
            desc: item.description
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
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Ingresos Discriminados por Centro de Costo</h3>
          <div className="border border-slate-100 rounded-xl divide-y divide-slate-50 text-xs">
            <div className="p-3 flex justify-between items-center bg-slate-50/20">
              <span className="font-bold text-slate-800">1. Turnos de Cancha (Cancha 1 y Cancha 2)</span>
              <span className="font-bold font-mono text-slate-800">${economicData.ingresosTurnos.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="font-bold text-slate-800">2. Buffet & Buffet Ventas Bar</span>
              <span className="font-bold font-mono text-slate-800">${economicData.ingresosBuffet.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-3 flex justify-between items-center bg-slate-50/20">
              <span className="font-bold text-slate-800">3. Otros Ingresos Imputados</span>
              <span className="font-bold font-mono text-slate-800">${economicData.ingresosOtros.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-3 bg-indigo-50/20 text-indigo-900 flex justify-between items-center font-black">
              <span>Suma Total De Ingresos</span>
              <span className="font-mono text-indigo-750">${economicData.totalIngresos.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* EXPENSES Breakdown */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4 shadow-3xs">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Costos Reales Egresados por Cuenta de Plan</h3>
          <div className="border border-slate-100 rounded-xl divide-y divide-slate-50 text-xs">
            <div className="p-2.5 flex justify-between items-center">
              <span className="font-bold text-slate-800">1. Sueldos & Pago Personal</span>
              <span className="font-semibold font-mono text-slate-800">${economicData.egresosSueldos.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-2.5 flex justify-between items-center bg-slate-50/20">
              <span className="font-bold text-slate-800">2. Servicios Generales (Luz, Internet, etc)</span>
              <span className="font-semibold font-mono text-slate-800">${economicData.egresosServicios.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-2.5 flex justify-between items-center">
              <span className="font-bold text-slate-800">3. Alquileres de Local/Canchas</span>
              <span className="font-semibold font-mono text-slate-800">${economicData.egresosAlquiler.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-2.5 flex justify-between items-center bg-slate-50/20">
              <span className="font-bold text-slate-800">4. Mantenimiento y Arreglos</span>
              <span className="font-semibold font-mono text-slate-800">${economicData.egresosMantenimiento.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-2.5 flex justify-between items-center">
              <span className="font-bold text-slate-800">5. Marketing y Publicidad</span>
              <span className="font-semibold font-mono text-slate-800">${economicData.egresosMarketing.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-2.5 flex justify-between items-center bg-slate-50/20">
              <span className="font-bold text-slate-800">6. Financieros e Impuestos</span>
              <span className="font-semibold font-mono text-slate-800">${economicData.egresosFinanciero.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-2.5 flex justify-between items-center">
              <span className="font-bold text-slate-800">7. Otros Gastos/Costos Generales</span>
              <span className="font-semibold font-mono text-slate-800">${economicData.egresosOtros.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</span>
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
                    <tr key={idx} className="hover:bg-slate-50/40">
                      <td className="p-2 pl-3 font-mono text-slate-500">{item.date}</td>
                      <td className="p-2 text-slate-700">
                        <span className="font-bold text-slate-900 block">{item.account}</span>
                        <span className="text-[8.5px] text-slate-400 capitalize">{item.subaccount}</span>
                      </td>
                      <td className="p-2 text-right pr-3 font-bold font-mono text-indigo-650">${item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  {economicData.matchedIncomesList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-400 text-xs font-mono">Sin ingresos imputed.</td>
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
                    <tr key={idx} className="hover:bg-slate-50/40">
                      <td className="p-2 pl-3 font-mono text-slate-500">{item.date}</td>
                      <td className="p-2 text-slate-700">
                        <span className="font-bold text-rose-900 block">{item.account}</span>
                        <span className="text-[8.5px] text-slate-400 capitalize">{item.subaccount}</span>
                      </td>
                      <td className="p-2 text-right pr-3 font-bold font-mono text-rose-650">${item.amount.toFixed(2)}</td>
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

    </div>
  );
};

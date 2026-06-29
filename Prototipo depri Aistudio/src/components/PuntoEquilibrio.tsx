import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Scale, 
  ChevronRight, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Layers, 
  HelpCircle, 
  Award,
  Sliders,
  Play,
  Settings,
  X,
  RotateCcw,
  Utensils,
  Coins
} from "lucide-react";

interface Budget {
  id: string;
  monthStr: string;
  category: string;
  account: string;
  subaccount: string;
  amount: number;
}

interface CajaV2Session {
  id: string;
  dateStr: string;
  cancha1: any[];
  cancha2: any[];
  otrosIngresos?: any[];
}

interface PuntoEquilibrioProps {
  sales: any[];
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const PuntoEquilibrio: React.FC<PuntoEquilibrioProps> = ({ sales, apiFetch }) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [history, setHistory] = useState<CajaV2Session[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchingRef = React.useRef(false); // Guard for redundant fetches
  const [selectedPeriod, setSelectedPeriod] = useState("Junio 2026");

  // Dynamic variable cost factor
  const [variableCostPct, setVariableCostPct] = useState<number>(15);
  const [standardVariableCostPct, setStandardVariableCostPct] = useState<number>(() => Number(localStorage.getItem("pe_standard_var_cost") || "15"));
  
  // Custom standard court rate config
  const [standardCourtRate, setStandardCourtRate] = useState<number>(() => Number(localStorage.getItem("pe_standard_court_price") || "42000"));
  const [averageCourtPrice, setAverageCourtPrice] = useState<number>(standardCourtRate);

  // Buffet (daily) and Other (monthly) revenues simulation
  const [buffetSimDaily, setBuffetSimDaily] = useState<number>(0);
  const [standardBuffetDaily, setStandardBuffetDaily] = useState<number>(() => Number(localStorage.getItem("pe_standard_buffet_daily") || "0"));
  
  const [otrosSim, setOtrosSim] = useState<number>(0);
  const [standardOtrosMonthly, setStandardOtrosMonthly] = useState<number>(() => Number(localStorage.getItem("pe_standard_otros_monthly") || "0"));

  // Step configs
  const [stepCourt, setStepCourt] = useState(() => Number(localStorage.getItem("pe_step_court") || "1000"));
  const [stepVar, setStepVar] = useState(() => Number(localStorage.getItem("pe_step_var") || "5"));
  const [stepBuffet, setStepBuffet] = useState(() => Number(localStorage.getItem("pe_step_buffet") || "1000"));
  const [stepOtros, setStepOtros] = useState(() => Number(localStorage.getItem("pe_step_otros") || "5000"));

  const [minCourt, setMinCourt] = useState(() => Number(localStorage.getItem("pe_min_court") || "10000"));
  const [maxCourt, setMaxCourt] = useState(() => Number(localStorage.getItem("pe_max_court") || "200000"));

  const [minVar, setMinVar] = useState(() => Number(localStorage.getItem("pe_min_var") || "5"));
  const [maxVar, setMaxVar] = useState(() => Number(localStorage.getItem("pe_max_var") || "100"));

  const [minBuffet, setMinBuffet] = useState(() => Number(localStorage.getItem("pe_min_buffet") || "0"));
  const [maxBuffet, setMaxBuffet] = useState(() => Number(localStorage.getItem("pe_max_buffet") || "200000"));

  const [minOtros, setMinOtros] = useState(() => Number(localStorage.getItem("pe_min_otros") || "0"));
  const [maxOtros, setMaxOtros] = useState(() => Number(localStorage.getItem("pe_max_otros") || "2000000"));

  const [modal, setModal] = useState<"court" | "varCost" | "buffet" | "otros" | null>(null);
  const [tempValue, setTempValue] = useState("0");
  const [tempStep, setTempStep] = useState("0");
  const [tempMin, setTempMin] = useState("0");
  const [tempMax, setTempMax] = useState("0");

  const monthOptions = [
    "Enero 2026", "Febrero 2026", "Marzo 2026", "Abril 2026", "Mayo 2026", "Junio 2026",
    "Julio 2026", "Agosto 2026", "Septiembre 2026", "Octubre 2026", "Noviembre 2026", "Diciembre 2026"
  ];

  const loadData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      // 1. Fetch budgets for structural fixed costs
      const resB = await apiFetch("/api/budgets");
      if (resB.ok) {
        const d = await resB.json();
        if (Array.isArray(d)) setBudgets(d);
      }

      // 2. Fetch boxes history to approximate average turn price
      const resH = await apiFetch("/api/caja/history");
      if (resH.ok) {
        const d = await resH.json();
        if (Array.isArray(d)) setHistory(d);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Helper: auto-imputed period for box session
  const getAutoImputedPeriodForSession = (dateStr: string) => {
    try {
      const dateObj = new Date(dateStr + "T12:00:00");
      const monthName = dateObj.toLocaleString("es-ES", { month: "long" });
      return monthName[0].toUpperCase() + monthName.substring(1) + " " + dateObj.getFullYear();
    } catch {
      return "";
    }
  };

  // Compute actual real revenues for baseline references
  const actualRevenues = useMemo(() => {
    let turnos = 0;
    let buffet = 0;
    let otros = 0;

    const isPeriodMatched = (p?: string) => p === selectedPeriod;

    // Pre-process sales for faster lookup
    const salesByDate = new Map<string, any[]>();
    const salesBySessionId = new Map<string, any[]>();
    
    (sales || []).forEach(sale => {
      if (sale.origin === "consumo_interno" || sale.origin === "mesa" || sale.origin === "sistema_caja") return;
      const sysKeys = ["Cancha 1", "Cancha 2", "Otros Ingresos", "Otros Egresos", "Personal Egreso"];
      if (sysKeys.includes(sale.table_number || "")) return;
      
      if (sale.caja_session_id) {
        if (!salesBySessionId.has(sale.caja_session_id)) salesBySessionId.set(sale.caja_session_id, []);
        salesBySessionId.get(sale.caja_session_id)!.push(sale);
      } else {
        const dateStr = new Date(sale.date).toISOString().split("T")[0];
        if (!salesByDate.has(dateStr)) salesByDate.set(dateStr, []);
        salesByDate.get(dateStr)!.push(sale);
      }
    });

    history.forEach(box => {
      const boxPeriod = getAutoImputedPeriodForSession(box.dateStr);
      const isAutoImputed = isPeriodMatched(boxPeriod);

      if (isAutoImputed) {
        // Turns
        const c1 = Array.isArray(box.cancha1) ? box.cancha1.reduce((sum, s) => sum + (s.amount || 0), 0) : 0;
        const c2 = Array.isArray(box.cancha2) ? box.cancha2.reduce((sum, s) => sum + (s.amount || 0), 0) : 0;
        turnos += c1 + c2;

        // Buffet
        let buffetSum = 0;
        const bRes = salesBySessionId.get(box.id) || salesByDate.get(box.dateStr) || [];
        buffetSum = bRes.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
        buffet += buffetSum;

        // Otros
        if (Array.isArray(box.otrosIngresos)) {
          box.otrosIngresos.forEach(item => {
            if (item.id === "buffet") return;
            const itemPeriod = item.periodoImputado || boxPeriod;
            if (item.amount > 0 && isPeriodMatched(itemPeriod)) {
              otros += item.amount * (item.quantity || 1);
            }
          });
        }
      }
    });

    return { turnos, buffet, otros };
  }, [history, sales, selectedPeriod]);

  // Reset/sync simulations
  useEffect(() => {
    setVariableCostPct(standardVariableCostPct);
    setBuffetSimDaily(actualRevenues.buffet / 30);
    setOtrosSim(actualRevenues.otros);
  }, [selectedPeriod, actualRevenues.buffet, actualRevenues.otros]);

  // Compute fixed costs from monthly budget targets
  const fixedCostsTotal = useMemo(() => {
    const matched = budgets.filter(b => b.monthStr === selectedPeriod);
    if (matched.length > 0) {
      return matched.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    }
    return 140000; 
  }, [budgets, selectedPeriod]);

  // Contribution base (1 - ratio)
  const contributionRatio = useMemo(() => {
    return 1 - (variableCostPct / 100);
  }, [variableCostPct]);

  // Punto de Equilibrio Total en pesos (PE)
  const breakEvenDollars = useMemo(() => {
    if (contributionRatio <= 0.05) return fixedCostsTotal;
    return Math.round(fixedCostsTotal / contributionRatio);
  }, [fixedCostsTotal, contributionRatio]);

  // Buffet (monthly) and others simulated contributions offset the required break-even target
  const simulatedTurnRevenueRequired = useMemo(() => {
    return Math.max(0, breakEvenDollars - (buffetSimDaily * 30) - otrosSim);
  }, [breakEvenDollars, buffetSimDaily, otrosSim]);

  // Translate remaining required court sales into slots to survive
  const requiredTurns = useMemo(() => {
    if (averageCourtPrice <= 100) return 0;
    return Math.ceil(simulatedTurnRevenueRequired / averageCourtPrice);
  }, [simulatedTurnRevenueRequired, averageCourtPrice]);

  // (Removed handleSaveStandardRate and handleResetStandardRate as they are obsolete due to modal logic)
  
  // Safe maximum values for sliders
  const maxBuffetSlider = useMemo(() => {
    return Math.max(100000, Math.ceil(actualRevenues.buffet / 30 / 1000) * 1000 * 2);
  }, [actualRevenues.buffet]);


  const maxOtrosSlider = useMemo(() => {
    return Math.max(1000000, Math.ceil(actualRevenues.otros / 100000) * 100000 * 2);
  }, [actualRevenues.otros]);

  if (loading) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-xs text-slate-500 font-mono">Consolidando cálculo de punto de equilibrio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Header block */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-600" />
            Análisis de Punto de Equilibrio (Break-Even)
          </h2>
          <p className="text-[10px] text-slate-400 tracking-wider font-mono">
            ESTABLECIMIENTO DE UMBRALES DE RENTABILIDAD Y OBJETIVOS OPERATIVOS
          </p>
        </div>

        <div className="flex gap-2.5 items-center">
          <span className="text-[10.5px] font-black uppercase text-slate-550 font-mono">Período:</span>
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="p-1 px-3 border border-slate-200 bg-slate-50 font-black text-slate-800 text-[11px] rounded-lg tracking-wider cursor-pointer"
          >
            {monthOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Visual equilibrium gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PE Metrics Card */}
        <div className="lg:col-span-2 bg-[#09111e] text-white rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between shadow-3xs">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Scale className="w-64 h-64 text-white" />
          </div>

          <div className="space-y-1 z-10">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[9px] font-black uppercase tracking-widest font-mono">
                Umbral Mínimo de Facturación Total
              </span>
              {( (buffetSimDaily * 30) !== actualRevenues.buffet || otrosSim !== actualRevenues.otros || averageCourtPrice !== standardCourtRate) && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[8.5px] font-black uppercase tracking-widest font-mono animate-pulse">
                  Simulación Activa
                </span>
              )}
            </div>
            
            <h3 className="text-3xl font-black font-mono tracking-tight text-emerald-400 pt-1.5 leading-none">
              ${breakEvenDollars.toLocaleString("es-ES")} <span className="text-xs text-slate-400 font-sans uppercase font-bold tracking-widest">ARS</span>
            </h3>
            <p className="text-[10px] text-slate-300 font-medium leading-relaxed pt-2">
              Ingreso total bruto requerido para cubrir el 100% de los costos estructurales del club (fijos y variables). Cada peso generado por encima de este umbral genera rentabilidad neta real.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-slate-800/60 pt-5 mt-6 font-mono">
            <div>
              <span className="text-[8.5px] text-slate-400 block uppercase tracking-wider font-sans font-bold">Costos Fijos Estructurales</span>
              <span className="text-sm font-black text-slate-100">${fixedCostsTotal.toLocaleString("es-ES")}</span>
            </div>
            <div>
              <span className="text-[8.5px] text-emerald-400/80 block uppercase tracking-wider font-sans font-bold">Objetivo Diario Promedio</span>
              <span className="text-sm font-black text-emerald-400">${Math.round(breakEvenDollars / 30).toLocaleString("es-ES")}</span>
              <span className="text-[8px] text-slate-400 block">(${(breakEvenDollars / 30).toLocaleString("es-ES", {maximumFractionDigits:0})}/día)</span>
            </div>
            <div>
              <span className="text-[8.5px] text-slate-400 block uppercase tracking-wider font-sans font-bold">Margen de Contribución</span>
              <span className="text-sm font-black text-slate-100">{(contributionRatio * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Required turn representation */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 flex flex-col justify-between shadow-3xs">
          <div className="space-y-2">
            <span className="px-2.5 py-0.5 bg-indigo-550 text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full text-[9px] font-black uppercase tracking-wider">
              Objetivo de Explotación de Canchas
            </span>
            <div className="pt-2 leading-none flex gap-4">
              <div>
                <span className="block text-4xl font-mono font-black text-indigo-950">{requiredTurns}</span>
                <span className="text-[10px] font-black uppercase text-slate-400 font-sans tracking-wide">al mes</span>
              </div>
              <div>
                <span className="block text-4xl font-mono font-black text-emerald-600">{(requiredTurns / 30).toFixed(1)}</span>
                <span className="text-[10px] font-black uppercase text-slate-400 font-sans tracking-wide">al día</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-medium leading-normal pt-2">
              Reservas requeridas para alcanzar el punto de equilibrio, considerando los aportes de bar y otros.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4 text-[10px] text-slate-400 font-mono space-y-1 uppercase">
            <div>• Tarifa por Turno: ${averageCourtPrice.toLocaleString("es-ES")} ARS</div>
            <div>• Canchas Activas: Cancha 1 / Cancha 2</div>
            {simulatedTurnRevenueRequired !== breakEvenDollars && (
              <div className="text-indigo-650 font-bold">• Factura Canchas: ${simulatedTurnRevenueRequired.toLocaleString("es-ES")} ARS</div>
            )}
          </div>
        </div>

      </div>

      {/* 3. Parametric simulator widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Sliders adjustments */}
        <div className="lg:col-span-3 bg-white border border-slate-150 rounded-2xl p-6 space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-slate-500" />
                Simulador Paramétrico de Rentabilidad
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">Simula el impacto de desvíos en base a variaciones en la explotación comercial</p>
            </div>
            <button 
              onClick={() => {
                setVariableCostPct(standardVariableCostPct);
                setAverageCourtPrice(standardCourtRate);
                setBuffetSimDaily(actualRevenues.buffet / 30);
                setOtrosSim(actualRevenues.otros);
              }}
              title="Reestablecer parámetros a valores reales/estándar"
              className="p-1.5 hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

            <div className="space-y-4">
            
            {/* 1. Variable Cost % */}
            <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-[10.5px] font-black uppercase font-mono">
                <span className="text-slate-700 flex items-center gap-1">
                  1. Porcentaje Costos Variables (%):
                  <button onClick={() => { setTempValue(String(variableCostPct)); setTempStep(String(stepVar)); setTempMin(String(minVar)); setTempMax(String(maxVar)); setModal("varCost"); }} className="p-1 text-slate-400 hover:text-indigo-600 rounded"><Settings className="w-3.5 h-3.5" /></button>
                </span>
                <span className="text-indigo-650 text-xs">{variableCostPct}%</span>
              </div>
              <input type="range" min={minVar} max={maxVar} step={stepVar} value={variableCostPct} onChange={e => setVariableCostPct(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
            </div>

            {/* 2. Court Rate */}
            <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-[10.5px] font-black uppercase font-mono">
                <span className="text-slate-700 flex items-center gap-1">
                  2. Tarifa Promedio de Turno Cancha:
                  <button onClick={() => { setTempValue(String(standardCourtRate)); setTempStep(String(stepCourt)); setTempMin(String(minCourt)); setTempMax(String(maxCourt)); setModal("court"); }} className="p-1 text-slate-400 hover:text-indigo-600 rounded"><Settings className="w-3.5 h-3.5" /></button>
                </span>
                <span className="text-indigo-650 text-xs">${averageCourtPrice.toLocaleString("es-ES")}</span>
              </div>
              <input type="range" min={minCourt} max={maxCourt} step={stepCourt} value={averageCourtPrice} onChange={e => setAverageCourtPrice(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
            </div>

            {/* 3. Buffet Daily */}
            <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-[10.5px] font-black uppercase font-mono">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-slate-400" />
                  3. Recaudación Estimada Buffet (Diaria):
                  <button onClick={() => { setTempValue(String(standardBuffetDaily)); setTempStep(String(stepBuffet)); setTempMin(String(minBuffet)); setTempMax(String(maxBuffet)); setModal("buffet"); }} className="p-1 text-slate-400 hover:text-indigo-600 rounded"><Settings className="w-3.5 h-3.5" /></button>
                </span>
                <span className="text-indigo-650 text-xs font-black">${buffetSimDaily.toLocaleString("es-ES")}</span>
              </div>
              <input type="range" min={minBuffet} max={maxBuffet} step={stepBuffet} value={buffetSimDaily} onChange={e => setBuffetSimDaily(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
            </div>

            {/* 4. Others Monthly */}
            <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-1">
              <div className="flex justify-between items-center text-[10.5px] font-black uppercase font-mono">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-slate-400" />
                  4. Recaudación Otros Ingresos ($/mes):
                  <button onClick={() => { setTempValue(String(standardOtrosMonthly)); setTempStep(String(stepOtros)); setTempMin(String(minOtros)); setTempMax(String(maxOtros)); setModal("otros"); }} className="p-1 text-slate-400 hover:text-indigo-600 rounded"><Settings className="w-3.5 h-3.5" /></button>
                </span>
                <span className="text-indigo-650 text-xs font-black">${otrosSim.toLocaleString("es-ES")}</span>
              </div>
              <input type="range" min={minOtros} max={maxOtros} step={stepOtros} value={otrosSim} onChange={e => setOtrosSim(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
            </div>

          </div>
        </div>

        {/* Dynamic calculation steps explanation */}
        <div className="lg:col-span-2 p-5 bg-[#fafbfd] border border-slate-100 rounded-xl space-y-3.5 text-xs text-slate-650 font-medium flex flex-col justify-between">
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> Detalle Matemático del Cálculo
            </h4>
            
            <div className="space-y-4 font-mono text-base divide-y divide-slate-100">
              <div className="pt-0.5">
                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">1. Costos Fijos:</span>
                <span>Fijo mensual = <strong className="text-slate-900">${fixedCostsTotal.toLocaleString("es-ES")}</strong></span>
              </div>
              
              <div className="pt-3">
                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">2. Umbral de Equilibrio (PE):</span>
                <span>Fijos / (1 - {variableCostPct / 100}) = <strong className="text-slate-900">${breakEvenDollars.toLocaleString("es-ES")} ARS</strong></span>
              </div>

              <div className="pt-3">
                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">3. Canales Comerciales:</span>
                <div className="pl-3 border-l-2 border-slate-200 text-slate-600 text-sm">
                  <div>• Buffet (mensual): <strong className="text-slate-800">${(buffetSimDaily * 30).toLocaleString("es-ES")}</strong></div>
                  <div>• Otros (mensual): <strong className="text-slate-800">${otrosSim.toLocaleString("es-ES")}</strong></div>
                </div>
              </div>

              <div className="pt-3">
                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">4. Facturación Mínima en Canchas:</span>
                <span>PE - Buffet - Otros = <strong className="text-indigo-700">${simulatedTurnRevenueRequired.toLocaleString("es-ES")} ARS</strong></span>
              </div>

              <div className="pt-3">
                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">5. Cálculo de Turnos:</span>
                <span>${simulatedTurnRevenueRequired.toLocaleString("es-ES")} / ${averageCourtPrice.toLocaleString("es-ES")} = <strong className="text-emerald-700">{requiredTurns} turnos</strong></span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-indigo-50/70 text-indigo-950 font-sans text-[10px] rounded-lg border border-indigo-100/50 leading-relaxed mt-4">
            <strong>Conclusión:</strong> El complejo deportivo necesita facturar un mínimo de <strong>${breakEvenDollars.toLocaleString("es-ES")} ARS</strong> totales. Tras descontar el aporte comercial de bar y otros ingresos, se requiere cubrir un neto de <strong>${simulatedTurnRevenueRequired.toLocaleString("es-ES")} ARS</strong> equivalente a <strong>{requiredTurns} turnos</strong> a una tarifa de <strong>${averageCourtPrice.toLocaleString("es-ES")} ARS</strong> en el mes de <strong>{selectedPeriod}</strong> para evitar pérdidas.
          </div>
        </div>

      </div>

      {/* Gear configuration modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full flex flex-col max-h-[90vh] overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-black uppercase tracking-wider">Configurar Estimación</span>
              </div>
              <button onClick={() => setModal(null)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <p className="text-[10.5px] text-slate-500 leading-normal">
                Configura el valor de referencia estándar para el análisis. Este valor se guardará como parámetro de partida inicial.
              </p>
              
              <div className="space-y-1.5">
                <label className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 block">Nuevo Valor</label>
                <input 
                  type="number"
                  value={tempValue}
                  onChange={e => setTempValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 text-xs rounded-xl text-slate-800 font-bold outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 block">Nuevo Salto (Step)</label>
                <input 
                  type="number"
                  value={tempStep}
                  onChange={e => setTempStep(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 text-xs rounded-xl text-slate-800 font-bold outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 block">Valor Mínimo</label>
                  <input 
                    type="number"
                    value={tempMin}
                    onChange={e => setTempMin(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 text-xs rounded-xl text-slate-800 font-bold outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 block">Valor Máximo</label>
                  <input 
                    type="number"
                    value={tempMax}
                    onChange={e => setTempMax(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 text-xs rounded-xl text-slate-800 font-bold outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (modal === "court") { 
                    localStorage.setItem("pe_standard_court_price", "42000"); 
                    localStorage.setItem("pe_step_court", "1000"); 
                    localStorage.setItem("pe_min_court", "10000");
                    localStorage.setItem("pe_max_court", "200000");
                    setStandardCourtRate(42000); 
                    setStepCourt(1000); 
                    setMinCourt(10000);
                    setMaxCourt(200000);
                    setAverageCourtPrice(42000); 
                  }
                  else if (modal === "varCost") { 
                    localStorage.setItem("pe_standard_var_cost", "15"); 
                    localStorage.setItem("pe_step_var", "5"); 
                    localStorage.setItem("pe_min_var", "5");
                    localStorage.setItem("pe_max_var", "100");
                    setStandardVariableCostPct(15); 
                    setStepVar(5); 
                    setMinVar(5);
                    setMaxVar(100);
                    setVariableCostPct(15); 
                  }
                  else if (modal === "buffet") { 
                    localStorage.setItem("pe_standard_buffet_daily", "0"); 
                    localStorage.setItem("pe_step_buffet", "1000"); 
                    localStorage.setItem("pe_min_buffet", "0");
                    localStorage.setItem("pe_max_buffet", "200000");
                    setStandardBuffetDaily(0); 
                    setStepBuffet(1000); 
                    setMinBuffet(0);
                    setMaxBuffet(200000);
                    setBuffetSimDaily(0); 
                  }
                  else if (modal === "otros") { 
                    localStorage.setItem("pe_standard_otros_monthly", "0"); 
                    localStorage.setItem("pe_step_otros", "5000"); 
                    localStorage.setItem("pe_min_otros", "0");
                    localStorage.setItem("pe_max_otros", "2000000");
                    setStandardOtrosMonthly(0); 
                    setStepOtros(5000); 
                    setMinOtros(0);
                    setMaxOtros(2000000);
                    setOtrosSim(0); 
                  }
                  setModal(null);
                }}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = Number(tempValue);
                  const step = Number(tempStep);
                  const mn = Number(tempMin);
                  const mx = Number(tempMax);
                  if (modal === "court") { 
                    localStorage.setItem("pe_standard_court_price", String(val)); 
                    localStorage.setItem("pe_step_court", String(step)); 
                    localStorage.setItem("pe_min_court", String(mn));
                    localStorage.setItem("pe_max_court", String(mx));
                    setStandardCourtRate(val); 
                    setStepCourt(step); 
                    setMinCourt(mn);
                    setMaxCourt(mx);
                    setAverageCourtPrice(val); 
                  }
                  else if (modal === "varCost") { 
                    localStorage.setItem("pe_standard_var_cost", String(val)); 
                    localStorage.setItem("pe_step_var", String(step)); 
                    localStorage.setItem("pe_min_var", String(mn));
                    localStorage.setItem("pe_max_var", String(mx));
                    setStandardVariableCostPct(val); 
                    setStepVar(step); 
                    setMinVar(mn);
                    setMaxVar(mx);
                    setVariableCostPct(val); 
                  }
                  else if (modal === "buffet") { 
                    localStorage.setItem("pe_standard_buffet_daily", String(val)); 
                    localStorage.setItem("pe_step_buffet", String(step)); 
                    localStorage.setItem("pe_min_buffet", String(mn));
                    localStorage.setItem("pe_max_buffet", String(mx));
                    setStandardBuffetDaily(val); 
                    setStepBuffet(step); 
                    setMinBuffet(mn);
                    setMaxBuffet(mx);
                    setBuffetSimDaily(val); 
                  }
                  else if (modal === "otros") { 
                    localStorage.setItem("pe_standard_otros_monthly", String(val)); 
                    localStorage.setItem("pe_step_otros", String(step)); 
                    localStorage.setItem("pe_min_otros", String(mn));
                    localStorage.setItem("pe_max_otros", String(mx));
                    setStandardOtrosMonthly(val); 
                    setStepOtros(step); 
                    setMinOtros(mn);
                    setMaxOtros(mx);
                    setOtrosSim(val); 
                  }
                  setModal(null);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors opacity-100"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

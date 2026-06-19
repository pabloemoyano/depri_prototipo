import React, { useState, useEffect, useMemo } from "react";
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
  Play
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
}

interface PuntoEquilibrioProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const PuntoEquilibrio: React.FC<PuntoEquilibrioProps> = ({ apiFetch }) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [history, setHistory] = useState<CajaV2Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("Junio 2026");

  // Dynamic variable cost factor
  const [variableCostPct, setVariableCostPct] = useState<number>(15); // e.g. 15% generic variable cost (food COGS, ball wear, lights)
  const [averageCourtPrice, setAverageCourtPrice] = useState<number>(8000); // ARS per 1 hour slot

  const monthOptions = [
    "Enero 2026", "Febrero 2026", "Marzo 2026", "Abril 2026", "Mayo 2026", "Junio 2026",
    "Julio 2026", "Agosto 2026", "Septiembre 2026", "Octubre 2026", "Noviembre 2026", "Diciembre 2026"
  ];

  const loadData = async () => {
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
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute fixed costs from monthly budget targets
  const fixedCostsTotal = useMemo(() => {
    const matched = budgets.filter(b => b.monthStr === selectedPeriod);
    if (matched.length > 0) {
      return matched.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    }
    // Fallback default if no budget is created yet
    return 140000; 
  }, [budgets, selectedPeriod]);

  // Compute break-even point
  // PE ($) = Costos Fijos / (1 - (CV / Ventas))
  // contribution base (1 - ratio)
  const contributionRatio = useMemo(() => {
    return 1 - (variableCostPct / 100);
  }, [variableCostPct]);

  const breakEvenDollars = useMemo(() => {
    if (contributionRatio <= 0.05) return fixedCostsTotal; // Prevent infinity edge case
    return Math.round(fixedCostsTotal / contributionRatio);
  }, [fixedCostsTotal, contributionRatio]);

  // Translate break-even threshold into required slots to survive
  const requiredTurns = useMemo(() => {
    if (averageCourtPrice <= 100) return 100;
    return Math.ceil(breakEvenDollars / averageCourtPrice);
  }, [breakEvenDollars, averageCourtPrice]);

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
          <span className="text-[10.5px] font-black uppercase text-slate-550 font-mono font-bold">Período:</span>
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

      {/* 2. Visual equilibrium gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PE Metrics Card */}
        <div className="lg:col-span-2 bg-[#09111e] text-white rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between shadow-3xs">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Scale className="w-64 h-64 text-white" />
          </div>

          <div className="space-y-1 z-10">
            <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[9px] font-black uppercase tracking-widest font-mono">
              Umbral Mínimo de Facturación
            </span>
            <h3 className="text-3xl font-black font-mono tracking-tight text-emerald-400 pt-1.5 leading-none">
              ${breakEvenDollars.toLocaleString("es-ES")} <span className="text-xs text-slate-400 font-sans uppercase font-bold tracking-widest">ARS</span>
            </h3>
            <p className="text-[10px] text-slate-300 font-medium leading-relaxed pt-2">
              Ingreso bruto requerido para cubrir el 100% de los costos estructurales fijos y variables. A partir de este límite, cada peso generado representa rentabilidad neta real.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-800/60 pt-5 mt-6 font-mono">
            <div>
              <span className="text-[8.5px] text-slate-400 block uppercase tracking-wider font-sans font-bold">Costos Fijos Estructurales</span>
              <span className="text-sm font-black text-slate-100">${fixedCostsTotal.toLocaleString("es-ES")}</span>
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
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-black uppercase tracking-wider">
              Objetivo de Explotación
            </span>
            <div className="pt-2 leading-none">
              <span className="block text-4xl font-mono font-black text-indigo-950">{requiredTurns}</span>
              <span className="text-[10px] font-black uppercase text-slate-400 font-sans tracking-wide">Reservas de Cancha al Mes</span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium leading-normal pt-2">
              Equivale aproximadamente a <strong className="font-bold">{(requiredTurns / 30).toFixed(1)} reservas diarias</strong> de canchas para empatar los costos del centro deportivo.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4 text-[10px] text-slate-400 font-mono space-y-1 uppercase">
            <div>• Tarifa Promedio Estimada: ${averageCourtPrice.toLocaleString("es-ES")} ARS</div>
            <div>• Canchas Activas: Cancha 1 / Cancha 2</div>
          </div>
        </div>

      </div>

      {/* 3. Parametric simulator widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border border-slate-150 rounded-2xl p-6">
        
        {/* Sliders adjustments */}
        <div className="space-y-5">
          <div>
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-slate-500" />
              Simulador Paramétrico de Rentabilidad
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">Simula desvíos en base a variaciones de precios y márgenes variables</p>
          </div>

          <div className="space-y-4">
            {/* Slider 1: Variable cost percent */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px] font-black uppercase font-mono">
                <span className="text-slate-600">Porcentaje Costos Variables (%):</span>
                <span className="text-indigo-650">{variableCostPct}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={variableCostPct}
                onChange={e => setVariableCostPct(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
              />
              <span className="block text-[8.5px] text-slate-400 font-medium">Consumo de bar bar stock, bolas, desgaste de alfombra de césped y pérdidas variables.</span>
            </div>

            {/* Slider 2: Average slot court rate */}
            <div className="space-y-1 pt-2">
              <div className="flex justify-between items-center text-[11px] font-black uppercase font-mono">
                <span className="text-slate-600">Tarifa Promedio Turno Cancha ($):</span>
                <span className="text-indigo-650">${averageCourtPrice.toLocaleString("es-ES")}</span>
              </div>
              <input
                type="range"
                min="3000"
                max="15000"
                step="500"
                value={averageCourtPrice}
                onChange={e => setAverageCourtPrice(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
              />
              <span className="block text-[8.5px] text-slate-400 font-medium">Impacta de manera directa disminuyendo o aumentando los turnos mínimos para alcanzar break-even.</span>
            </div>
          </div>
        </div>

        {/* Dynamic calculation steps explanation */}
        <div className="p-5 bg-[#fafbfd] border border-slate-100 rounded-xl space-y-3.5 text-xs text-slate-650 font-medium">
          <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> Detalle Matemático del Cálculo
          </h4>
          
          <div className="space-y-2 font-mono text-[10.5px]">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">1. Costos Fijos Consolidados:</span>
              <span>Total Planificado Fijo = <strong>${fixedCostsTotal.toLocaleString("es-ES")}</strong></span>
            </div>
            
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">2. Factor de Beneficio:</span>
              <span>1 - (CV / Ventas) = 1 - ({variableCostPct / 100}) = <strong>{contributionRatio.toFixed(2)}</strong></span>
            </div>

            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">3. Fórmula de Equilibrio Evaluada:</span>
              <span>Punto Equilibrio = Costos Fijos / {contributionRatio.toFixed(2)} = <strong>${breakEvenDollars.toLocaleString("es-ES")} ARS</strong></span>
            </div>
          </div>

          <div className="p-2.5 bg-indigo-50 text-indigo-950 font-sans text-[10.5px] rounded-lg border border-indigo-100/50">
            <strong>Conclusión:</strong> El complejo deportivo necesita facturar un mínimo de <strong>${breakEvenDollars.toLocaleString("es-ES")} ARS</strong> en el mes de <strong>{selectedPeriod}</strong> para no sufrir pérdidas.
          </div>
        </div>

      </div>

    </div>
  );
};

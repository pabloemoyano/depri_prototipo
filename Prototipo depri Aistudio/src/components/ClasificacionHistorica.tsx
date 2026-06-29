import React, { useState, useEffect, useMemo } from "react";
import { 
  Tag, 
  Search, 
  Filter, 
  Calendar, 
  FolderTree, 
  CheckCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight, 
  Save, 
  CheckSquare, 
  Square, 
  Info, 
  Loader2, 
  RefreshCw,
  AlertOctagon,
  ChevronUp
} from "lucide-react";
import { 
  getUnifiedAccounts, 
  getUnifiedSubaccounts, 
  Account, 
  Subaccount,
  getAccountLabel,
  getSubaccountLabel
} from "../lib/accountManager";

interface ClasificacionHistoricaProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

// Representación unificada en memoria para la grilla
interface MovementItem {
  key: string; // "manual_{id}" o "caja_personal_{boxId}" o "caja_oe_{boxId}_{oeId}" o "caja_oi_{boxId}_{oiId}"
  id: string; // ID interno del objeto (del asiento manual, o de la sesión de caja, o del egreso/ingreso)
  boxId?: string; // ID de la sesión de caja si es de origen caja_history
  origin: "ledger_manual" | "caja_personal" | "caja_oe" | "caja_oi";
  originLabel: string;
  date: string;
  description: string;
  amount: number;
  type: "Ingreso" | "Egreso" | "Ajuste";
  account: string;
  subaccount: string;
  periodoImputado: string;
  isPending: boolean;
}

export const ClasificacionHistorica: React.FC<ClasificacionHistoricaProps> = ({ apiFetch }) => {
  // Datos crudos del servidor
  const [manualEntries, setManualEntries] = useState<any[]>([]);
  const [cajaHistory, setCajaHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filtros de visualización
  const [filterState, setFilterState] = useState<"Todos" | "Pendientes" | "Clasificados">("Todos");
  const [filterPeriod, setFilterPeriod] = useState<string>("Todos");
  const [filterAccount, setFilterAccount] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Renglones seleccionados para clasificación masiva
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Registro en edición individual (Key del movimiento en edición)
  const [editingKey, setEditingKey] = useState<string | null>(null);
  
  // Valores seleccionados para la edición (Individual o Masiva)
  // Almacenamos IDs del Plan Maestro
  const [selectedAccountVal, setSelectedAccountVal] = useState<string>("");
  const [selectedSubaccountVal, setSelectedSubaccountVal] = useState<string>("");
  const [selectedPeriodVal, setSelectedPeriodVal] = useState<string>("");

  // Plan de cuentas unificado maestro en memoria
  const masterAccounts = useMemo(() => getUnifiedAccounts(), []);

  // Meses disponibles (consecuente con PresupuestoMensual)
  const monthOptions = useMemo(() => [
    "Enero 2026", "Febrero 2026", "Marzo 2026", "Abril 2026", "Mayo 2026", "Junio 2026",
    "Julio 2026", "Agosto 2026", "Septiembre 2026", "Octubre 2026", "Noviembre 2026", "Diciembre 2026"
  ], []);

  // Carga inicial de datos
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Cargar Libro de Gestión (Asientos manuales)
      const resL = await apiFetch("/api/ledger-manual");
      if (resL.ok) {
        const dataL = await resL.json();
        if (Array.isArray(dataL)) {
          setManualEntries(dataL);
        }
      } else {
        console.error("Error al recuperar el libro manual");
      }

      // Cargar Cajas Históricas
      const resH = await apiFetch("/api/caja/history");
      if (resH.ok) {
        const dataH = await resH.json();
        if (Array.isArray(dataH)) {
          setCajaHistory(dataH);
        }
      } else {
        console.error("Error al recuperar el historial de caja");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Error de conexión al servidor al cargar movimientos históricos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Determinar si una fila está pendiente
  const checkIfPending = (account: string, subaccount: string, periodo: string) => {
    if (!periodo || periodo.trim() === "" || !monthOptions.includes(periodo)) return true;
    if (!account || account.trim() === "") return true;

    // Buscar si existe en el Plan Maestro
    const matchedAcc = masterAccounts.find(
      a => a.label.toLowerCase() === account.toLowerCase() || a.id.toLowerCase() === account.toLowerCase()
    );
    if (!matchedAcc) return true;

    if (!subaccount || subaccount.trim() === "") return true;

    // Buscar si la subcuenta existe para esa cuenta
    const matchedSub = matchedAcc.subaccounts.find(
      s => s.label.toLowerCase() === subaccount.toLowerCase() || s.id.toLowerCase() === subaccount.toLowerCase()
    );
    if (!matchedSub) return true;

    return false;
  };

  // Compilar todos los movimientos de ambos orígenes en una lista plana unificada
  const compiledMovements = useMemo((): MovementItem[] => {
    const list: MovementItem[] = [];

    // 1. Agregar asientos manuales
    manualEntries.forEach(entry => {
      const isPend = checkIfPending(entry.account, entry.subaccount, entry.periodoImputado);
      list.push({
        key: `manual_${entry.id}`,
        id: entry.id,
        origin: "ledger_manual",
        originLabel: "Libro de Gestión (Manual)",
        date: entry.date,
        description: entry.description || "Asiento manual sin descripción",
        amount: Number(entry.haber) || Number(entry.debe) || 0,
        type: Number(entry.haber) > 0 ? "Egreso" : "Ingreso",
        account: entry.account || "",
        subaccount: entry.subaccount || "",
        periodoImputado: entry.periodoImputado || "",
        isPending: isPend
      });
    });

    // 2. Agregar ítems de cajas del historial
    cajaHistory.forEach(box => {
      const bDate = box.dateStr || "Fecha No Definida";

      let defaultPeriod = "";
      try {
        const dateObj = new Date(bDate + "T12:00:00");
        const monthName = dateObj.toLocaleString("es-ES", { month: "long" });
        defaultPeriod = monthName[0].toUpperCase() + monthName.substring(1) + " " + dateObj.getFullYear();
      } catch (err) {
        defaultPeriod = "";
      }

      // A) Pago a Personal
      if (Number(box.personalAmount) > 0) {
        const acc = box.personalAccount || "";
        const sub = box.personalDescription || "";
        const period = box.personalPeriodoImputado || defaultPeriod;
        const isPend = checkIfPending(acc, sub, period);

        list.push({
          key: `caja_personal_${box.id}`,
          id: box.id,
          boxId: box.id,
          origin: "caja_personal",
          originLabel: "Caja Diaria (Personal/Sueldo)",
          date: bDate,
          description: box.personalDescription || `Pago personal hoja caja #${box.id}`,
          amount: Number(box.personalAmount),
          type: "Egreso",
          account: acc,
          subaccount: sub,
          periodoImputado: period,
          isPending: isPend
        });
      }

      // B) Otros Egresos
      if (Array.isArray(box.otrosEgresos)) {
        box.otrosEgresos.forEach((oe: any) => {
          const matchedAcc = masterAccounts.find((a: any) => a.id === oe.accountId);
          const acc = matchedAcc ? matchedAcc.label : (oe.account || "");
          const matchedSub = matchedAcc?.subaccounts.find((s: any) => s.id === oe.subaccountId);
          const sub = matchedSub ? matchedSub.label : (oe.suggestedSubaccount || oe.description || "");
          const period = oe.periodoImputado || defaultPeriod;
          const isPend = checkIfPending(acc, sub, period);

          list.push({
            key: `caja_oe_${box.id}_${oe.id}`,
            id: oe.id,
            boxId: box.id,
            origin: "caja_oe",
            originLabel: "Caja Diaria (Egreso Extra)",
            date: bDate,
            description: oe.description || "Egreso adicional",
            amount: (Number(oe.amount) || 0) * (Number(oe.quantity) || 1),
            type: "Egreso",
            account: acc,
            subaccount: sub,
            periodoImputado: period,
            isPending: isPend
          });
        });
      }

      // C) Otros Ingresos
      if (Array.isArray(box.otrosIngresos)) {
        box.otrosIngresos.forEach((oi: any) => {
          const matchedAcc = masterAccounts.find((a: any) => a.id === oi.accountId);
          const acc = matchedAcc ? matchedAcc.label : (oi.account || "");
          const matchedSub = matchedAcc?.subaccounts.find((s: any) => s.id === oi.subaccountId);
          const sub = matchedSub ? matchedSub.label : (oi.suggestedSubaccount || oi.description || "");
          const period = oi.periodoImputado || defaultPeriod;
          const isPend = checkIfPending(acc, sub, period);

          list.push({
            key: `caja_oi_${box.id}_${oi.id}`,
            id: oi.id,
            boxId: box.id,
            origin: "caja_oi",
            originLabel: "Caja Diaria (Ingreso Extra)",
            date: bDate,
            description: oi.description || "Ingreso adicional",
            amount: (Number(oi.amount) || 0) * (Number(oi.quantity) || 1),
            type: "Ingreso",
            account: acc,
            subaccount: sub,
            periodoImputado: period,
            isPending: isPend
          });
        });
      }
    });

    // Ordenar de forma descendente por fecha
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [manualEntries, cajaHistory, masterAccounts, monthOptions]);

  // Lista única de cuentas y períodos que existen actualmente en la grilla para los filtros superiores
  const existingAccountsList = useMemo(() => {
    const set = new Set<string>();
    compiledMovements.forEach(m => {
      if (m.account && m.account.trim() !== "") set.add(m.account);
    });
    return Array.from(set).sort();
  }, [compiledMovements]);

  const existingPeriodsList = useMemo(() => {
    const set = new Set<string>();
    compiledMovements.forEach(m => {
      if (m.periodoImputado && m.periodoImputado.trim() !== "") set.add(m.periodoImputado);
    });
    return Array.from(set).sort();
  }, [compiledMovements]);

  // Filtrado final de la grilla
  const filteredMovements = useMemo(() => {
    return compiledMovements.filter(item => {
      // Filtro de Estado
      if (filterState === "Pendientes" && !item.isPending) return false;
      if (filterState === "Clasificados" && item.isPending) return false;

      // Filtro de Período
      if (filterPeriod !== "Todos" && item.periodoImputado !== filterPeriod) return false;

      // Filtro de Cuenta
      if (filterAccount !== "Todos" && item.account !== filterAccount) return false;

      // Filtro de Búsqueda Textual
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesDesc = item.description?.toLowerCase().includes(query);
        const matchesOrig = item.originLabel?.toLowerCase().includes(query);
        const matchesAmt = item.amount.toString().includes(query);
        const matchesAcc = item.account?.toLowerCase().includes(query);
        const matchesSub = item.subaccount?.toLowerCase().includes(query);
        if (!matchesDesc && !matchesOrig && !matchesAmt && !matchesAcc && !matchesSub) return false;
      }

      return true;
    });
  }, [compiledMovements, filterState, filterPeriod, filterAccount, searchQuery]);

  // Métricas rápidas arriba de la tabla (en base al universo compilado)
  const metrics = useMemo(() => {
    const total = compiledMovements.length;
    const pending = compiledMovements.filter(m => m.isPending).length;
    const classified = total - pending;
    return { total, pending, classified };
  }, [compiledMovements]);

  // Subcuentas dinámicas para la cuenta seleccionada en el formulario
  const activeSubaccounts = useMemo((): Subaccount[] => {
    console.log("[CH-EDIT-3] ActiveSubaccounts calc", { selectedAccountVal });
    if (!selectedAccountVal) return [];
    // Buscar la cuenta en el plan maestro por id o por label
    const acc = masterAccounts.find(
      a => a.label === selectedAccountVal || a.id === selectedAccountVal
    );
    return acc ? acc.subaccounts : [];
  }, [selectedAccountVal, masterAccounts]);

  // Modo Edición Individual o Masiva inicializador
  const startEdit = (item: MovementItem) => {
    console.log("[CH-EDIT-1] StartEdit entry", {
      itemKey: item.key,
      origin: item.origin,
      account: item.account,
      subaccount: item.subaccount
    });
    console.log("[CH-EDIT-2] Before setting editingKey", { currentEditingKey: editingKey, newItemKey: item.key });
    setEditingKey(item.key);
    setSelectedKeys([]); // Limpiar selección masiva
    setSelectedAccountVal(item.account || "");
    setSelectedSubaccountVal(item.subaccount || "");
    setSelectedPeriodVal(item.periodoImputado || "");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setSelectedAccountVal("");
    setSelectedSubaccountVal("");
    setSelectedPeriodVal("");
  };

  // Inicializa asignadores para edición masiva
  const startBulkEdit = () => {
    setEditingKey(null);
    setSelectedAccountVal("");
    setSelectedSubaccountVal("");
    setSelectedPeriodVal("");
  };

  // Selección múltiple
  const handleToggleSelectRow = (key: string) => {
    setSelectedKeys(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
    setEditingKey(null); // Cancelar edición individual si se selecciona masivo
  };

  const handleToggleSelectAll = () => {
    if (selectedKeys.length === filteredMovements.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(filteredMovements.map(m => m.key));
    }
    setEditingKey(null);
  };

  // Rutina de guardado de clasificaciones (Individual o Masiva)
  const saveClassification = async (keysToSave: string[], accId: string, subaccId: string, periodStr: string) => {
    console.log("[CH-2] saveClassification entered", { accId, subaccId, periodStr, keysToSaveLength: keysToSave.length });
    // 1. Resolver etiquetas a partir de los IDs
    const accountObj = masterAccounts.find(a => a.id === accId);
    const subaccountObj = accountObj?.subaccounts.find(s => s.id === subaccId);

    const accLabel = accountObj?.label || "Sin Cuenta";
    const subLabel = subaccountObj?.label || (subaccId || "Sin Subcuenta");

    if (!accId || accId.trim() === "") {
      console.log("[CH-3] Early return: missing account");
      alert("Por favor selecciona una Cuenta válida.");
      return;
    }
    if (!subaccId || subaccId.trim() === "") {
      console.log("[CH-3] Early return: missing subaccount");
      alert("Por favor selecciona una Subcuenta válida.");
      return;
    }
    if (!periodStr || periodStr.trim() === "") {
      console.log("[CH-3] Early return: missing period");
      alert("Por favor selecciona un Período Imputado válido.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Necesitaremos procesar secuencialmente o en paralelo
      // Para evitar transiciones raras, guardaremos los clones de state adaptados localmente y los mandaremos a guardar
      let updatedManuals = [...manualEntries];
      let updatedCajaHistory = [...cajaHistory];

      // Mapear cada elemento a procesar
      for (const key of keysToSave) {
        const item = compiledMovements.find(m => m.key === key);
        if (!item) continue;

        if (item.origin === "ledger_manual") {
          // Actualizar asiento manual
          const entryIdx = updatedManuals.findIndex(m => m.id === item.id);
          if (entryIdx !== -1) {
            const updatedEntry = {
              ...updatedManuals[entryIdx],
              accountId: accId,
              subaccountId: subaccId,
              account: accLabel,
              description: subLabel,
              periodoImputado: periodStr
            };
            
            // Post al endpoint
            console.log("[CH-4] About to call API ledger-manual", { updatedEntry });
            const res = await apiFetch("/api/ledger-manual", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updatedEntry)
            });
            console.log("[CH-5] API response ledger-manual", { ok: res.ok, status: res.status });

            if (res.ok) {
              const freshEntry = await res.json();
              updatedManuals[entryIdx] = freshEntry;
            } else {
              throw new Error("Fallo al actualizar el Libro de Gestión en el servidor.");
            }
          }
        } else {
          // Proviene de caja_history
          const boxIdx = updatedCajaHistory.findIndex(h => h.id === item.boxId);
          if (boxIdx !== -1) {
            const freshBox = { ...updatedCajaHistory[boxIdx] };

            if (item.origin === "caja_personal") {
              freshBox.personalAccountId = accId;
              freshBox.personalSubaccountId = subaccId;
              freshBox.personalAccount = accLabel;
              freshBox.personalDescription = subLabel;
              freshBox.personalPeriodoImputado = periodStr;
            } else if (item.origin === "caja_oe") {
              if (Array.isArray(freshBox.otrosEgresos)) {
                freshBox.otrosEgresos = freshBox.otrosEgresos.map((oe: any) => {
                  if (oe.id === item.id) {
                    return {
                      ...oe,
                      accountId: accId,
                      subaccountId: subaccId,
                      account: accLabel,
                      description: subLabel,
                      periodoImputado: periodStr
                    };
                  }
                  return oe;
                });
              }
            } else if (item.origin === "caja_oi") {
              if (Array.isArray(freshBox.otrosIngresos)) {
                freshBox.otrosIngresos = freshBox.otrosIngresos.map((oi: any) => {
                  if (oi.id === item.id) {
                    return {
                      ...oi,
                      accountId: accId,
                      subaccountId: subaccId,
                      account: accLabel,
                      description: subLabel,
                      periodoImputado: periodStr
                    };
                  }
                  return oi;
                });
              }
            }

            // Guardar toda la caja
            console.log("[CH-4] About to call API caja/history", { freshBox });
            const res = await apiFetch("/api/caja/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(freshBox)
            });
            console.log("[CH-5] API response caja/history", { ok: res.ok, status: res.status });

            if (res.ok) {
              const freshSavedBox = await res.json();
              updatedCajaHistory[boxIdx] = freshSavedBox;
            } else {
              throw new Error("Fallo al actualizar la caja histórica en el servidor.");
            }
          }
        }
      }

      // Actualizar estados locales de forma limpia
      setManualEntries(updatedManuals);
      setCajaHistory(updatedCajaHistory);

      setSuccessMsg(`¡Se clasificaron con éxito ${keysToSave.length} movimiento(s)! Los presupuestos mensuales recalcularán ejecutados nativamente.`);
      
      // Limpiar selecciones y ediciones
      setEditingKey(null);
      setSelectedKeys([]);
      setSelectedAccountVal("");
      setSelectedSubaccountVal("");
      setSelectedPeriodVal("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Ocurrió un error inesperado al guardar la clasificación: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // Manejar Click de Guardado Individual
  const handleSaveIndividual = () => {
    console.log("[CH-1] Click Guardar detectado (Individual)", { editingKey, selectedAccountVal, selectedSubaccountVal, selectedPeriodVal });
    if (!editingKey) return;
    saveClassification([editingKey], selectedAccountVal, selectedSubaccountVal, selectedPeriodVal);
  };

  // Manejar Click de Guardado Masivo
  const handleSaveBulk = () => {
    console.log("[CH-1] Click Guardar detectado (Masivo)", { selectedKeys, selectedAccountVal, selectedSubaccountVal, selectedPeriodVal });
    if (selectedKeys.length === 0) return;
    if (confirm(`¿Estás seguro de que deseas clasificar en lote los ${selectedKeys.length} movimientos seleccionados con estos nuevos valores?\nEsto actualizará directamente las partidas originales en la base de datos.`)) {
      saveClassification(selectedKeys, selectedAccountVal, selectedSubaccountVal, selectedPeriodVal);
    }
  };

  return (
    <div className="space-y-6" id="fin-clasificacion-seccion">
      
      {/* Encabezado e instrucciones conceptuales */}
      <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4" id="clasif-header-info">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <Tag size={18} className="stroke-[2.5]" />
            </span>
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 leading-none">
              Clasificación Financiera Histórica
            </h1>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Asigna Cuenta, Subcuenta y Período Imputado a asientos manuales de gestión y egresos de caja históricos. 
            El módulo de <strong>Presupuesto Mensual</strong> integrará automáticamente estas partidas de manera nativa e inmediata.
          </p>
        </div>
        
        <button
          onClick={loadData}
          disabled={loading || saving}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50/50 p-2.5 px-4 rounded-xl shadow-sm transition disabled:opacity-50"
          id="btn-recargar-movimientos"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualizar Registros
        </button>
      </div>

      {/* Tarjetas de Métricas de Armonización */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="clasif-cards-metricas">
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Movimientos</p>
            <h2 className="text-2xl font-black text-slate-900 font-mono">{loading ? "..." : metrics.total}</h2>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-lg font-bold text-sm">
            100%
          </div>
        </div>

        <div className="bg-white border border-amber-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pendientes de Clasificación</p>
            <h2 className="text-2xl font-black text-amber-600 font-mono">{loading ? "..." : metrics.pending}</h2>
          </div>
          <div className={`p-2.5 rounded-lg text-xs font-bold font-mono ${metrics.pending > 0 ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-green-100 text-green-700"}`}>
            {metrics.pending > 0 ? `${((metrics.pending / (metrics.total || 1)) * 100).toFixed(0)}%` : "0%"}
          </div>
        </div>

        <div className="bg-white border border-green-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Registros Clasificados</p>
            <h2 className="text-2xl font-black text-green-600 font-mono">{loading ? "..." : metrics.classified}</h2>
          </div>
          <div className="p-2.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold font-mono">
            {metrics.total > 0 ? `${((metrics.classified / metrics.total) * 100).toFixed(0)}%` : "0%"}
          </div>
        </div>
      </div>

      {/* Alertas de Éxito / Error */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-lg flex items-center gap-2" id="clasif-msg-error">
          <AlertOctagon size={16} className="text-rose-600 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-3.5 rounded-lg flex items-center gap-2 animate-bounce" id="clasif-msg-exito">
          <CheckCircle size={16} className="text-green-600 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* SECCIÓN EDICIÓN (INDIVIDUAL O MASIVA) - Se despliega de forma destacada en la parte superior si está activo */}
      {(editingKey !== null || selectedKeys.length > 0) && (
        <div className="bg-indigo-50/70 border border-indigo-200/70 p-5 rounded-2xl shadow-sm space-y-4 animate-fadeIn" id="clasif-card-editor">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 bg-indigo-600 text-white rounded text-[10px] font-black uppercase tracking-wider">
                {editingKey !== null ? "Clasificación Individual" : "Clasificación Masiva en Lote"}
              </span>
              <p className="text-xs text-indigo-950 font-bold">
                {editingKey !== null 
                  ? `Editando un movimiento seleccionado.` 
                  : `Actualizando ${selectedKeys.length} registros seleccionados de forma simultánea.`}
              </p>
            </div>
            <button 
              onClick={cancelEdit}
              className="text-xs text-indigo-700 hover:text-indigo-950 font-black uppercase tracking-wider bg-white rounded border border-indigo-200 p-1 px-2"
              id="btn-cancelar-edicion"
            >
              Cerrar Editor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Combo Cuenta */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Cuenta (Plan Maestro)</label>
              <select
                value={selectedAccountVal}
                onChange={e => {
                  setSelectedAccountVal(e.target.value);
                  setSelectedSubaccountVal(""); // reset subaccount, wait for selection
                }}
                className="w-full text-xs font-black p-2 bg-white border border-indigo-200 rounded-lg text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                id="select-clasif-cuenta"
              >
                <option value="">Selecciona una Cuenta...</option>
                {masterAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Combo Subcuenta */}
            <div className="space-y-1" onLoad={() => console.log("[CH-EDIT-4] Editor Render", { editingKey })}>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Subcuenta (Plan Maestro)</label>
              <select
                value={selectedSubaccountVal}
                onFocus={() => console.log("[CH-EDIT-5] Subaccount dropdown focus", { selectedAccountVal, selectedSubaccountVal, activeSubaccountsLength: activeSubaccounts.length })}
                onChange={e => setSelectedSubaccountVal(e.target.value)}
                disabled={!selectedAccountVal}
                className="w-full text-xs font-black p-2 bg-white border border-indigo-200 rounded-lg text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                id="select-clasif-subcuenta"
              >
                <option value="">Selecciona una Subcuenta...</option>
                {activeSubaccounts.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Combo Período Imputado */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Período Imputado</label>
              <select
                value={selectedPeriodVal}
                onChange={e => setSelectedPeriodVal(e.target.value)}
                className="w-full text-xs font-black p-2 bg-white border border-indigo-200 rounded-lg text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                id="select-clasif-periodo"
              >
                <option value="">Selecciona el Período...</option>
                {monthOptions.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón Guardar */}
            <div>
              {editingKey !== null ? (
                <button
                  onClick={handleSaveIndividual}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider p-2.5 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
                  id="btn-guardar-clasif-indiv"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      Guardar Clasificación
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSaveBulk}
                  disabled={saving || selectedKeys.length === 0}
                  className="w-full flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider p-2.5 rounded-lg text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition disabled:opacity-50"
                  id="btn-guardar-clasif-masiva"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Guardando Lote...
                    </>
                  ) : (
                    <>
                      <CheckSquare size={14} />
                      Aplicar en Lote ({selectedKeys.length})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN DE FILTROS SUPERIORES DE BÚSQUEDA */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-4" id="clasif-panel-filtros">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          
          {/* Tabs del Filtro de Estado */}
          <div className="flex bg-slate-100 p-1 rounded-xl self-start md:self-auto" id="clasif-tabs-estado">
            {(["Todos", "Pendientes", "Clasificados"] as const).map(tab => {
              const isActive = filterState === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setFilterState(tab);
                    setSelectedKeys([]); // Limpiar selección al cambiar de estado
                  }}
                  className={`text-xs font-black uppercase tracking-wider p-2 px-4 rounded-lg transform duration-150 ${
                    isActive 
                      ? "bg-white text-indigo-700 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  id={`btn-filtro-estado-${tab.toLowerCase()}`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 items-center">
            
            {/* Selector de Período */}
            <div className="w-full sm:w-48 flex items-center gap-1.5 border border-slate-200 rounded-xl p-1 px-2.5 bg-slate-50">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <select
                value={filterPeriod}
                onChange={e => setFilterPeriod(e.target.value)}
                className="w-full text-[11px] font-black text-slate-700 uppercase bg-transparent border-none outline-none cursor-pointer"
                id="filtro-periodo-historias"
              >
                <option value="Todos">PERÍODO: TODOS</option>
                {existingPeriodsList.map(p => (
                  <option key={p} value={p}>{p.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Selector de Cuenta */}
            <div className="w-full sm:w-48 flex items-center gap-1.5 border border-slate-200 rounded-xl p-1 px-2.5 bg-slate-50">
              <FolderTree size={13} className="text-slate-400 shrink-0" />
              <select
                value={filterAccount}
                onChange={e => setFilterAccount(e.target.value)}
                className="w-full text-[11px] font-black text-slate-700 uppercase bg-transparent border-none outline-none cursor-pointer"
                id="filtro-cuenta-historias"
              >
                <option value="Todos">CUENTA: TODOS</option>
                {existingAccountsList.map(a => (
                  <option key={a} value={a}>{a.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Buscador de Texto */}
            <div className="w-full sm:w-64 flex items-center gap-1.5 border border-slate-200 rounded-xl p-2 px-3 focus-within:ring-2 focus-within:ring-indigo-500/10 transition">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por descripción, origen..."
                className="w-full text-xs text-slate-800 placeholder-slate-400 outline-none font-semibold bg-transparent"
                id="busqueda-textual-clasif"
              />
            </div>
          </div>
        </div>
      </div>

      {/* DATAGRID / LISTA DE MOVIMIENTOS */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden" id="clasif-panel-datagrid">
        {loading ? (
          <div className="p-16 text-center space-y-3" id="clasif-loading-state">
            <Loader2 className="animate-spin h-8 w-8 text-indigo-600 mx-auto stroke-[2.5]" />
            <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Cargando movimientos históricos...</p>
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="p-16 text-center space-y-2 text-slate-400" id="clasif-empty-state">
            <AlertTriangle className="h-8 w-8 text-slate-300 mx-auto stroke-[2]" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-600">No se encontraron movimientos</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No hay registros que coincidan con los filtros seleccionados. Intenta cambiar de filtro o actualizar la base de datos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="table-clasif-historica">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 select-none">
                  {/* Selector Header */}
                  <th className="p-4 w-12 text-center">
                    <button 
                      onClick={handleToggleSelectAll}
                      className="text-slate-400 hover:text-indigo-600 transition"
                      id="checkbox-seleccionar-todos"
                    >
                      {selectedKeys.length === filteredMovements.length ? (
                        <CheckSquare size={16} className="text-indigo-600 shrink-0" />
                      ) : (
                        <Square size={16} className="shrink-0" />
                      )}
                    </button>
                  </th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-wider">Origen</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-wider">Fecha</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-wider">Descripción</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-wider text-right">Importe</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-wider">Cuenta</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-wider">Subcuenta</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-wider">Período</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-wider text-center">Estado</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.map(item => {
                  const isRowSelected = selectedKeys.includes(item.key);
                  const isRowEditing = editingKey === item.key;
                  
                  return (
                    <tr 
                      key={item.key}
                      className={`hover:bg-slate-50/50 transition duration-150 ${
                        isRowSelected ? "bg-amber-50/40 hover:bg-amber-50/60" : ""
                      } ${
                        isRowEditing ? "bg-indigo-50/45" : ""
                      }`}
                      id={`row-clasif-${item.key}`}
                    >
                      {/* Checkbox Selector */}
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handleToggleSelectRow(item.key)}
                          className="text-slate-400 hover:text-indigo-600 transition"
                          id={`checkbox-seleccionar-fila-${item.key}`}
                        >
                          {isRowSelected ? (
                            <CheckSquare size={16} className="text-indigo-600 shrink-0" />
                          ) : (
                            <Square size={16} className="text-slate-300 hover:text-slate-400 shrink-0" />
                          )}
                        </button>
                      </td>

                      {/* Origen */}
                      <td className="p-4">
                        <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          item.origin.startsWith("caja") 
                            ? "bg-sky-50 text-sky-700 border border-sky-200/40" 
                            : "bg-purple-50 text-purple-700 border border-purple-200/40"
                        }`}>
                          {item.originLabel}
                        </span>
                      </td>

                      {/* Fecha */}
                      <td className="p-4 font-mono text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                        {item.date}
                      </td>

                      {/* Descripción */}
                      <td className="p-4 max-w-xs">
                        <p className="text-xs font-bold text-slate-800 line-clamp-2" title={item.description}>
                          {item.description}
                        </p>
                      </td>

                      {/* Importe */}
                      <td className="p-4 text-right">
                        <span className={`font-mono text-xs font-black ${
                          item.type === "Ingreso" ? "text-emerald-600" : "text-slate-800"
                        }`}>
                          {item.type === "Ingreso" ? "+" : "-"}${item.amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Cuenta */}
                      <td className="p-4">
                        {item.account ? (
                          <span className="text-xs font-bold text-slate-600">{getAccountLabel(item.account)}</span>
                        ) : (
                          <span className="text-xs text-slate-400 italic font-medium">No Asignada</span>
                        )}
                      </td>

                      {/* Subcuenta */}
                      <td className="p-4">
                        {item.subaccount ? (
                          <span className="text-xs font-bold text-slate-600">{getSubaccountLabel(item.account, item.subaccount)}</span>
                        ) : (
                          <span className="text-xs text-slate-400 italic font-medium">No Asignada</span>
                        )}
                      </td>

                      {/* Período */}
                      <td className="p-4">
                        {item.periodoImputado ? (
                          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 p-1 px-2 rounded-md whitespace-nowrap">
                            {item.periodoImputado}
                          </span>
                        ) : (
                          <span className="text-xs text-red-400 font-bold italic">Ausente</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="p-4 text-center whitespace-nowrap">
                        {item.isPending ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 bg-amber-50 p-1 px-2.5 rounded-full border border-amber-200/50">
                            <AlertTriangle size={11} className="stroke-[2.5]" />
                            Pendiente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-green-600 bg-green-50 p-1 px-2.5 rounded-full border border-green-200/50">
                            <CheckCircle size={11} />
                            Clasificado
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="p-4 text-right">
                        <button
                          onClick={() => startEdit(item)}
                          className={`text-xs font-black uppercase tracking-wider p-1.5 px-3.5 rounded-lg border transition ${
                            isRowEditing 
                              ? "bg-indigo-600 text-white border-indigo-600" 
                              : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50/50"
                          }`}
                          id={`btn-clasificar-fila-${item.key}`}
                        >
                          {item.isPending ? "Clasificar" : "Reclasificar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pié informativo sobre actualización nativa en cascada */}
      <div className="bg-slate-50 border border-slate-200/40 p-4 rounded-xl flex items-start gap-2.5 text-slate-500" id="clasif-tip-container">
        <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-[11px]">
          <p className="font-bold text-slate-700 uppercase tracking-wide">Actualización Sincrónica en Cascada</p>
          <p className="leading-relaxed">
            Las modificaciones realizadas sobre este tablero reescriben los atributos relacionales correspondientes del registro original de forma segura y permanente. 
            El módulo de presupuestos reconstruye e indexa dinámicamente sus balances ejecutados en memoria cada vez que se visualiza, por lo que verás reflejados tus cambios inmediatamente y de forma automatizada en <strong>Finanzas &gt; Presupuestos</strong>.
          </p>
        </div>
      </div>

    </div>
  );
};

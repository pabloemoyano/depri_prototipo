import React, { useState, useMemo } from "react";
import { Printer } from "lucide-react";
import { StockItem, InventoryMovement } from "../types";

interface InventoryHistoryProps {
  stock: StockItem[];
  movements: InventoryMovement[];
}

export const InventoryHistory: React.FC<InventoryHistoryProps> = ({ stock, movements }) => {
  // Helper to construct a Date object shifted to Argentina timezone (UTC-3) for UTC methods
  const getArgDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    let d: Date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      // It's a localized date string like "YYYY-MM-DD". Force it to noon UTC to start.
      d = new Date(`${dateStr}T12:00:00Z`);
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return null;
    
    // Shift the date back by 3 hours so that its UTC methods read as local Argentina time (UTC-3) parts.
    return new Date(d.getTime() - 3 * 60 * 60 * 1000);
  };

  const initialRange = useMemo(() => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000); // Current shifted to Argentina
    const pad = (num: number) => String(num).padStart(2, "0");
    const day = d.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday));
    const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));
    
    return {
      from: `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`,
      to: `${sunday.getUTCFullYear()}-${pad(sunday.getUTCMonth() + 1)}-${pad(sunday.getUTCDate())}`
    };
  }, []);

  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [viewMode, setViewMode] = useState<"diaria" | "semanal" | "mensual" | "anual" | "historico">("diaria");
  const [displayFormat, setDisplayFormat] = useState<"lista" | "matriz">("matriz");
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [showPeriodSelector, setShowPeriodSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const categories = useMemo(() => Array.from(new Set(stock.map(item => item.category))), [stock]);

  // Helper functions to identify product classifications
  const formatQty = (val: number) => {
    if (val === 0) return "";
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(2);
  };

  const isCombo = (item: StockItem) => item.is_recipe === true && (item.components?.length || 0) > 1;
  const isFraccionado = (item: StockItem) => item.is_recipe === true && (item.components?.length || 0) <= 1;
  const isEnvase = (item: StockItem) => item.category?.toLowerCase() === "envases";

  // State to hold selected item IDs
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    stock.forEach(item => {
      const combo = isCombo(item);
      const fraccion = isFraccionado(item);
      const envase = isEnvase(item);
      // Default: checked if NOT combo, NOT fraccionado, NOT envase
      initial[item.id] = !combo && !fraccion && !envase;
    });
    return initial;
  });

  // Sync state if new items are loaded in stock
  React.useEffect(() => {
    setSelectedItemIds(prev => {
      const updated = { ...prev };
      let changed = false;
      stock.forEach(item => {
        if (!(item.id in updated)) {
          const combo = isCombo(item);
          const fraccion = isFraccionado(item);
          const envase = isEnvase(item);
          updated[item.id] = !combo && !fraccion && !envase;
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [stock]);

  // Helper to extract clean local "YYYY-MM-DD" from any movement date ISO/custom string
  const getLocalDateStr = (dateStr: string) => {
    const d = getArgDate(dateStr);
    if (!d) return "";
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getPeriodStr = (dateStr: string) => {
    const d = getArgDate(dateStr);
    if (!d) return "";
    
    if (viewMode === "diaria") {
      const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
      const pad = (num: number) => String(num).padStart(2, "0");
      return `${days[d.getUTCDay()]} ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
    }
    
    if (viewMode === "semanal") {
      const day = d.getUTCDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday));
      
      const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));
      
      const pad = (num: number) => String(num).padStart(2, "0");
      const monStr = `Lun ${pad(monday.getUTCDate())}/${pad(monday.getUTCMonth() + 1)}/${monday.getUTCFullYear()}`;
      const sunStr = `Dom ${pad(sunday.getUTCDate())}/${pad(sunday.getUTCMonth() + 1)}/${sunday.getUTCFullYear()}`;
      return `${monStr} - ${sunStr}`;
    }
    
    if (viewMode === "mensual") {
      const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }

    if (viewMode === "anual") {
      return `${d.getUTCFullYear()}`;
    }

    if (viewMode === "historico") {
      return "Histórico Total";
    }
    
    return getLocalDateStr(dateStr);
  };

  const getDefaultDateRange = (mode: string) => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000); // Current shifted to Argentina
    const currentYear = d.getUTCFullYear();
    const pad = (num: number) => String(num).padStart(2, "0");

    if (mode === "diaria") {
      const day = d.getUTCDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday));
      const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));
      return {
        from: `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`,
        to: `${sunday.getUTCFullYear()}-${pad(sunday.getUTCMonth() + 1)}-${pad(sunday.getUTCDate())}`
      };
    } else if (mode === "semanal") {
      return {
        from: `${currentYear}-01-01`,
        to: `${currentYear}-12-31`
      };
    } else if (mode === "mensual") {
      return {
        from: `${currentYear}-01-01`,
        to: `${currentYear}-12-31`
      };
    } else if (mode === "anual") {
      return {
        from: `${currentYear - 4}-01-01`,
        to: `${currentYear}-12-31`
      };
    } else {
      return {
        from: "",
        to: ""
      };
    }
  };

  const availablePeriods = useMemo(() => {
    const periods = new Set<string>();
    const periodTimes = new Map<string, number>();

    movements.forEach(m => {
      if (!selectedItemIds[m.itemId]) return;

      const mLocalDateStr = getLocalDateStr(m.date);
      if (fromDate && mLocalDateStr < fromDate) return;
      if (toDate && mLocalDateStr > toDate) return;

      const pStr = getPeriodStr(m.date);
      if (pStr) {
        periods.add(pStr);
        const t = new Date(m.date).getTime();
        if (!periodTimes.has(pStr) || t < periodTimes.get(pStr)!) {
          periodTimes.set(pStr, t);
        }
      }
    });

    return Array.from(periods).sort((a, b) => (periodTimes.get(a) || 0) - (periodTimes.get(b) || 0));
  }, [movements, viewMode, fromDate, toDate, selectedItemIds]);

  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);

  React.useEffect(() => {
    setSelectedPeriods(availablePeriods);
  }, [availablePeriods]);

  const isSelectionContinuous = (available: string[], selected: string[]) => {
    if (selected.length <= 1) return true;
    const indices = selected.map(p => available.indexOf(p)).filter(idx => idx !== -1);
    if (indices.length === 0) return true;
    indices.sort((a, b) => a - b);
    for (let i = 0; i < indices.length - 1; i++) {
      if (indices[i + 1] - indices[i] !== 1) {
        return false;
      }
    }
    return true;
  };

  const isSelectionValid = useMemo(() => {
    return isSelectionContinuous(availablePeriods, selectedPeriods);
  }, [availablePeriods, selectedPeriods]);

  const filteredMovements = useMemo(() => {
    return movements.filter(move => {
      const item = stock.find(s => s.id === move.itemId);
      const moveDateStr = getLocalDateStr(move.date);
      
      const matchDateFrom = !fromDate || moveDateStr >= fromDate;
      const matchDateTo = !toDate || moveDateStr <= toDate;
      const matchItem = !!selectedItemIds[move.itemId];
      
      return matchDateFrom && matchDateTo && matchItem;
    });
  }, [movements, fromDate, toDate, selectedItemIds, stock]);

  const sortedSelectedPeriods = useMemo(() => {
    return availablePeriods.filter(p => selectedPeriods.includes(p));
  }, [availablePeriods, selectedPeriods]);

  const pivotData = useMemo(() => {
    if (displayFormat !== "matriz") return null;
    if (!isSelectionValid || sortedSelectedPeriods.length === 0) {
      return { periods: [], rows: [], totals: { stockInicial: 0, stockFinal: 0, periods: {} as Record<string, { compras: number, ventas: number, consumo: number, ajuste: number }> } };
    }

    const itemsToProcess = stock.filter(item => {
      const isActive = item.is_active !== false;
      return isActive && !!selectedItemIds[item.id];
    });
    itemsToProcess.sort((a,b) => a.name.localeCompare(b.name));

    const P_first = sortedSelectedPeriods[0];

    let totals = {
      stockInicial: 0,
      stockFinal: 0,
      periods: {} as Record<string, { compras: number, ventas: number, consumo: number, ajuste: number }>
    };
    
    sortedSelectedPeriods.forEach(p => {
       totals.periods[p] = { compras: 0, ventas: 0, consumo: 0, ajuste: 0 };
    });

    const rows = itemsToProcess.map(item => {
        // Find if there is an INICIAL movement for this item
        const m_init = movements.find(m => m.itemId === item.id && m.type === "INICIAL");
        let stockInicial = 0;

        if (m_init) {
          stockInicial = m_init.quantity;

          // Add/subtract movements strictly after the INICIAL movement's timestamp
          // that are before the active periods
          movements.forEach(m => {
            if (m.itemId !== item.id) return;
            if (m.type === "INICIAL") return; // Already handled as base quantity of stockInicial

            // Ignore historical movements that happened before or at the same time as the INICIAL movement
            if (new Date(m.date).getTime() <= new Date(m_init.date).getTime()) {
              return;
            }

            const mLocalDateStr = getLocalDateStr(m.date);
            if (fromDate && mLocalDateStr < fromDate) {
              stockInicial += m.quantity;
              return;
            }

            const pStr = getPeriodStr(m.date);
            const pIndex = availablePeriods.indexOf(pStr);
            const firstIndex = availablePeriods.indexOf(P_first);

            if (pIndex !== -1 && pIndex < firstIndex) {
              stockInicial += m.quantity;
            }
          });
        } else {
          // No INICIAL movement, sum all movements that are historically before the active range
          movements.forEach(m => {
            if (m.itemId !== item.id) return;

            const mLocalDateStr = getLocalDateStr(m.date);
            if (fromDate && mLocalDateStr < fromDate) {
              stockInicial += m.quantity;
              return;
            }

            const pStr = getPeriodStr(m.date);
            const pIndex = availablePeriods.indexOf(pStr);
            const firstIndex = availablePeriods.indexOf(P_first);

            if (pIndex !== -1 && pIndex < firstIndex) {
              stockInicial += m.quantity;
            }
          });
        }

        // Initialize period data
        const periodData: Record<string, { compras: number, ventas: number, consumo: number, ajuste: number }> = {};
        sortedSelectedPeriods.forEach(p => {
             periodData[p] = { compras: 0, ventas: 0, consumo: 0, ajuste: 0 };
        });

        // Populate period data
        movements.forEach(m => {
          if (m.itemId !== item.id) return;
          if (m.type === "INICIAL") return;

          const mLocalDateStr = getLocalDateStr(m.date);
          if (fromDate && mLocalDateStr < fromDate) return;
          if (toDate && mLocalDateStr > toDate) return;

          const pStr = getPeriodStr(m.date);
          if (pStr && sortedSelectedPeriods.includes(pStr)) {
            if (m.type === "COMPRA") {
              periodData[pStr].compras += m.quantity;
            } else if (m.type === "VENTA") {
              periodData[pStr].ventas += Math.abs(m.quantity);
            } else if (m.type === "CONSUMO") {
              periodData[pStr].consumo += Math.abs(m.quantity);
            } else {
              periodData[pStr].ajuste += m.quantity;
            }
          }
        });

        // Calculate stockFinal
        let stockFinal = stockInicial;
        sortedSelectedPeriods.forEach(p => {
          const d = periodData[p];
          stockFinal += d.compras - d.ventas - d.consumo + d.ajuste;
        });

        return {
            item,
            stockInicial,
            periodData,
            stockFinal
        };
    });

    // Populate totals
    rows.forEach(row => {
      totals.stockInicial += row.stockInicial;
      totals.stockFinal += row.stockFinal;
      sortedSelectedPeriods.forEach(p => {
        totals.periods[p].compras += row.periodData[p].compras;
        totals.periods[p].ventas += row.periodData[p].ventas;
        totals.periods[p].consumo += row.periodData[p].consumo;
        totals.periods[p].ajuste += row.periodData[p].ajuste;
      });
    });

    return { periods: sortedSelectedPeriods, rows, totals };
  }, [displayFormat, movements, stock, viewMode, fromDate, toDate, selectedItemIds, sortedSelectedPeriods, isSelectionValid]);

  const handlePrintKardex = () => {
    try {
      const customLogo = localStorage.getItem("barstock_app_custom_logo") || "/src/assets/images/deprimera_logo_1780923105846.png";
      const isMatrix = displayFormat === "matriz";
      const printWindow = window.open("", "_blank", "width=1000,height=1100,scrollbars=yes,resizable=yes");
      
      if (!printWindow) {
        alert("El bloqueo de ventanas emergentes impidió abrir la planilla de impresión. Por favor, habilítalos.");
        return;
      }

      let tableHtml = "";
      if (!isMatrix) {
        const sortedMoves = [...filteredMovements].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        tableHtml = `
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left;">
                <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 9pt; font-weight: bold;">Fecha</th>
                <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 9pt; font-weight: bold;">Tipo</th>
                <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 9pt; font-weight: bold;">Artículo</th>
                <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 9pt; font-weight: bold; text-align: right;">Cantidad</th>
                <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 9pt; font-weight: bold;">Documento</th>
                <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 9pt; font-weight: bold;">Operador</th>
              </tr>
            </thead>
            <tbody>
              ${sortedMoves.map(move => {
                const item = stock.find(s => s.id === move.itemId);
                const dateStr = new Date(move.date).toLocaleDateString("es-ES") + " " + new Date(move.date).toLocaleTimeString("es-ES", {hour: '2-digit', minute:'2-digit'});
                const qtyStyle = move.quantity > 0 ? "color: #16a34a; font-weight: bold;" : "color: #dc2626; font-weight: bold;";
                const formattedQtyPlain = Number.isInteger(move.quantity) ? move.quantity.toString() : move.quantity.toFixed(2);
                const formattedQty = move.quantity > 0 ? `+${formattedQtyPlain}` : formattedQtyPlain;
                return `
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt; font-family: monospace;">
                      ${dateStr}
                      ${move.purchaseDate && move.purchaseDate !== getLocalDateStr(move.date) ? `<div style="font-size: 7.5pt; color: #4f46e5; font-weight: 600;">Factura: ${move.purchaseDate.split("-").reverse().join("/")}</div>` : ""}
                    </td>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt; font-weight: bold;">${move.type}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt; font-weight: 600;">${item?.name || "Desconocido"}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt; text-align: right; ${qtyStyle}">${formattedQty}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt; font-family: monospace;">${move.documentId || "-"}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt;">${move.operator || "-"}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        `;
      } else if (pivotData) {
        tableHtml = `
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left;">
                <th style="padding: 6px; border-bottom: 2px solid #cbd5e1; font-size: 8pt; font-weight: bold;" rowspan="2">Artículo</th>
                <th style="padding: 6px; border-bottom: 2px solid #cbd5e1; font-size: 8pt; font-weight: bold; text-align: center;" rowspan="2">Stock Inicial</th>
                ${pivotData.periods.map(p => `
                  <th style="padding: 4px; border-bottom: 2px solid #cbd5e1; font-size: 8pt; font-weight: bold; text-align: center; border-right: 1px solid #cbd5e1;" colspan="4">${p}</th>
                `).join("")}
                <th style="padding: 6px; border-bottom: 2px solid #cbd5e1; font-size: 8pt; font-weight: bold; text-align: center;" rowspan="2">Stock Final</th>
              </tr>
              <tr style="background-color: #f8fafc; text-align: center;">
                ${pivotData.periods.map(p => `
                  <th style="padding: 4px; border-bottom: 1px solid #cbd5e1; font-size: 7.5pt; font-weight: 600;">Com</th>
                  <th style="padding: 4px; border-bottom: 1px solid #cbd5e1; font-size: 7.5pt; font-weight: 600;">Ven</th>
                  <th style="padding: 4px; border-bottom: 1px solid #cbd5e1; font-size: 7.5pt; font-weight: 600;">Cons</th>
                  <th style="padding: 4px; border-bottom: 1px solid #cbd5e1; font-size: 7.5pt; font-weight: 600; border-right: 1px solid #cbd5e1;">Aju</th>
                `).join("")}
              </tr>
            </thead>
            <tbody>
              ${pivotData.rows.map(row => `
                <tr style="page-break-inside: avoid;">
                  <td style="padding: 5px; border-bottom: 1px solid #e2e8f0; font-size: 8pt; font-weight: bold;">${row.item.name}</td>
                  <td style="padding: 5px; border-bottom: 1px solid #e2e8f0; font-size: 8pt; text-align: center; font-family: monospace;">${Number.isInteger(row.stockInicial) ? row.stockInicial : row.stockInicial.toFixed(2)}</td>
                  ${pivotData.periods.map(p => {
                    const d = row.periodData[p];
                    const f = (v: number) => v === 0 ? "" : (Number.isInteger(v) ? v.toString() : v.toFixed(2));
                    return `
                      <td style="padding: 5px; border-bottom: 1px solid #e2e8f0; font-size: 8pt; text-align: center; font-family: monospace; background-color: #fbfbfb;">${f(d.compras)}</td>
                      <td style="padding: 5px; border-bottom: 1px solid #e2e8f0; font-size: 8pt; text-align: center; font-family: monospace; background-color: #fbfbfb;">${f(d.ventas)}</td>
                      <td style="padding: 5px; border-bottom: 1px solid #e2e8f0; font-size: 8pt; text-align: center; font-family: monospace; background-color: #fbfbfb;">${f(d.consumo)}</td>
                      <td style="padding: 5px; border-bottom: 1px solid #e2e8f0; font-size: 8pt; text-align: center; font-family: monospace; border-right: 1px solid #e2e8f0; background-color: #fbfbfb;">${f(d.ajuste)}</td>
                    `;
                  }).join("")}
                  <td style="padding: 5px; border-bottom: 1px solid #e2e8f0; font-size: 8pt; text-align: center; font-family: monospace; font-weight: bold; color: #4338ca;">${Number.isInteger(row.stockFinal) ? row.stockFinal : row.stockFinal.toFixed(2)}</td>
                </tr>
              `).join("")}
              <!-- Totals row -->
              <tr style="background-color: #0f172a; color: white; font-weight: bold; page-break-inside: avoid;">
                <td style="padding: 6px; font-size: 8px; text-transform: uppercase;">Total General</td>
                <td style="padding: 6px; font-size: 8px; text-align: center; font-family: monospace;">${Number.isInteger(pivotData.totals.stockInicial) ? pivotData.totals.stockInicial : pivotData.totals.stockInicial.toFixed(2)}</td>
                ${pivotData.periods.map(p => {
                    const d = pivotData.totals.periods[p];
                    const f = (v: number) => Number.isInteger(v) ? v.toString() : v.toFixed(2);
                    return `
                      <td style="padding: 6px; font-size: 8px; text-align: center; font-family: monospace; color: #4ade80;">${f(d.compras)}</td>
                      <td style="padding: 6px; font-size: 8px; text-align: center; font-family: monospace; color: #f87171;">${f(d.ventas)}</td>
                      <td style="padding: 6px; font-size: 8px; text-align: center; font-family: monospace; color: #fbbf24;">${f(d.consumo)}</td>
                      <td style="padding: 6px; font-size: 8px; text-align: center; font-family: monospace; border-right: 1px solid #cbd5e1; color: #cbd5e1;">${f(d.ajuste)}</td>
                    `;
                }).join("")}
                <td style="padding: 6px; font-size: 8px; text-align: center; font-family: monospace; color: #a5b4fc;">${Number.isInteger(pivotData.totals.stockFinal) ? pivotData.totals.stockFinal : pivotData.totals.stockFinal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        `;
      }
      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <title>Kardex de Inventario - Reporte de Control de Barra</title>
            <meta charset="utf-8" />
            <style>
              @page {
                size: ${isMatrix ? 'A4 landscape' : 'A4 portrait'};
                margin: 10mm;
              }
              body {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
                font-family: ui-sans-serif, system-ui, sans-serif !important;
              }
              tr {
                page-break-inside: avoid !important;
              }
              td, th {
                border-bottom: 1px solid #ddd !important;
              }
            </style>
          </head>
          <body>
            <div style="padding: 10px;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-b: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
                <div>
                  <h1 style="font-size: 16pt; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a; font-family: system-ui, sans-serif;">Reporte de Kardex de Inventario</h1>
                  <p style="font-size: 9.5pt; color: #475569; margin: 5px 0 0 0; line-height: 1.3;">
                    Generado el: <strong>${new Date().toLocaleString("es-ES")}</strong><br/>
                    ${fromDate || toDate ? `Filtrado por fecha: <strong>${fromDate ? 'Desde ' + fromDate.split("-").reverse().join("/") : ''} ${toDate ? 'Hasta ' + toDate.split("-").reverse().join("/") : ''}</strong>` : 'Todas las fechas disponibles'}
                  </p>
                </div>
                ${customLogo ? `<img src="${customLogo}" style="height: 55px; max-width: 150px; object-fit: contain;" />` : ''}
              </div>
              
              <div style="margin-bottom: 15px;">
                <p style="font-size: 9pt; color: #64748b; margin: 0;">
                  Artículos seleccionados: <strong>${Object.values(selectedItemIds).filter(Boolean).length} / ${stock.length}</strong>
                  ${isMatrix ? ' | Vista: <strong>Matriz de Evolución (' + viewMode.toUpperCase() + ')</strong>' : ' | Vista: <strong>Historial de Movimientos de Stock</strong>'}
                </p>
              </div>

              ${tableHtml}
            </div>
            <script>
              setTimeout(() => {
                window.print();
                setTimeout(() => {
                  window.close();
                }, 1000);
              }, 350);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (e) {
      console.error("Popup printing failed", e);
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-end">
         <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Desde</label>
            <input type="date" className="border px-2 py-1 rounded text-xs" value={fromDate} onChange={e => setFromDate(e.target.value)} />
         </div>
         <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Hasta</label>
            <input type="date" className="border px-2 py-1 rounded text-xs" value={toDate} onChange={e => setToDate(e.target.value)} />
         </div>
         <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Artículos a Mostrar</label>
            <button 
              type="button" 
              onClick={() => setShowProductSelector(!showProductSelector)}
              className="border px-3 py-1.5 rounded text-xs bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 transition-colors duration-150"
            >
              📊 Filtrar Artículos ({Object.values(selectedItemIds).filter(Boolean).length}/{stock.length})
              <span className="text-[10px] text-slate-400">
                {showProductSelector ? "▲" : "▼"}
              </span>
            </button>
         </div>
         <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Formato</label>
            <select className="border px-2 py-1 rounded text-xs" value={displayFormat} onChange={(e) => setDisplayFormat(e.target.value as any)}>
                <option value="matriz">Evolución (Matriz)</option>
                <option value="lista">Lista General</option>
            </select>
         </div>
         {displayFormat === "matriz" && (
           <>
             <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Agrupación</label>
                <select 
                  className="border px-2 py-1 rounded text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold" 
                  value={viewMode} 
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setViewMode(val);
                    const range = getDefaultDateRange(val);
                    setFromDate(range.from);
                    setToDate(range.to);
                  }}
                >
                    <option value="diaria">Diaria</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensual">Mensual</option>
                    <option value="anual">Anual</option>
                    <option value="historico">Histórico Total</option>
                </select>
             </div>

             <div className="flex flex-col gap-1 relative z-40">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Períodos</label>
                <button
                  type="button"
                  onClick={() => setShowPeriodSelector(!showPeriodSelector)}
                  className="border px-3 py-1.5 rounded text-xs bg-white hover:bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 transition-colors duration-150"
                >
                  📅 Filtar Períodos ({selectedPeriods.length}/{availablePeriods.length})
                  <span className="text-[10px] text-slate-400">
                    {showPeriodSelector ? "▲" : "▼"}
                  </span>
                </button>
                
                {showPeriodSelector && (
                  <div className="absolute top-[100%] left-0 mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-lg z-50 min-w-[240px] max-h-[300px] overflow-y-auto space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-1.5">
                      <span className="text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-400">Seleccionar Períodos</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPeriods(availablePeriods)}
                          className="text-[9px] hover:underline font-bold text-indigo-600 dark:text-indigo-400"
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPeriods([])}
                          className="text-[9px] hover:underline font-bold text-rose-600 dark:text-rose-450"
                        >
                          Ninguno
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      {availablePeriods.map(p => {
                        const isChecked = selectedPeriods.includes(p);
                        return (
                          <label key={p} className="flex items-center gap-2 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none py-0.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedPeriods(prev => prev.filter(x => x !== p));
                                } else {
                                  setSelectedPeriods(prev => [...prev, p]);
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                            />
                            <span>{p}</span>
                          </label>
                        );
                      })}
                      {availablePeriods.length === 0 && (
                        <div className="text-xs text-slate-400 py-2 text-center">Sin períodos en este rango</div>
                      )}
                    </div>
                  </div>
                )}
             </div>
           </>
         )}
      </div>

      {showProductSelector && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4 animate-fadeIn transition-all">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-850 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Seleccionar Artículos del Kardex</span>
              <div className="text-[11px] text-slate-500 font-medium">
                ({Object.values(selectedItemIds).filter(Boolean).length} seleccionados de {stock.length})
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const updated: Record<string, boolean> = {};
                  stock.forEach(item => {
                    updated[item.id] = true;
                  });
                  setSelectedItemIds(updated);
                }}
                className="text-[10px] bg-white border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-750 px-2 py-1 rounded font-bold text-slate-600 dark:text-slate-300 transition-colors"
              >
                ✓ Seleccionar Todos
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated: Record<string, boolean> = {};
                  stock.forEach(item => {
                    updated[item.id] = false;
                  });
                  setSelectedItemIds(updated);
                }}
                className="text-[10px] bg-white border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-750 px-2 py-1 rounded font-bold text-slate-600 dark:text-slate-300 transition-colors"
              >
                ✗ Deseleccionar Todos
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated: Record<string, boolean> = {};
                  stock.forEach(item => {
                    const combo = isCombo(item);
                    const fraccion = isFraccionado(item);
                    const envase = isEnvase(item);
                    updated[item.id] = !combo && !fraccion && !envase;
                  });
                  setSelectedItemIds(updated);
                }}
                className="text-[10px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-350 px-2.5 py-1 rounded font-bold transition-colors"
                title="Todos menos Combos, Fraccionados y Envases"
              >
                ↺ Valor por Defecto
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar artículo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs border rounded-lg pl-8 pr-3 py-1.5 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-505"
            />
            <span className="absolute left-3 top-2 text-slate-400 text-xs">🔍</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[350px] overflow-y-auto pr-1">
            {categories.map(categoryName => {
              const categoryItems = stock.filter(
                item => item.category === categoryName && 
                (item.is_active !== false) &&
                (searchQuery === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase()))
              );
              
              if (categoryItems.length === 0) return null;

              const allCheckedInCategory = categoryItems.every(i => selectedItemIds[i.id]);

              return (
                <div key={categoryName} className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col justify-start">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1.5 mb-2">
                    <span className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-wider">
                      {categoryName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const targetVal = !allCheckedInCategory;
                        setSelectedItemIds(prev => {
                          const next = { ...prev };
                          categoryItems.forEach(i => {
                            next[i.id] = targetVal;
                          });
                          return next;
                        });
                      }}
                      className="text-[9px] hover:underline font-bold text-indigo-600 dark:text-indigo-400"
                    >
                      {allCheckedInCategory ? "Deseleccionar" : "Seleccionar"}
                    </button>
                  </div>
                  
                  <div className="space-y-1.5 overflow-y-auto max-h-[160px] pr-0.5">
                    {categoryItems.map(item => {
                      const combo = isCombo(item);
                      const fraccion = isFraccionado(item);
                      const envase = isEnvase(item);
                      const checked = !!selectedItemIds[item.id];

                      let badgeText = "";
                      let badgeClass = "";
                      if (combo) {
                        badgeText = "Combo";
                        badgeClass = "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400";
                      } else if (fraccion) {
                        badgeText = "Frac";
                        badgeClass = "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-500";
                      } else if (envase) {
                        badgeText = "Envase";
                        badgeClass = "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400";
                      }

                      return (
                        <label 
                          key={item.id} 
                          className="flex items-start gap-2 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer py-0.5 select-none"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedItemIds(prev => ({
                                ...prev,
                                [item.id]: !prev[item.id]
                              }));
                            }}
                            className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span className="flex-1 truncate leading-tight select-none" title={item.name}>
                            {item.name}
                          </span>
                          {badgeText && (
                            <span className={`text-[8px] font-semibold uppercase rounded px-1 py-0.2 scale-90 ${badgeClass} shrink-0`}>
                              {badgeText}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
        <h2 className="text-xs sm:text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200">
           {displayFormat === "matriz" ? "Evolución de Stock" : "Historial de Movimientos de Stock"}
        </h2>
        <button
          type="button"
          onClick={handlePrintKardex}
          className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] sm:text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-white" />
          <span>Imprimir Kardex</span>
        </button>
      </div>
      
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-auto max-h-[650px] relative">
        {!isSelectionValid ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-500 text-xl font-bold">⚠️</div>
            <h3 className="text-xs sm:text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 tracking-wider">Inconsistencia en Selección</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              Los períodos seleccionados deben formar un rango continuo para mantener la integridad del Kardex.
            </p>
          </div>
        ) : displayFormat === "lista" ? (
          <table className="w-full text-left text-xs border-collapse separate border-spacing-0">
            <thead className="sticky top-0 bg-white dark:bg-slate-900 z-30">
              <tr className="text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800">
                <th className="py-2.5 px-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">Fecha</th>
                <th className="py-2.5 px-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">Tipo</th>
                <th className="py-2.5 px-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">Artículo</th>
                <th className="py-2.5 px-2 text-right bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 font-bold">Cant.</th>
                <th className="py-2.5 px-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">Documento</th>
                <th className="py-2.5 px-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {(filteredMovements as InventoryMovement[]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(move => {
                  const item = stock.find(s => s.id === move.itemId);
                  return (
                      <tr key={move.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300">
                         <td className="py-2.5 px-2 font-mono whitespace-nowrap">
                           <div>{new Date(move.date).toLocaleDateString("es-ES")} {new Date(move.date).toLocaleTimeString("es-ES", {hour: '2-digit', minute:'2-digit'})}</div>
                           {move.purchaseDate && move.purchaseDate !== getLocalDateStr(move.date) && (
                             <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold" title="Fecha real del comprobante">
                               Factura: {move.purchaseDate.split("-").reverse().join("/")}
                             </div>
                           )}
                         </td>
                         <td className="py-2.5 px-2 font-bold">{move.type}</td>
                         <td className="py-2.5 px-2 font-semibold">{item?.name || "Desconocido"}</td>
                         <td className={`py-2.5 px-2 text-right font-mono font-bold ${move.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                           {move.quantity > 0 ? `+${formatQty(move.quantity)}` : formatQty(move.quantity)}
                         </td>
                         <td className="py-2.5 px-2 font-mono">{move.documentId}</td>
                         <td className="py-2.5 px-2">{move.operator}</td>
                      </tr>
                  );
              })}
            </tbody>
          </table>
                     ) : (
          pivotData && (
            <table className="w-full text-left text-[11px] border-collapse separate border-spacing-0 relative">
               <thead>
                 <tr className="text-slate-850 dark:text-slate-100 uppercase sticky top-0 bg-white dark:bg-slate-900 z-30">
                   <th className="py-2.5 px-2 font-black border-b border-r border-slate-200 dark:border-slate-700 sticky top-0 left-0 bg-white dark:bg-slate-900 z-50 w-[180px] min-w-[180px] max-w-[180px]" rowSpan={2}>Artículo</th>
                   <th className="py-2.5 px-2 text-center font-black border-b border-r border-slate-200 dark:border-slate-700 sticky top-0 left-[180px] bg-white dark:bg-slate-900 z-50 w-[80px] min-w-[80px] max-w-[80px] shadow-[2px_2px_0_rgba(148,163,184,0.15)]" rowSpan={2}>Stock<br/>Inicial</th>
                   {pivotData.periods.map(p => (
                     <th key={p} className="py-1 px-2 text-center font-black border-b border-r border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-30" colSpan={4}>{p}</th>
                   ))}
                   <th className="py-2.5 px-2 text-center font-black border-b sticky top-0 bg-white dark:bg-slate-900 z-30" rowSpan={2}>Stock<br/>Final</th>
                 </tr>
                 <tr className="text-slate-600 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 sticky top-[34px] z-30">
                   {pivotData.periods.map(p => (
                     <React.Fragment key={`sub-${p}`}>
                       <th className="py-1.5 px-2 text-center font-bold border-b border-r border-slate-200 dark:border-slate-700">Compras</th>
                       <th className="py-1.5 px-2 text-center font-bold border-b border-r border-slate-200 dark:border-slate-700">Ventas</th>
                       <th className="py-1.5 px-2 text-center font-bold border-b border-r border-slate-200 dark:border-slate-700">Consumo Int.</th>
                       <th className="py-1.5 px-2 text-center font-bold border-b border-r border-slate-200 dark:border-slate-700">Ajuste</th>
                     </React.Fragment>
                   ))}
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                 {pivotData.rows.map(row => (
                   <tr key={row.item.id} className="group hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20">
                     <td className="py-2 px-2 font-semibold text-slate-800 dark:text-slate-150 border-r border-slate-100 dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-indigo-50/70 dark:group-hover:bg-indigo-950/40 z-20 w-[180px] min-w-[180px] max-w-[180px] truncate whitespace-nowrap">{row.item.name}</td>
                     <td className="py-2 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 sticky left-[180px] bg-white dark:bg-slate-900 group-hover:bg-indigo-50/70 dark:group-hover:bg-indigo-950/40 z-20 w-[80px] min-w-[80px] max-w-[80px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">{formatQty(row.stockInicial)}</td>
                     {pivotData.periods.map(p => {
                       const d = row.periodData[p];
                       return (
                         <React.Fragment key={`${row.item.id}-${p}`}>
                           <td className="py-2 px-2 text-center font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">{formatQty(d.compras)}</td>
                           <td className="py-2 px-2 text-center font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">{formatQty(d.ventas)}</td>
                           <td className="py-2 px-2 text-center font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">{formatQty(d.consumo)}</td>
                           <td className="py-2 px-2 text-center font-mono border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">{formatQty(d.ajuste)}</td>
                         </React.Fragment>
                       );
                     })}
                     <td className="py-2 px-2 text-center font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900">{formatQty(row.stockFinal)}</td>
                   </tr>
                 ))}
                 
                 {/* Totals Row */}
                 <tr className="bg-slate-800 dark:bg-slate-950 text-white font-black uppercase text-[10px]">
                   <td className="py-3 px-2 border-r border-slate-600 dark:border-slate-700 sticky left-0 bg-slate-800 dark:bg-slate-950 z-20 w-[180px] min-w-[180px] max-w-[180px] whitespace-nowrap">Total General</td>
                   <td className="py-3 px-2 text-center font-mono border-r border-slate-600 dark:border-slate-700 sticky left-[180px] bg-slate-800 dark:bg-slate-950 z-20 w-[80px] min-w-[80px] max-w-[80px] shadow-[2px_0_5px_rgba(0,0,0,0.1)]">{formatQty(pivotData.totals.stockInicial)}</td>
                   {pivotData.periods.map(p => {
                       const d = pivotData.totals.periods[p];
                       return (
                         <React.Fragment key={`tot-${p}`}>
                           <td className="py-3 px-2 text-center font-mono text-emerald-400 bg-slate-800 dark:bg-slate-950">{formatQty(d.compras) || 0}</td>
                           <td className="py-3 px-2 text-center font-mono text-rose-400 bg-slate-800 dark:bg-slate-950">{formatQty(d.ventas) || 0}</td>
                           <td className="py-3 px-2 text-center font-mono text-amber-400 bg-slate-800 dark:bg-slate-950">{formatQty(d.consumo) || 0}</td>
                           <td className="py-3 px-2 text-center font-mono text-slate-300 border-r border-slate-600 dark:border-slate-700 bg-slate-800 dark:bg-slate-950">{formatQty(d.ajuste) || 0}</td>
                         </React.Fragment>
                       );
                   })}
                   <td className="py-3 px-2 text-center font-mono text-indigo-300 border-r border-slate-600 dark:border-slate-700 bg-slate-800 dark:bg-slate-950">{formatQty(pivotData.totals.stockFinal)}</td>
                 </tr>
               </tbody>
             </table>
          )
        )}
      </div>
    </div>
  );
};

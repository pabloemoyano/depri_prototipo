/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ArrowUpRight, 
  HelpCircle, 
  Search, 
  Info, 
  Filter, 
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Lock,
  ChevronRight,
  Sparkles,
  CheckCircle,
  Clock,
  Check,
  X,
  Layers,
  FileSpreadsheet,
  Printer,
  Eye
} from "lucide-react";
import { SaleTransaction, StockItem, EventModel, CustomerProfile } from "../types";
import { TurnReport } from "./TurnReport";
import { CajaConsolidadaReport } from "./CajaConsolidadaReport";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

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
  saldoInicial: number;
}

interface ReportsTabProps {
  stock: StockItem[];
  sales: SaleTransaction[];
  events?: EventModel[];
  customers?: CustomerProfile[];
  apiFetch?: (url: string, options?: RequestInit) => Promise<any>;
  activeReportId?: string;
}

type SortField = "name" | "quantity" | "sales" | "cost" | "gain" | "margin";
type SortOrder = "asc" | "desc";

export const ReportsTab: React.FC<ReportsTabProps> = ({ 
  stock, 
  sales, 
  events = [], 
  customers = [], 
  apiFetch,
  activeReportId: propActiveReportId
}) => {
  // Local sub-navigation for multiple reports if not controlled by prop
  const [localActiveReportId] = useState<string>("rentabilidad_buffet");
  const activeReportId = propActiveReportId || localActiveReportId;
  // Print preview state
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);

  // Daily cash sessions (Planilla de caja diaria V2) state for dynamic turns reporting
  const [cajaSessions, setCajaSessions] = useState<CajaV2Session[]>(() => {
    const sessionsList: CajaV2Session[] = [];
    try {
      const activeStr = localStorage.getItem("caja_v2_active_session");
      if (activeStr) {
        const active = JSON.parse(activeStr) as CajaV2Session;
        if (active && active.id) {
          sessionsList.push(active);
        }
      }
    } catch (e) {
      console.warn("Error parsing active session from localStorage on ReportsTab init:", e);
    }
    
    try {
      const historyStr = localStorage.getItem("caja_v2_closed_history");
      if (historyStr) {
        const historyArr = JSON.parse(historyStr);
        if (Array.isArray(historyArr)) {
          historyArr.forEach((s: any) => {
            if (s && s.id) {
              sessionsList.push(s);
            }
          });
        }
      }
    } catch (e) {
      console.warn("Error parsing history sessions from localStorage on ReportsTab init:", e);
    }
    
    return sessionsList;
  });

  const [loadingCaja, setLoadingCaja] = useState<boolean>(false);

  const consolidatedApiFetch = useMemo(() => {
    return async (url: string, opts?: RequestInit) => {
      if (apiFetch) {
        return apiFetch(url, opts);
      }
      return fetch(url, opts);
    };
  }, [apiFetch]);

  React.useEffect(() => {
    let isMounted = true;

    const loadCajaSessions = async () => {
      if (!apiFetch) return;
      setLoadingCaja(true);
      try {
        const sessionsMap = new Map<string, CajaV2Session>();

        // 1. Fetch active session from server
        try {
          const res = await apiFetch("/api/caja/active");
          if (res.ok) {
            const data = await res.json();
            if (data && data.id) {
              sessionsMap.set(data.id, data);
            }
          }
        } catch (e) {
          console.warn("[REPORTS] Error fetching active session:", e);
        }

        // 2. Fetch history sessions from server
        try {
          const res = await apiFetch("/api/caja/history");
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              data.forEach(s => {
                if (s && s.id) {
                  sessionsMap.set(s.id, s);
                }
              });
            }
          }
        } catch (e) {
          console.warn("[REPORTS] Error fetching history sessions:", e);
        }

        if (isMounted && sessionsMap.size > 0) {
          setCajaSessions(Array.from(sessionsMap.values()));
        }
      } catch (err) {
        console.error("Error loading daily cash sessions in ReportsTab:", err);
      } finally {
        if (isMounted) setLoadingCaja(false);
      }
    };

    loadCajaSessions();

    return () => {
      isMounted = false;
    };
  }, []);

  // Dynamic Turn Events computed from daily cash register (CajaV2Sessions)
  const mappedCajaEvents = useMemo(() => {
    const mapped: EventModel[] = [];
    
    cajaSessions.forEach(session => {
      const sessionDate = session.dateStr; // e.g. "2026-06-04"
      if (!sessionDate) return;
      
      // Process Cancha 1
      if (Array.isArray(session.cancha1)) {
        session.cancha1.forEach((slot, index) => {
          const cName = slot.customerName ? slot.customerName.trim() : "";
          const amt = Number(slot.amount) || 0;
          
          if (cName !== "" || amt > 0) {
            mapped.push({
              id: `c1-${sessionDate}-${slot.time}-${index}-${slot.customerId || 'anon'}`,
              ownerId: "",
              title: `Turno Cancha 1 - ${slot.time} hs`,
              customerName: cName !== "" ? cName : "Cliente Eventual",
              date: sessionDate,
              time: slot.time || "Sin asignar",
              fieldNumber: "Cancha 1" as any,
              price: amt,
              status: amt > 0 ? "Confirmado" : "Pendiente",
              cateringNeeded: false,
              notes: slot.customerId ? `ID Cliente: ${slot.customerId}` : ""
            });
          }
        });
      }
      
      // Process Cancha 2
      if (Array.isArray(session.cancha2)) {
        session.cancha2.forEach((slot, index) => {
          const cName = slot.customerName ? slot.customerName.trim() : "";
          const amt = Number(slot.amount) || 0;
          
          if (cName !== "" || amt > 0) {
            mapped.push({
              id: `c2-${sessionDate}-${slot.time}-${index}-${slot.customerId || 'anon'}`,
              ownerId: "",
              title: `Turno Cancha 2 - ${slot.time} hs`,
              customerName: cName !== "" ? cName : "Cliente Eventual",
              date: sessionDate,
              time: slot.time || "Sin asignar",
              fieldNumber: "Cancha 2" as any,
              price: amt,
              status: amt > 0 ? "Confirmado" : "Pendiente",
              cateringNeeded: false,
              notes: slot.customerId ? `ID Cliente: ${slot.customerId}` : ""
            });
          }
        });
      }
    });

    return mapped;
  }, [cajaSessions]);

  // Logo retriever with fallback as per system guidelines
  const getLogoSrc = (): string => {
    try {
      const customLocal = localStorage.getItem("barstock_app_custom_logo");
      if (customLocal) return customLocal;
    } catch (e) {}
    return "/src/assets/images/deprimera_logo_1780923105846.png";
  };

  // Default filter dates: From first day of current month to today
  const [sinceDate, setSinceDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });

  const [untilDate, setUntilDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Filter: category (Familia)
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  
  // Filter: only items with sales (Solo productos con ventas)
  const [onlyWithSales, setOnlyWithSales] = useState<boolean>(true);

  // Search filter query to search products in detailed table
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sort state for detail table
  const [sortField, setSortField] = useState<SortField>("gain");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Turn Analysis filter states
  const [selectedCanchaFilter, setSelectedCanchaFilter] = useState<string>("Todas");
  const [selectedClienteFilter, setSelectedClienteFilter] = useState<string>("Todos");
  const [selectedHorarioFilter, setSelectedHorarioFilter] = useState<string>("Todos");

  // Dynamic lists for Turn Analysis dropdown filters
  const uniqueCanchas = useMemo(() => {
    const canchaSet = new Set<string>();
    mappedCajaEvents.forEach(e => {
      if (e.fieldNumber) canchaSet.add(e.fieldNumber);
    });
    return ["Todas", ...Array.from(canchaSet).sort()];
  }, [mappedCajaEvents]);

  const uniqueClientesEvents = useMemo(() => {
    const customerSet = new Set<string>();
    mappedCajaEvents.forEach(e => {
      if (e.customerName) customerSet.add(e.customerName);
    });
    return ["Todos", ...Array.from(customerSet).sort()];
  }, [mappedCajaEvents]);

  const uniqueHorarios = useMemo(() => {
    const hourSet = new Set<string>();
    mappedCajaEvents.forEach(e => {
      if (e.time) hourSet.add(e.time);
    });
    return ["Todos", ...Array.from(hourSet).sort()];
  }, [mappedCajaEvents]);

  // EXCLUSION & OPTIONAL SWITCHES (Strict constraints requested by user)
  const [includeTurnos, setIncludeTurnos] = useState<boolean>(false);
  const [includeConsumos, setIncludeConsumos] = useState<boolean>(false);

  // Dynamic unique categories list from current stock items + optionals if enabled
  const categoriesList = useMemo(() => {
    const catsSet = new Set<string>();
    stock.forEach(item => {
      if (item.category) {
        catsSet.add(item.category);
      }
    });
    const list = Array.from(catsSet).sort();
    if (includeTurnos) {
      list.push("Turnos");
    }
    if (includeConsumos) {
      list.push("Consumos");
    }
    return ["Todas", ...list];
  }, [stock, includeTurnos, includeConsumos]);

  // Handle Sort Toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc"); // Default to desc for easier top profitability ranking
    }
  };

  // Main calculations: Rentabilidad Buffet Query
  const reportData = useMemo(() => {
    // 1. Filter sales by date range and isolate core from optionals
    const filteredSales = sales.filter(sale => {
      if (!sale.date) return false;
      const saleDateStr = sale.date.substring(0, 10);
      return saleDateStr >= sinceDate && saleDateStr <= untilDate;
    });

    // Helper map of stock items for category and current purchase price lookup
    const stockMap = new Map<string, StockItem>();
    stock.forEach(item => stockMap.set(item.id, item));

    // Raw accumulators for different business units BEFORE toggle filters
    let rawBuffetSales = 0;
    let rawBuffetCost = 0;
    let rawTurnosSales = 0;
    let rawTurnosCost = 0; // Turn bookings have no calculated purchase cost
    let rawConsumosCost = 0;

    let buffetTicketsCount = 0;
    let turnosTicketsCount = 0;
    let consumosTicketsCount = 0;

    // Separate calculations first to ensure pristine financial separation
    filteredSales.forEach(sale => {
      // Is this transaction a consumption record?
      const isConsumoSale = sale.origin === "consumo_interno" || sale.method === "consumo";
      let hasTurn = false;
      let hasBuffet = false;
      let hasConsumo = false;

      (sale.items || []).forEach(item => {
        const id = item.stock_item_id || "custom";
        const stockItem = stockMap.get(id);
        const quantity = Number(item.quantity) || 0;

        let originalCostUsed = 0;
        if (id === "custom") {
          originalCostUsed = 0;
        } else if (typeof item.purchase_price === "number") {
          originalCostUsed = item.purchase_price;
        } else {
          originalCostUsed = stockItem ? (stockItem.purchase_price || 0) : 0;
        }

        const totalSales = Number(item.total) || (quantity * (Number(item.price) || 0));
        const totalCost = Number((quantity * originalCostUsed).toFixed(2));

        // Detect if item is a Turn Booking
        const isTurnItem = id.startsWith("cancha_booking") || 
                           item.stock_item_id === "cancha_booking_c1" || 
                           item.stock_item_id === "cancha_booking_c2" || 
                           (item.name && item.name.toLowerCase().includes("venta de turno")) || 
                           sale.origin === "sistema_caja";

        if (isTurnItem) {
          rawTurnosSales += totalSales;
          hasTurn = true;
        } else if (isConsumoSale) {
          rawConsumosCost += totalCost;
          hasConsumo = true;
        } else {
          rawBuffetSales += totalSales;
          rawBuffetCost += totalCost;
          hasBuffet = true;
        }
      });

      if (hasBuffet) buffetTicketsCount++;
      if (hasTurn) turnosTicketsCount++;
      if (hasConsumo) consumosTicketsCount++;
    });

    // Map of stock_id -> aggregated product stats for detailed report list
    const productAggregates: Record<string, {
      id: string;
      name: string;
      category: string;
      quantity: number;
      sales: number;
      cost: number;
      gain: number;
      margin: number;
      isReconstructed: boolean;
      hasHistoricalCost: boolean;
      typeLabel: "Buffet" | "Turno" | "Consumo Interno";
    }> = {};

    // 2. Iterate filtered sales items and aggregate based on toggle selections
    filteredSales.forEach(sale => {
      const isConsumoSale = sale.origin === "consumo_interno" || sale.method === "consumo";

      (sale.items || []).forEach(item => {
        const id = item.stock_item_id || "custom";
        const stockItem = stockMap.get(id);
        const category = stockItem ? stockItem.category : "Otros";

        const isTurnItem = id.startsWith("cancha_booking") || 
                           item.stock_item_id === "cancha_booking_c1" || 
                           item.stock_item_id === "cancha_booking_c2" || 
                           (item.name && item.name.toLowerCase().includes("venta de turno")) || 
                           sale.origin === "sistema_caja";
        
        const isConsumoItem = !isTurnItem && isConsumoSale;
        const isBuffetItem = !isTurnItem && !isConsumoItem;

        // Apply strict exclusion rules
        if (isTurnItem && !includeTurnos) return;
        if (isConsumoItem && !includeConsumos) return;

        // Apply category filter if set
        const itemCategoryName = isTurnItem 
          ? "Turnos" 
          : (isConsumoItem ? "Consumos" : category);

        if (selectedCategory !== "Todas" && itemCategoryName !== selectedCategory && category !== selectedCategory) {
          return;
        }

        // Determine cost: Frozen purchase_price or fallback
        let originalCostUsed = 0;
        let isReconstructed = false;
        let hasHistoricalCost = false;

        if (id === "custom" || isTurnItem) {
          originalCostUsed = 0;
          isReconstructed = false;
        } else if (typeof item.purchase_price === "number") {
          originalCostUsed = item.purchase_price;
          hasHistoricalCost = true;
        } else {
          originalCostUsed = stockItem ? (stockItem.purchase_price || 0) : 0;
          isReconstructed = true;
        }

        const quantity = Number(item.quantity) || 0;
        // Turnos have 100% revenue. Consumos Internos have 0 revenue under this report. Core Buffet has normal revenue.
        const totalSales = isConsumoItem ? 0 : (Number(item.total) || (quantity * (Number(item.price) || 0)));
        const totalCost = Number((quantity * originalCostUsed).toFixed(2));

        // Group rows so turn bookings accumulate in one row, mermas are listed cleanly, and buffet products group by item id
        const aggId = isTurnItem ? "turno_booking_global" : (isConsumoItem ? `consumo_${id}` : id);
        const aggName = isTurnItem 
          ? "Ventas de Turnos (Cancha / Reservas)" 
          : (isConsumoItem ? `Consumo Interno: ${item.name || (stockItem ? stockItem.name : "Producto")}` : (item.name || (stockItem ? stockItem.name : "Producto")));

        if (!productAggregates[aggId]) {
          productAggregates[aggId] = {
            id: aggId,
            name: aggName,
            category: itemCategoryName,
            quantity: 0,
            sales: 0,
            cost: 0,
            gain: 0,
            margin: 0,
            isReconstructed: false,
            hasHistoricalCost: false,
            typeLabel: isTurnItem ? "Turno" : (isConsumoItem ? "Consumo Interno" : "Buffet")
          };
        }

        const agg = productAggregates[aggId];
        agg.quantity += quantity;
        agg.sales += totalSales;
        agg.cost += totalCost;
        if (isReconstructed && !isTurnItem) agg.isReconstructed = true;
        if (hasHistoricalCost && !isTurnItem) agg.hasHistoricalCost = true;
      });
    });

    // If "Solo productos con ventas" is false, inject catalogue stock items with no sales matching selected Buffet category
    if (!onlyWithSales) {
      stock.forEach(item => {
        if (selectedCategory !== "Todas" && item.category !== selectedCategory) {
          return;
        }
        // Exclude virtual elements or disabled recipes from blank list
        if (item.id.startsWith("cancha_booking")) return;

        if (!productAggregates[item.id]) {
          productAggregates[item.id] = {
            id: item.id,
            name: item.name,
            category: item.category || "Otros",
            quantity: 0,
            sales: 0,
            cost: 0,
            gain: 0,
            margin: 0,
            isReconstructed: false,
            hasHistoricalCost: false,
            typeLabel: "Buffet"
          };
        }
      });
    }

    // Convert aggregated map to array and compute final gain and margin
    let finalUnitsSold = 0;
    let anyRowReconstructed = false;

    let records = Object.values(productAggregates).map(agg => {
      agg.sales = Number(agg.sales.toFixed(2));
      agg.cost = Number(agg.cost.toFixed(2));
      agg.gain = Number((agg.sales - agg.cost).toFixed(2));
      agg.margin = agg.sales > 0 ? Number(((agg.gain / agg.sales) * 100).toFixed(2)) : 0;
      
      finalUnitsSold += agg.quantity;
      if (agg.isReconstructed) {
        anyRowReconstructed = true;
      }
      return agg;
    });

    // Search query locally on matching name or category
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      records = records.filter(rec => 
        rec.name.toLowerCase().includes(q) || 
        rec.category.toLowerCase().includes(q)
      );
    }

    // Apply sorting
    records.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === "string") {
        return sortOrder === "asc" 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }

      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    // Final Dynamic Compilation based strictly on filters toggled
    const finalSales = Number((rawBuffetSales + (includeTurnos ? rawTurnosSales : 0)).toFixed(2));
    const finalCost = Number((rawBuffetCost + (includeConsumos ? rawConsumosCost : 0)).toFixed(2));
    const finalGain = Number((finalSales - finalCost).toFixed(2));
    const finalMarginPct = finalSales > 0 ? Number(((finalGain / finalSales) * 100).toFixed(2)) : 0;

    let finalTicketsCount = buffetTicketsCount;
    if (includeTurnos) finalTicketsCount += turnosTicketsCount;
    if (includeConsumos) finalTicketsCount += consumosTicketsCount;

    return {
      records,
      breakdown: {
        buffetSales: rawBuffetSales,
        buffetCost: rawBuffetCost,
        buffetProfit: Number((rawBuffetSales - rawBuffetCost).toFixed(2)),
        buffetMargin: rawBuffetSales > 0 ? Number((((rawBuffetSales - rawBuffetCost) / rawBuffetSales) * 100).toFixed(2)) : 0,

        turnosSales: rawTurnosSales,
        turnosCost: 0,
        turnosProfit: rawTurnosSales,
        turnosMargin: 100,

        consumosSales: 0,
        consumosCost: rawConsumosCost,
        consumosProfit: -rawConsumosCost,
        consumosMargin: 0
      },
      summary: {
        ventasBrutas: finalSales,
        cmv: finalCost,
        gananciaBruta: finalGain,
        margen: finalMarginPct,
        ticketsConfirmados: finalTicketsCount,
        unidadesVendidas: finalUnitsSold,
        anyReconstructed: anyRowReconstructed
      }
    };
  }, [sales, stock, sinceDate, untilDate, selectedCategory, onlyWithSales, searchQuery, sortField, sortOrder, includeTurnos, includeConsumos]);

  // Days count helper
  const poolDaysCount = useMemo(() => {
    if (!sinceDate || !untilDate) return 1;
    const s = new Date(sinceDate);
    const u = new Date(untilDate);
    const diff = Math.abs(u.getTime() - s.getTime());
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    return isNaN(days) || days <= 0 ? 1 : days;
  }, [sinceDate, untilDate]);

  const turnReportData = useMemo(() => {
    // Filter events by date and specific dropdown values from daily cash registers
    const filtered = mappedCajaEvents.filter(e => {
      if (!e.date) return false;
      const dateStr = e.date.substring(0, 10);
      if (dateStr < sinceDate || dateStr > untilDate) return false;

      if (selectedCanchaFilter !== "Todas" && e.fieldNumber !== selectedCanchaFilter) return false;
      if (selectedClienteFilter !== "Todos" && e.customerName !== selectedClienteFilter) return false;
      if (selectedHorarioFilter !== "Todos" && e.time !== selectedHorarioFilter) return false;

      return true;
    });

    // 1. Calculations: Por cancha
    const canchaStats: Record<string, { count: number; earnings: number; usagePct: number }> = {};
    
    const standardFields = [
      "Cancha 1",
      "Cancha 2"
    ];

    standardFields.forEach(f => {
      canchaStats[f] = { count: 0, earnings: 0, usagePct: 0 };
    });

    filtered.forEach(e => {
      const field = e.fieldNumber || "Cancha 1";
      if (!canchaStats[field]) {
        canchaStats[field] = { count: 0, earnings: 0, usagePct: 0 };
      }
      canchaStats[field].count++;
      canchaStats[field].earnings += e.price || 0;
    });

    const maxDailySlots = 12;
    const totalPossibleSlots = poolDaysCount * maxDailySlots;

    Object.keys(canchaStats).forEach(field => {
      const count = canchaStats[field].count;
      const pct = (count / (totalPossibleSlots || 1)) * 100;
      canchaStats[field].usagePct = Math.min(Number(pct.toFixed(1)), 100);
    });

    const canchaRanking = Object.entries(canchaStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.count - a.count);

    // 2. Calculations: Por horario
    const timeStats: Record<string, { count: number; earnings: number }> = {};
    filtered.forEach(e => {
      const t = e.time || "Sin asignar";
      if (!timeStats[t]) {
        timeStats[t] = { count: 0, earnings: 0 };
      }
      timeStats[t].count++;
      timeStats[t].earnings += e.price || 0;
    });

    const timeRanking = Object.entries(timeStats)
      .map(([slot, stats]) => ({ slot, ...stats }))
      .sort((a, b) => b.count - a.count);

    const peakTimeSlot = timeRanking.length > 0 ? timeRanking[0].slot : "N/D";
    const peakTimeCount = timeRanking.length > 0 ? timeRanking[0].count : 0;

    // 3. Calculations: Por cliente
    const clientStats: Record<string, { count: number; spend: number }> = {};
    filtered.forEach(e => {
      const c = e.customerName || "Cliente Genérico";
      if (!clientStats[c]) {
        clientStats[c] = { count: 0, spend: 0 };
      }
      clientStats[c].count++;
      clientStats[c].spend += e.price || 0;
    });

    const clientRanking = Object.entries(clientStats)
      .map(([name, stats]) => {
        const profile = customers.find(cust => cust.fullName.toLowerCase() === name.toLowerCase());
        const tier = profile ? profile.loyaltyTier : "STANDARD TIER";
        const weeks = poolDaysCount / 7 || 1;
        const frequencyPerWeek = stats.count / (weeks < 0.1 ? 0.1 : weeks);
        return {
          name,
          tier,
          frequencyPerWeek: Number(frequencyPerWeek.toFixed(2)),
          ...stats
        };
      })
      .sort((a, b) => b.count - a.count);

    // 4. Calculations: Por día de semana
    const daysName = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado"
    ];
    const weekdayStats: Record<string, { count: number; earnings: number }> = {};
    daysName.forEach(d => {
      weekdayStats[d] = { count: 0, earnings: 0 };
    });

    filtered.forEach(e => {
      if (e.date) {
        const [y, m, d] = e.date.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayIndex = dateObj.getDay();
        const dayName = daysName[dayIndex] || "N/D";
        if (weekdayStats[dayName]) {
          weekdayStats[dayName].count++;
          weekdayStats[dayName].earnings += e.price || 0;
        }
      }
    });

    const weekdayRanking = Object.entries(weekdayStats)
      .map(([day, stats]) => ({ day, ...stats }));
    const peakDayObj = [...weekdayRanking].sort((a, b) => b.count - a.count);
    const peakDay = peakDayObj.length > 0 && peakDayObj[0].count > 0 ? peakDayObj[0].day : "N/D";

    const totalReservas = filtered.length;
    const totalRecaudado = filtered.reduce((acc, current) => acc + (current.price || 0), 0);
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
      peakDay,
      poolDaysCount
    };
  }, [mappedCajaEvents, sinceDate, untilDate, selectedCanchaFilter, selectedClienteFilter, selectedHorarioFilter, poolDaysCount, customers]);

  return (
    <div className="space-y-6" id="reports-tab-container">
      {/* 1. Header of Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-[#eff4ff] dark:border-slate-800 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 dark:bg-slate-800 rounded-xl text-emerald-600 dark:text-emerald-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-white uppercase tracking-tight font-sans">
                {activeReportId === "rentabilidad_buffet" ? "Rentabilidad de Buffet" : "Análisis de Turnos / Gestión"}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeReportId === "rentabilidad_buffet" 
                ? "Analiza el margen real de la barra sin distorsiones operativas. Gestiona separaciones y ajustes financieros opcionales."
                : "Auditoría de planilla de canchas y cruzamiento con caja diaria en tiempo real."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Info Badge on database persistence status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-[11px] text-slate-500 font-bold select-none">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Zona Horaria: Local</span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="text-emerald-600 font-bold uppercase tracking-widest text-[9.5px]">MODO SEPARADO ✔</span>
            </div>

            {/* Imprimir Action (opens print preview first) */}
            <button
              onClick={() => setShowPrintPreview(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl transition cursor-pointer shadow-sm uppercase tracking-wide"
              title="Visualizar en formato A4 oficial y confirmar para imprimir"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Reporte</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Primary reports content display - Optimized Full-Screen layout */}
      <div className="space-y-6 w-full">
          {activeReportId === "rentabilidad_buffet" ? (
            <>
              {/* 3. Operational Parameter Controls (Core filtration, Turnos toggle & Consumos toggle) */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-[#eff4ff] dark:border-slate-800 shadow-3xs space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2.5">
              <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-emerald-500" />
                Filtros Básicos y Rango de Fechas
              </h3>
              <button
                onClick={() => {
                  setSinceDate(() => {
                    const d = new Date();
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
                  });
                  setUntilDate(() => {
                    const d = new Date();
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  });
                  setSelectedCategory("Todas");
                  setOnlyWithSales(true);
                  setSearchQuery("");
                  setIncludeTurnos(false);
                  setIncludeConsumos(false);
                }}
                className="text-[10px] font-extrabold text-slate-400 hover:text-emerald-600 transition"
                title="Restablecer filtros"
              >
                Reajustar Valores
              </button>
            </div>

            {/* Inputs grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Fecha Desde input */}
              <div className="col-span-1 md:col-span-3 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Fecha Desde
                </label>
                <input
                  type="date"
                  value={sinceDate}
                  onChange={(e) => setSinceDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-white focus:outline-hidden focus:border-emerald-500"
                  id="date_filter_since"
                />
              </div>

              {/* Fecha Hasta input */}
              <div className="col-span-1 md:col-span-3 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-white focus:outline-hidden focus:border-emerald-500"
                  id="date_filter_until"
                />
              </div>

              {/* Familia Selector */}
              <div className="col-span-1 md:col-span-3 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Familia / Categoría
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  id="category_filter_select"
                >
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Checkbox "Solo vendidos" */}
              <div className="col-span-1 md:col-span-3 flex items-center md:pt-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyWithSales}
                    onChange={(e) => setOnlyWithSales(e.target.checked)}
                    className="rounded-md border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    id="only_sales_toggle"
                  />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Solo vendidos en el período
                  </span>
                </label>
              </div>
            </div>

            {/* SEGREGATION & EXCLUSION RULES CONTROLLER CARD (Strictly requested by user) */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-500" />
                <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Elementos Adicionales y Exclusiones del Informe (Core Buffet Protegido)
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Rule Toggle 1: Ventas de Turnos */}
                <div className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  includeTurnos 
                    ? "bg-slate-50 dark:bg-slate-850/60 border-emerald-500/35" 
                    : "bg-slate-50/50 dark:bg-slate-900/40 border-slate-150 dark:border-slate-800"
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        Ventas de Turnos (Canchas)
                      </span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        includeTurnos 
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400" 
                          : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                      }`}>
                        {includeTurnos ? "Sumando al total" : "Excluido (Default)"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Representan turnos jugados. Tienen margen de ganancia del 100% (sin CMV). Al estar apagado, protege al buffet de distorsiones de margen.
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/50 pt-2.5">
                    <span className="text-[10px] font-semibold text-slate-420">Monto del período: <strong className="font-bold text-slate-700 dark:text-slate-300">${reportData.breakdown.turnosSales.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                    
                    <button
                      type="button"
                      onClick={() => setIncludeTurnos(!includeTurnos)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        includeTurnos ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                      id="toggle-turnos"
                    >
                      <span className="sr-only">Toggle Turnos</span>
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          includeTurnos ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Rule Toggle 2: Consumos Internos */}
                <div className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  includeConsumos 
                    ? "bg-slate-50 dark:bg-slate-850/60 border-indigo-500/35" 
                    : "bg-slate-50/50 dark:bg-slate-900/40 border-slate-150 dark:border-slate-800"
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        Consumos Internos y Mermas
                      </span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        includeConsumos 
                          ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-400" 
                          : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                      }`}>
                        {includeConsumos ? "Ajustando costos" : "Excluido (Default)"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      No son ventas sino egresos de insumos operativos. Al sumarse, agregan sus costos (CMV) al buffet a precio de venta $0 para transparentar pérdidas.
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/50 pt-2.5">
                    <span className="text-[10px] font-semibold text-slate-420">Costo del período: <strong className="font-bold text-slate-700 dark:text-slate-300">${reportData.breakdown.consumosCost.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                    
                    <button
                      type="button"
                      onClick={() => setIncludeConsumos(!includeConsumos)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        includeConsumos ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                      id="toggle-consumos"
                    >
                      <span className="sr-only">Toggle Consumos</span>
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          includeConsumos ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* 4. Executive Summaries - Bento metrics grid showing DYNAMIC COMPILED RESULTS */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4" id="executive_summaries_grid">
            
            {/* Card 1: Ventas Brutas */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4.5 border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Ventas / Ingresos Consolidados
                </span>
                <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                  ${reportData.summary.ventasBrutas.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 mt-2 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-0.5 rounded-md w-fit">
                <ArrowUpRight className="w-3 h-3" />
                <span>
                  {includeTurnos ? "Buffet + Turnos de Cancha" : "Solo ventas de Buffet"}
                </span>
              </div>
            </div>

            {/* Card 2: Costo Mercadería Vendida (CMV) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4.5 border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Costo de Mercadería (CMV) Total
                </span>
                <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                  ${reportData.summary.cmv.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex flex-col gap-0.5 mt-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/10 px-2 py-0.5 rounded-md w-fit">
                  <TrendingDown className="w-3 h-3" />
                  <span>
                    {includeConsumos ? "Fórmulas + Consumo Interno" : "Solo coste de Buffet"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Ganancia Bruta */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4.5 border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex flex-col justify-between col-span-2 md:col-span-1">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Rentabilidad / Utilidad Real
                </span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  ${reportData.summary.gananciaBruta.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-450 mt-2">
                <span>Margen sobre ventas:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px] bg-emerald-50 dark:bg-emerald-900/10 px-1.5 py-0.5 rounded">
                  {reportData.summary.margen.toFixed(1)}%
                </strong>
              </div>
            </div>

            {/* Secondary smaller metrics */}
            <div className="bg-slate-50/50 dark:bg-slate-850 rounded-xl p-3 px-4 border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Tickets Contabilizados:
              </span>
              <strong className="text-sm font-black text-slate-750 dark:text-slate-300">
                {reportData.summary.ticketsConfirmados} u.
              </strong>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-850 rounded-xl p-3 px-4 border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Artículos Despachados:
              </span>
              <strong className="text-sm font-black text-slate-750 dark:text-slate-300">
                {reportData.summary.unidadesVendidas.toLocaleString("es-ES")} u.
              </strong>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-850 rounded-xl p-3 px-4 border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex items-center justify-between col-span-2 md:col-span-1">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Estado Gastos/Egresos:
              </span>
              <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 dark:bg-rose-900/10 px-2 py-0.5 rounded uppercase tracking-wider">
                Excluidos ✔
              </span>
            </div>
          </div>

          {/* 5. Direct Side-by-Side Breakdown Panel (Strictly requests category segregation) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs overflow-hidden">
            <div className="p-4 bg-slate-50/40 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Desglose Financiero por Unidad de Negocio (Separación de Flujos)
              </span>
            </div>
            
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Unit Tile 1: Buffet Core */}
              <div className="p-4 rounded-xl bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-500/20 relative">
                <div className="absolute top-3 right-3 text-[8.5px] font-extrabold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                  CORE ACTIVO
                </div>
                <h4 className="text-[11px] font-black uppercase text-slate-450 dark:text-slate-400 tracking-wider">
                  A. Buffet de Barra (Core)
                </h4>
                <div className="mt-3.5 space-y-1.5 text-xs font-semibold">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ingresos Buffet:</span>
                    <span className="text-slate-800 dark:text-white font-mono font-bold">${reportData.breakdown.buffetSales.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Costos (CMV) Buffet:</span>
                    <span className="text-slate-800 dark:text-white font-mono font-bold">${reportData.breakdown.buffetCost.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-slate-150 dark:border-slate-800/80 my-2 pt-2 flex justify-between font-bold text-slate-900 dark:text-white">
                    <span>Rentabilidad Buffet:</span>
                    <span className="text-emerald-600 font-bold font-mono">${reportData.breakdown.buffetProfit.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-420">Margen real del Buffet:</span>
                    <span className="bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-600 font-extrabold">{reportData.breakdown.buffetMargin.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Unit Tile 2: Shift Sales (Optional) */}
              <div className={`p-4 rounded-xl border relative transition ${
                includeTurnos 
                  ? "bg-slate-50 dark:bg-slate-850 border-emerald-500/20" 
                  : "bg-slate-50/55 dark:bg-slate-900/30 border-slate-150 dark:border-slate-800 opacity-70"
              }`}>
                <div className={`absolute top-3 right-3 text-[8.5px] font-extrabold px-1.5 py-0.5 rounded ${
                  includeTurnos 
                    ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-950" 
                    : "text-slate-500 bg-slate-200 dark:bg-slate-800"
                }`}>
                  {includeTurnos ? "INCLUIDO EN TOTALS" : "EXCLUIDO"}
                </div>
                <h4 className="text-[11px] font-black uppercase text-slate-450 dark:text-slate-400 tracking-wider">
                  B. Ventas de Turnos (Opcionales)
                </h4>
                <div className="mt-3.5 space-y-1.5 text-xs font-semibold">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recaudación Turnos:</span>
                    <span className="text-slate-850 dark:text-white font-mono font-bold">${reportData.breakdown.turnosSales.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Costo Asociado:</span>
                    <span className="text-slate-400 font-mono font-bold">$0.00</span>
                  </div>
                  <div className="border-t border-slate-150 dark:border-slate-800/80 my-2 pt-2 flex justify-between font-bold text-slate-900 dark:text-white">
                    <span>Resultado Turnos:</span>
                    <span className="text-emerald-605 font-bold font-mono">${reportData.breakdown.turnosProfit.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-420">Margen del Turno:</span>
                    <span className="bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-600 font-extrabold">100.0%</span>
                  </div>
                </div>
              </div>

              {/* Unit Tile 3: Internal Consumptions */}
              <div className={`p-4 rounded-xl border relative transition ${
                includeConsumos 
                  ? "bg-slate-50 dark:bg-slate-850 border-indigo-500/20" 
                  : "bg-slate-50/55 dark:bg-slate-900/30 border-slate-150 dark:border-slate-800 opacity-70"
              }`}>
                <div className={`absolute top-3 right-3 text-[8.5px] font-extrabold px-1.5 py-0.5 rounded ${
                  includeConsumos 
                    ? "text-indigo-705 bg-indigo-100 dark:bg-indigo-950" 
                    : "text-slate-500 bg-slate-200 dark:bg-slate-800"
                }`}>
                  {includeConsumos ? "INCLUIDO EN TOTALS" : "EXCLUIDO"}
                </div>
                <h4 className="text-[11px] font-black uppercase text-slate-450 dark:text-slate-400 tracking-wider">
                  C. Consumos / Mermas (Ajuste)
                </h4>
                <div className="mt-3.5 space-y-1.5 text-xs font-semibold">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ingresos por Consumo:</span>
                    <span className="text-slate-400 font-mono font-bold">$0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Costo de Insumos:</span>
                    <span className="text-slate-850 dark:text-white font-mono font-bold">${reportData.breakdown.consumosCost.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-slate-150 dark:border-slate-800/80 my-2 pt-2 flex justify-between font-bold text-slate-900 dark:text-white">
                    <span>Ajuste Operativo:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono">-${reportData.breakdown.consumosCost.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-420">Estructura del Ajuste:</span>
                    <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 font-extrabold">Costo puro</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Note about Complete Exclusion of External Expenses */}
            <div className="p-3 bg-rose-50/40 dark:bg-rose-950/10 border-t border-slate-100 dark:border-slate-800/60 text-[10.5px] text-rose-800 dark:text-rose-400 font-bold flex items-center gap-2 px-5">
              <X className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
              <span>D. Gastos y Egresos Operacionales Externos (Sueldos, Facturas de Luz, etc.): Excluidos permanentemente de la rentabilidad del buffet por diseño.</span>
            </div>
          </div>

          {/* 6. Detailed Reports Table Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs overflow-hidden">
            
            {/* Table Controller Header bar */}
            <div className="p-4 bg-slate-50/40 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Análisis Detallado por Artículo
                </span>
                <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-755 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                  {reportData.records.length} elementos
                </span>
              </div>

              {/* Instant Search tool */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-450" />
                <input
                  type="text"
                  placeholder="Buscar por producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-700 dark:text-white focus:outline-hidden focus:border-emerald-500"
                  id="reports_table_search"
                />
              </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" id="rentabilidad_detailed_table">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10.5px] font-black text-slate-455 dark:text-slate-400 text-left bg-slate-50/20 dark:bg-slate-850/40 select-none">
                    <th 
                      onClick={() => handleSort("name")}
                      className="py-3 px-4 font-bold cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-1">
                        <span>Producto / Concepto</span>
                        {sortField === "name" && (sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("quantity")}
                      className="py-3 px-4 text-center font-bold cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Cant. Consumida</span>
                        {sortField === "quantity" && (sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("sales")}
                      className="py-3 px-4 text-right font-bold cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Ingreso Bruto</span>
                        {sortField === "sales" && (sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("cost")}
                      className="py-3 px-4 text-right font-bold cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Costo Adquisición (CMV)</span>
                        {sortField === "cost" && (sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("gain")}
                      className="py-3 px-4 text-right font-bold cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Margen de Ganancia</span>
                        {sortField === "gain" && (sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("margin")}
                      className="py-3 px-4 text-right font-bold cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Margen %</span>
                        {sortField === "margin" && (sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />)}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11.5px]">
                  {reportData.records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                        Ningún registro coincide con los filtros especificados para el rango {sinceDate} - {untilDate}.
                      </td>
                    </tr>
                  ) : (
                    reportData.records.map((rec) => (
                      <tr 
                        key={rec.id} 
                        className="hover:bg-slate-50/40 dark:hover:bg-slate-850/50 transition-colors"
                        id={`report_row_${rec.id}`}
                      >
                        {/* Name, category and label */}
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold">{rec.name}</span>
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm ${
                                rec.typeLabel === "Turno" 
                                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400" 
                                  : (rec.typeLabel === "Consumo Interno" 
                                      ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-400" 
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-500")
                              }`}>
                                {rec.typeLabel}
                              </span>
                            </div>
                            <span className="text-[9.5px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                              {rec.category || "Otros"}
                            </span>
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                          {rec.quantity.toLocaleString("es-ES")}
                        </td>

                        {/* Revenue */}
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-705 dark:text-slate-200">
                          ${rec.sales.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Cost CMV */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-600 dark:text-slate-400">
                          <div className="space-y-0.5">
                            <span>
                              ${rec.cost.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {rec.isReconstructed && (
                              <span className="text-[8px] font-black text-amber-650 dark:text-amber-400 uppercase tracking-widest block" title="Costo histórico reconstruido mediante el precio actual en catálogo.">
                                ⚠️ Reconstruido
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Profit / Net Margin */}
                        <td className={`py-3 px-4 text-right font-mono font-black ${rec.gain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-450"}`}>
                          ${rec.gain.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Margin % */}
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black font-mono ${
                            rec.margin > 60 
                              ? "bg-emerald-50 dark:bg-emerald-900/15 text-emerald-700 dark:text-emerald-400" 
                              : rec.margin > 30 
                                ? "bg-indigo-50 dark:bg-indigo-900/15 text-indigo-700 dark:text-indigo-400" 
                                : rec.margin > 0 
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" 
                                  : "bg-red-50 dark:bg-red-900/15 text-red-700 dark:text-red-400"
                          }`}>
                            {rec.margin > 0 ? `${rec.margin.toFixed(1)}%` : "0.0%"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary Indicator with Warning */}
            <div className="p-4 bg-slate-50/30 dark:bg-slate-850/30 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                <Info className="w-4 h-4 text-slate-450 flex-shrink-0" />
                <span>Haga clic en los encabezados de la tabla para ordenar el listado de rentabilidad.</span>
              </div>
              
              {reportData.summary.anyReconstructed && (
                <div className="p-2 px-3 bg-amber-50/60 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30 text-[10.5px] text-amber-800 dark:text-amber-450 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>Se detectaron registros de transacciones anteriores con costo de insumo reconstruido.</span>
                </div>
              )}
            </div>

          </div>
            </>
          ) : activeReportId === "analisis_turnos" ? (
            <TurnReport
              events={mappedCajaEvents}
              customers={customers || []}
              sinceDate={sinceDate}
              untilDate={untilDate}
              setSinceDate={setSinceDate}
              setUntilDate={setUntilDate}
            />
          ) : (
            <CajaConsolidadaReport
              sales={sales}
              apiFetch={consolidatedApiFetch}
            />
          )}

      </div>

      {/* Printable template helper definition */}
      {(() => {
        // Defined inline or within the scope to avoid double rendering constraints
        const PrintableReport = () => {
          if (activeReportId === "analisis_turnos") {
            return (
              <div className="simulated-paper text-slate-900 text-left p-2 sm:p-4 md:p-8" id="print-document-root-content">
                {/* Header with Brand Logo */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
                  <div className="space-y-1.5">
                    <img 
                      src={getLogoSrc()} 
                      alt="Logo de la marca" 
                      className="h-14 w-auto mb-2.5 object-contain"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = "/src/assets/images/deprimera_logo_1780923105846.png";
                      }}
                    />
                    <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                      DE PRIMERA — FÚTBOL & EVENTOS
                    </h1>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Análisis de Turnos y Gestión de Canchas
                    </p>
                  </div>
                  <div className="text-right space-y-1 text-xs">
                    <div className="bg-slate-900 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-sm">
                      REPORTE DE TURNOS
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 mt-2">
                      Período Evaluado:
                    </p>
                    <p className="font-extrabold text-slate-900 text-xs text-right">
                      {sinceDate} al {untilDate}
                    </p>
                    <p className="text-[9px] text-slate-450 mt-1 font-mono text-right">
                      Generado: {new Date().toLocaleString("es-ES")}
                    </p>
                  </div>
                </div>

                {/* Scope Parameters */}
                <div className="my-5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 print-avoid-break font-sans">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                    Filtros Activos en Listado de Reservas
                  </span>
                  <div className="grid grid-cols-3 gap-4 text-[11px] font-bold text-slate-700">
                    <div>
                      Cancha: <span className="font-black text-slate-900">{selectedCanchaFilter}</span>
                    </div>
                    <div>
                      Cliente: <span className="font-black text-slate-900">{selectedClienteFilter}</span>
                    </div>
                    <div>
                      Horario Inicial: <span className="font-black text-slate-900">{selectedHorarioFilter}</span>
                    </div>
                  </div>
                </div>

                {/* Turn metrics */}
                <div className="grid grid-cols-3 gap-4 my-6 print-avoid-break">
                  <div className="p-4 border border-slate-250 bg-indigo-50/10 rounded-xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Recaudación Turnos
                    </span>
                    <span className="text-xl font-black text-slate-900 block mt-1 font-mono">
                      ${turnReportData.totalRecaudado.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-1 font-semibold">
                      Monto cobrado por juego
                    </span>
                  </div>

                  <div className="p-4 border border-slate-250 bg-slate-50 rounded-xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Turnos Registrados
                    </span>
                    <span className="text-xl font-black text-slate-900 block mt-1 font-mono">
                      {turnReportData.totalReservas} reservas
                    </span>
                    <span className="text-[9px] text-slate-550 block mt-1 font-semibold">
                      Confirmados: {turnReportData.confirmedCount}
                    </span>
                  </div>

                  <div className="p-4 border border-slate-250 bg-rose-50/10 rounded-xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Día de Máxima Demanda
                    </span>
                    <span className="text-lg font-black text-slate-900 block mt-1">
                      {turnReportData.peakDay}
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-1 font-semibold">
                      Pico horario: {turnReportData.peakTimeSlot} hs
                    </span>
                  </div>
                </div>

                {/* Tables: Cancha ranking & busiest hours */}
                <div className="grid grid-cols-2 gap-6 my-6 print-avoid-break">
                  <div>
                    <h3 className="text-[10px] font-black uppercase text-slate-900 tracking-wider mb-2">
                      Rendimiento de Uso por Cancha
                    </h3>
                    <div className="h-[180px] w-full flex items-center justify-center bg-slate-50/50 rounded-xl p-2 border border-slate-100">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={turnReportData.canchaRanking}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={55}
                            paddingAngle={4}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            style={{ fontSize: "9px", fontWeight: "bold" }}
                          >
                            {turnReportData.canchaRanking.map((entry, index) => {
                              const colors = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444"];
                              const color = colors[index % colors.length];
                              return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                          </Pie>
                          <Tooltip 
                            formatter={(value: any, name: any, props: any) => {
                              const item = props?.payload;
                              const rev = item?.earnings !== undefined ? `$${item.earnings}` : "";
                              return [`${value} reservas (${rev})`, name];
                            }}
                            contentStyle={{ fontSize: '10px', borderRadius: '8px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black uppercase text-slate-900 tracking-wider mb-2">
                      Ranking De Clientes (Top 5)
                    </h3>
                    <table className="w-full border border-slate-200 text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[9px] text-slate-550 font-bold uppercase">
                          <th className="p-2 font-bold text-left">Cliente</th>
                          <th className="p-2 font-bold text-center">Reservas</th>
                          <th className="p-2 font-bold text-right">Gasto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {turnReportData.clientRanking.slice(0, 5).map(cust => (
                          <tr key={cust.name} className="border-b border-slate-100 font-semibold text-[10.5px]">
                            <td className="p-2 font-black text-slate-900 truncate max-w-[130px]">
                              {cust.name}
                              <span className="block text-[8px] text-indigo-500">{cust.tier}</span>
                            </td>
                            <td className="p-2 text-center font-mono">{cust.count}</td>
                            <td className="p-2 text-right font-mono font-bold">${cust.spend.toLocaleString("es-ES")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table for detailed listings */}
                <h3 className="text-[10px] font-black uppercase text-slate-900 tracking-wider mb-2 mt-6">
                  Listado Cronológico Filtrado de Reservas de Canchas
                </h3>
                <table className="w-full border border-slate-200 text-xs print-avoid-break">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[9px] text-slate-550 uppercase font-bold text-left">
                      <th className="p-2 text-left font-bold">Fecha / Hora</th>
                      <th className="p-2 text-left font-bold">Cancha</th>
                      <th className="p-2 text-left font-bold">Cliente</th>
                      <th className="p-2 text-center font-bold">Estado</th>
                      <th className="p-2 text-right font-bold">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turnReportData.filteredEvents.slice(0, 30).map(evt => (
                      <tr key={evt.id} className="border-b border-slate-100 text-[10px] font-semibold text-slate-750">
                        <td className="p-2 font-black text-slate-900">{evt.date} — {evt.time} hs</td>
                        <td className="p-2">{evt.fieldNumber}</td>
                        <td className="p-2 text-slate-600 font-bold">{evt.customerName}</td>
                        <td className="p-2 text-center text-[9px] uppercase font-bold">{evt.status}</td>
                        <td className="p-2 text-right font-mono font-bold">${evt.price.toLocaleString("es-ES")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {turnReportData.filteredEvents.length > 30 && (
                  <p className="text-[9.5px] text-slate-400 italic mt-2 text-center">
                    * El reporte de impresión ha sido truncado en los primeros 30 registros para optimización de páginas.
                  </p>
                )}

                {/* Note and certification footer */}
                <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-[10.5px]">
                  <div className="space-y-1 text-slate-500">
                    <p className="font-extrabold text-[10px] text-slate-605 uppercase tracking-wide">
                      Declaración de Auditoría y Control de Canchas:
                    </p>
                    <p className="leading-relaxed text-[9.5px]">
                      Corte automático deportivo generado de forma segura. Todas las reservas listadas cumplen con las validaciones de planilla y el cruce financiero oficial del club.
                    </p>
                  </div>
                  <div className="flex flex-col justify-end text-center space-y-3.5 pr-4">
                    <div className="w-48 mx-auto border-b-2 border-slate-400 h-8 font-sans"></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                      Corte Operador / Firma Administrador
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="simulated-paper text-slate-900 text-left p-2 sm:p-4 md:p-8" id="print-document-root-content">
            {/* Header with Brand Logo */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
              <div className="space-y-1.5">
                <img 
                  src={getLogoSrc()} 
                  alt="Logo de la marca" 
                  className="h-14 w-auto mb-2.5 object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = "/src/assets/images/deprimera_logo_1780923105846.png";
                  }}
                />
                <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                  DE PRIMERA — FÚTBOL & EVENTOS
                </h1>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Auditoría Financiera Interna — Control de Stock y Rentabilidad
                </p>
              </div>
              <div className="text-right space-y-1 text-xs">
                <div className="bg-slate-900 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-sm">
                  REPORTE DE RENTABILIDAD
                </div>
                <p className="text-[10px] font-bold text-slate-500 mt-2">
                  Período Evaluado:
                </p>
                <p className="font-extrabold text-slate-900 text-xs">
                  {sinceDate} al {untilDate}
                </p>
                <p className="text-[9px] text-slate-400 mt-1 font-mono">
                  Generado: {new Date().toLocaleString("es-ES")}
                </p>
              </div>
            </div>

            {/* Scope / parameters badge */}
            <div className="my-5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 print-avoid-break">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                Parámetros de Cálculo y Filtros Generados
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px] font-bold text-slate-700">
                <div>
                  Categoría/Familia: <span className="font-black text-slate-900">{selectedCategory}</span>
                </div>
                <div>
                  Cruce con Reservas Cancha: <span className="font-black text-emerald-600">{includeTurnos ? "SÍ (Suma total)" : "NO (Aislado)"}</span>
                </div>
                <div>
                  Ajuste de Mermas/Consumos: <span className="font-black text-indigo-600">{includeConsumos ? "SÍ (Suma coste)" : "NO (Excluido)"}</span>
                </div>
                <div>
                  Cero de Gastos Indirectos: <span className="font-black text-rose-600 font-bold uppercase">SÍ (Core Limpio)</span>
                </div>
              </div>
            </div>

            {/* Primary Metrics Bento Panel */}
            <div className="grid grid-cols-3 gap-4 my-6 print-avoid-break">
              <div className="p-4 border border-slate-200 bg-emerald-50/20 rounded-xl">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Ingreso Bruto
                </span>
                <span className="text-xl font-black text-slate-900 block mt-1 font-mono">
                  ${reportData.summary.ventasBrutas.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] font-semibold text-slate-500 block mt-1">
                  {includeTurnos ? "Ventas Buffet + Turnos" : "Solo ventas core Buffet"}
                </span>
              </div>

              <div className="p-4 border border-slate-200 bg-slate-50/30 rounded-xl">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Costo de Adquisición (CMV)
                </span>
                <span className="text-xl font-black text-slate-900 block mt-1 font-mono">
                  ${reportData.summary.cmv.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] font-semibold text-slate-500 block mt-1">
                  {includeConsumos ? "Fórmulas + Consumo Interno" : "Solo coste core Buffet"}
                </span>
              </div>

              <div className="p-4 border border-slate-200 bg-emerald-500/5 rounded-xl">
                <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest block">
                  Utilidad Real Desglosada
                </span>
                <span className="text-xl font-black text-emerald-700 block mt-1 font-mono">
                  ${reportData.summary.gananciaBruta.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] font-bold text-slate-700 block mt-1">
                  Margen S/ Ventas: <strong className="text-emerald-600 font-extrabold">{reportData.summary.margen.toFixed(1)}%</strong>
                </span>
              </div>
            </div>

            {/* Segregation overview list */}
            <div className="my-6 border border-slate-200 rounded-xl overflow-hidden print-avoid-break">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-black text-[9.5px] uppercase tracking-wider text-slate-500">
                Separación de Flujos por Divisiones Financieras
              </div>
              <div className="p-4 grid grid-cols-3 gap-4 divide-x divide-slate-200 text-xs">
                <div className="pr-2 space-y-1">
                  <h5 className="font-extrabold text-slate-900 uppercase text-[9px] tracking-wider">A. BUFFET (CORE ACTIVO)</h5>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Ventas:</span>
                    <strong className="text-slate-900 font-mono">${reportData.breakdown.buffetSales.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>CMV Costos:</span>
                    <strong className="text-slate-900 font-mono">${reportData.breakdown.buffetCost.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between text-[11px] font-extrabold text-slate-900 pt-1 border-t border-slate-100">
                    <span>Resultado:</span>
                    <strong className="text-emerald-600 font-mono">${reportData.breakdown.buffetProfit.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>

                <div className="px-3 space-y-1">
                  <h5 className="font-extrabold text-slate-900 uppercase text-[9px] tracking-wider">B. CANCHAS (TURNO EXTRA)</h5>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Recaudación:</span>
                    <strong className="text-slate-900 font-mono">${reportData.breakdown.turnosSales.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Costo:</span>
                    <strong className="text-slate-400 font-mono">$0.00</strong>
                  </div>
                  <div className="flex justify-between text-[11px] font-extrabold text-slate-900 pt-1 border-t border-slate-100">
                    <span>Resultado:</span>
                    <strong className="text-emerald-600 font-mono">${reportData.breakdown.turnosProfit.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>

                <div className="pl-3 space-y-1">
                  <h5 className="font-extrabold text-slate-900 uppercase text-[9px] tracking-wider">C. MERMAS/CONSUMOS</h5>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Recepción:</span>
                    <strong className="text-slate-400 font-mono">$0.00</strong>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Insumos CMV:</span>
                    <strong className="text-slate-900 font-mono">${reportData.breakdown.consumosCost.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between text-[11px] font-extrabold text-slate-900 pt-1 border-t border-slate-100">
                    <span>Ajuste:</span>
                    <strong className="text-rose-600 font-mono">-${reportData.breakdown.consumosCost.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Table Area */}
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-2 mt-6 print-avoid-break">
              Detalle Pormenorizado de Márgenes de Artículos
            </h3>
            <table className="w-full border-collapse border border-slate-200 print-avoid-break">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-700 uppercase border-b border-slate-200">
                  <th className="p-2 px-3 border-r border-slate-200 font-bold text-left">Concepto / Producto</th>
                  <th className="p-2 px-3 text-center border-r border-slate-200 font-bold">Familia / Tipo</th>
                  <th className="p-2 px-3 text-center border-r border-slate-200 font-bold">Cant.</th>
                  <th className="p-2 px-3 text-right border-r border-slate-200 font-bold">Ingresos</th>
                  <th className="p-2 px-3 text-right border-r border-slate-200 font-bold">Insumo CMV</th>
                  <th className="p-2 px-3 text-right border-r border-slate-200 font-bold">Resultado</th>
                  <th className="p-2 px-3 text-right font-bold">Margen %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {reportData.records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400 font-medium">
                      Ningún producto registrado en el período especificado.
                    </td>
                  </tr>
                ) : (
                  reportData.records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50">
                      <td className="p-2 px-3 font-semibold text-slate-900 border-r border-slate-200">{rec.name}</td>
                      <td className="p-2 px-3 text-center text-slate-600 border-r border-slate-200 text-xs uppercase tracking-tight">
                        <span className="font-extrabold text-[9.5px] block">{rec.category}</span>
                        <span className="text-[8px] text-slate-400 block font-bold">({rec.typeLabel})</span>
                      </td>
                      <td className="p-2 px-3 text-center font-mono font-bold border-r border-slate-200">{rec.quantity}</td>
                      <td className="p-2 px-3 text-right font-mono border-r border-slate-200">${rec.sales.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 px-3 text-right font-mono border-r border-slate-200">
                        ${rec.cost.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                        {rec.isReconstructed && <span className="block text-[7.5px] text-amber-600 uppercase font-extrabold">Reconstruido</span>}
                      </td>
                      <td className="p-2 px-3 text-right font-mono border-r border-slate-200 font-bold text-slate-900">
                        ${rec.gain.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 px-3 text-right font-mono font-bold text-slate-900">
                        {rec.margin > 0 ? `${rec.margin.toFixed(1)}%` : "0.0%"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Note and certification footer */}
            <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-[10.5px] print-avoid-break">
              <div className="space-y-1 text-slate-500">
                <p className="font-extrabold text-[10px] text-slate-605 uppercase tracking-wide">
                  Declaración de Auditoría y Control Financiero:
                </p>
                <p className="leading-relaxed text-[9.5px]">
                  Corte automático generado de forma segura. El inventario core de buffet ha sido conciliado según la segregación oficial de caja del gimnasio/deportiva, previniendo distorsiones por egresos externos fijos.
                </p>
              </div>
              <div className="flex flex-col justify-end text-center space-y-3.5 pr-4">
                <div className="w-48 mx-auto border-b-2 border-slate-400 h-8"></div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                  Corte Operador / Firma Administrador
                </span>
              </div>
            </div>
          </div>
        );
      };

        return (
          <>
            {/* Render Print Preview Overlay via Portal so it occupies document.body peer space */}
            {showPrintPreview && createPortal(
              <div className="print-portal-container z-[9999]">
                {/* On-screen Print Preview Modal overlay info (hidden on print) */}
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 md:p-6 no-print overflow-y-auto">
                  <div className="bg-slate-100 dark:bg-slate-950 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden my-4">
                    
                    {/* Modal Action Bar */}
                    <div className="px-5 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between no-print h-16">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-50 dark:bg-slate-800 rounded-lg text-emerald-600">
                          <Eye className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-black uppercase text-slate-800 dark:text-white tracking-wider">
                          Vista Previa de Impresión Física
                        </span>
                      </div>

                      <div className="flex items-center gap-2 px-1">
                        {/* Trigger direct Print inside container */}
                        <button
                          onClick={() => {
                            window.print();
                          }}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Confirmar e Imprimir</span>
                        </button>

                        {/* Close dialog */}
                        <button
                          onClick={() => setShowPrintPreview(false)}
                          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>Cerrar</span>
                        </button>
                      </div>
                    </div>

                    {/* Simulator Screen Area (shows physical A4 paper bounds) */}
                    <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-200/60 dark:bg-slate-900/80 flex justify-center">
                      <div className="w-full max-w-[21cm] bg-white text-slate-900 p-8 sm:p-12 shadow-xl border border-slate-300 rounded-md min-h-[29.7cm] flex flex-col justify-between">
                        <PrintableReport />
                      </div>
                    </div>
                    
                    <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-850 text-[10px] text-slate-500 font-bold no-print text-center selection:none">
                      * La vista previa simula las dimensiones A4 físicas y aplica las reglas de exclusión de mermas, turnos y costos.
                    </div>
                  </div>
                </div>

                {/* Flat, dedicated printable element that is shown ONLY on paper during printing */}
                <div className="hidden print:block print-document-only-container">
                  <PrintableReport />
                </div>
              </div>,
              document.body
            )}
          </>
        );
      })()}

      {/* Style for clean print layout bypassing scale/zoom issues as per instruction rules */}
      <style>{`
        /* Style for on-screen simulated paper */
        .simulated-paper {
          background-color: white !important;
          color: #0f172a !important;
          font-family: 'Inter', system-ui, sans-serif !important;
        }
        
        @media print {
          /* Hide the interactive app under #root completely */
          #root {
            display: none !important;
          }

          /* Hide on-screen only elements (modal overlays, action headers) */
          .no-print {
            display: none !important;
          }

          /* Ensure body background is white and text is dark */
          body {
            background-color: white !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Ensure print portal container is fully static and shown */
          .print-portal-container {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 99999999 !important;
          }

          /* Show the printable helper container */
          .print-document-only-container {
            display: block !important;
          }

          /* Clear styles on simulated-paper for print */
          .simulated-paper {
            display: block !important;
            background-color: white !important;
            color: #000000 !important;
            padding: 10mm !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
          }

          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          th, td {
            display: table-cell !important;
            padding: 6px 10px !important;
            font-size: 9.5pt !important;
            border-bottom: 1px solid #cbd5e1 !important;
          }
          
          th {
            background-color: #f1f5f9 !important;
            font-weight: 800 !important;
            color: #000000 !important;
          }
        }
      `}</style>

    </div>
  );
};

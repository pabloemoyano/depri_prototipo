/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Lock, 
  Unlock, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Coins, 
  ShoppingBag, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  RefreshCw,
  PlusCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Settings,
  X,
  Save,
  Printer,
  XCircle,
  Pencil,
  Edit2,
  Check,
  ChevronDown,
  AlertCircle
} from "lucide-react";
import { SaleTransaction, CustomerProfile, SaleItem, PendingClassification } from "../types";
import { auth, db } from "../lib/firebase";
import { getUnifiedPlan, getUnifiedAccounts, getUnifiedSubaccounts, Pillar, Account, Subaccount } from "../lib/accountManager";
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { AdminClassificationModal } from "./AdminClassificationModal";
import { CustomDropdown } from "./CustomDropdown";

// @ts-ignore
import deprimeraLogo from "../assets/images/deprimera_logo_1780923105846.png";

// Unified helper for authenticated requests to the backend API
async function apiFetchCaja(url: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Acceso denegado: Usuario no autenticado.");
  const token = await user.getIdToken();
  const headers = {
    ...options.headers,
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  return fetch(url, { ...options, headers });
}

// Types for V2 Sheet State
interface CanchaSlot {
  time: string;
  customerId: string; // empty if manual text
  customerName: string; // customer name or manual entry
  amount: number;
}

interface CustomEntry {
  id: string;
  quantity: number;
  accountId: string; // Master Plan Account ID
  subaccountId: string; // Master Plan Subaccount ID
  suggestedSubaccount?: string; // If subaccount not found
  isPendingClassification?: boolean;
  description: string;
  amount: number;
  purchaseId?: string;
}

interface CajaV2Session {
  id: string;
  dateStr: string; // e.g. "2026-06-04" or text
  isClosed: boolean;
  isOpen?: boolean; // 3-state support
  cancha1: CanchaSlot[];
  cancha2: CanchaSlot[];
  otrosIngresos: CustomEntry[];
  otrosEgresos: CustomEntry[];
  personalAccount: string; // Updated from fixed "Personal"
  personalDescription: string; // Updated from personalRole select
  personalAmount: number; // default "Encargado" egreso amount
  saldoInicial: number;
  rendicionEfectivo: number;
  rendicionTransferencia: number;
  rendicionTarjetas: number;
  billCounts?: Record<string, number>;
  buffetAccountId?: string;
  buffetSubaccountId?: string;
  buffetDescription?: string;
}

interface CajaDiariaV2Props {
  sales: SaleTransaction[];
  customers: CustomerProfile[];
  onAddSale?: (saleData: {
    items: SaleItem[];
    method: "efectivo" | "tarjeta" | "bizum";
    origin: "terminal" | "mesa" | "ticket_ai";
    table_number: string;
    notes?: string;
  }) => Promise<boolean>;
  onAddCustomer?: (customerData: any) => Promise<boolean>;
  onEditCustomer?: (customerData: CustomerProfile) => Promise<void>;
  onDeleteCustomer?: (id: string) => Promise<void>;
}

const getIsoStr = (d: Date): string => {
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0]; // Fallback safely for invalid dates
  const tzo = d.getTimezoneOffset();
  const raw = new Date(d.getTime() - (tzo * 60000));
  return raw.toISOString().split("T")[0];
};

export const parseCustomDateToIso = (text: string): string => {
  if (!text) return getIsoStr(new Date());
  const clean = text.trim();
  
  // 1. Check if YYYY-MM-DD or standard ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) return clean.replace(/\//g, "-");

  const cleanLower = clean.toLowerCase();
  
  // 2. Map Spanish words
  const spanishMonths: Record<string, string> = {
    enero: "01", ene: "01",
    febrero: "02", feb: "02",
    marzo: "03", mar: "03",
    abril: "04", abr: "04",
    mayo: "05", may: "05",
    junio: "06", jun: "06",
    julio: "07", jul: "07",
    agosto: "08", ago: "08",
    septiembre: "09", sep: "09", sept: "09",
    octubre: "10", oct: "10",
    noviembre: "11", nov: "11",
    diciembre: "12", dic: "12"
  };

  const tokens = cleanLower.split(/[^a-z0-9áéíóúñ]+/i).filter(Boolean);
  const filteredTokens = tokens.filter(t => t !== "de" && t !== "del" && t !== "el" && t !== "la" && t !== "al");

  let foundMonthKey = "";
  let monthIndex = -1;
  filteredTokens.forEach((tok, idx) => {
    if (spanishMonths[tok]) {
      foundMonthKey = tok;
      monthIndex = idx;
    }
  });

  if (monthIndex !== -1 && foundMonthKey) {
    const mStr = spanishMonths[foundMonthKey];
    let dStr = "";
    let yStr = "";
    if (monthIndex === 1 && filteredTokens.length >= 3) {
      dStr = filteredTokens[0];
      yStr = filteredTokens[2];
    } else if (filteredTokens.length >= 2) {
      const digits = filteredTokens.filter((t, idx) => idx !== monthIndex && /^\d+$/.test(t));
      if (digits.length >= 2) {
        const len4 = digits.find(d => d.length === 4);
        if (len4) {
          yStr = len4;
          const other = digits.find(d => d !== len4);
          if (other) dStr = other;
        } else {
          dStr = digits[0];
          yStr = digits[1];
        }
      } else if (digits.length === 1) {
        dStr = digits[0];
        yStr = String(new Date().getFullYear());
      }
    }
    
    if (dStr && yStr) {
      dStr = dStr.padStart(2, "0");
      if (yStr.length === 2) {
        yStr = "20" + yStr;
      }
      const iso = `${yStr}-${mStr}-${dStr}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    }
  }
  
  // 3. Parse pure numeric slash/dash formats: DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    const first = parts[0].trim();
    const second = parts[1].trim();
    const third = parts[2].trim();
    
    if (first.length === 4) {
      // YYYY/MM/DD
      const yStr = first;
      const mStr = second.padStart(2, "0");
      const dStr = third.padStart(2, "0");
      const iso = `${yStr}-${mStr}-${dStr}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    } else {
      const firstNum = parseInt(first, 10);
      const secondNum = parseInt(second, 10);
      
      let dStr = "";
      let mStr = "";
      let yStr = third;
      if (yStr.length === 2) {
        yStr = "20" + yStr;
      }
      
      // Decide intelligently which component is what
      if (secondNum > 12) {
        // Must be MM/DD/YYYY
        mStr = String(firstNum).padStart(2, "0");
        dStr = String(secondNum).padStart(2, "0");
      } else if (firstNum > 12) {
        // Must be DD/MM/YYYY
        dStr = String(firstNum).padStart(2, "0");
        mStr = String(secondNum).padStart(2, "0");
      } else {
        // Default to standard European/LatAm Spanish format: DD/MM/YYYY
        dStr = String(firstNum).padStart(2, "0");
        mStr = String(secondNum).padStart(2, "0");
      }
      
      const iso = `${yStr}-${mStr}-${dStr}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    }
  }

  // 4. Native parse fallback with robust timezone shift avoidance
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const yStr = String(d.getFullYear());
      const mStr = String(d.getMonth() + 1).padStart(2, "0");
      const dStr = String(d.getDate()).padStart(2, "0");
      return `${yStr}-${mStr}-${dStr}`;
    }
  } catch (e) {}

  return getIsoStr(new Date());
};

const toSpanishLongDate = (isoText: string): string => {
  if (!isoText) return "";
  const clean = isoText.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const parts = clean.split("-");
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const months = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    return `${d} de ${months[m - 1]} de ${y}`;
  }
  return clean;
};

// Also import FolderClosed and FolderOpen if they are needed, or since we have Lucide-react, let's see which icons are imported
export const CajaDiariaV2: React.FC<CajaDiariaV2Props> = ({ sales = [], customers = [], onAddSale, onAddCustomer, onEditCustomer, onDeleteCustomer }) => {
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    return localStorage.getItem("barstock_app_custom_logo");
  });

  // Load latest logo on mount and listen to changes
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const resp = await fetch("/api/settings/logo");
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.hasOwnProperty("customLogo")) {
            if (data.customLogo) {
              setCustomLogo(data.customLogo);
              localStorage.setItem("barstock_app_custom_logo", data.customLogo);
            } else {
              // If server has no logo, check if local storage has one, if so, upload it
              const localLogo = localStorage.getItem("barstock_app_custom_logo");
              if (localLogo) {
                await fetch("/api/settings/logo", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ customLogo: localLogo })
                });
                window.dispatchEvent(new Event("custom_logo_updated"));
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fetching settings logo in CajaDiariaV2:", err);
      }
    };
    fetchLogo();
    
    const handleUpdate = () => {
      setCustomLogo(localStorage.getItem("barstock_app_custom_logo"));
    };
    window.addEventListener("custom_logo_updated", handleUpdate);
    return () => {
      window.removeEventListener("custom_logo_updated", handleUpdate);
    };
  }, []);

  // Available slots
  const defaultTimesCancha1 = [
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "0:00", "1:00"
  ];

  const defaultTimesCancha2 = [
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "0:00", "1:00"
  ];

  const defaultPersonnelOptions = [
    "Encargado",
    "Ayudante",
    "Enc + Ayte",
    "Personal de Limpieza",
    "Seguridad Deportiva",
    "Cajero del Club",
    "Soporte Técnico"
  ];

  // Helper to generate a default/initial session structure
  const createFreshSession = (dateText: string = ""): CajaV2Session => {
    return {
      id: "session_v2_" + Date.now(),
      dateStr: dateText || getIsoStr(new Date()),
      isClosed: false,
      isOpen: false,
      cancha1: defaultTimesCancha1.map(time => ({ time, customerId: "", customerName: "", amount: 0 })),
      cancha2: defaultTimesCancha2.map(time => ({ time, customerId: "", customerName: "", amount: 0 })),
      otrosIngresos: [
        {
          id: "buffet",
          quantity: 1,
          accountId: "",
          subaccountId: "",
          description: "Ventas de Buffet",
          amount: 0
        }
      ],
      otrosEgresos: [],
      personalAccount: "Personal",
      personalDescription: "Encargado",
      personalAmount: 0,
      saldoInicial: 0,
      rendicionEfectivo: 0,
      rendicionTransferencia: 0,
      rendicionTarjetas: 0,
      billCounts: {
        "20000": 0,
        "10000": 0,
        "2000": 0,
        "1000": 0,
        "500": 0,
        "200": 0,
        "100": 0
      }
    };
  };

  // State
  const [activeSession, setActiveSession] = useState<CajaV2Session>(() => createFreshSession());
  const [history, setHistory] = useState<CajaV2Session[]>([]);
  const [currentDateISO, setCurrentDateISO] = useState<string>(() => getIsoStr(new Date()));

  const [isClosingConfirm, setIsClosingConfirm] = useState(false);
  const [isOpeningConfirm, setIsOpeningConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  // Accounting Plan state
  const [masterPlan, setMasterPlan] = useState<Pillar[]>([]);
  const [pendingClassificationsCount, setPendingClassificationsCount] = useState(0);
  const [showAdminClassificationModal, setShowAdminClassificationModal] = useState(false);

  useEffect(() => {
    setMasterPlan(getUnifiedPlan());
    
    // Fetch pending classifications count for admin
    const fetchPendingCount = async () => {
      // Small wait for auth state to stabilize if needed, 
      // but the main issue was the missing firestore rules
      const user = auth.currentUser;
      if (!user) return; 

      try {
        const q = query(collection(db, "pending_classifications"), where("status", "==", "PENDIENTE"));
        const snapshot = await getDocs(q);
        setPendingClassificationsCount(snapshot.size);
      } catch (err) {
        console.error("Error fetching pending classifications:", err);
      }
    };
    fetchPendingCount();
  }, []);

  // Default prices (tarifas) configuration
  const [showTarifasModal, setShowTarifasModal] = useState<1 | 2 | null>(null);
  const [tarifas, setTarifas] = useState<{cancha1: Record<string, number>, cancha2: Record<string, number>}>(() => {
    const saved = localStorage.getItem("caja_v2_tarifas");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { cancha1: {}, cancha2: {} };
  });
  const [editingTarifas, setEditingTarifas] = useState<Record<string, number>>({});

  const saveTarifas = async (cancha: 1 | 2) => {
    const newTarifas = { ...tarifas, [`cancha${cancha}`]: editingTarifas };
    setTarifas(newTarifas);
    localStorage.setItem("caja_v2_tarifas", JSON.stringify(newTarifas));
    setShowTarifasModal(null);

    try {
      await apiFetchCaja("/api/caja/tarifas", {
        method: "POST",
        body: JSON.stringify(newTarifas)
      });
    } catch (e) {
      console.error("Error saving tarifas to server:", e);
    }
  };

  const openTarifasModal = (cancha: 1 | 2) => {
    setEditingTarifas(tarifas[`cancha${cancha}`] || {});
    setShowTarifasModal(cancha);
  };

  // States for replacing manual client name window.prompt
  const [showManualClientPrompt, setShowManualClientPrompt] = useState(false);
  const [manualClientTarget, setManualClientTarget] = useState<{ index: number; cancha: 1 | 2 } | null>(null);
  const [manualClientNameInput, setManualClientNameInput] = useState("");

  // States for opening configuration
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [showOpenConfirm, setShowOpenConfirm] = useState<boolean>(false);

  // CRITICAL: Force clear local state for start fresh
  const handleFactoryReset = async () => {
    if (!window.confirm("¿ESTÁS SEGURO? Se borrarán todas las ventas y movimientos del servidor, y se reiniciará la caja local. Esta acción NO se puede deshacer.")) {
      return;
    }

    try {
      const resp = await fetch("/api/maintenance/total-wipe");
      const data = await resp.json();
      if (data.success) {
        localStorage.removeItem("caja_v2_active_session");
        localStorage.removeItem("caja_v2_closed_history");
        localStorage.removeItem("caja_v2_tarifas");
        localStorage.setItem("caja_v2_db_reset", Date.now().toString());
        window.location.reload();
      } else {
        alert("Error al borrar datos: " + data.error);
      }
    } catch (err) {
      alert("Error de conexión al resetear.");
    }
  };

  // Concept options for Other Incomes (Otros Ingresos) with persistent local storage
  const [otrosIngresosAccounts, setOtrosIngresosAccounts] = useState<string[]>(() => {
    const saved = localStorage.getItem("caja_v2_otros_ingresos_accounts");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ["Ventas Buffet", "Otros"];
  });

  const [otrosIngresosDescriptions, setOtrosIngresosDescriptions] = useState<string[]>(() => {
    const saved = localStorage.getItem("caja_v2_otros_ingresos_descriptions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [""];
  });

  // Concept options for Other Expenses (Otros Egresos) with persistent local storage
  const [otrosEgresosAccounts, setOtrosEgresosAccounts] = useState<string[]>(() => {
    const saved = localStorage.getItem("caja_v2_otros_egresos_accounts");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ["General", "Otros"];
  });

  const [otrosEgresosDescriptions, setOtrosEgresosDescriptions] = useState<string[]>(() => {
    const saved = localStorage.getItem("caja_v2_otros_egresos_descriptions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ["", "Otros"];
  });

  // Concept options for Personnel (Personal) with persistent local storage
  const [personnelAccounts, setPersonnelAccounts] = useState<string[]>(() => {
    const saved = localStorage.getItem("caja_v2_personnel_accounts");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ["Personal"];
  });

  const [personnelDescriptions, setPersonnelDescriptions] = useState<string[]>(() => {
    const saved = localStorage.getItem("caja_v2_personnel_descriptions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return defaultPersonnelOptions;
  });

  const customersListNames = React.useMemo(() => {
    return (customers || [])
      .filter(c => c.is_active !== false)
      .map(c => c.fullName)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [customers]);

  const loadedFromServerRef = React.useRef(false);

  const saveBoxlistsToServer = async () => {
    try {
      const compiled = {
        otrosIngresosAccounts,
        otrosIngresosDescriptions,
        otrosEgresosAccounts,
        otrosEgresosDescriptions,
        personnelAccounts,
        personnelDescriptions
      };
      await apiFetchCaja("/api/caja/boxlists", {
        method: "POST",
        body: JSON.stringify(compiled)
      });
    } catch (err) {
      console.error("Error saving boxlists to server:", err);
    }
  };

  const handleUpdateBoxlistCategory = async (category: string, nextOptions: string[]) => {
    const compiled = {
      otrosIngresosAccounts: category === "otrosIngresosAccounts" ? nextOptions : otrosIngresosAccounts,
      otrosIngresosDescriptions: category === "otrosIngresosDescriptions" ? nextOptions : otrosIngresosDescriptions,
      otrosEgresosAccounts: category === "otrosEgresosAccounts" ? nextOptions : otrosEgresosAccounts,
      otrosEgresosDescriptions: category === "otrosEgresosDescriptions" ? nextOptions : otrosEgresosDescriptions,
      personnelAccounts: category === "personnelAccounts" ? nextOptions : personnelAccounts,
      personnelDescriptions: category === "personnelDescriptions" ? nextOptions : personnelDescriptions
    };

    if (category === "otrosIngresosAccounts") {
      setOtrosIngresosAccounts(nextOptions);
      localStorage.setItem("caja_v2_otros_ingresos_accounts", JSON.stringify(nextOptions));
    } else if (category === "otrosIngresosDescriptions") {
      setOtrosIngresosDescriptions(nextOptions);
      localStorage.setItem("caja_v2_otros_ingresos_descriptions", JSON.stringify(nextOptions));
    } else if (category === "otrosEgresosAccounts") {
      setOtrosEgresosAccounts(nextOptions);
      localStorage.setItem("caja_v2_otros_egresos_accounts", JSON.stringify(nextOptions));
    } else if (category === "otrosEgresosDescriptions") {
      setOtrosEgresosDescriptions(nextOptions);
      localStorage.setItem("caja_v2_otros_egresos_descriptions", JSON.stringify(nextOptions));
    } else if (category === "personnelAccounts") {
      setPersonnelAccounts(nextOptions);
      localStorage.setItem("caja_v2_personnel_accounts", JSON.stringify(nextOptions));
    } else if (category === "personnelDescriptions") {
      setPersonnelDescriptions(nextOptions);
      localStorage.setItem("caja_v2_personnel_descriptions", JSON.stringify(nextOptions));
    }

    try {
      await apiFetchCaja("/api/caja/boxlists", {
        method: "POST",
        body: JSON.stringify(compiled)
      });
      console.log(`Synced ${category} changes directly with Firestore.`);
    } catch (err) {
      console.error("Error on direct boxlist Category synchronization:", err);
    }
  };

  useEffect(() => {
    const fetchBoxlists = async () => {
      try {
        const res = await apiFetchCaja("/api/caja/boxlists");
        if (res.ok) {
          const data = await res.json();
          if (data) {
            if (Array.isArray(data.otrosIngresosAccounts)) setOtrosIngresosAccounts(data.otrosIngresosAccounts);
            if (Array.isArray(data.otrosIngresosDescriptions)) setOtrosIngresosDescriptions(data.otrosIngresosDescriptions);
            if (Array.isArray(data.otrosEgresosAccounts)) setOtrosEgresosAccounts(data.otrosEgresosAccounts);
            if (Array.isArray(data.otrosEgresosDescriptions)) setOtrosEgresosDescriptions(data.otrosEgresosDescriptions);
            if (Array.isArray(data.personnelAccounts)) setPersonnelAccounts(data.personnelAccounts);
            if (Array.isArray(data.personnelDescriptions)) setPersonnelDescriptions(data.personnelDescriptions);
          } else {
            // First time ever: initialize database config doc with current local values
            loadedFromServerRef.current = true;
            await saveBoxlistsToServer();
          }
        }
      } catch (err) {
        console.error("Error loading server boxlists:", err);
      } finally {
        loadedFromServerRef.current = true;
      }
    };
    fetchBoxlists();
  }, []);

  const handleRenameOtrosIngresosAccount = (oldVal: string, newVal: string) => {
    setActiveSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        otrosIngresos: prev.otrosIngresos.map(r => r.account === oldVal ? { ...r, account: newVal } : r)
      };
    });
  };

  const handleRenameOtrosIngresosDescription = (oldVal: string, newVal: string) => {
    setActiveSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        otrosIngresos: prev.otrosIngresos.map(r => r.description === oldVal ? { ...r, description: newVal } : r)
      };
    });
  };

  const handleRenameOtrosEgresosAccount = (oldVal: string, newVal: string) => {
    setActiveSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        otrosEgresos: prev.otrosEgresos.map(r => r.account === oldVal ? { ...r, account: newVal } : r)
      };
    });
  };

  const handleRenameOtrosEgresosDescription = (oldVal: string, newVal: string) => {
    setActiveSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        otrosEgresos: prev.otrosEgresos.map(r => r.description === oldVal ? { ...r, description: newVal } : r)
      };
    });
  };

  const handleRenamePersonnelAccount = (oldVal: string, newVal: string) => {
    setActiveSession(prev => {
      if (!prev) return prev;
      if (prev.personalAccount === oldVal) {
        return { ...prev, personalAccount: newVal };
      }
      return prev;
    });
  };

  const handleRenamePersonnelDescription = (oldVal: string, newVal: string) => {
    setActiveSession(prev => {
      if (!prev) return prev;
      if (prev.personalDescription === oldVal) {
        return { ...prev, personalDescription: newVal };
      }
      return prev;
    });
  };

  // Print state
  const [printSession, setPrintSession] = useState<CajaV2Session | null>(null);

  // Auto self-heal: Ensure 1:00 is present in cancha1 and cancha2 lists for any loaded active session (V2 timeline alignment support)
  useEffect(() => {
    let changed = false;
    const healedC1 = [...activeSession.cancha1];
    defaultTimesCancha1.forEach(t => {
      if (!healedC1.some(s => s.time === t)) {
        healedC1.push({ time: t, customerId: "", customerName: "", amount: 0 });
        changed = true;
      }
    });

    const healedC2 = [...activeSession.cancha2];
    defaultTimesCancha2.forEach(t => {
      if (!healedC2.some(s => s.time === t)) {
        healedC2.push({ time: t, customerId: "", customerName: "", amount: 0 });
        changed = true;
      }
    });

    if (changed) {
      setActiveSession(prev => ({
        ...prev,
        cancha1: healedC1,
        cancha2: healedC2
      }));
    }
  }, [activeSession.cancha1.length, activeSession.cancha2.length]);

  // Determine which session to display based on currentDateISO
  const isActiveOpenSessionMatched = activeSession && activeSession.isOpen && !activeSession.isClosed && parseCustomDateToIso(activeSession.dateStr) === currentDateISO;
  
  // Find all history matches for this day
  const historyMatches = history.filter(h => parseCustomDateToIso(h.dateStr) === currentDateISO);
  // Pick the most recent closed history match if not active
  const historyMatch = historyMatches.length > 0 ? historyMatches[0] : null;

  const isClosed = !!historyMatch;
  const isOpen = isActiveOpenSessionMatched && !isClosed;
  const isLocked = !isClosed && !isOpen;
  const isEditable = isOpen && !isClosed;

  let sessionToDisplay: CajaV2Session;
  if (isActiveOpenSessionMatched && !isClosed) {
    sessionToDisplay = activeSession;
  } else if (historyMatch) {
    sessionToDisplay = {
      ...historyMatch,
      isClosed: true,
      isOpen: true
    };
  } else {
    // Show empty mockup/draft for Locked state
    sessionToDisplay = {
      ...createFreshSession(currentDateISO),
      isClosed: false,
      isOpen: false
    };
  }

  const session = sessionToDisplay;

  // Check if there is an existing open session for another date
  const existingOpenSession = (activeSession && activeSession.isOpen && parseCustomDateToIso(activeSession.dateStr) !== currentDateISO) ? activeSession : null;

  // Automatically recalculate Buffet row from `sales` for the viewed date/session ID
  const dateSales = sales.filter(sale => {
    if (sale.origin === "consumo_interno") return false;
    
    // EXCLUDE SALES FROM MESA/CANCHAS to avoid double counting
    // Canchas are managed manually in the grid below
    if (sale.origin === "mesa") return false; 
    
    // EXCLUDE System-generated cage movements to avoid double counting
    if (sale.origin === "sistema_caja") return false;
    
    // Extra safety for legacy system movements that might have "terminal" origin
    const systemLabels = ["Cancha 1", "Cancha 2", "Otros Ingresos", "Otros Egresos", "Personal Egreso"];
    if (systemLabels.includes(sale.table_number || "")) return false;
    
    if (sale.caja_session_id && session.id) {
      return sale.caja_session_id === session.id;
    }
    try {
      const saleIso = getIsoStr(new Date(sale.date));
      return saleIso === parseCustomDateToIso(session.dateStr);
    } catch {
      return false;
    }
  });
  
  const barSalesTotal = dateSales.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0);
  const barSalesQty = dateSales.reduce((acc, sale) => acc + (sale.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 0), 0);

  // Sync to localstorage and debounced POST upload to server
  useEffect(() => {
    const fetchCajaDataOnMount = async () => {
      try {
        // Run diagnostics/repair to heal any status conflict
        await apiFetchCaja("/api/caja/diagnose");
      } catch (e) {
        console.warn("Self-repair diagnostics error:", e);
      }

      let fetchedActiveSession: any = null;
      try {
        const activeRes = await apiFetchCaja("/api/caja/active");
        if (activeRes.ok) {
          const s = await activeRes.json();
          if (s && s.id) {
            setActiveSession(s);
            fetchedActiveSession = s;
          }
        }
      } catch (e) {
        console.warn("Failed fetching active session from server:", e);
      }

      try {
        const historyRes = await apiFetchCaja("/api/caja/history");
        if (historyRes.ok) {
          const serverHist = await historyRes.json();
          if (Array.isArray(serverHist)) {
            // Find local history to prevent overwrites or data loss
            let localHist: any[] = [];
            const saved = localStorage.getItem("caja_v2_closed_history");
            if (saved) {
              try {
                localHist = JSON.parse(saved);
              } catch {}
            }
            if (!Array.isArray(localHist)) localHist = [];

            // Identify local closed sessions missing from Firestore
            const serverIds = new Set(serverHist.map(h => h.id));
            const activeId = fetchedActiveSession?.id;
            const activeDateIso = fetchedActiveSession?.dateStr ? parseCustomDateToIso(fetchedActiveSession.dateStr) : null;

            const missingFromServer = localHist.filter(h => {
              if (!h || !h.id) return false;
              if (serverIds.has(h.id)) return false;
              // If it's currently active on the server, it's NOT a missing closed session!
              if (activeId && h.id === activeId) return false;
              if (activeDateIso && parseCustomDateToIso(h.dateStr) === activeDateIso) return false;
              return true;
            });

            if (missingFromServer.length > 0) {
              console.log("[SYNC] Local-only closed sessions found. Migrating to server:", missingFromServer);
              for (const missing of missingFromServer) {
                await apiFetchCaja("/api/caja/history", {
                  method: "POST",
                  body: JSON.stringify(missing)
                }).catch(err => console.error("Error migrating local history box to server:", err));
              }
              // Refetch latest synchronized sorted list
              const refetchedRes = await apiFetchCaja("/api/caja/history");
              if (refetchedRes.ok) {
                const freshHist = await refetchedRes.json();
                if (Array.isArray(freshHist)) {
                  setHistory(freshHist);
                }
              }
            } else {
              setHistory(serverHist);
            }
          }
        }
      } catch (e) {
        console.warn("Failed fetching history from server:", e);
      }

      try {
        const tarifasRes = await apiFetchCaja("/api/caja/tarifas");
        if (tarifasRes.ok) {
          const tar = await tarifasRes.json();
          if (tar && (tar.cancha1 || tar.cancha2)) {
            setTarifas(tar);
          }
        }
      } catch (e) {
        console.warn("Failed fetching tarifas from server:", e);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchCajaDataOnMount();
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch active session once to keep shared sessions fully synchronized
  useEffect(() => {
    let _active = true;
    const fetchActive = async () => {
      try {
        const activeRes = await apiFetchCaja("/api/caja/active");
        if (activeRes.ok && _active) {
          const s = await activeRes.json();
          if (s && s.id) {
            setActiveSession(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(s)) {
                if (currentDateISO !== parseCustomDateToIso(s.dateStr)) {
                  setCurrentDateISO(parseCustomDateToIso(s.dateStr));
                }
                return s;
              }
              return prev;
            });
          } else if (s === null) {
            setActiveSession(prev => {
              if (prev && prev.id && prev.isOpen && !prev.isClosed) {
                return createFreshSession(currentDateISO);
              }
              return prev;
            });
          }
        }
      } catch (e) {
        // Silent block
      }
    };
    
    fetchActive();

    return () => { _active = false; };
  }, [currentDateISO]);

  // Debounced POST upload to Firestore
  useEffect(() => {
    if (!activeSession) return;

    // Debounce uploads by 600ms to avoid clogging firestore on fast typing
    const uploadTimer = setTimeout(() => {
      // Do not upload if we are currently saving/closing things or the session is actually closed
      if (activeSession && activeSession.id && activeSession.isOpen && !isSaving) {
        apiFetchCaja("/api/caja/active", {
          method: "POST",
          body: JSON.stringify(activeSession)
        }).catch(err => console.error("Error syncing active session to server:", err));
      }
    }, 600);

    return () => clearTimeout(uploadTimer);
  }, [activeSession]);

  // Form helpers to write/edit canchas
  const updateCancha1Field = (index: number, fields: Partial<CanchaSlot>) => {
    if (!isEditable) return;
    setActiveSession(prev => {
      const updated = [...prev.cancha1];
      updated[index] = { ...updated[index], ...fields };
      return { ...prev, cancha1: updated };
    });
  };

  const updateCancha2Field = (index: number, fields: Partial<CanchaSlot>) => {
    if (!isEditable) return;
    setActiveSession(prev => {
      const updated = [...prev.cancha2];
      updated[index] = { ...updated[index], ...fields };
      return { ...prev, cancha2: updated };
    });
  };

  // Otros ingresos
  const addOtrosIngresosRow = () => {
    if (!isEditable) return;
    const newEntry: CustomEntry = {
      id: "inc_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      quantity: 1,
      accountId: "",
      subaccountId: "",
      description: "",
      amount: 0
    };
    setActiveSession(prev => ({
      ...prev,
      otrosIngresos: [...prev.otrosIngresos, newEntry]
    }));
  };

  const updateOtrosIngresosRow = (id: string, fields: Partial<CustomEntry>) => {
    if (!isEditable) return;
    setActiveSession(prev => ({
      ...prev,
      otrosIngresos: prev.otrosIngresos.map(row => row.id === id ? { ...row, ...fields } : row)
    }));
  };

  const deleteOtrosIngresosRow = (id: string) => {
    if (!isEditable) return;
    setActiveSession(prev => ({
      ...prev,
      otrosIngresos: prev.otrosIngresos.filter(row => row.id !== id)
    }));
  };

  // Otros egresos
  const addOtrosEgresosRow = () => {
    if (!isEditable) return;
    const newEntry: CustomEntry = {
      id: "exp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      quantity: 1,
      accountId: "",
      subaccountId: "",
      description: "",
      amount: 0
    };
    setActiveSession(prev => ({
      ...prev,
      otrosEgresos: [...prev.otrosEgresos, newEntry]
    }));
  };

  const updateOtrosEgresosRow = (id: string, fields: Partial<CustomEntry>) => {
    if (!isEditable) return;
    setActiveSession(prev => ({
      ...prev,
      otrosEgresos: prev.otrosEgresos.map(row => row.id === id ? { ...row, ...fields } : row)
    }));
  };

  const deleteOtrosEgresosRow = (id: string) => {
    if (!isEditable) return;
    setActiveSession(prev => ({
      ...prev,
      otrosEgresos: prev.otrosEgresos.filter(row => row.id !== id)
    }));
  };

  // Calculations
  const subtotalCancha1 = session.cancha1.reduce((sum, slot) => sum + (Number(slot.amount) || 0), 0);
  const subtotalCancha2 = session.cancha2.reduce((sum, slot) => sum + (Number(slot.amount) || 0), 0);

  const otrosIngresosManualTotal = session.otrosIngresos.reduce((sum, row) => {
    if (row.id === "buffet") return sum;
    return sum + (row.quantity * (Number(row.amount) || 0));
  }, 0);
  const totalOtrosIngresos = barSalesTotal + otrosIngresosManualTotal;

  // Other Expenses: manual otrosEgresos only
  const totalOtrosEgresos = session.otrosEgresos.reduce((sum, row) => sum + (row.quantity * (Number(row.amount) || 0)), 0);

  // Theoretical Account Summary
  const totalIngresosTeorico = Number(session.saldoInicial) + subtotalCancha1 + subtotalCancha2 + totalOtrosIngresos;
  const totalEgresosTeorico = totalOtrosEgresos;
  const totalARendirTeorico = totalIngresosTeorico - totalEgresosTeorico;

  // Actual Cash Count Reconciliation (Argentine denominations)
  const totalRendidoEfectivo = Object.entries(session.billCounts || {}).reduce((sum, [denom, count]) => sum + (Number(denom) * (Number(count) || 0)), 0);
  const totalRendidoTransferencia = Number(session.rendicionTransferencia) || 0;
  const totalRendidoReal = totalRendidoEfectivo + totalRendidoTransferencia;

  const diferenciaRendicion = totalRendidoReal - totalARendirTeorico;

  // Handles state controls
  const handleForceResetAll = async () => {
    if (confirm("¿Estás seguro de que quieres realizar un RESET TOTAL? Esto borrará todas las ventas y movimientos del servidor, y reiniciará el historial de cajas. Esta acción NO se puede deshacer.")) {
      try {
        const resp = await fetch("/api/maintenance/total-wipe");
        const data = await resp.json();
        if (!data.success) {
          alert("Error en el servidor: " + (data.error || "Ocurrió un problema"));
          return;
        }

        // Clear Local Storage
        localStorage.removeItem("caja_v2_active_session");
        localStorage.removeItem("caja_v2_closed_history");
        localStorage.removeItem("caja_v2_tarifas");
        localStorage.setItem("caja_v2_db_reset", Date.now().toString());

        // Refresh UI
        setHistory([]);
        const fresh = createFreshSession(currentDateISO);
        fresh.isOpen = false;
        fresh.isClosed = false;
        setActiveSession(fresh);
        
        setSuccessNotification("SISTEMA RESETEADO: Todo se ha borrado correctamente.");
        window.location.reload();
      } catch (err) {
        alert("Error de conexión al intentar resetear el sistema.");
      }
    }
  };

  const handleCloseCajaV2 = async () => {
    if (activeSession.isClosed) return;
    setIsSaving(true);
    
    try {
      const salesToRegister: any[] = [];
      const sessionTargetDate = new Date(currentDateISO + "T12:00:00").toISOString();
      
      // Post Cancha 1 Slots
      activeSession.cancha1.forEach((slot) => {
        if (slot.amount > 0) {
          salesToRegister.push({
            items: [{
              stock_item_id: "cancha_booking_c1",
              name: "venta de turno",
              quantity: 1,
              price: Number(slot.amount),
              total: Number(slot.amount)
            }],
            total: Number(slot.amount),
            method: "efectivo" as const,
            origin: "sistema_caja" as const,
            table_number: "Cancha 1",
            notes: `Cliente: ${slot.customerName || "Consumidor Final"} - Turno: ${slot.time}`,
            caja_session_id: activeSession.id,
            date: sessionTargetDate
          });
        }
      });

      // Post Cancha 2 Slots
      activeSession.cancha2.forEach((slot) => {
        if (slot.amount > 0) {
          salesToRegister.push({
            items: [{
              stock_item_id: "cancha_booking_c2",
              name: "venta de turno",
              quantity: 1,
              price: Number(slot.amount),
              total: Number(slot.amount)
            }],
            total: Number(slot.amount),
            method: "efectivo" as const,
            origin: "sistema_caja" as const,
            table_number: "Cancha 2",
            notes: `Cliente: ${slot.customerName || "Consumidor Final"} - Turno: ${slot.time}`,
            caja_session_id: activeSession.id,
            date: sessionTargetDate
          });
        }
      });

      // Post Otros Ingresos (excluding automatic Buffet bar totals, since they are already sales)
      for (const row of activeSession.otrosIngresos) {
        if (row.id === "buffet") continue;
        if (row.amount > 0) {
          const accLabel = masterPlan.flatMap(p => p.accounts).find(a => a.id === row.accountId)?.label || "Sin Cuenta";
          const subaccLabel = masterPlan.flatMap(p => p.accounts).flatMap(a => a.subaccounts).find(s => s.id === row.subaccountId)?.label || (row.isPendingClassification ? `Pendiente: ${row.suggestedSubaccount}` : "Sin Subcuenta");
          
          const rowName = `${accLabel} - ${subaccLabel}${row.description ? ` - ${row.description}` : ""}`;
          const saleObj = {
            items: [{
              stock_item_id: "other_income",
              name: rowName,
              quantity: Number(row.quantity) || 1,
              price: Number(row.amount),
              total: (Number(row.quantity) || 1) * Number(row.amount)
            }],
            total: (Number(row.quantity) || 1) * Number(row.amount),
            method: "efectivo" as const,
            origin: "sistema_caja" as const,
            table_number: "Otros Ingresos",
            notes: row.description || `Clasificación: ${accLabel} / ${subaccLabel}`,
            caja_session_id: activeSession.id,
            date: sessionTargetDate,
            accountId: row.accountId,
            subaccountId: row.subaccountId
          };
          salesToRegister.push(saleObj);

          if (row.isPendingClassification) {
            await addDoc(collection(db, "pending_classifications"), {
              movementId: activeSession.id + "_" + row.id,
              accountId: row.accountId,
              suggestedSubaccount: row.suggestedSubaccount || "",
              description: row.description || "",
              amount: (Number(row.quantity) || 1) * Number(row.amount),
              user: auth.currentUser?.email || "Sistema",
              date: sessionTargetDate,
              imputedPeriod: currentDateISO.substring(0, 7),
              status: "PENDIENTE",
              type: "INGRESO"
            });
          }
        }
      }

      // Post Otros Egresos (as negative sale items)
      for (const row of activeSession.otrosEgresos) {
        if (row.amount > 0) {
          const accLabel = masterPlan.flatMap(p => p.accounts).find(a => a.id === row.accountId)?.label || "Sin Cuenta";
          const subaccLabel = masterPlan.flatMap(p => p.accounts).flatMap(a => a.subaccounts).find(s => s.id === row.subaccountId)?.label || (row.isPendingClassification ? `Pendiente: ${row.suggestedSubaccount}` : "Sin Subcuenta");

          const rowName = `${accLabel} - ${subaccLabel}${row.description ? ` - ${row.description}` : ""}`;
          const saleObj = {
            items: [{
              stock_item_id: "other_expense",
              name: rowName,
              quantity: Number(row.quantity) || 1,
              price: -Number(row.amount),
              total: -((Number(row.quantity) || 1) * Number(row.amount))
            }],
            total: -((Number(row.quantity) || 1) * Number(row.amount)),
            method: "efectivo" as const,
            origin: "sistema_caja" as const,
            table_number: "Otros Egresos",
            notes: row.description || `Clasificación: ${accLabel} / ${subaccLabel}`,
            caja_session_id: activeSession.id,
            date: sessionTargetDate,
            accountId: row.accountId,
            subaccountId: row.subaccountId
          };
          salesToRegister.push(saleObj);

          if (row.isPendingClassification) {
            await addDoc(collection(db, "pending_classifications"), {
              movementId: activeSession.id + "_" + row.id,
              accountId: row.accountId,
              suggestedSubaccount: row.suggestedSubaccount || "",
              description: row.description || "",
              amount: (Number(row.quantity) || 1) * Number(row.amount),
              user: auth.currentUser?.email || "Sistema",
              date: sessionTargetDate,
              imputedPeriod: currentDateISO.substring(0, 7),
              status: "PENDIENTE",
              type: "EGRESO"
            });
          }
        }
      }

      // Execute onAddSale calls and wait sequentially to keep database order correct
      if (onAddSale) {
        for (const sale of salesToRegister) {
          const success = await onAddSale(sale);
          if (success === false) {
            throw new Error(`Error registrando el movimiento "${sale.items[0]?.name}". El servidor rechazó la solicitud.`);
          }
        }
      }

      // Recalculate physical cash total in bills on closing to ensure perfect sync
      const finalRendicionEfectivo = Object.entries(activeSession.billCounts || {}).reduce(
        (sum, [denom, count]) => sum + (Number(denom) * (Number(count) || 0)),
        0
      );

      const closedSession: CajaV2Session = {
        ...activeSession,
        isClosed: true,
        isOpen: false,
        rendicionEfectivo: finalRendicionEfectivo,
        dateStr: currentDateISO
      };
      
      // Synchronize closed session data with the backend with strict status validation
      const historyRes = await apiFetchCaja("/api/caja/history", {
        method: "POST",
        body: JSON.stringify(closedSession)
      });
      
      if (!historyRes.ok) {
        const errJSON = await historyRes.json().catch(() => ({}));
        throw new Error(`No se pudo registrar la sesión de caja en el historial: ${errJSON.error || historyRes.statusText}`);
      }

      const historyData = await historyRes.json();
      if (!historyData || !historyData.id) {
        throw new Error("El servidor no retornó una confirmación de guardado válida (ID faltante).");
      }

      // STRICT VERIFICATION: Fetch from backend to ensure the caja has indeed been saved
      const verifyRes = await apiFetchCaja("/api/caja/history");
      if (!verifyRes.ok) {
        throw new Error("Error al consultar el historial del servidor para verificar el guardado de la caja.");
      }
      const verifyList = await verifyRes.json();
      const isVerifiedSaved = Array.isArray(verifyList) && verifyList.some((h: any) => h && h.id === closedSession.id);
      if (!isVerifiedSaved) {
        throw new Error("Fallo crítico de verificación: La caja fue guardada pero no se encuentra presente en el historial de la base de datos.");
      }

      // Once successfully persisted and verified, delete the temporary active session from backend
      const deleteRes = await apiFetchCaja("/api/caja/active", {
        method: "DELETE"
      });
      if (!deleteRes.ok) {
        const errJSON = await deleteRes.json().catch(() => ({}));
        throw new Error(`No se pudo dar de baja la caja activa del servidor tras persistir el historial: ${errJSON.error || deleteRes.statusText}`);
      }

      setHistory(prev => [closedSession, ...prev]);
      
      const fresh = createFreshSession(currentDateISO);
      setActiveSession(fresh);
      setIsClosingConfirm(false);
      
      setSuccessNotification("¡Hoja diaria de caja V2 cerrada con éxito! Todos los registros de la planilla (turnos, ingresos y egresos) han sido grabados de forma segura, impactaron en todos los módulos correspondientes, y la persistencia en base de datos fue verificada satisfactoriamente.");
    } catch (e: any) {
      console.error("Fallo crítico en el proceso de cierre de caja:", e);
      alert(`⚠️ ERROR EN EL PROCESO DE CIERRE: ${e.message || e || "Ocurrió un error inesperado al cerrar la caja."}\n\nLa caja NO se ha cerrado para evitar cualquier inconsistencia o pérdida de datos. Por favor, intente nuevamente.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenNewCajaV2 = (initialAmount: number = 0) => {
    const fresh: CajaV2Session = {
      ...createFreshSession(currentDateISO),
      isOpen: true,
      saldoInicial: initialAmount,
      dateStr: currentDateISO
    };
    setActiveSession(fresh);
    setIsOpeningConfirm(false);
    setShowOpenConfirm(false);
    setSuccessNotification("¡Nueva hoja de trabajo de control y rendición de caja V2 iniciada para esta fecha!");
  };

  const handleAnnulApertura = async () => {
    if (!confirm("¿Estás seguro de que deseas ANULAR la apertura de caja de este día? Esto regresará la caja al estado cerrada sin guardar ninguna rendición ni movimientos, permitiéndote abrir la caja en otra fecha si te equivocaste.")) {
      return;
    }
    
    setIsSaving(true);
    try {
      const res = await apiFetchCaja("/api/caja/active", {
        method: "DELETE"
      });
      if (res.ok) {
        localStorage.removeItem("caja_v2_active_session");
        
        const fresh = createFreshSession(currentDateISO);
        fresh.isOpen = false;
        fresh.isClosed = false;
        setActiveSession(fresh);
        
        setSuccessNotification("Apertura de caja anulada con éxito. El estado ha regresado a Caja Cerrada.");
      } else {
        const errText = await res.text();
        alert("Error al anular la apertura en el servidor: " + errText);
      }
    } catch (e: any) {
      console.error(e);
      alert("Error de conexión al anular la apertura: " + (e.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReopenCaja = async () => {
    if (!confirm("¿Estás seguro de que deseas REABRIR la caja de este día? Esto la quitará del historial cerrado y la pondrá de nuevo como la Caja Activa actual, permitiéndote realizar modificaciones, agregar turnos o egresos, y volver a cerrarla cuando corresponda.")) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiFetchCaja("/api/caja/reopen", {
        method: "POST",
        body: JSON.stringify({ dateStr: currentDateISO })
      });
      if (res.ok) {
        const data = await res.json();
        const reopenedId = data.session?.id;
        
        // Remove this specific session from local closed history to prevent automatic re-upload
        const saved = localStorage.getItem("caja_v2_closed_history");
        if (saved) {
          try {
            const hist = JSON.parse(saved);
            if (Array.isArray(hist)) {
              const filtered = hist.filter((h: any) => h && parseCustomDateToIso(h.dateStr) !== currentDateISO && h.id !== reopenedId);
              localStorage.setItem("caja_v2_closed_history", JSON.stringify(filtered));
            }
          } catch (e) {
            console.error("Error cleaning local history on reopen:", e);
          }
        }

        setSuccessNotification("¡Planilla de caja reabierta con éxito! Ahora puedes modificarla en esta pantalla.");
        
        // Reload page to refresh all tab states cleanly
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const errText = await res.text();
        alert("Error al reabrir la caja en el servidor: " + errText);
      }
    } catch (e: any) {
      console.error(e);
      alert("Error de conexión al reabrir la caja: " + (e.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleActiveCustomerSelect = (index: number, cancha: 1 | 2, value: string) => {
    if (session.isClosed) return;
    
    // Check if selecting "Otro..." or a real client
    if (value === "OTRO_MANUAL") {
      setManualClientTarget({ index, cancha });
      setManualClientNameInput("");
      setShowManualClientPrompt(true);
    } else if (value === "") {
      if (cancha === 1) {
        updateCancha1Field(index, { customerId: "", customerName: "", amount: 0 });
      } else {
        updateCancha2Field(index, { customerId: "", customerName: "", amount: 0 });
      }
    } else {
      const selectedCust = customers.find(c => c.id === value);
      if (selectedCust) {
        if (cancha === 1) {
          const slotTime = session.cancha1[index]?.time;
          const defaultPrice = tarifas.cancha1[slotTime] || 0;
          updateCancha1Field(index, { customerId: selectedCust.id, customerName: selectedCust.fullName, amount: defaultPrice });
        } else {
          const slotTime = session.cancha2[index]?.time;
          const defaultPrice = tarifas.cancha2[slotTime] || 0;
          updateCancha2Field(index, { customerId: selectedCust.id, customerName: selectedCust.fullName, amount: defaultPrice });
        }
      }
    }
  };

  const handleConfirmManualClient = async () => {
    if (manualClientTarget && manualClientNameInput.trim()) {
      const { index, cancha } = manualClientTarget;
      const finalName = manualClientNameInput.trim();
      let finalCustomerId = "";

      if (onAddCustomer) {
        // Attempt to create customer
        const newCustomerData = {
          fullName: finalName,
          phone: "",
          email: "",
          category: "Regular",
          loyaltyTier: "STANDARD TIER",
          loyaltyPoints: 0,
          progressToNextPct: 0,
          ytdSales: 0,
          outstandingCredit: 0,
          is_active: true
        };
        const success = await onAddCustomer(newCustomerData);
        // It will eventually show up in `customers` prop after refresh.
      }

      if (cancha === 1) {
        const slotTime = session.cancha1[index]?.time;
        const defaultPrice = tarifas.cancha1[slotTime] || 0;
        updateCancha1Field(index, { customerId: finalCustomerId, customerName: finalName, amount: defaultPrice });
      } else {
        const slotTime = session.cancha2[index]?.time;
        const defaultPrice = tarifas.cancha2[slotTime] || 0;
        updateCancha2Field(index, { customerId: finalCustomerId, customerName: finalName, amount: defaultPrice });
      }
    }
    setShowManualClientPrompt(false);
    setManualClientTarget(null);
    setManualClientNameInput("");
  };

  const getSessionTotals = (sess: CajaV2Session) => {
    const subtotalC1 = sess.cancha1.reduce((sum, slot) => sum + (Number(slot.amount) || 0), 0);
    const subtotalC2 = sess.cancha2.reduce((sum, slot) => sum + (Number(slot.amount) || 0), 0);
    const totalCanchas = subtotalC1 + subtotalC2;

    const sIso = parseCustomDateToIso(sess.dateStr);
    const sSales = sales.filter(sale => {
      if (sale.origin === "consumo_interno") return false;
      
      // EXCLUDE MESA AND sistema_caja FROM BUFFET TOTAL to avoid double counting
      if (sale.origin === "mesa" || sale.origin === "sistema_caja") return false;

      const sysLabelsArr = ["Cancha 1", "Cancha 2", "Otros Ingresos", "Otros Egresos", "Personal Egreso"];
      if (sysLabelsArr.includes(sale.table_number || "")) return false;

      // Use session ID if available for pinpoint accuracy
      if (sale.caja_session_id && sess.id) {
        return sale.caja_session_id === sess.id;
      }

      // Fallback to date matching for older records
      try {
        return getIsoStr(new Date(sale.date)) === sIso;
      } catch {
        return false;
      }
    });

    const barTotal = sSales.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0);
    const barQty = sSales.reduce((acc, sale) => acc + (sale.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 0), 0);

    const otrosIngresosTotal = sess.otrosIngresos.reduce((sum, r) => {
      if (r.id === "buffet") return sum;
      return sum + ((Number(r.quantity) || 1) * (Number(r.amount) || 0));
    }, 0);
    const totalIncomes = barTotal + otrosIngresosTotal;

    const totalExpenses = sess.otrosEgresos.reduce((sum, r) => sum + ((Number(r.quantity) || 1) * (Number(r.amount) || 0)), 0);

    const theoreticalCaja = (Number(sess.saldoInicial) || 0) + totalCanchas + totalIncomes - totalExpenses;
    
    const cashTotal = Object.entries(sess.billCounts || {}).reduce((sum, [denom, count]) => sum + (Number(denom) * (Number(count) || 0)), 0);
    const realRendido = cashTotal + (Number(sess.rendicionTransferencia) || 0);
    const discrepancy = realRendido - theoreticalCaja;

    return {
      subtotalC1,
      subtotalC2,
      totalCanchas,
      barTotal,
      barQty,
      otrosIngresosTotal,
      totalIncomes,
      personalExp: 0,
      otrosEgresosTotal: totalExpenses,
      totalExpenses,
      theoreticalCaja,
      realRendido,
      discrepancy
    };
  };

  const handleTriggerPrint = () => {
    try {
      const printContent = document.getElementById("print-section");
      if (!printContent) {
        // Fallback if print section is missing
        window.print();
        return;
      }

      // Open a temporary blank window
      const printWindow = window.open("", "_blank", "width=850,height=1100,scrollbars=yes,resizable=yes");
      if (!printWindow) {
        // Fallback to native print if popups are blocked
        console.warn("Popup blocked. Falling back to native print.");
        window.focus();
        window.print();
        return;
      }

      // Write document structure with only the print-section content
      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <base href="${window.location.origin}/" />
            <title>Planilla de Caja Diaria</title>
            <meta charset="utf-8" />
            <style>
              @page {
                size: A4 portrait;
                margin: 8mm 10mm; /* Consistent margins for A4 */
              }
              body {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
                font-family: ui-sans-serif, system-ui, sans-serif !important;
                overflow: visible !important;
                width: 100% !important;
              }
              #print-section {
                display: block !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              /* Standard high-contrast, compact styling for print-out */
              table {
                width: 100% !important;
                border-collapse: collapse !important;
              }
              tr {
                page-break-inside: avoid !important;
              }
              td, th {
                padding: 3px 5px !important;
                border-bottom: 1px solid #ddd !important;
                font-size: 9pt !important;
              }
              .grid-cols-2 {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                gap: 12px !important;
              }
              h1 { font-size: 13pt !important; margin: 0 0 2px 0 !important; line-height: 1.1 !important; }
              h4 { font-size: 10pt !important; font-weight: bold !important; margin-bottom: 4px !important; }
              p, div, span { font-size: 9pt !important; line-height: 1.15 !important; }
              .space-y-6 > * + * {
                margin-top: 0.5rem !important;
              }
              .space-y-2 > * + * {
                margin-top: 0.2rem !important;
              }
              /* Reset colored backgrounds for perfect printing contrast */
              .bg-indigo-50, .bg-emerald-50, .bg-rose-50, .bg-slate-50 {
                background: transparent !important;
                border: 0.5pt solid #ddd !important;
              }
            </style>
          </head>
          <body class="bg-white">
            <div style="padding: 5px;">
              ${printContent.innerHTML}
            </div>
          </body>
        </html>
      `);

      // Dynamically copy all style and link nodes from the main app to the temporary window
      const styleSheets = document.querySelectorAll('link[rel="stylesheet"], style');
      styleSheets.forEach((node) => {
        printWindow.document.head.appendChild(node.cloneNode(true));
      });

      printWindow.document.close();
      printWindow.focus();

      // Initiate print after drawing has settled, then auto-close the tab
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => {
          printWindow.close();
        }, 1000);
      }, 350);

    } catch (e) {
      console.error("Advanced window.open printing failed, reverting to default printer frame.", e);
      window.print();
    }
  };

  // View specific history session sheet
  const handleLoadHistorySession = (histSess: CajaV2Session) => {
    setCurrentDateISO(parseCustomDateToIso(histSess.dateStr));
    const element = document.getElementById("cajadiaria_v2_view");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const canEditDate = !session.isClosed;

  return (
    <div className="space-y-6" id="cajadiaria_v2_view">
      {successNotification && (
        <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-900 p-4 rounded-xl shadow-xs flex items-center justify-between text-xs font-bold animate-fade-in relative z-20">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successNotification}</span>
          </div>
          <button
            onClick={() => setSuccessNotification(null)}
            className="p-1 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-950 font-black text-sm rounded-md cursor-pointer transition select-none"
            title="Cerrar notificación"
          >
            ✕
          </button>
        </div>
      )}
      
      {/* Upper Panel */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-8 text-white opacity-5 select-none pointer-events-none">
          <Coins className="w-64 h-64" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-950/60 py-1 px-3 rounded-full border border-emerald-800">
                Modelo Excel V2
              </span>
              <span className={`text-[10px] font-black uppercase tracking-wide py-1 px-2.5 rounded-full border ${
                isClosed 
                   ? "bg-rose-950 text-rose-300 border-rose-800" 
                   : isOpen
                     ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                     : "bg-slate-800 text-slate-350 border-slate-705"
              }`}>
                {isClosed ? "🔒 Caja Cerrada" : isOpen ? "🔓 Caja Abierta" : "🔒 Caja Bloqueada (Vacía)"}
              </span>
            </div>
            <h2 className="text-xl font-bold font-display uppercase tracking-tight">Planilla de Control y Rendición de Caja V2</h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Diseño de caja unificado por canchas deportivas, otros cobros, flujo de personal y rendición de efectivo con monitoreo de discrepancia.
            </p>
          </div>
          
          <div className="md:text-right flex flex-col md:items-end justify-center gap-3">
            {pendingClassificationsCount > 0 && (
              <div className="bg-amber-100 border border-amber-200 rounded-xl py-2 px-4 shadow-sm flex items-center gap-2 animate-pulse">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <div className="text-left">
                  <div className="text-[9px] text-amber-800 font-black uppercase tracking-widest leading-none">Pendientes de Clasificación</div>
                  <div className="text-xs font-black text-amber-900">
                    {pendingClassificationsCount} movimientos esperando revisión
                  </div>
                </div>
                <button 
                  onClick={() => setShowAdminClassificationModal(true)}
                  className="ml-2 bg-amber-600 text-white text-[10px] font-bold px-2 py-1 rounded-md hover:bg-amber-700 transition cursor-pointer"
                >
                  GESTIONAR
                </button>
              </div>
            )}

            <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700/50 rounded-xl py-2 px-4 shadow-sm inline-block">
              {activeSession && activeSession.isOpen && !activeSession.isClosed ? (
                <>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Estado Global</div>
                  <div className="text-xs font-black text-[#10b981]">
                    HAY UNA CAJA ABIERTA DEL DÍA <br className="hidden md:block" /> {activeSession.dateStr}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Estado Global</div>
                  <div className="text-xs font-black text-rose-400">
                    NO EXISTEN CAJAS ABIERTAS
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Fields structured like sheet */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-6">
        
        {/* Date line (Fecha centrada con botones de navegación a derecha e izquierda) */}
        <div className="flex flex-col items-center justify-center border-b border-slate-100 pb-5 pt-2 space-y-3">
          <span className="bg-rose-500 font-extrabold text-white px-4 py-1.5 rounded-full text-[10px] tracking-wider uppercase shadow-3xs">
            FECHA DE CAJA
          </span>
          
          <div className="flex items-center justify-center gap-4 w-full max-w-lg">
            {/* Left navigation arrow */}
            <button
              onClick={() => {
                const parts = currentDateISO.split('-');
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                d.setDate(d.getDate() - 1);
                setCurrentDateISO(getIsoStr(d));
              }}
              className="p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer text-slate-600 shadow-3xs flex items-center justify-center"
              title="Día anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Date Input */}
            <div className="relative flex-1 text-center">
              <input
                type="date"
                max={getIsoStr(new Date())}
                value={currentDateISO}
                onChange={(e) => {
                  const newDate = e.target.value;
                  if (newDate) {
                    setCurrentDateISO(newDate);
                  }
                }}
                className="w-full text-center px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-black text-slate-850 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-3xs disabled:opacity-85 disabled:bg-slate-100 uppercase"
              />
            </div>

            {/* Right navigation arrow */}
            <button
              onClick={() => {
                const parts = currentDateISO.split('-');
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                d.setDate(d.getDate() + 1);
                const nextDate = getIsoStr(d);
                if (nextDate <= getIsoStr(new Date())) {
                  setCurrentDateISO(nextDate);
                }
              }}
              disabled={currentDateISO >= getIsoStr(new Date())}
              className="p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 shadow-3xs flex items-center justify-center"
              title="Día siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center flex flex-col items-center justify-center space-y-2 mt-1">
            {isClosed ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-[11px] text-rose-600 font-extrabold bg-rose-50 py-1 px-4 rounded-full border border-rose-200/50 inline-flex items-center gap-1 uppercase tracking-wider shadow-4xs">
                  <Lock className="w-3 h-3" />
                  <span>Caja archivada (Solo lectura)</span>
                </span>
                <button
                  onClick={handleReopenCaja}
                  disabled={isSaving}
                  className="mt-1 bg-amber-600 hover:bg-amber-700 active:scale-95 transition-all text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg shadow-xs flex items-center gap-1 cursor-pointer uppercase tracking-wider"
                  title="Reabrir planilla diaria para edición"
                >
                  <Unlock className="w-3 h-3" />
                  <span>Reabrir Planilla de Caja</span>
                </button>
              </div>
            ) : isOpen ? (
              <span className="text-[11px] text-emerald-600 font-extrabold bg-emerald-50 py-1 px-4 rounded-full border border-emerald-200/50 inline-flex items-center gap-1 uppercase tracking-wider shadow-4xs">
                <Unlock className="w-3 h-3" />
                <span>Hoja de Trabajo Vigente (Abierta)</span>
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 font-extrabold bg-slate-100 py-1 px-4 rounded-full border border-slate-250 inline-flex items-center gap-1 uppercase tracking-wider shadow-4xs">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Planilla Vacía / Bloqueada</span>
              </span>
            )}
            
            <p className="text-[11px] font-black text-slate-500 tracking-wider uppercase mt-1">
              {toSpanishLongDate(currentDateISO)}
            </p>
          </div>
        </div>

        {/* Locked day hero opener panel */}
        {isLocked && (
          <div className="w-full bg-slate-50/80 border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-4 shadow-4xs max-w-2xl mx-auto my-4 transition-all">
            <div className="flex flex-col items-center space-y-2">
              <div className="p-3 bg-white rounded-full border border-slate-200 shadow-4xs text-slate-400">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                La jornada para este día no ha sido iniciada
              </h4>
              <p className="text-[11px] text-slate-500 max-w-md leading-relaxed">
                La planilla diaria de caja para esta fecha está vacía y bloqueada. Para registrar turnos, cobros o transacciones, debes iniciar la jornada aquí mismo.
              </p>
            </div>

            {showOpenConfirm ? (
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-5 space-y-4 text-left max-w-md mx-auto transition-all animate-fade-in">
                <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5 justify-center">
                  <Unlock className="w-4 h-4" />
                  <span>Configurar Apertura de Caja</span>
                </p>
                
                {existingOpenSession && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-[10.5px] font-medium leading-relaxed space-y-1">
                    <p className="font-extrabold uppercase text-[9.5px] tracking-wider flex items-center gap-1.5 text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>¡Atención! Caja Previa Abierta</span>
                    </p>
                    <p>
                      Ya tienes una planilla abierta de fecha <strong className="font-black text-amber-950">{toSpanishLongDate(existingOpenSession.dateStr)}</strong>. Si abres esta nueva caja sin cerrar la anterior, aquella se pausará en el borrador temporal.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[9.5px] font-black text-emerald-800 uppercase tracking-widest">
                    Saldo Inicial de Efectivo para Cambio:
                  </label>
                  <div className="relative rounded-lg shadow-4xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-emerald-600 font-bold text-xs">$</span>
                    </div>
                    <input
                      type="number"
                      value={openingBalance || ""}
                      onChange={(e) => setOpeningBalance(Number(e.target.value) || 0)}
                      placeholder="Ej: 5000"
                      className="block w-full pl-7 pr-3 py-2 text-xs font-bold text-slate-800 bg-white border border-emerald-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 shadow-4xs"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    onClick={() => handleOpenNewCajaV2(openingBalance)}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg transition shadow-4xs cursor-pointer select-none text-center uppercase tracking-wider"
                  >
                    Confirmar e Iniciar
                  </button>
                  <button
                    onClick={() => setShowOpenConfirm(false)}
                    className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer select-none text-center"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setOpeningBalance(0);
                  setShowOpenConfirm(true);
                }}
                className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-xl shadow-md transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none mx-auto border-b-4 border-emerald-800 uppercase tracking-widest"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Iniciar Jornada y Abrir Caja V2</span>
              </button>
            )}
          </div>
        )}

        {/* Dynamic Fields of the spreadsheet */}
        <div className={`space-y-6 transition-all ${isLocked ? "opacity-40 pointer-events-none select-none filter blur-[0.6px]" : ""}`}>
          
          {/* TOP SECTION: CANCHA 1 & 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* CANCHA 1 BOX */}
            <div className="border border-emerald-200 rounded-xl overflow-hidden shadow-3xs">
              <div className="bg-[#15803d] text-white py-2.5 px-4 font-black font-display tracking-widest text-xs uppercase flex items-center justify-between">
                <span className="flex-1 text-center pl-6">CANCHA 1</span>
                <button 
                  onClick={() => openTarifasModal(1)}
                  className="p-1 hover:bg-emerald-700 rounded transition-colors text-emerald-200 hover:text-white"
                  title="Configurar precios por horario"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-50 text-emerald-800 font-bold border-b border-emerald-150">
                      <th className="py-2 px-3 w-20">Turno</th>
                      <th className="py-2 px-3">Cliente</th>
                      <th className="py-2 px-3 text-right w-36">Importe ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {session.cancha1.map((slot, index) => (
                      <tr key={`c1-${slot.time}`} className="hover:bg-slate-50/40 transition">
                        {/* Time cell */}
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                          {slot.time}
                        </td>
                        
                        {/* Client Selector (Unified AutocompleteBoxlist V2) */}
                        <td className="py-1 px-3">
                          {session.isClosed ? (
                            <div className="w-full px-1.5 py-1 text-xs font-semibold text-slate-800">
                              {slot.customerName || "Sin Cliente"}
                            </div>
                          ) : (
                            <AutocompleteBoxlist
                              value={slot.customerName || ""}
                              options={customersListNames}
                              placeholder="Cliente..."
                              focusBorderColor="focus:ring-emerald-500"
                              disabled={!isEditable}
                              onChange={(val) => {
                                if (val === "") {
                                  updateCancha1Field(index, { customerId: "", customerName: "", amount: 0 });
                                  return;
                                }
                                const matched = customers.find(c => c.fullName.toLowerCase() === val.toLowerCase());
                                if (matched) {
                                  const slotTime = session.cancha1[index]?.time;
                                  const defaultPrice = tarifas.cancha1[slotTime] || 0;
                                  updateCancha1Field(index, { customerId: matched.id, customerName: matched.fullName, amount: defaultPrice });
                                } else {
                                  const slotTime = session.cancha1[index]?.time;
                                  const defaultPrice = tarifas.cancha1[slotTime] || 0;
                                  updateCancha1Field(index, { customerId: "", customerName: val, amount: defaultPrice });
                                }
                              }}
                              onUpdateOptions={async (nextOpts) => {
                                // Find if a completely new customer name was added
                                const newName = nextOpts.find(o => !customers.some(c => c.fullName.toLowerCase() === o.toLowerCase()));
                                if (newName && onAddCustomer) {
                                  const newCustomerData = {
                                    fullName: newName,
                                    phone: "",
                                    email: "",
                                    category: "Regular",
                                    loyaltyTier: "STANDARD TIER",
                                    loyaltyPoints: 0,
                                    progressToNextPct: 0,
                                    ytdSales: 0,
                                    outstandingCredit: 0,
                                    is_active: true
                                  };
                                  await onAddCustomer(newCustomerData);
                                }
                              }}
                              onRenameOption={async (oldVal, newVal) => {
                                const matched = customers.find(c => c.fullName.toLowerCase() === oldVal.toLowerCase());
                                if (matched && onEditCustomer) {
                                  await onEditCustomer({
                                    ...matched,
                                    fullName: newVal
                                  });
                                }
                              }}
                              onDeleteOption={async (val) => {
                                const matched = customers.find(c => c.fullName.toLowerCase() === val.toLowerCase());
                                if (matched && onDeleteCustomer) {
                                  await onDeleteCustomer(matched.id);
                                }
                              }}
                            />
                          )}
                        </td>

                        {/* Amount cell */}
                        <td className="py-1 px-3 text-right">
                          <input
                            type="number"
                            disabled={!isEditable}
                            value={slot.amount || ""}
                            onChange={(e) => updateCancha1Field(index, { amount: Number(e.target.value) || 0 })}
                            placeholder="0"
                            className="px-2 py-1 border border-slate-200 rounded-md text-right font-mono font-bold text-xs text-slate-800 max-w-[100px] bg-slate-50/50 focus:outline-hidden"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/80 border-t-2 border-slate-200">
                      <td colSpan={2} className="py-3 px-4 font-extrabold text-slate-800 uppercase text-[10px] tracking-wider text-right">
                        SUB TOTAL CANCHA 1
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-right text-slate-900 text-xs">
                        ${subtotalCancha1.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* CANCHA 2 BOX */}
            <div className="border border-emerald-200 rounded-xl overflow-hidden shadow-3xs">
              <div className="bg-[#15803d] text-white py-2.5 px-4 font-black font-display tracking-widest text-xs uppercase flex items-center justify-between">
                <span className="flex-1 text-center pl-6">CANCHA 2</span>
                <button 
                  onClick={() => openTarifasModal(2)}
                  className="p-1 hover:bg-emerald-700 rounded transition-colors text-emerald-200 hover:text-white"
                  title="Configurar precios por horario"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-50 text-emerald-800 font-bold border-b border-emerald-150">
                      <th className="py-2 px-3 w-20">Turno</th>
                      <th className="py-2 px-3">Cliente</th>
                      <th className="py-2 px-3 text-right w-36">Importe ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {session.cancha2.map((slot, index) => (
                      <tr key={`c2-${slot.time}`} className="hover:bg-slate-50/40 transition">
                        {/* Time cell */}
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                          {slot.time}
                        </td>
                        
                        {/* Client Selector (Unified AutocompleteBoxlist V2) */}
                        <td className="py-1 px-3">
                          {session.isClosed ? (
                            <div className="w-full px-1.5 py-1 text-xs font-semibold text-slate-800">
                              {slot.customerName || "Sin Cliente"}
                            </div>
                          ) : (
                            <AutocompleteBoxlist
                              value={slot.customerName || ""}
                              options={customersListNames}
                              placeholder="Cliente..."
                              focusBorderColor="focus:ring-emerald-500"
                              disabled={!isEditable}
                              onChange={(val) => {
                                if (val === "") {
                                  updateCancha2Field(index, { customerId: "", customerName: "", amount: 0 });
                                  return;
                                }
                                const matched = customers.find(c => c.fullName.toLowerCase() === val.toLowerCase());
                                if (matched) {
                                  const slotTime = session.cancha2[index]?.time;
                                  const defaultPrice = tarifas.cancha2[slotTime] || 0;
                                  updateCancha2Field(index, { customerId: matched.id, customerName: matched.fullName, amount: defaultPrice });
                                } else {
                                  const slotTime = session.cancha2[index]?.time;
                                  const defaultPrice = tarifas.cancha2[slotTime] || 0;
                                  updateCancha2Field(index, { customerId: "", customerName: val, amount: defaultPrice });
                                }
                              }}
                              onUpdateOptions={async (nextOpts) => {
                                // Find if a completely new customer name was added
                                const newName = nextOpts.find(o => !customers.some(c => c.fullName.toLowerCase() === o.toLowerCase()));
                                if (newName && onAddCustomer) {
                                  const newCustomerData = {
                                    fullName: newName,
                                    phone: "",
                                    email: "",
                                    category: "Regular",
                                    loyaltyTier: "STANDARD TIER",
                                    loyaltyPoints: 0,
                                    progressToNextPct: 0,
                                    ytdSales: 0,
                                    outstandingCredit: 0,
                                    is_active: true
                                  };
                                  await onAddCustomer(newCustomerData);
                                }
                              }}
                              onRenameOption={async (oldVal, newVal) => {
                                const matched = customers.find(c => c.fullName.toLowerCase() === oldVal.toLowerCase());
                                if (matched && onEditCustomer) {
                                  await onEditCustomer({
                                    ...matched,
                                    fullName: newVal
                                  });
                                }
                              }}
                              onDeleteOption={async (val) => {
                                const matched = customers.find(c => c.fullName.toLowerCase() === val.toLowerCase());
                                if (matched && onDeleteCustomer) {
                                  await onDeleteCustomer(matched.id);
                                }
                              }}
                            />
                          )}
                        </td>

                        {/* Amount cell */}
                        <td className="py-1 px-3 text-right">
                          <input
                            type="number"
                            disabled={!isEditable}
                            value={slot.amount || ""}
                            onChange={(e) => updateCancha2Field(index, { amount: Number(e.target.value) || 0 })}
                            placeholder="0"
                            className="px-2 py-1 border border-slate-200 rounded-md text-right font-mono font-bold text-xs text-slate-800 max-w-[100px] bg-slate-50/50 focus:outline-hidden"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/80 border-t-2 border-slate-200">
                      <td colSpan={2} className="py-3 px-4 font-extrabold text-slate-800 uppercase text-[10px] tracking-wider text-right">
                        SUB TOTAL CANCHA 2
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-right text-slate-900 text-xs">
                        ${subtotalCancha2.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          </div>

          {/* OTROS INGRESOS SECTION (FULL WIDTH) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
            <div className="bg-slate-800 text-white py-2 px-4 font-black tracking-widest text-[11px] uppercase">
              OTROS INGRESOS (BAR / EXTRAS)
            </div>
            
            <div className="overflow-visible">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-[10px]">
                    <th className="py-2 px-3 w-16">Cant.</th>
                    <th className="py-2 px-3 w-1/4">Cuenta</th>
                    <th className="py-2 px-3 w-1/4">Subcuenta</th>
                    <th className="py-2 px-3">Descripción</th>
                    <th className="py-2 px-3 text-right w-[110px]">Importe ($)</th>
                    {!session.isClosed && <th className="py-2 px-3 text-center w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Manual Other Incomes */}
                  {session.otrosIngresos.map((row, index) => {
                    const isBuffetRow = index === 0;
                    const allAccounts = masterPlan.flatMap(p => p.accounts);
                    
                    // Determine effective Buffet data for Buffet row
                    const buffetAcc = allAccounts.find(a => a.label.toLowerCase().includes("buffet"));
                    const buffetSubAcc = buffetAcc?.subaccounts.find(s => s.label.toLowerCase().includes("ventas varias"));
                    
                    const effectiveAccountId = isBuffetRow && buffetAcc ? buffetAcc.id : row.accountId;
                    const effectiveSubaccountId = isBuffetRow && buffetSubAcc ? buffetSubAcc.id : row.subaccountId;

                    const selectedAccount = allAccounts.find(a => a.id === effectiveAccountId);
                    const subaccounts = selectedAccount?.subaccounts || [];

                    return (
                      <tr key={row.id} className={isBuffetRow ? "bg-amber-50/70" : (row.isPendingClassification ? "bg-amber-50/30" : "")}>
                        <td className="py-1 px-3">
                          <input
                            type="number"
                            min="1"
                            disabled={isBuffetRow || session.isClosed}
                            value={isBuffetRow ? barSalesQty : (row.quantity || "")}
                            onChange={(e) => updateOtrosIngresosRow(row.id, { quantity: Number(e.target.value) || 1 })}
                            className="w-12 px-1.5 py-0.5 border border-slate-200 rounded-md text-center font-mono font-bold text-[11.5px]"
                          />
                        </td>
                        <td className="py-1 px-3">
                          <AutocompleteBoxlist
                            value={isBuffetRow ? (buffetAcc?.label || "Buffet") : (selectedAccount?.label || "")}
                            options={allAccounts.map(a => a.label)}
                            placeholder="Seleccionar Cuenta..."
                            focusBorderColor="focus:ring-emerald-500"
                            disabled={isBuffetRow || session.isClosed}
                            onChange={(val) => {
                              const matched = allAccounts.find(a => a.label.toLowerCase() === val.toLowerCase());
                              if (matched) {
                                updateOtrosIngresosRow(row.id, { accountId: matched.id, subaccountId: "", suggestedSubaccount: "", isPendingClassification: false });
                              } else if (val === "") {
                                updateOtrosIngresosRow(row.id, { accountId: "", subaccountId: "", suggestedSubaccount: "", isPendingClassification: false });
                              } else {
                                updateOtrosIngresosRow(row.id, { accountId: val, subaccountId: "", suggestedSubaccount: "", isPendingClassification: true });
                              }
                            }}
                            onUpdateOptions={() => {}} 
                          />
                        </td>
                        <td className="py-1 px-3">
                          {row.isPendingClassification ? (
                            <div className="flex flex-col gap-1">
                              <AutocompleteBoxlist
                                value={row.suggestedSubaccount || ""}
                                options={[]}
                                placeholder="Sugerir subcuenta..."
                                focusBorderColor="focus:ring-amber-500"
                                disabled={isBuffetRow || session.isClosed}
                                onChange={(val) => updateOtrosIngresosRow(row.id, { suggestedSubaccount: val })}
                                onUpdateOptions={() => {}}
                              />
                              <div className="flex items-center gap-1">
                                <input 
                                  type="checkbox" 
                                  id={`check-found-inc-${row.id}`}
                                  checked={false}
                                  onChange={() => updateOtrosIngresosRow(row.id, { isPendingClassification: false, suggestedSubaccount: "" })}
                                  className="w-3 h-3 text-emerald-600"
                                />
                                <label htmlFor={`check-found-inc-${row.id}`} className="text-[9px] text-slate-500 uppercase font-black cursor-pointer">Revertir</label>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <AutocompleteBoxlist
                                value={isBuffetRow ? (buffetSubAcc?.label || "Ventas varias") : (subaccounts.find(s => s.id === row.subaccountId)?.label || "")}
                                options={subaccounts.map(s => s.label)}
                                placeholder="Seleccionar Subcuenta..."
                                focusBorderColor="focus:ring-emerald-500"
                                disabled={isBuffetRow || session.isClosed}
                                onChange={(val) => {
                                  const matched = subaccounts.find(s => s.label.toLowerCase() === val.toLowerCase());
                                  if (matched) {
                                    updateOtrosIngresosRow(row.id, { subaccountId: matched.id });
                                  } else if (val === "") {
                                    updateOtrosIngresosRow(row.id, { subaccountId: "" });
                                  } else {
                                    updateOtrosIngresosRow(row.id, { subaccountId: val, suggestedSubaccount: val, isPendingClassification: true });
                                  }
                                }}
                                onUpdateOptions={() => {}}
                              />
                            </div>
                          )}
                        </td>
                        <td className="py-1 px-3">
                          <textarea
                            placeholder="Descripción detallada..."
                            value={row.description || ""}
                            disabled={session.isClosed}
                            onChange={(e) => updateOtrosIngresosRow(row.id, { description: e.target.value })}
                            className="w-full px-1.5 py-1 border border-slate-100 rounded-md text-[10px] text-slate-500 focus:ring-1 focus:ring-emerald-500 bg-slate-50/30 min-h-[40px] resize-none"
                          />
                        </td>
                        <td className="py-1 px-3 text-right">
                          <input
                            type="number"
                            disabled={isBuffetRow || session.isClosed}
                            placeholder="0"
                            value={isBuffetRow ? barSalesTotal : (row.amount || "")}
                            onChange={(e) => updateOtrosIngresosRow(row.id, { amount: Number(e.target.value) || 0 })}
                            className="w-full px-1.5 py-1 border border-slate-200 rounded-md text-right font-mono text-xs font-bold focus:ring-1 focus:ring-emerald-500"
                          />
                        </td>
                        {!session.isClosed && (
                          <td className="py-1 px-3 text-center">
                            {!isBuffetRow && (
                              <button
                                onClick={() => deleteOtrosIngresosRow(row.id)}
                                className="p-1 text-slate-400 hover:text-red-600 cursor-pointer text-center"
                                title="Borrar fila"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!session.isClosed && (
              <div className="bg-slate-50/90 p-2 border-t border-slate-150 flex justify-start">
                <button
                  onClick={addOtrosIngresosRow}
                  className="flex items-center gap-1.5 py-1 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-[10px] transition cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-[#16a34a]" />
                  <span>Añadir Fila de Ingreso</span>
                </button>
              </div>
            )}

            <div className="bg-slate-50/80 p-3 flex justify-between items-center border-t border-slate-200">
              <span className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">
                TOTAL OTROS INGRESOS
              </span>
              <span className="font-mono font-black text-slate-900 text-xs">
                ${totalOtrosIngresos.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* OTROS EGRESOS SECTION (FULL WIDTH) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
            <div className="bg-slate-800 text-white py-2 px-4 font-black tracking-widest text-[11px] uppercase">
              OTROS EGRESOS (EGRESOS / RETIROS)
            </div>
            
            <div className="overflow-visible">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-[10px]">
                    <th className="py-2 px-3 w-16">Cant.</th>
                    <th className="py-2 px-3 w-1/4">Cuenta</th>
                    <th className="py-2 px-3 w-1/4">Subcuenta</th>
                    <th className="py-2 px-3">Descripción</th>
                    <th className="py-2 px-3 text-right w-[110px]">Importe ($)</th>
                    {!session.isClosed && <th className="py-2 px-3 text-center w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Manual Other Expenses */}
                  {session.otrosEgresos.map((row) => {
                    const allAccounts = masterPlan.flatMap(p => p.accounts);
                    const selectedAccount = allAccounts.find(a => a.id === row.accountId);
                    const subaccounts = selectedAccount?.subaccounts || [];

                    return (
                      <tr key={row.id} className={row.isPendingClassification ? "bg-amber-50/30" : ""}>
                        <td className="py-1 px-3">
                          <input
                            type="number"
                            min="1"
                            disabled={session.isClosed || !!row.purchaseId}
                            value={row.quantity || ""}
                            onChange={(e) => updateOtrosEgresosRow(row.id, { quantity: Number(e.target.value) || 1 })}
                            className="w-full px-1.5 py-0.5 border border-slate-200 rounded-md text-center font-mono font-bold text-[11.5px] disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="py-1 px-3">
                          <AutocompleteBoxlist
                            value={selectedAccount?.label || ""}
                            options={allAccounts.map(a => a.label)}
                            placeholder="Seleccionar Cuenta..."
                            focusBorderColor="focus:ring-rose-500"
                            disabled={session.isClosed || !!row.purchaseId}
                            onChange={(val) => {
                              const matched = allAccounts.find(a => a.label.toLowerCase() === val.toLowerCase());
                              if (matched) {
                                updateOtrosEgresosRow(row.id, { accountId: matched.id, subaccountId: "", suggestedSubaccount: "", isPendingClassification: false });
                              } else if (val === "") {
                                updateOtrosEgresosRow(row.id, { accountId: "", subaccountId: "", suggestedSubaccount: "", isPendingClassification: false });
                              } else {
                                updateOtrosEgresosRow(row.id, { accountId: val, subaccountId: "", suggestedSubaccount: "", isPendingClassification: true });
                              }
                            }}
                            onUpdateOptions={() => {}}
                          />
                        </td>
                        <td className="py-1 px-3">
                          {row.isPendingClassification ? (
                            <div className="flex flex-col gap-1 w-full">
                              <AutocompleteBoxlist
                                value={row.suggestedSubaccount || ""}
                                options={[]}
                                placeholder="Sugerir subcuenta..."
                                focusBorderColor="focus:ring-amber-500"
                                disabled={session.isClosed || !!row.purchaseId}
                                onChange={(val) => updateOtrosEgresosRow(row.id, { suggestedSubaccount: val })}
                                onUpdateOptions={() => {}}
                              />
                              {!row.purchaseId && (
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="checkbox" 
                                    id={`check-found-exp-${row.id}`}
                                    checked={false}
                                    onChange={() => updateOtrosEgresosRow(row.id, { isPendingClassification: false, suggestedSubaccount: "" })}
                                    className="w-3 h-3 text-rose-600"
                                  />
                                  <label htmlFor={`check-found-exp-${row.id}`} className="text-[9px] text-slate-500 uppercase font-black cursor-pointer">Revertir</label>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1 w-full">
                              <AutocompleteBoxlist
                                value={subaccounts.find(s => s.id === row.subaccountId)?.label || ""}
                                options={subaccounts.map(s => s.label)}
                                placeholder="Seleccionar Subcuenta..."
                                focusBorderColor="focus:ring-rose-500"
                                disabled={session.isClosed || !row.accountId || !!row.purchaseId}
                                onChange={(val) => {
                                  const matched = subaccounts.find(s => s.label.toLowerCase() === val.toLowerCase());
                                  if (matched) {
                                    updateOtrosEgresosRow(row.id, { subaccountId: matched.id });
                                  } else if (val === "") {
                                    updateOtrosEgresosRow(row.id, { subaccountId: "" });
                                  } else {
                                    updateOtrosEgresosRow(row.id, { subaccountId: val, suggestedSubaccount: val, isPendingClassification: true });
                                  }
                                }}
                                onUpdateOptions={() => {}}
                              />
                              {!row.purchaseId && row.accountId && (
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="checkbox" 
                                    id={`check-missing-exp-${row.id}`}
                                    checked={false}
                                    onChange={() => updateOtrosEgresosRow(row.id, { isPendingClassification: true, subaccountId: "" })}
                                    className="w-3 h-3 text-amber-600"
                                  />
                                  <label htmlFor={`check-missing-exp-${row.id}`} className="text-[9px] text-amber-700 uppercase font-black cursor-pointer">Subcuenta no encontrada</label>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-1 px-3">
                          <textarea
                            placeholder="Descripción detallada..."
                            value={row.description || ""}
                            disabled={session.isClosed || !!row.purchaseId}
                            onChange={(e) => updateOtrosEgresosRow(row.id, { description: e.target.value })}
                            className="w-full px-1.5 py-1 border border-slate-100 rounded-md text-[10px] text-slate-500 focus:ring-1 focus:ring-rose-500 bg-slate-50/30 min-h-[40px] resize-none disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        <td className="py-1 px-3 text-right">
                          <input
                            type="number"
                            disabled={session.isClosed || !!row.purchaseId}
                            placeholder="0"
                            value={row.amount || ""}
                            onChange={(e) => updateOtrosEgresosRow(row.id, { amount: Number(e.target.value) || 0 })}
                            className="w-full px-1.5 py-1 border border-slate-200 rounded-md text-right font-mono text-xs font-bold focus:ring-1 focus:ring-rose-500 disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </td>
                        {!session.isClosed && (
                          <td className="py-1 px-3 text-center">
                            {row.purchaseId ? (
                              <span className="inline-flex items-center text-slate-400" title="Movimiento de compra bloqueado">
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <button
                                onClick={() => deleteOtrosEgresosRow(row.id)}
                                className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                title="Borrar fila"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!session.isClosed && (
              <div className="bg-slate-50/90 p-2 border-t border-slate-150 flex justify-start">
                <button
                  onClick={addOtrosEgresosRow}
                  className="flex items-center gap-1.5 py-1 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-[10px] transition cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-rose-600" />
                  <span>Añadir Fila de Egreso</span>
                </button>
              </div>
            )}

            <div className="bg-slate-50/80 p-3 flex justify-between items-center border-t border-slate-200">
              <span className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">
                TOTAL OTROS EGRESOS
              </span>
              <span className="font-mono font-black text-[#93000a] text-xs">
                ${totalOtrosEgresos.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* BOTTOM SECTION: RESUMEN TEÓRICO & RENDICIÓN DE CAJA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* RESUMEN TEÓRICO A RENDIR */}
            <div className="border border-emerald-200 rounded-xl overflow-hidden shadow-3xs bg-slate-50/50">
              <h3 className="bg-emerald-800 text-white py-2.5 px-4 font-black font-display tracking-widest text-xs uppercase flex items-center gap-2 justify-center">
                <FileText className="w-4 h-4 text-emerald-300" />
                <span>Resumen Teórico a Rendir</span>
              </h3>

              <div className="p-4 space-y-3">
                {/* Saldo Inicial Editable */}
                <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200/50">
                  <span className="font-bold text-slate-500 uppercase text-[10.5px]">SALDO INICIAL</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-500">$</span>
                    <input
                      type="number"
                      disabled={!isEditable}
                      value={session.saldoInicial || ""}
                      onChange={(e) => setActiveSession(prev => ({ ...prev, saldoInicial: Number(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-24 px-2 py-1 text-right font-mono font-extrabold text-[#091426] border border-slate-200 rounded bg-white text-xs"
                    />
                  </div>
                </div>

                {/* Subtotal Cancha 1 */}
                <div className="flex justify-between items-center text-xs pb-1 border-b border-dashed border-slate-200/50 text-slate-700">
                  <span>INGRESOS CANCHA 1</span>
                  <span className="font-mono font-semibold">${subtotalCancha1.toFixed(2)}</span>
                </div>

                {/* Subtotal Cancha 2 */}
                <div className="flex justify-between items-center text-xs pb-1 border-b border-dashed border-slate-200/50 text-slate-700">
                  <span>INGRESOS CANCHA 2</span>
                  <span className="font-mono font-semibold">${subtotalCancha2.toFixed(2)}</span>
                </div>

                {/* Recaudación Buffet */}
                <div className="flex justify-between items-center text-xs pb-1 border-b border-dashed border-slate-200/50 text-[#15803d]">
                  <span>RECAUDACIÓN BUFFET (BAR)</span>
                  <span className="font-mono font-bold">${barSalesTotal.toFixed(2)}</span>
                </div>

                {/* Total Otros Ingresos */}
                <div className="flex justify-between items-center text-xs pb-1 border-b border-dashed border-slate-200/50 text-slate-700">
                  <span>OTROS INGRESOS EXTRAS</span>
                  <span className="font-mono font-semibold">${otrosIngresosManualTotal.toFixed(2)}</span>
                </div>

                {/* TOTAL INGRESOS block */}
                <div className="flex justify-between items-center text-xs font-bold pt-1 text-slate-800">
                  <span>TOTAL INGRESOS (+ SALDO INIC.)</span>
                  <span className="font-mono">${totalIngresosTeorico.toFixed(2)}</span>
                </div>

                {/* TOTAL EGRESOS */}
                <div className="flex justify-between items-center text-xs font-bold text-[#ba1a1a] pb-2 border-b border-slate-200">
                  <span>TOTAL EGRESOS Y RETIROS</span>
                  <span className="font-mono">-${totalEgresosTeorico.toFixed(2)}</span>
                </div>

                {/* TO SURRENDER / A RENDIR (Grand Total) */}
                <div className="flex justify-between items-center text-sm font-black pt-2 bg-[#091426] text-white p-3 rounded-lg leading-none">
                  <span className="uppercase tracking-wide text-[10px]">A RENDIR (Teórico)</span>
                  <span className="font-mono text-base">${totalARendirTeorico.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* RENDICIÓN DE CAJA (MONTO FÍSICO) WITH DENOMINATIONS */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs bg-slate-50/50 h-fit">
              <h3 className="bg-emerald-800 text-white py-2.5 px-4 font-black font-display tracking-widest text-xs uppercase flex items-center gap-2 justify-center border-b border-emerald-705">
                <Coins className="w-4 h-4 text-emerald-300" />
                <span>Rendición de Caja (Monto Físico)</span>
              </h3>

              <div className="p-4 space-y-4">
                {/* Denominations Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                            <tr className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-tighter">
                                <th className="py-1 px-2">Cantidad</th>
                                <th className="py-1 px-2">Denominación</th>
                                <th className="py-1 px-2 text-right">Importe ($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[20000, 10000, 2000, 1000, 500, 200, 100].map((denom) => {
                                const count = session.billCounts?.[denom.toString()] || 0;
                                return (
                                    <tr key={denom}>
                                        <td className="py-1 px-2">
                                            <input
                                                type="number"
                                                min="0"
                                                disabled={!isEditable}
                                                value={count || ""}
                                                onChange={(e) => setActiveSession(prev => {
                                                    const updatedCounts = {
                                                        ...(prev.billCounts || {}),
                                                        [denom.toString()]: Number(e.target.value) || 0
                                                    };
                                                    const updatedCash = Object.entries(updatedCounts).reduce((sum, [d, count]) => sum + (Number(d) * (Number(count) || 0)), 0);
                                                    return {
                                                        ...prev,
                                                        billCounts: updatedCounts,
                                                        rendicionEfectivo: updatedCash
                                                    };
                                                })}
                                                className="w-16 px-1 py-0.5 border border-slate-200 rounded font-mono text-center bg-white"
                                            />
                                        </td>
                                        <td className="py-1 px-2 font-bold text-slate-600">
                                            $ {denom.toLocaleString()}
                                        </td>
                                        <td className="py-1 px-2 text-right font-mono font-bold text-slate-800">
                                            $ {(count * denom).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-100/80 font-black">
                                <td colSpan={2} className="py-2 px-2 text-right uppercase text-[9px]">Total Efectivo</td>
                                <td className="py-2 px-2 text-right text-xs font-mono">
                                    $ {totalRendidoEfectivo.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                
                {/* Transferencias */}
                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200/55">
                  <span className="font-bold text-slate-600 uppercase text-[10px]">TRANSFERENCIAS / BIZUM</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-500">$</span>
                    <input
                      type="number"
                      disabled={!isEditable}
                      value={session.rendicionTransferencia || ""}
                      onChange={(e) => setActiveSession(prev => ({ ...prev, rendicionTransferencia: Number(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-28 px-2 py-1 text-right font-mono font-bold text-slate-800 border border-slate-200 rounded-md bg-white focus:outline-hidden text-xs"
                    />
                  </div>
                </div>

                {/* Total Rendido */}
                <div className="flex justify-between items-center text-xs font-black pt-1 bg-emerald-50 text-emerald-900 p-2.5 rounded-lg border border-emerald-200/40">
                  <span className="uppercase text-[9.5px]/none tracking-wider">TOTAL RENDIDO (REAL)</span>
                  <span className="font-mono font-black text-sm">${totalRendidoReal.toFixed(2)}</span>
                </div>

                {/* Difference Warnings */}
                <div className="pt-1.5">
                  {diferenciaRendicion === 0 ? (
                    <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 py-2 px-3 rounded-lg border border-emerald-300 text-[10px] font-bold">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span>COINCIDENCIA EN CERO</span>
                    </div>
                  ) : diferenciaRendicion > 0 ? (
                    <div className="flex items-center gap-2 text-cyan-800 bg-cyan-50 py-2 px-3 rounded-lg border border-cyan-200 text-[10px] font-bold">
                      <HelpCircle className="w-4 h-4 flex-shrink-0" />
                      <span>SOBRANTE: +${diferenciaRendicion.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-800 bg-red-50 py-2 px-3 rounded-lg border border-red-200 text-[10px] font-black">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>FALTANTE: ${diferenciaRendicion.toFixed(2)}</span>
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>

          {/* Full-width action button */}
          <div className="col-span-1 lg:col-span-2 mt-8 mx-[-1.25rem] mb-[-1.25rem] border-t border-slate-150 flex flex-col justify-center overflow-hidden bg-slate-50 relative z-10">
            {isSaving && (
              <div className="w-full py-4 px-6 bg-slate-100 text-slate-700 text-center font-bold text-xs flex items-center justify-center gap-2 animate-pulse rounded-b-xl">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-700"></span>
                <span>PROCESANDO CIERRE Y REGISTRANDO MOVIMIENTOS EN EL SISTEMA...</span>
              </div>
            )}
            
            {!isSaving && isOpen && (
              <>
                {isClosingConfirm ? (
                  <div className="w-full p-4 bg-rose-50 text-center space-y-3">
                    <p className="text-xs font-black text-rose-950 uppercase tracking-widest">
                      ⚠️ ¿CONFIRMAS EL CIERRE DEFINITIVO DE LA PLANILLA?
                    </p>
                    <p className="text-[10.5px] text-rose-700 max-w-xl mx-auto font-medium">
                      Una vez cerrada, todos los turnos, otros ingresos y egresos vigentes se consolidarán permanentemente y se guardarán como movimientos de transacciones efectivas en el sistema. No se podrá volver a modificar esta planilla de hoy.
                    </p>
                    <div className="flex gap-2.5 justify-center">
                      <button
                        onClick={handleCloseCajaV2}
                        className="py-2 px-5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg transition shadow-md cursor-pointer uppercase tracking-wider select-none font-sans"
                      >
                        Sí, Consolidar y Cerrar Jornada
                      </button>
                      <button
                        onClick={() => setIsClosingConfirm(false)}
                        className="py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer select-none font-sans"
                      >
                        Volver a la planilla
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-red-800 border-t border-red-700">
                    <button
                      onClick={() => setIsClosingConfirm(true)}
                      className="flex-1 py-3 px-6 bg-[#ba1a1a] hover:bg-red-700 text-white text-xs font-black hover:shadow-md transition flex items-center justify-center gap-2 cursor-pointer select-none"
                    >
                      <Lock className="w-4 h-4" />
                      <span className="tracking-wider uppercase">Cerrar planilla de caja V2 (Enviar movimientos)</span>
                    </button>
                    
                    <button
                      onClick={handleAnnulApertura}
                      className="py-3 px-6 bg-slate-800 hover:bg-slate-750 text-amber-400 hover:text-amber-300 text-xs font-black hover:shadow-md transition flex items-center justify-center gap-2 cursor-pointer select-none rounded-b-xl md:rounded-b-none md:rounded-br-xl"
                    >
                      <XCircle className="w-4 h-4" />
                      <span className="tracking-wider uppercase">Anular Apertura de Caja</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

        </div>

      </div>

      {/* Archivados de Caja Historicos List */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-3xs">
        <div>
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
            Historial de Hojas Diario de Caja V2
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Lista de planillas enviadas y confirmadas formalmente por contabilidad para auditoría.
          </p>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-dashed rounded-xl border-slate-200">
            No se han registrado planillas cerradas bajo el modelo V2 en el historial local. Al cerrar la caja, se guardará aquí.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {history.map((hist) => {
              const histTotalCancha1 = hist.cancha1.reduce((sum, slot) => sum + (slot.amount || 0), 0);
              const histTotalCancha2 = hist.cancha2.reduce((sum, slot) => sum + (slot.amount || 0), 0);

              const hIso = parseCustomDateToIso(hist.dateStr);
              const histSalesForLogic = sales.filter(sale => {
                if (sale.origin === "consumo_interno") return false;
                
                // Use session ID if available for pinpoint accuracy
                if (sale.caja_session_id && hist.id) {
                  return sale.caja_session_id === hist.id;
                }

                // Fallback to date matching for older records
                try { 
                  return getIsoStr(new Date(sale.date)) === hIso; 
                } catch { 
                  return false; 
                }
              });

              // EXCLUDE MESA AND sistema_caja FROM BUFFET TOTAL to avoid double counting
              const histBarSalesOnly = histSalesForLogic.filter(s => {
                if (s.origin === "mesa" || s.origin === "sistema_caja") return false;
                const sysLabels = ["Cancha 1", "Cancha 2", "Otros Ingresos", "Otros Egresos", "Personal Egreso"];
                if (sysLabels.includes(s.table_number || "")) return false;
                return true;
              });
              const histBarSalesTotal = histBarSalesOnly.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0);

              const histTotalOtrosIncomes = histBarSalesTotal + hist.otrosIngresos.reduce((sum, r) => {
                if (r.id === "buffet") return sum;
                return sum + (r.quantity * (Number(r.amount) || 0));
              }, 0);
              const histTotalEgresos = (hist.personalAmount || 0) + hist.otrosEgresos.reduce((sum, r) => sum + (r.quantity * (r.amount || 0)), 0);
              const histTotalIngresosCanchas = histTotalCancha1 + histTotalCancha2;

              const histTheoreticalToSurrender = hist.saldoInicial + histTotalIngresosCanchas + histTotalOtrosIncomes - histTotalEgresos;
              const histRealTotalRendido = (hist.rendicionEfectivo || 0) + (hist.rendicionTransferencia || 0) + (hist.rendicionTarjetas || 0);
              const histDiff = histRealTotalRendido - histTheoreticalToSurrender;

              return (
                <div key={hist.id} className="p-4 border border-slate-200 rounded-xl hover:shadow-md transition bg-slate-50 relative flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-xs font-black text-slate-850 truncate max-w-[170px]" title={hist.dateStr}>
                        {toSpanishLongDate(hist.dateStr)}
                      </span>
                      <span className="text-[9px] text-[#8590a6] font-bold uppercase font-mono">
                        V2 ARCHIVE
                      </span>
                    </div>

                    <div className="space-y-1 text-[11.5px] text-slate-600 border-b border-slate-200 pb-2">
                      <p className="flex justify-between">
                        <span>Ingresos canchas:</span> 
                        <strong className="text-slate-800">${histTotalIngresosCanchas.toFixed(2)}</strong>
                      </p>
                      <p className="flex justify-between">
                        <span>Otros ingresos:</span> 
                        <strong className="text-emerald-700">${histTotalOtrosIncomes.toFixed(2)}</strong>
                      </p>
                      <p className="flex justify-between">
                        <span>Otros egresos:</span> 
                        <strong className="text-rose-700">-${histTotalEgresos.toFixed(2)}</strong>
                      </p>
                    </div>

                    <div className="space-y-1 text-[11.5px] text-slate-600">
                      <p className="flex justify-between font-bold pt-1">
                        <span>Total de caja:</span> 
                        <strong className="text-slate-800">${histTheoreticalToSurrender.toFixed(2)}</strong>
                      </p>
                      <p className="flex justify-between font-bold">
                        <span>Monto rendido:</span> 
                        <strong className="text-indigo-700">${histRealTotalRendido.toFixed(2)}</strong>
                      </p>
                      <p className="flex justify-between font-bold">
                        <span>Diferencia:</span> 
                        <strong className={histDiff === 0 ? "text-emerald-600" : histDiff < 0 ? "text-rose-600" : "text-emerald-600"}>
                          {histDiff > 0 ? "+" : ""}{histDiff.toFixed(2)}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t">
                    <span className={`text-[9px] font-black py-0.5 px-1.5 rounded-sm ${
                      Math.abs(histDiff) < 0.01 
                        ? "bg-emerald-50 text-emerald-800" 
                        : "bg-rose-50 text-rose-800"
                    }`}>
                      {Math.abs(histDiff) < 0.01 ? "✔ Cuadrado" : `Diferencia: $${histDiff.toFixed(2)}`}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPrintSession(hist)}
                        className="py-1 px-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-100 flex items-center gap-1.5 text-[10.5px] font-bold text-slate-700 cursor-pointer transition select-none"
                        title="Imprimir Planilla Cerrada"
                      >
                        <Printer className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Imprimir</span>
                      </button>

                      <button
                        onClick={() => handleLoadHistorySession(hist)}
                        className="px-2.5 py-1 text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        Analizar Hoja
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dynamic React Prompt Modal for Manual Client entry */}
      {showManualClientPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 border-b pb-2.5">
              <Coins className="w-5 h-5" />
              <h4 className="text-sm font-black uppercase tracking-wider">Asignar Cliente Manual</h4>
            </div>
            
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Ingresa el nombre del cliente manual para este turno. Se registrará este nombre personalizado en la planilla de caja vigente.
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Nombre del Cliente:
              </label>
              <input
                type="text"
                value={manualClientNameInput}
                onChange={(e) => setManualClientNameInput(e.target.value)}
                placeholder="Ej. Juan Pérez (Socio)"
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 bg-slate-50 text-slate-900 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-3xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleConfirmManualClient();
                  } else if (e.key === "Escape") {
                    setShowManualClientPrompt(false);
                  }
                }}
              />
            </div>

            <div className="flex flex-row gap-2.5 pt-1 justify-end">
              <button
                onClick={() => {
                  setShowManualClientPrompt(false);
                  setManualClientTarget(null);
                  setManualClientNameInput("");
                }}
                className="py-1.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer select-none"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmManualClient}
                className="py-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg transition shadow-xs cursor-pointer uppercase tracking-wider select-none"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTarifasModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 max-w-sm w-full shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-2 text-emerald-700 border-b pb-3">
              <Settings className="w-5 h-5" />
              <h4 className="text-sm font-black uppercase tracking-wider flex-1">Tarifas Cancha {showTarifasModal}</h4>
              <button onClick={() => setShowTarifasModal(null)} className="p-1 hover:bg-slate-100 rounded text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Configura el precio por defecto de cada bloque de hora. Cuando asignes un cliente a un turno, el importe correspondiente aparecerá automáticamente.
            </p>

            <div className="overflow-y-auto space-y-2 flex-1 pr-2">
              {(showTarifasModal === 1 ? defaultTimesCancha1 : defaultTimesCancha2).map(time => (
                <div key={time} className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                  <span className="font-bold font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">{time}</span>
                  <div className="flex items-center gap-1.5 relative w-32">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-[11px] select-none">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingTarifas[time] || ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setEditingTarifas(prev => ({
                          ...prev,
                          [time]: isNaN(val) ? 0 : val
                        }));
                      }}
                      className="w-full pl-6 pr-2 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors placeholder-slate-300"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-row gap-2.5 pt-2 justify-end border-t border-slate-100">
              <button
                onClick={() => setShowTarifasModal(null)}
                className="py-1.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer select-none"
              >
                Cancelar
              </button>
              <button
                onClick={() => saveTarifas(showTarifasModal)}
                className="py-1.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-lg transition shadow-xs cursor-pointer uppercase tracking-wider select-none flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdminClassificationModal && (
        <AdminClassificationModal 
          onClose={() => setShowAdminClassificationModal(false)}
          onResolved={() => {
            // Refresh counts
            const fetchPendingCount = async () => {
              try {
                const q = query(collection(db, "pending_classifications"), where("status", "==", "PENDIENTE"));
                const snapshot = await getDocs(q);
                setPendingClassificationsCount(snapshot.size);
              } catch (err) {
                console.error("Error fetching pending classifications:", err);
              }
            };
            fetchPendingCount();
          }}
        />
      )}

      {/* Styled Printable & Review Overlay */}
      {printSession && (
        <>
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 6mm 8mm; /* Tight paper margins */
              }
              
              /* Hide all global UI components */
              header, nav, sidebar, footer, .no-print, button, .print\:hidden,
              aside, [role="navigation"], [role="banner"], 
              .sidebar-wrapper, .header-container {
                display: none !important;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
              }

              /* Force overflow visible and height auto on all wrappers to avoid viewport or clip clipping */
              html, body, #root, #main-content, #viewport, .viewport,
              #print-modal-wrapper, #print-modal-wrapper > div,
              .max-h-\\[95vh\\], .overflow-y-auto {
                display: block !important;
                position: static !important;
                overflow: visible !important;
                overflow-x: visible !important;
                overflow-y: visible !important;
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
                transform: none !important;
                backdrop-filter: none !important;
              }

              /* THE PRINT AREA */
              #print-section {
                display: block !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                color: black !important;
                transform: none !important;
                zoom: none !important;
              }

              #print-section * {
                color: black !important;
                border-color: #ccc !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              /* Tighten all vertical spacing */
              .space-y-6 > * + * { margin-top: 0.3rem !important; }
              .space-y-4 > * + * { margin-top: 0.2rem !important; }
              .mt-6 { margin-top: 0.3rem !important; }
              .mt-3 { margin-top: 0.1rem !important; }
              .pb-4 { padding-bottom: 0.15rem !important; }
              .p-3 { padding: 0.15rem !important; }
              .pt-12 { padding-top: 0.5rem !important; } /* Signature tighten */

              table {
                width: 100% !important;
                border-collapse: collapse !important;
                font-size: 8pt !important;
              }
              
              th, td {
                padding: 1.5px 3px !important;
                border-bottom: 1px solid #ccc !important;
              }

              tr {
                page-break-inside: avoid !important;
              }
              
              /* Grid columns preservation */
              .grid-cols-2 {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                gap: 8px !important;
              }

              h1 { font-size: 12pt !important; margin: 0 !important; line-height: 1 !important; }
              p, div, span { font-size: 8.5pt !important; line-height: 1.1 !important; }
              
              /* Reset colored backgrounds for contrast on paper */
              .bg-indigo-50, .bg-emerald-50, .bg-rose-50, .bg-slate-50 {
                background: transparent !important;
                border: 0.5pt solid #eee !important;
              }
            }
          `}</style>
          
          <div id="print-modal-wrapper" className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-2xl p-6 md:p-8 max-w-4xl w-full shadow-2xl relative space-y-6 max-h-[95vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:p-0 print:border-0 print:rounded-none">
              
              {/* Controls panel - hidden during print */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4 print:hidden">
                <div className="flex flex-col gap-1 items-start">
                  <div className="flex items-center gap-2 text-indigo-700">
                    <Printer className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-black uppercase tracking-wider">Vista Previa de Impresión</h3>
                  </div>
                  {typeof window !== 'undefined' && window.self !== window.top && (
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100 mt-1 max-w-[320px] sm:max-w-md">
                      ⚠️ Atención: Si la ventana de impresión no se abre debido al bloqueo de marcos del navegador, haz clic en el botón de abrir la aplicación "Abrir en pestaña nueva"
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={handleTriggerPrint}
                    className="flex-1 sm:flex-none py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg transition shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 uppercase select-none cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-white" />
                    <span>Imprimir Planilla</span>
                  </button>
                  <button
                    onClick={() => setPrintSession(null)}
                    className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition select-none cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              {/* Printable Area */}
              <div id="print-section" className="space-y-6 text-slate-900 font-sans print:text-black print:bg-white bg-white">
                {/* Header */}
                <div className="text-center pb-4 border-b-2 border-dashed border-slate-300 flex flex-col items-center">
                  {customLogo && (
                    <img 
                      src={customLogo} 
                      alt="Logo De Primera" 
                      className="w-24 h-24 object-contain mb-3 print:w-20 print:h-20"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <h1 className="text-lg md:text-xl font-black uppercase tracking-widest text-slate-800 print:text-black font-sans">
                    Planilla de Caja Diaria V2
                  </h1>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1 print:text-black">
                    Resumen de Jornada y Arqueo de Caja Cerrada
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs">
                    <div className="font-semibold">
                      Fecha: <span className="font-black text-slate-800 print:text-black">{toSpanishLongDate(printSession.dateStr)}</span>
                    </div>
                    <div>
                      Referencia: <span className="font-mono font-bold text-slate-600 print:text-black">#{printSession.id}</span>
                    </div>
                    <div className="text-indigo-600 font-bold print:text-black">
                      Estado: <span className="bg-indigo-50 border border-indigo-100 text-indigo-750 px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-widest print:border-none print:bg-none print:px-0">Cerrada / Archivada</span>
                    </div>
                  </div>
                </div>

                {/* Grid 1: Bookings of Cancha 1 & Cancha 2 side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                  
                  {/* Cancha 1 Table */}
                  <div className="border border-slate-200 rounded-xl p-3 space-y-2 print:border-slate-300">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b pb-1">
                      Cancha 1
                    </h4>
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-100 text-[10px]">
                          <th className="py-1">Hora</th>
                          <th className="py-1">Cliente</th>
                          <th className="py-1 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {printSession.cancha1.map((slot, i) => (
                          <tr key={`print-c1-${i}`} className={slot.customerName ? "bg-slate-50/50" : "text-slate-400"}>
                            <td className="py-1.5 font-mono text-slate-600">{slot.time}</td>
                            <td className="py-1.5 truncate max-w-[150px] font-semibold text-slate-800 print:text-black">
                              {slot.customerName || "- Vacío -"}
                            </td>
                            <td className="py-1.5 text-right font-mono font-bold text-slate-700">
                              ${(slot.amount || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-800">
                          <td colSpan={2} className="py-2 uppercase text-[9px] tracking-widest">Subtotal Cancha 1</td>
                          <td className="py-2 text-right font-mono">${printSession.cancha1.reduce((sum, slot) => sum + (slot.amount || 0), 0).toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Cancha 2 Table */}
                  <div className="border border-slate-200 rounded-xl p-3 space-y-2 print:border-slate-300">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b pb-1">
                      Cancha 2
                    </h4>
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-100 text-[10px]">
                          <th className="py-1">Hora</th>
                          <th className="py-1">Cliente</th>
                          <th className="py-1 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {printSession.cancha2.map((slot, i) => (
                          <tr key={`print-c2-${i}`} className={slot.customerName ? "bg-slate-50/50" : "text-slate-400"}>
                            <td className="py-1.5 font-mono text-slate-600">{slot.time}</td>
                            <td className="py-1.5 truncate max-w-[150px] font-semibold text-slate-800 print:text-black">
                              {slot.customerName || "- Vacío -"}
                            </td>
                            <td className="py-1.5 text-right font-mono font-bold text-slate-700">
                              ${(slot.amount || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-800">
                          <td colSpan={2} className="py-2 uppercase text-[9px] tracking-widest">Subtotal Cancha 2</td>
                          <td className="py-2 text-right font-mono">${printSession.cancha2.reduce((sum, slot) => sum + (slot.amount || 0), 0).toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                </div>

                {/* Grid 2: Otros Ingresos & Otros Egresos side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                  
                  {/* Otros Ingresos Table */}
                  <div className="border border-slate-200 rounded-xl p-3 space-y-2 print:border-slate-300">
                    <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest border-b pb-1">
                      Otros Ingresos (Buffet + Extras)
                    </h4>
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-100 text-[10px]">
                          <th className="py-1 w-10">Cant</th>
                          <th className="py-1">Concepto</th>
                          <th className="py-1 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {/* Buffet calculation block */}
                        {(() => {
                          const hIso = parseCustomDateToIso(printSession.dateStr);
                          const histSales = sales.filter(sale => {
                            if (sale.origin === "consumo_interno") return false;
                            
                            // EXCLUDE MESA (CANCHAS) FROM BUFFET TOTAL to avoid double counting
                            if (sale.origin === "mesa" || sale.origin === "sistema_caja" || sale.origin === "consumo_interno") return false;
                            
                            const sysL = ["Cancha 1", "Cancha 2", "Otros Ingresos", "Otros Egresos", "Personal Egreso"];
                            if (sysL.includes(sale.table_number || "")) return false;

                            // Use session ID if available for pinpoint accuracy
                            if (sale.caja_session_id && printSession.id) {
                              return sale.caja_session_id === printSession.id;
                            }

                            // Fallback to date matching for older records
                            try { 
                              return getIsoStr(new Date(sale.date)) === hIso; 
                            } catch { 
                              return false; 
                            }
                          });
                          const bSalesTotal = histSales.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0);
                          const bSalesQty = histSales.reduce((acc, sale) => acc + (sale.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 0), 0);
                          
                          return (
                            <tr className="bg-emerald-50/20 text-slate-800">
                              <td className="py-1.5 font-mono font-bold">{bSalesQty}</td>
                              <td className="py-1.5 font-semibold text-[#15803d]">Ventas Buffet (Bar)</td>
                              <td className="py-1.5 text-right font-bold text-[#15803d]">${bSalesTotal.toFixed(2)}</td>
                            </tr>
                          );
                        })()}

                        {/* Manual Items */}
                        {printSession.otrosIngresos.map((row, i) => (
                          <tr key={`print-inc-${i}`}>
                            <td className="py-1.5 font-mono">{row.quantity || 1}</td>
                            <td className="py-1.5 font-semibold text-slate-800">
                              {(() => {
                                const accLabel = masterPlan.flatMap(p => p.accounts).find(a => a.id === row.accountId)?.label;
                                const subaccLabel = masterPlan.flatMap(p => p.accounts).flatMap(a => a.subaccounts).find(s => s.id === row.subaccountId)?.label || (row.isPendingClassification ? `Pendiente: ${row.suggestedSubaccount}` : "");

                                if (accLabel && subaccLabel) {
                                  return `${accLabel} + ${subaccLabel}`;
                                } else if (accLabel) {
                                  return accLabel;
                                } else {
                                  return row.account || "Ingreso";
                                }
                              })()}
                            </td>
                            <td className="py-1.5 text-right font-mono text-slate-705">${((row.quantity || 1) * (row.amount || 0)).toFixed(2)}</td>
                          </tr>
                        ))}

                        {printSession.otrosIngresos.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-2 text-center text-slate-400 text-[10px]">Sin ingresos extras manuales</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-800">
                          <td colSpan={2} className="py-2 uppercase text-[9px] tracking-widest">Total Otros Ingresos</td>
                          <td className="py-2 text-right font-mono text-emerald-800">
                            ${(() => {
                              const hIso = parseCustomDateToIso(printSession.dateStr);
                              const histSales = sales.filter(sale => {
                                if (sale.origin === "consumo_interno") return false;
                                
                                // EXCLUDE MESA (CANCHAS) FROM BUFFET TOTAL
                                if (sale.origin === "mesa" || sale.origin === "sistema_caja" || sale.origin === "consumo_interno") return false;
                                
                                const sysLL = ["Cancha 1", "Cancha 2", "Otros Ingresos", "Otros Egresos", "Personal Egreso"];
                                if (sysLL.includes(sale.table_number || "")) return false;

                                if (sale.caja_session_id && printSession.id) {
                                  return sale.caja_session_id === printSession.id;
                                }

                                try { 
                                  return getIsoStr(new Date(sale.date)) === hIso; 
                                } catch { 
                                  return false; 
                                }
                              });
                              const bSalesTotal = histSales.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0);
                              return (bSalesTotal + printSession.otrosIngresos.reduce((sum, r) => {
                                if (r.id === "buffet") return sum;
                                return sum + ((Number(r.quantity) || 1) * (Number(r.amount) || 0));
                              }, 0)).toFixed(2);
                            })()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Otros Egresos Table */}
                  <div className="border border-slate-200 rounded-xl p-3 space-y-2 print:border-slate-300">
                    <h4 className="text-xs font-black text-rose-800 uppercase tracking-widest border-b pb-1">
                      Otros Egresos (Retiros + Gastos)
                    </h4>
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-100 text-[10px]">
                          <th className="py-1 w-10">Cant</th>
                          <th className="py-1">Concepto</th>
                          <th className="py-1 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {/* Personal cash drawing */}
                        {printSession.personalAmount > 0 && (
                          <tr className="bg-rose-50/20 text-slate-800">
                            <td className="py-1.5 font-mono font-bold">1</td>
                            <td className="py-1.5 font-semibold text-rose-700">Retiro del Personal ({printSession.personalRole})</td>
                            <td className="py-1.5 text-right font-bold text-rose-700">-${(printSession.personalAmount || 0).toFixed(2)}</td>
                          </tr>
                        )}

                        {/* Manual Items */}
                        {printSession.otrosEgresos.map((row, i) => (
                          <tr key={`print-exp-${i}`}>
                            <td className="py-1.5 font-mono">{row.quantity || 1}</td>
                            <td className="py-1.5 font-semibold text-slate-700">
                              {(() => {
                                const accLabel = masterPlan.flatMap(p => p.accounts).find(a => a.id === row.accountId)?.label;
                                const subaccLabel = masterPlan.flatMap(p => p.accounts).flatMap(a => a.subaccounts).find(s => s.id === row.subaccountId)?.label || (row.isPendingClassification ? `Pendiente: ${row.suggestedSubaccount}` : "");

                                if (accLabel && subaccLabel) {
                                  return `${accLabel} + ${subaccLabel}`;
                                } else if (accLabel) {
                                  return accLabel;
                                } else {
                                  return row.account || "Egreso";
                                }
                              })()}
                            </td>
                            <td className="py-1.5 text-right font-mono text-rose-700">-${((row.quantity || 1) * (row.amount || 0)).toFixed(2)}</td>
                          </tr>
                        ))}

                        {(!printSession.personalAmount || printSession.personalAmount === 0) && printSession.otrosEgresos.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-2 text-center text-slate-400 text-[10px]">Sin egresos registrados</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-800">
                          <td colSpan={2} className="py-2 uppercase text-[9px] tracking-widest">Total Otros Egresos</td>
                          <td className="py-2 text-right font-mono text-rose-800">
                            -${((printSession.personalAmount || 0) + printSession.otrosEgresos.reduce((sum, r) => sum + (r.quantity * (r.amount || 0)), 0)).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                </div>

                {/* Financial Consolidation & Physical Counts Summary */}
                {(() => {
                  const sTotals = getSessionTotals(printSession);
                  const billsData = Object.entries(printSession.billCounts || {})
                    .map(([denomStr, countValue]) => ({
                      denom: Number(denomStr),
                      count: Number(countValue) || 0
                    }))
                    .filter(item => item.count > 0)
                    .sort((a, b) => b.denom - a.denom);

                  return (
                    <div className="border-2 border-slate-350 rounded-xl p-4 bg-slate-50/40 grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:border-slate-300">
                      
                      {/* Theoretical Balance (Book balance) */}
                      <div className="space-y-2 bg-white/70 p-3 rounded-lg border border-slate-100 print:bg-none print:border-none">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 border-b pb-1">
                          Cálculo Teórico en Caja (Libro)
                        </h4>
                        <div className="space-y-1.5 text-xs text-slate-700">
                          <p className="flex justify-between">
                            <span>(+) Apertura / Saldo inicial:</span>
                            <strong className="font-mono">${printSession.saldoInicial.toFixed(2)}</strong>
                          </p>
                          <p className="flex justify-between">
                            <span>(+) Recaudación Canchas (1 + 2):</span>
                            <strong className="font-mono">${sTotals.totalCanchas.toFixed(2)}</strong>
                          </p>
                          <p className="flex justify-between">
                            <span>(+) Recaudación Buffet (Bar):</span>
                            <strong className="font-mono">${sTotals.barTotal.toFixed(2)}</strong>
                          </p>
                          <p className="flex justify-between">
                            <span>(+) Otros Ingresos Extras:</span>
                            <strong className="font-mono">${sTotals.otrosIngresosTotal.toFixed(2)}</strong>
                          </p>
                          <p className="flex justify-between border-b pb-1.5">
                            <span>(-) Total de Retiros y Gastos:</span>
                            <strong className="font-mono text-rose-600">-${sTotals.totalExpenses.toFixed(2)}</strong>
                          </p>
                          <p className="flex justify-between text-xs font-black text-slate-800 print:text-black">
                            <span>(=) Monto Esperado en Caja:</span>
                            <span className="font-mono text-slate-900 font-extrabold">${sTotals.theoreticalCaja.toFixed(2)}</span>
                          </p>
                        </div>
                      </div>

                      {/* Real count & Discrepancies */}
                      <div className="space-y-2 bg-white/70 p-3 rounded-lg border border-slate-100 print:bg-none print:border-none flex flex-col justify-between">
                        <div className="space-y-2">
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 border-b pb-1">
                            Cerrado Real Rendido (Físico)
                          </h4>
                          <div className="space-y-1.5 text-xs text-slate-700">
                            <p className="flex justify-between">
                              <span>Efectivo Rendido:</span>
                              <strong className="font-mono">${(printSession.rendicionEfectivo || 0).toFixed(2)}</strong>
                            </p>
                            <p className="flex justify-between">
                              <span>Transferencias Rendidas:</span>
                              <strong className="font-mono">${(printSession.rendicionTransferencia || 0).toFixed(2)}</strong>
                            </p>
                            <p className="flex justify-between border-b pb-1.5">
                              <span>Tarjeta (Crédito/Débito) Rendida:</span>
                              <strong className="font-mono">${(printSession.rendicionTarjetas || 0).toFixed(2)}</strong>
                            </p>
                            <p className="flex justify-between font-bold text-slate-800 print:text-black pb-1.5 border-b border-slate-150">
                              <span>Total Rendido Informado:</span>
                              <strong className="font-mono text-indigo-700">${sTotals.realRendido.toFixed(2)}</strong>
                            </p>
                          </div>

                          {/* Banknote breakdown detail */}
                          <div className="mt-3 text-xs">
                            <span className="text-[10px] font-black uppercase text-slate-500 block tracking-wider mb-2 print:text-black">
                              Detalle del Arqueo de Billetes:
                            </span>
                            {billsData.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic">No se registró detalle de billetes.</p>
                            ) : (
                              <div className="w-full overflow-hidden border border-slate-200 rounded-lg bg-white shadow-xs print:border-slate-350">
                                <table className="w-full text-left border-collapse text-[11px]">
                                  <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold print:bg-slate-200 print:text-black border-b border-slate-200">
                                      <th className="px-3 py-1.5">Denominación</th>
                                      <th className="px-3 py-1.5 text-center">Cantidad</th>
                                      <th className="px-3 py-1.5 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-105 print:divide-slate-300 font-mono">
                                    {billsData.map(({ denom, count }) => (
                                      <tr key={denom} className="hover:bg-slate-50/50 text-slate-700 dark:text-slate-300 print:text-black">
                                        <td className="px-3 py-1.5 font-semibold text-slate-600 print:text-black">
                                          ${denom.toLocaleString("es-ES")}
                                        </td>
                                        <td className="px-3 py-1.5 text-center text-slate-700 print:text-black font-bold">
                                          {count}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-extrabold text-slate-800 print:text-black">
                                          ${(count * denom).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="bg-slate-50/80 font-bold border-t border-slate-250">
                                      <td className="px-3 py-1.5 text-slate-700 print:text-black" colSpan={2}>
                                        Total Arqueado:
                                      </td>
                                      <td className="px-3 py-1.5 text-right text-emerald-800 dark:text-emerald-400 print:text-black font-extrabold">
                                        ${billsData.reduce((acc, curr) => acc + (curr.denom * curr.count), 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 mt-2 flex justify-between items-center bg-slate-100/50 p-2 rounded print:border-slate-300">
                          <span className="text-[11px] font-black uppercase text-slate-600">DIFERENCIA DE ARQUEO:</span>
                          <span className={`text-sm font-black font-mono ${
                            Math.abs(sTotals.discrepancy) < 0.01 
                              ? "text-emerald-700" 
                              : sTotals.discrepancy < 0 
                              ? "text-rose-700" 
                              : "text-emerald-700"
                          }`}>
                            {sTotals.discrepancy > 0 ? "+" : ""}{sTotals.discrepancy.toFixed(2)}
                          </span>
                        </div>
                      </div>

                    </div>
                  );
                })()}

                {/* Signatures region */}
                <div className="pt-8 grid grid-cols-2 gap-12 text-center text-xs">
                  <div className="space-y-1">
                    <div className="border-t border-slate-400 mx-auto w-48 pt-1 text-slate-500 font-bold">
                      Firma Responsable
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">Arqueo Entregado por Operador</div>
                  </div>
                  <div className="space-y-1">
                    <div className="border-t border-slate-400 mx-auto w-48 pt-1 text-slate-500 font-bold">
                      Firma Supervisor V2
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">Convalidado por Administración</div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </>
      )}

    </div>
  );
};

interface AutocompleteBoxlistProps {
  value: string;
  options: string[];
  onChange: (val: string) => void;
  onUpdateOptions: (newOpts: string[]) => void;
  onRenameOption?: (oldVal: string, newVal: string) => void;
  onDeleteOption?: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  focusBorderColor?: string;
}

const AutocompleteBoxlist: React.FC<AutocompleteBoxlistProps> = ({
  value,
  options,
  onChange,
  onUpdateOptions,
  onRenameOption,
  onDeleteOption,
  disabled = false,
  placeholder = "Buscar o agregar...",
  focusBorderColor = "focus:ring-indigo-500"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [deletingOption, setDeletingOption] = useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Sync internal input value with prop value when dropdown is closed or prop changed
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setEditingIndex(null);
        setDeletingOption(null);
        if (inputValue.trim() === "") {
          onChange("");
          setInputValue("");
        } else {
          setInputValue(value); // revert only if didn't clear and didn't select
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, inputValue, onChange]);

  // Clean, unique, alphabetically sorted options
  const sortedOptions = React.useMemo(() => {
    const cleanList = options
      .map(o => String(o || "").trim())
      .filter(o => o !== "");
    const uniqueList: string[] = Array.from(new Set(cleanList));
    return uniqueList.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [options]);

  // Filter options based on input value
  const filteredOptions = React.useMemo(() => {
    const query = inputValue.toLowerCase().trim();
    if (!query) return sortedOptions;
    return sortedOptions.filter(opt => opt.toLowerCase().includes(query));
  }, [sortedOptions, inputValue]);

  // Is there an exact match (case insensitive) for the typed content?
  const isExactMatch = React.useMemo(() => {
    const valTrim = inputValue.trim().toLowerCase();
    if (!valTrim) return true;
    return sortedOptions.some(opt => opt.toLowerCase() === valTrim);
  }, [sortedOptions, inputValue]);

  const handleAddNewOption = (newVal: string) => {
    const trimmed = newVal.trim();
    if (!trimmed) return;
    
    // Check duplicates case insensitively
    const exists = sortedOptions.some(opt => opt.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return;
    }

    const nextOptions = [...sortedOptions, trimmed];
    onUpdateOptions(nextOptions);
    onChange(trimmed);
    setInputValue(trimmed);
    setIsOpen(false);
  };

  const handleStartEdit = (e: React.MouseEvent, index: number, optionVal: string) => {
    e.stopPropagation();
    setEditingIndex(index);
    setEditingValue(optionVal);
  };

  const handleSaveEdit = (e: React.MouseEvent, oldVal: string) => {
    e.stopPropagation();
    const trimmed = editingValue.trim();
    if (!trimmed) return;

    if (trimmed !== oldVal) {
      // Check duplicates
      const exists = sortedOptions.some(o => o.toLowerCase() === trimmed.toLowerCase() && o !== oldVal);
      if (exists) {
        return;
      }

      const nextOptions = sortedOptions.map(o => o === oldVal ? trimmed : o);
      onUpdateOptions(nextOptions);

      if (onRenameOption) {
        onRenameOption(oldVal, trimmed);
      }

      if (value === oldVal) {
        onChange(trimmed);
        setInputValue(trimmed);
      }
    }
    setEditingIndex(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingIndex(null);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              if (inputValue.trim() === "") {
                onChange("");
                setInputValue("");
              }
            }, 200);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (inputValue.trim() === "") {
                onChange("");
                setInputValue("");
                setIsOpen(false);
              } else if (filteredOptions.length > 0) {
                const firstMatch = filteredOptions[0];
                onChange(firstMatch);
                setInputValue(firstMatch);
                setIsOpen(false);
              } else if (inputValue.trim() && !isExactMatch) {
                handleAddNewOption(inputValue);
              }
            } else if (e.key === "Escape") {
              setIsOpen(false);
              setEditingIndex(null);
              setDeletingOption(null);
              if (inputValue.trim() === "") {
                onChange("");
                setInputValue("");
              } else {
                setInputValue(value);
              }
            }
          }}
          className={`w-full px-2 py-1 pr-7 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/30 ${focusBorderColor}`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) setIsOpen(prev => !prev);
          }}
          className="absolute right-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 cursor-pointer animate-none"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg max-h-72 overflow-y-auto z-[9999] flex flex-col">
          {/* Reset button inside dropdown */}
          {value !== "" && (
            <div className="p-1 px-2 border-b border-rose-100 dark:border-rose-950 bg-rose-50/40 dark:bg-rose-950/20">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setInputValue("");
                  setIsOpen(false);
                }}
                className="w-full text-left font-bold text-rose-600 dark:text-rose-450 hover:underline cursor-pointer flex items-center gap-1 py-1 text-[11px]"
              >
                <X className="w-3.5 h-3.5" />
                -- Borrar selección --
              </button>
            </div>
          )}

          {/* Option to create a new option inline if it doesn't exist */}
          {!isExactMatch && inputValue.trim() && (
            <div className="p-1 px-2 border-b border-slate-150 dark:border-slate-700 bg-emerald-50/45 dark:bg-emerald-950/25">
              <button
                type="button"
                onClick={() => handleAddNewOption(inputValue)}
                className="w-full text-left text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 py-1 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar "{inputValue}"
              </button>
            </div>
          )}

          <ul className="py-1 divide-y divide-slate-100 dark:divide-slate-705 text-[11px] font-semibold text-slate-700 dark:text-slate-305">
            {filteredOptions.map((opt, idx) => {
              const isEditing = editingIndex === idx;
              return (
                <li
                  key={`opt-${idx}`}
                  onClick={() => {
                    if (!isEditing) {
                      onChange(opt);
                      setInputValue(opt);
                      setIsOpen(false);
                    }
                  }}
                  className={`group px-2 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-705 cursor-pointer ${value === opt ? "bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-200"}`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(e, opt);
                          else if (e.key === "Escape") handleCancelEdit(e);
                        }}
                        className="flex-1 px-1 py-0.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded text-[11px] font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleSaveEdit(e, opt)}
                        className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 p-0.5 rounded cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 animate-none" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-755 p-0.5 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 animate-none" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="truncate flex-1">{opt}</span>
                      {deletingOption === opt ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-rose-500 font-extrabold text-[9px] animate-pulse">¿Borrar?</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextOptions = sortedOptions.filter(o => o !== opt);
                              onUpdateOptions(nextOptions);
                              if (onDeleteOption) {
                                onDeleteOption(opt);
                              }
                              if (value === opt) {
                                onChange("");
                                setInputValue("");
                              }
                              setDeletingOption(null);
                            }}
                            className="text-rose-600 hover:text-rose-800 p-0.5 rounded bg-rose-55 hover:bg-rose-100 dark:bg-rose-950/40 cursor-pointer"
                            title="Confirmar eliminación"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingOption(null);
                            }}
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded bg-slate-55 hover:bg-slate-100 dark:bg-slate-700/50 cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            type="button"
                            onClick={(e) => handleStartEdit(e, idx, opt)}
                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5 rounded-md hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Editar"
                          >
                            <Pencil className="w-3 h-3 animate-none" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingOption(opt);
                            }}
                            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 rounded-md hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3 animate-none" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}

            {filteredOptions.length === 0 && !inputValue.trim() && (
              <li className="px-2 py-4 text-center text-slate-400 text-[10px] italic">
                Escribe para buscar o agregar nuevas opciones
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

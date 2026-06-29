/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Loader2, 
  AlertCircle, 
  Database, 
  ArrowUpRight, 
  Bell, 
  Clock, 
  Search, 
  Building2,
  Lock,
  Unlock,
  AlertTriangle,
  Sun,
  Moon,
  LogOut
} from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, signOut } from "./lib/firebase";

import { StockItem, SaleTransaction, SaleItem, CustomerProfile, Provider, EventModel, TableSession } from "./types";

// Import custom named premium components
import { Sidebar } from "./components/Sidebar";
import { DashboardStats } from "./components/DashboardStats";
import { InventoryTab } from "./components/InventoryTab";
import { ProvidersTab } from "./components/ProvidersTab";
import { PurchasesTab } from "./components/PurchasesTab";
import { SalesTab } from "./components/SalesTab";
import { WeeklyAuditTab } from "./components/WeeklyAuditTab";
import { CajaDiariaTab } from "./components/CajaDiariaTab";
import { CustomersTab } from "./components/CustomersTab";
import { PlanCuentasMaestro } from "./components/PlanCuentasMaestro";
import { ScannerAI } from "./components/ScannerAI";
import { EventsTab } from "./components/EventsTab";
import { DeactivatedTab } from "./components/DeactivatedTab";
import { LoginScreen } from "./components/LoginScreen";
import { ReportsTab } from "./components/ReportsTab";
import { MapaArquitectura } from "./components/MapaArquitectura";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  
  // User Authentication State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<{ username: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [stock, setStock] = useState<StockItem[]>([]);
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [presentations, setPresentations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [events, setEvents] = useState<EventModel[]>([]);
  const [tables, setTables] = useState<TableSession[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [activeCaja, setActiveCaja] = useState<any>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);
  
  // Status hooks
  const [loading, setLoading] = useState<boolean>(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Venue Selector State
  const [activeVenue, setActiveVenue] = useState("Cancha Principal & Barra F7");

  // Live Clocks Time State
  const [timeStr, setTimeStr] = useState("");

  // Theme support
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("theme") === "dark" || document.documentElement.classList.contains("dark");
  });

  // Dark Mode side effects
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // Auth sync effect
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setUserProfile({ username: u.displayName || u.email?.split("@")[0] || "Usuario" });
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Synchronize custom logo from central server to localStorage on startup
  useEffect(() => {
    async function syncCustomLogo() {
      try {
        const resp = await fetch("/api/settings/logo");
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.hasOwnProperty("customLogo")) {
            if (data.customLogo) {
              localStorage.setItem("barstock_app_custom_logo", data.customLogo);
              window.dispatchEvent(new Event("custom_logo_updated"));
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
        console.error("Error syncing custom logo on launch:", err);
      }
    }
    syncCustomLogo();
  }, []);

  // DB triggers indicators
  const [clearing, setClearing] = useState<boolean>(false);
  const [seeding, setSeeding] = useState<boolean>(false);

  // API helper with Auth
  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!user) throw new Error("Acceso denegado: Usuario no autenticado.");
    const token = await user.getIdToken();
    const headers = {
      ...options.headers,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    };

    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (e: any) {
      console.error("Network Fetch Error:", e);
      throw new Error(`Fallo de conexión de red: ${e.message || e}`);
    }

    if (!response.ok) {
      let errorMsg = `Error ${response.status}: ${response.statusText}`;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          const errData = await response.json();
          if (errData.isQuotaExceeded) {
            setIsQuotaExceeded(true);
          }
          if (errData.error) errorMsg = errData.error;
          if (errData.details) errorMsg += ` (${errData.details})`;
          if (errData.code) errorMsg += ` [${errData.code}]`;
        } catch (e) {
          // JSON parsing failed despite header
        }
      } else {
        try {
          const text = await response.text();
          if (text && text.length < 200) errorMsg += `: ${text}`;
        } catch (e) { /* ignore */ }
      }
      throw new Error(errorMsg);
    }
    return response;
  }, [user]);

  // Fetch Active Caja on load/tab switch
  useEffect(() => {
    async function fetchActiveCaja() {
        if (!user) return; // Prevent "Access denied" error before auth
        try {
            const res = await apiFetch("/api/caja/active");
            if (res.ok) {
                const data = await res.json();
                setActiveCaja(data);
            }
        } catch (err) {
            console.error("Error fetching active caja", err);
        }
    }
    fetchActiveCaja();
  }, [activeTab, user, apiFetch]);

  const sendDevLog = async (log: string) => {
    console.log(log);
    try {
      if (user) {
        await apiFetch("/api/dev-logs", {
          method: "POST",
          body: JSON.stringify({ log }),
        });
      }
    } catch (e) {}
  };

  const handleClearDatabase = async () => {
    if (!window.confirm("¿Seguro que deseas VACIAR y reiniciar todo el stock, ventas, clientes, proveedores y reservas de 'De Primera Fútbol & Eventos'? Se borrarán todos los registros de forma definitiva.")) {
      return;
    }
    try {
      setLoading(true);
      const res = await apiFetch("/api/db/clear", { method: "POST" });
      if (res.ok) {
        setStock([]);
        setSales([]);
        setCustomers([]);
        setProviders([]);
        setEvents([]);
        setTables([]);
        alert("Base de datos de 'De Primera' totalmente vaciada.");
      } else {
        alert("Ocurrió un error al intentar vaciar.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDatabase = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/db/seed", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setStock(data.stock || []);
        setSales(data.sales || []);
        setCustomers(data.customers || []);
        setProviders(data.providers || []);
        setEvents(data.events || []);
        
        // Fetch tables as well
        const tablesRes = await apiFetch("/api/tables");
        if (tablesRes.ok) {
          const tablesData = await tablesRes.json();
          setTables(tablesData || []);
        }
        
        alert("¡Datos oficiales del Complejo 'De Primera' fútbol, bar y eventos cargados con éxito!");
      } else {
        alert("No se pudieron inicializar los datos.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("es-ES", { hour12: false }));
    };
    updateTime();
    const iv = setInterval(updateTime, 1000);
    return () => clearInterval(iv);
  }, []);

  // Stable component-level function to sync database with backend
  const fetchDB = async (isSilent: boolean = false) => {
    if (!user) return null;
    try {
      if (!isSilent) {
        setLoading(true);
        setErrorText(null);
      }

      // We fetch sequentially or parallel, but handle individual errors better
      const fetchTask = async (endpoint: string) => {
        try {
          const resp = await apiFetch(endpoint);
          const contentType = resp.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await resp.text();
            const isHtml = text.toLowerCase().includes("<!doctype html>") || text.toLowerCase().includes("<html>");
            if (isHtml) {
              throw new Error(`Error de configuración: El servidor devolvió una página HTML en lugar de datos JSON para '${endpoint}'. Esto suele ocurrir si la ruta no existe o el servidor no inició correctamente.`);
            }
            throw new Error(`Respuesta no válida del servidor (${endpoint}): ${text.substring(0, 100)}`);
          }
          return await resp.json();
        } catch (e: any) {
          console.error(`Failed to fetch ${endpoint}:`, e);
          throw e;
        }
      };

      const [stockData, salesData, customersData, providersData, eventsData, tablesData, purchasesData, movementsData, presentationsData, auditsData] = await Promise.all([
        fetchTask("/api/stock"),
        fetchTask("/api/sales"),
        isSilent ? Promise.resolve(null) : fetchTask("/api/customers"),
        isSilent ? Promise.resolve(null) : fetchTask("/api/providers"),
        fetchTask("/api/events"),
        fetchTask("/api/tables"),
        isSilent ? Promise.resolve(null) : fetchTask("/api/purchases"),
        isSilent ? Promise.resolve(null) : fetchTask("/api/inventory-movements"),
        isSilent ? Promise.resolve(null) : fetchTask("/api/presentations"),
        isSilent ? Promise.resolve(null) : fetchTask("/api/audits")
      ]);

      await sendDevLog(`[FRONTEND-10] IDs de ventas recibidos por fetchDB: ${JSON.stringify((salesData || []).map((s: any) => s.id))}`);

      setStock((prev) => JSON.stringify(prev) !== JSON.stringify(stockData) ? (stockData || []) : prev);
      setSales((prev) => JSON.stringify(prev) !== JSON.stringify(salesData) ? (salesData || []) : prev);
      if (movementsData !== null) {
        setMovements((prev) => JSON.stringify(prev) !== JSON.stringify(movementsData) ? (movementsData || []) : prev);
      }
      if (presentationsData !== null) {
        setPresentations((prev) => JSON.stringify(prev) !== JSON.stringify(presentationsData) ? (presentationsData || []) : prev);
      }
      if (customersData !== null) {
        setCustomers((prev) => JSON.stringify(prev) !== JSON.stringify(customersData) ? (customersData || []) : prev);
      }
      if (providersData !== null) {
        setProviders((prev) => JSON.stringify(prev) !== JSON.stringify(providersData) ? (providersData || []) : prev);
      }
      setEvents((prev) => JSON.stringify(prev) !== JSON.stringify(eventsData) ? (eventsData || []) : prev);
      setTables((prev) => JSON.stringify(prev) !== JSON.stringify(tablesData) ? (tablesData || []) : prev);
      if (purchasesData !== null) {
        setPurchases((prev) => JSON.stringify(prev) !== JSON.stringify(purchasesData) ? (purchasesData || []) : prev);
      }
      if (auditsData !== null) {
        setAudits((prev) => JSON.stringify(prev) !== JSON.stringify(auditsData) ? (auditsData || []) : prev);
      }

      return { success: true, count: (salesData || []).length, ids: (salesData || []).map((s: any) => s.id) };
    } catch (err: any) {
      console.error("fetchDB failure:", err);
      if (!isSilent) {
        setErrorText(err.message || "Error de conexión con el servidor.");
      }
      return { success: false, error: err.message };
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  };

  // Initial DB loading from JSON server backend and periodic polling for real-time multiplayer sync
  useEffect(() => {
    fetchDB(false);
  }, [user]);

  // Handlers for Stock Management Database
  const handleAddStockItem = async (itemData: Omit<StockItem, "id" | "last_updated">) => {
    try {
      const response = await apiFetch("/api/stock", {
        method: "POST",
        body: JSON.stringify(itemData),
      });

      if (!response.ok) return false;
      const newItem: StockItem = await response.json();
      
      setStock((prev) => [newItem, ...prev]);
      
      // Fetch fresh movements and stock to sync the INICIAL movement created by server
      const refreshMovements = await apiFetch("/api/inventory-movements");
      if (refreshMovements.ok) {
          const newMovements = await refreshMovements.json();
          setMovements(newMovements);
      }
      const refreshStock = await apiFetch("/api/stock");
      if (refreshStock.ok) {
          const freshStock = await refreshStock.json();
          setStock(freshStock);
      }

      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleEditStockItem = async (id: string, updatedFields: Partial<StockItem>) => {
    try {
      const response = await apiFetch(`/api/stock/${id}`, {
        method: "PUT",
        body: JSON.stringify(updatedFields),
      });

      if (!response.ok) return false;
      const updatedItem: StockItem = await response.json();

      setStock((prev) => prev.map((item) => (item.id === id ? updatedItem : item)));

      // Fetch fresh stock AND movements to sync potential AJUSTE movements created by server
      const freshRes = await apiFetch("/api/stock");
      if (freshRes.ok) {
        const freshStock = await freshRes.json();
        setStock(freshStock);
      }
      const freshMoves = await apiFetch("/api/inventory-movements");
      if (freshMoves.ok) {
        setMovements(await freshMoves.json());
      }

      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleDeleteStockItem = async (id: string) => {
    try {
      const response = await apiFetch(`/api/stock/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) return false;
      setStock((prev) => prev.filter((item) => item.id !== id));
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    try {
      await sendDevLog(`[FRONTEND-3] Momento en que se ejecuta handleDeleteSale: ${new Date().toISOString()}`);
      await sendDevLog(`[FRONTEND-7] Cantidad de ventas en el estado React antes del filtrado: ${sales.length}`);
      
      const salesBefore = sales;
      // OPTIMISTIC UPDATE: eliminate from active visible list immediately for zero-latency response
      setSales((prev) => {
        const filtered = prev.filter((s) => s.id !== saleId);
        sendDevLog(`[FRONTEND-8] Cantidad de ventas en el estado React después del filtrado: ${filtered.length}`);
        return filtered;
      });

      const deleteUrl = `/api/sales/${saleId}`;
      await sendDevLog(`[FRONTEND-4] URL DELETE enviada de forma relativa/absoluta: ${deleteUrl}`);

      const response = await apiFetch(deleteUrl, {
        method: "DELETE",
      });

      await sendDevLog(`[FRONTEND-5] Código HTTP recibido: ${response.status}`);
      let jsonResponse: any = { error: "No JSON could be parsed" };
      try {
        jsonResponse = await response.clone().json();
      } catch (err) {}
      await sendDevLog(`[FRONTEND-6] Respuesta JSON recibida: ${JSON.stringify(jsonResponse)}`);

      if (!response.ok) {
        console.error(`[DEBUG] Delete sale failed:`, jsonResponse);
        // Rollback on server error
        await sendDevLog("[FRONTEND-ROLLBACK] Volviendo el estado visible al original por error de servidor.");
        setSales(salesBefore);
        await fetchDB(true);
        throw new Error("Error eliminando la venta.");
      }
      
      await sendDevLog(`[DEBUG] Sale ${saleId} deleted successfully. Syncing database...`);
      await sendDevLog(`[FRONTEND-9] Lote previo a fetchDB tras borrado. Ejecutando fetchDB silencioso...`);
      const fetchDbResult = await fetchDB(true);
      await sendDevLog(`[FRONTEND-9] Resultado de fetchDB inmediatamente después de la eliminación: ${JSON.stringify(fetchDbResult)}`);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };
  
  // Handler for direct local POS checkpoint sales
  // Global Cart State for Rapid Sales (hoisted to App to persist when tabs switch)
  const [rapidSaleCart, setRapidSaleCart] = useState<SaleItem[]>([]);

  const handleAddSale = async (saleData: {
    items: SaleItem[];
    method: "efectivo" | "tarjeta" | "bizum" | string;
    origin: "terminal" | "mesa" | "ticket_ai" | string;
    table_number: string;
    notes?: string;
    date?: string;
    caja_session_id?: string | null;
  }) => {
    try {
      console.log("[DEBUG] Sending sale data to backend:", saleData);
      const response = await apiFetch("/api/sales", {
        method: "POST",
        body: JSON.stringify(saleData),
      });

      if (!response.ok) {
        const errJSON = await response.json().catch(() => ({}));
        console.error("[DEBUG] Backend error:", errJSON);
        throw new Error(errJSON.error || "No se pudo registrar la venta debido a un error del servidor.");
      }

      const resJSON = await response.json();
      console.log("[DEBUG] Sale registered successfully:", resJSON);
      
      if (resJSON.success && resJSON.transaction) {
        setSales((prev) => [resJSON.transaction, ...prev]);
        
        // Re-fetch fresh stock values to keep live dashboard synced after stock subtractions
        // OPTIMISTIC UPDATE: Update local stock state immediately to reduce server quota pressure
        setStock(prevStock => {
          const newStock = [...prevStock];
          saleData.items.forEach(saleItem => {
            const stockIndex = newStock.findIndex(s => s.id === saleItem.stock_item_id);
            if (stockIndex !== -1) {
              newStock[stockIndex] = { ...newStock[stockIndex], quantity: newStock[stockIndex].quantity - saleItem.quantity };
            }
          });
          return newStock;
        });
        const updateMovementsRes = await apiFetch("/api/inventory-movements");
        if (updateMovementsRes.ok) {
           const newMovements = await updateMovementsRes.json();
           setMovements(newMovements);
        }
        return true;
      }
      return false;
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  // Purchase tab replenishment additions handler
  const handleQuickAddStockQty = async (id: string, amount: number, customCost?: number) => {
    const item = stock.find((x) => x.id === id);
    if (!item) return false;
    const newQty = item.quantity + amount;
    const payload: Partial<StockItem> = { quantity: newQty };
    if (customCost !== undefined && customCost > 0) {
      payload.purchase_price = customCost;
    }
    return await handleEditStockItem(id, payload);
  };

  const handleLogInventoryMovement = async (movementData: any) => {
    try {
      const resp = await apiFetch("/api/inventory-movements", {
        method: "POST",
        body: JSON.stringify(movementData)
      });
      if (resp.ok) {
        const freshStockRes = await apiFetch("/api/stock");
        if (freshStockRes.ok) {
          const freshStock = await freshStockRes.json();
          setStock(freshStock || []);
        }
        const freshMovesRes = await apiFetch("/api/inventory-movements");
        if (freshMovesRes.ok) {
          const freshMoves = await freshMovesRes.json();
          setMovements(freshMoves || []);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleAddPresentation = async (name: string, units: number) => {
    const resp = await apiFetch("/api/presentations", {
      method: "POST",
      body: JSON.stringify({ name, units })
    });
    const newPresentation = await resp.json();
    setPresentations([...presentations, newPresentation]);
  };

  const handleEditPresentation = async (id: string, name: string, units: number) => {
    const resp = await apiFetch(`/api/presentations/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, units })
    });
    const updated = await resp.json();
    setPresentations(presentations.map(p => p.id === id ? updated : p));
  };

  const handleDeletePresentation = async (id: string) => {
    await apiFetch(`/api/presentations/${id}`, { method: "DELETE" });
    setPresentations(presentations.filter(p => p.id !== id));
  };

  // Save audit session dynamically via backend endpoint
  const handleSaveAudit = async (auditPayload: { responsible: string; note: string; adjustments: any[]; date?: string }): Promise<boolean> => {
    try {
      const response = await apiFetch("/api/audits", {
        method: "POST",
        body: JSON.stringify(auditPayload)
      });
      if (!response.ok) throw new Error("Error registrando auditoría.");
      
      const freshStockRes = await apiFetch("/api/stock");
      const freshStock = await freshStockRes.json();
      setStock(freshStock || []);
      
      const freshMovesRes = await apiFetch("/api/inventory-movements");
      const freshMoves = await freshMovesRes.json();
      setMovements(freshMoves || []);

      const freshAuditsRes = await apiFetch("/api/audits");
      const freshAudits = await freshAuditsRes.json();
      setAudits(freshAudits || []);

      return true;
    } catch (err) {
      console.error("handleSaveAudit failing:", err);
      return false;
    }
  };

  const handleUpdateAudit = async (id: string, date: string, note: string): Promise<boolean> => {
    try {
      const response = await apiFetch(`/api/audits/${id}`, {
        method: "PUT",
        body: JSON.stringify({ date, note })
      });
      if (!response.ok) throw new Error("Error actualizando auditoría.");
      
      const freshMovesRes = await apiFetch("/api/inventory-movements");
      const freshMoves = await freshMovesRes.json();
      setMovements(freshMoves || []);

      const freshAuditsRes = await apiFetch("/api/audits");
      const freshAudits = await freshAuditsRes.json();
      setAudits(freshAudits || []);

      return true;
    } catch (err) {
      console.error("handleUpdateAudit failing:", err);
      return false;
    }
  };

  // ----- TABLES CRUD HANDLERS -----
  const handleAddTable = async (tableData: any) => {
    try {
      const response = await apiFetch("/api/tables", {
        method: "POST",
        body: JSON.stringify(tableData),
      });
      if (!response.ok) throw new Error("Error creando mesa.");
      const t: TableSession = await response.json();
      setTables((prev) => [...prev, t]);
      return t;
    } catch (err) {
      console.error("handleAddTable failed:", err);
      throw err;
    }
  };

  const handleEditTable = async (id: string, updatedFields: any) => {
    try {
      const response = await apiFetch(`/api/tables/${id}`, {
        method: "PUT",
        body: JSON.stringify(updatedFields),
      });
      if (!response.ok) throw new Error("Error actualizando mesa.");
      const t: TableSession = await response.json();
      setTables((prev) => prev.map((item) => (item.id === id ? t : item)));
      return t;
    } catch (err) {
      console.error("handleEditTable failed:", err);
      throw err;
    }
  };

  const handleDeleteTable = async (id: string) => {
    try {
      const response = await apiFetch(`/api/tables/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Error eliminando mesa.");
      setTables((prev) => prev.filter((item) => item.id !== id));
      return true;
    } catch (err) {
      console.error("handleDeleteTable failed:", err);
      throw err;
    }
  };

  // ----- CUSTOMERS CRM HANDLERS -----
  const handleAddCustomer = async (custData: Omit<CustomerProfile, "id" | "purchaseHistory">) => {
    try {
      const response = await apiFetch("/api/customers", {
        method: "POST",
        body: JSON.stringify(custData),
      });
      if (!response.ok) throw new Error("Error guardando cliente.");
      const newCust: CustomerProfile = await response.json();
      setCustomers((prev) => [newCust, ...prev]);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleEditCustomer = async (cust: CustomerProfile) => {
    try {
      const response = await apiFetch(`/api/customers/${cust.id}`, {
        method: "PUT",
        body: JSON.stringify(cust),
      });
      if (!response.ok) throw new Error("Error editando cliente.");
      const updated: CustomerProfile = await response.json();
      setCustomers((prev) => prev.map((item) => (item.id === cust.id ? updated : item)));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      const response = await apiFetch(`/api/customers/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Error borrando cliente.");
      setCustomers((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  // ----- PROVIDERS HANDLERS -----
  const handleAddProvider = async (provData: Omit<Provider, "id">) => {
    try {
      const response = await apiFetch("/api/providers", {
        method: "POST",
        body: JSON.stringify(provData),
      });
      if (!response.ok) throw new Error("Error guardando proveedor.");
      const newProv: Provider = await response.json();
      setProviders((prev) => [newProv, ...prev]);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleEditProvider = async (prov: Provider) => {
    try {
      const response = await apiFetch(`/api/providers/${prov.id}`, {
        method: "PUT",
        body: JSON.stringify(prov),
      });
      if (!response.ok) throw new Error("Error editando proveedor.");
      const updated: Provider = await response.json();
      setProviders((prev) => prev.map((item) => (item.id === prov.id ? updated : item)));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      const response = await apiFetch(`/api/providers/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Error borrando proveedor.");
      setProviders((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleSavePurchaseInvoice = async (invoiceData: any) => {
    try {
      const response = await apiFetch("/api/purchases", {
        method: "POST",
        body: JSON.stringify(invoiceData)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error registrando compra: ${errorText}`);
      }
      const saved = await response.json();
      setPurchases((prev) => [saved, ...prev]);

      // Refresh stock
      const freshRes = await apiFetch("/api/stock");
      if (freshRes.ok) {
        const freshStock = await freshRes.json();
        setStock(freshStock);
      }
      
      const refreshMovements = await apiFetch("/api/inventory-movements");
      if (refreshMovements.ok) {
         const newMovements = await refreshMovements.json();
         setMovements(newMovements);
      }

      const refreshProviders = await apiFetch("/api/providers");
      if (refreshProviders.ok) {
        const freshProviders = await refreshProviders.json();
        setProviders(freshProviders);
      }
      
      return true;
    } catch (err: any) {
      console.error("handleSavePurchaseInvoice error:", err);
      alert(err.message || 'Error registrando compra');
      return false;
    }
  };

  const handleDeletePurchaseInvoice = async (id: string) => {
    try {
      const response = await apiFetch(`/api/purchases/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error borrando compra: ${errorText}`);
      }
      
      setPurchases((prev) => prev.filter((item) => item.id !== id));

      // Refresh stock
      const freshRes = await apiFetch("/api/stock");
      if (freshRes.ok) {
        const freshStock = await freshRes.json();
        setStock(freshStock);
      }
      
      const refreshMovements = await apiFetch("/api/inventory-movements");
      if (refreshMovements.ok) {
         const newMovements = await refreshMovements.json();
         setMovements(newMovements);
      }
      return true;
    } catch (err: any) {
      console.error("handleDeletePurchaseInvoice error:", err);
      alert(err.message || 'Error eliminando compra');
      return false;
    }
  };

  // ----- EVENTS HANDLERS -----
  const handleAddEvent = async (evtData: Omit<EventModel, "id">) => {
    try {
      const response = await apiFetch("/api/events", {
        method: "POST",
        body: JSON.stringify(evtData),
      });
      if (!response.ok) throw new Error("Error agendando evento.");
      const newEvt: EventModel = await response.json();
      setEvents((prev) => [newEvt, ...prev]);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleEditEvent = async (evt: EventModel) => {
    try {
      const response = await apiFetch(`/api/events/${evt.id}`, {
        method: "PUT",
        body: JSON.stringify(evt),
      });
      if (!response.ok) throw new Error("Error modificando evento.");
      const updated: EventModel = await response.json();
      setEvents((prev) => prev.map((item) => (item.id === evt.id ? updated : item)));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      const response = await apiFetch(`/api/events/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Error cancelando evento.");
      setEvents((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  // Calculate low stock metrics
  const lowStockCount = stock.filter(item => item.is_active !== false && !item.is_recipe && item.quantity <= item.min_quantity).length;

  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex flex-col justify-center items-center gap-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Sincronizando Seguridad...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={(username) => {
          // Username is already handled by onAuthStateChanged
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg-main)] text-slate-800 font-sans antialiased flex" id="viewport">
      
      {/* 1. SIDEBAR Navigation layout pane */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }} 
        lowStockCount={lowStockCount} 
      />

      {/* Global Quota Warning Banner */}
      <AnimatePresence>
        {isQuotaExceeded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-0 left-0 right-0 bg-amber-100 border-b border-amber-200 px-6 py-2 flex items-center justify-between z-[1000] shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="bg-amber-500 p-1 rounded-full">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <p className="text-[11px] font-bold text-amber-900 leading-tight">
                CUOTA DIARIA EXCEDIDA: El sistema está en modo lecturas limitadas por hoy (reset diario de Google). <br />
                <span className="font-medium opacity-80 italic">Tus datos están seguros, pero el servidor no procesará más cambios hasta mañana.</span>
              </p>
            </div>
            <button 
              onClick={() => setIsQuotaExceeded(false)}
              className="text-amber-700 hover:text-amber-900 text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-white/50 rounded border border-amber-200"
            >
              Entendido
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 min-w-0 min-h-screen flex flex-col justify-between pl-0 md:pl-0">
        
        {/* TOP COMPONENT: Control Bar, Clocks and operator profile metrics */}
        <header className="bg-white dark:bg-slate-900 border-b border-[#eff4ff] dark:border-slate-800 sticky top-0 z-40 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-3xs select-none">
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Building2 className="w-5 h-5 text-slate-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-250">Sede Principal</span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
            
            {/* Live Clock UTC indicator widget */}
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <Clock className="w-4 h-4 text-[#16a34a]" />
              <span>{timeStr || "Cargando..."}</span>
              <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1 py-0.5 rounded-sm">CEL</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Theme Toggle Switcher */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border dark:border-slate-800 cursor-pointer transition border-[#eff4ff]"
                title={darkMode ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
                id="theme_mode_toggle"
              >
                {darkMode ? <Sun className="w-4.5 h-4.5 text-[#22c55e]" /> : <Moon className="w-4.5 h-4.5 text-slate-500" />}
              </button>

              {/* Alert Bell */}
              <button
                onClick={() => {
                  if (lowStockCount > 0) {
                    setActiveTab("inventory");
                    alert(`⚠️ Alerta: Tienes ${lowStockCount} productos con stock mínimo crítico. Se recomienda emitir orden de reposición.`);
                  } else {
                    alert("✔ Sistema en orden: No posees productos bajo el stock mínimo.");
                  }
                }}
                className="relative p-2 rounded-xl text-slate-400 hover:text-slate-750 hover:bg-slate-50 border cursor-pointer transition border-[#eff4ff]"
                title="Centro de Alertas de Almacén"
              >
                <Bell className="w-4.5 h-4.5" />
                {lowStockCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-650 animate-ping" />
                )}
              </button>

              <div className="h-4.5 w-18 flex items-center justify-center font-bold text-[10px] px-2 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-lg">
                ONLINE ✔
              </div>

              {/* Active user status and log-out */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
                <div className="hidden lg:flex flex-col text-right font-sans">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Operador</span>
                  <span className="text-[11px] text-slate-700 font-extrabold capitalize">{userProfile?.username || "demo"}</span>
                </div>
                <button
                  onClick={async () => {
                    await signOut();
                  }}
                  className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 border border-rose-100 hover:border-rose-200 cursor-pointer transition"
                  title="Cerrar sesión actual de operador"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

          </div>

        </header>

        {/* 3. CONTENT CONTAINER BODY */}
        <div className="flex-1 px-4 sm:px-6 py-6 md:py-8 max-w-[1600px] w-full mx-auto space-y-6">


          {/* Sincronización database indicator overlay */}
          {loading && (
            <div className="py-28 bg-white rounded-2xl border border-[#eff4ff] shadow-sm flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-9 h-9 text-[#16a34a] animate-spin" />
              <p className="text-xs font-bold text-slate-500">Compilando e inicializando base de datos...</p>
            </div>
          )}

          {/* Error fallback alert indicator */}
          {!loading && errorText && (
            <div className="p-5 bg-rose-50 text-[#93000a] rounded-2xl border border-red-150 shadow-sm flex items-start gap-3.5 max-w-2xl mx-auto animate-shake">
              <AlertCircle className="w-5 h-5 text-[#ba1a1a] flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <h4 className="font-extrabold text-slate-900 uppercase">Fallo en Conexión</h4>
                <p className="font-medium text-[11.5px] text-[#93000a]">{errorText}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-2 text-xs font-extrabold underline hover:text-red-950 cursor-pointer"
                >
                  Intentar reconectar
                </button>
              </div>
            </div>
          )}

          {/* Core React Module Tabs Switcher loaded with motion transitions */}
          {!loading && !errorText && (
            <main className="min-h-[420px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  
                  {activeTab === "dashboard" && (
                    <DashboardStats 
                      stock={stock} 
                      sales={sales} 
                      purchases={purchases}
                      onRefillStock={handleQuickRefillFromDashboard}
                      onNavigateToTab={(tab) => {
                        setActiveTab(tab);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      apiFetch={apiFetch}
                    />
                  )}

                  {activeTab === "inventory" && (
                    <InventoryTab 
                      stock={stock} 
                      sales={sales}
                      movements={movements}
                      presentations={presentations}
                      onAddPresentation={handleAddPresentation}
                      onEditPresentation={handleEditPresentation}
                      onDeletePresentation={handleDeletePresentation}
                      providers={providers}
                      onAddStockItem={handleAddStockItem}
                      onEditStockItem={handleEditStockItem}
                      onDeleteStockItem={handleDeleteStockItem}
                      onLogMovement={handleLogInventoryMovement}
                    />
                  )}

                  {activeTab === "providers" && (
                    <ProvidersTab 
                      providers={providers}
                      purchases={purchases}
                      onAddProvider={handleAddProvider}
                      onEditProvider={handleEditProvider}
                      onDeleteProvider={handleDeleteProvider}
                      onNavigateToPurchases={() => setActiveTab("purchases")}
                    />
                  )}

                  {activeTab === "purchases" && (
                    <PurchasesTab 
                      stock={stock} 
                      providers={providers}
                      activeCaja={activeCaja}
                      onAddStockQty={handleQuickAddStockQty}
                      onAddProvider={handleAddProvider}
                      onEditProvider={handleEditProvider}
                      onDeleteProvider={handleDeleteProvider}
                      purchases={purchases}
                      onSavePurchaseInvoice={handleSavePurchaseInvoice}
                      onDeletePurchaseInvoice={handleDeletePurchaseInvoice}
                      onLogMovement={handleLogInventoryMovement}
                    />
                  )}

                  {activeTab === "sales" && (
                    <SalesTab 
                      stock={stock} 
                      sales={sales}
                      onAddSale={handleAddSale}
                      rapidSaleCart={rapidSaleCart}
                      setRapidSaleCart={setRapidSaleCart}
                      onTriggerAIScanTab={() => setActiveTab("scanner")}
                      onNavigateToTab={(tab) => {
                        setActiveTab(tab);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      tables={tables}
                      customers={customers}
                      onAddTable={handleAddTable}
                      onEditTable={handleEditTable}
                      onDeleteTable={handleDeleteTable}
                      onDeleteSale={handleDeleteSale}
                      onAddCustomer={handleAddCustomer}
                      onLogMovement={handleLogInventoryMovement}
                    />
                  )}

                  {activeTab === "audit" && (
                    <WeeklyAuditTab 
                      stock={stock} 
                      movements={movements}
                      audits={audits}
                      onSaveAudit={handleSaveAudit}
                      onUpdateAudit={handleUpdateAudit}
                    />
                  )}

                  {activeTab.startsWith("fin_") && (
                    <CajaDiariaTab 
                      sales={sales} 
                      stock={stock} 
                      customers={customers} 
                      onAddSale={handleAddSale} 
                      onAddCustomer={handleAddCustomer} 
                      onEditCustomer={handleEditCustomer} 
                      onDeleteCustomer={handleDeleteCustomer} 
                      activeSubTab={activeTab}
                      setActiveSubTab={setActiveTab}
                      apiFetch={apiFetch}
                    />
                  )}

                  {activeTab === "customers" && (
                    <CustomersTab 
                      customers={customers}
                      onAddCustomer={handleAddCustomer}
                      onEditCustomer={handleEditCustomer}
                      onDeleteCustomer={handleDeleteCustomer}
                    />
                  )}

                  {activeTab === "events" && (
                    <EventsTab 
                      events={events}
                      onAddEvent={handleAddEvent}
                      onEditEvent={handleEditEvent}
                      onDeleteEvent={handleDeleteEvent}
                      customers={customers}
                    />
                  )}

                  {activeTab === "plan_cuentas" && (
                    <PlanCuentasMaestro apiFetch={apiFetch} />
                  )}

                  {activeTab === "scanner" && (
                    <ScannerAI 
                      stock={stock} 
                      apiFetch={apiFetch}
                      onConfirmSale={handleAddSale}
                    />
                  )}

                  {activeTab === "sales_future" && (
                    <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-6 max-w-2xl mx-auto shadow-2xs my-8 animate-fade-in text-left">
                      <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                        <Clock className="w-10 h-10 animate-pulse" />
                      </div>
                      <div className="space-y-2 text-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full inline-block">Próximamente / En Desarrollo</span>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Módulo de Turnos y Servicios</h2>
                        <p className="text-xs text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                          Estamos diseñando una herramienta integral para la reserva de canchas en tiempo real, control de calendarios interactivos, facturación integrada de abonos y automatización de notificaciones para los clientes.
                        </p>
                      </div>
                      <div className="pt-6 border-t border-slate-100 flex justify-center gap-6 text-xs text-slate-400 font-bold font-mono">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                          Planificación de Canchas
                        </span>
                        <span>•</span>
                        <span>Abonos Recurrentes</span>
                        <span>•</span>
                        <span>Notificaciones SMS/WA</span>
                      </div>
                    </div>
                  )}

                  {activeTab === "deactivated" && (
                    <DeactivatedTab 
                      stock={stock}
                      customers={customers}
                      providers={providers}
                      onEditStockItem={handleEditStockItem}
                      onEditCustomer={handleEditCustomer}
                      onEditProvider={handleEditProvider}
                    />
                  )}

                  {activeTab === "mapa_arquitectura" && (
                    <MapaArquitectura apiFetch={apiFetch} />
                  )}

                  {(activeTab === "reports_buffet" || activeTab === "reports_turnos") && (
                    <ReportsTab 
                      stock={stock}
                      sales={sales}
                      events={events}
                      customers={customers}
                      apiFetch={apiFetch}
                      activeReportId={
                        activeTab === "reports_buffet" 
                          ? "rentabilidad_buffet" 
                          : "analisis_turnos"
                      }
                    />
                  )}

                </motion.div>
              </AnimatePresence>
            </main>
          )}

        </div>

        {/* 4. EXECUTIVE DESIGN FOOTER FOOTPRINT */}
        <footer className="text-center py-6 border-t border-[#eff4ff] text-xs text-slate-400 font-semibold bg-white mt-12 select-none">
          <div className="max-w-7xl w-full mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-400">
            <span>&copy; {new Date().getFullYear()} BarStock Pro. Todos los derechos de propiedad intelectual reservados.</span>
            <div className="flex items-center gap-4 text-[10px] font-bold">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                Sincronización: <strong className="text-emerald-600 font-bold uppercase">Google Firebase Cloud</strong>
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <span className="flex items-center gap-0.5">
                <span>IA Engine:</span>
                <strong className="text-indigo-600 font-black flex items-center gap-0.5">
                  Gemini 3.5-flash <ArrowUpRight className="w-3 h-3 text-indigo-500" />
                </strong>
              </span>
            </div>
          </div>
        </footer>

      </div>

    </div>
  );

  // Quick fallback handler for dashboard quick links adjustment
  async function handleQuickRefillFromDashboard(id: string, amount: number) {
    const item = stock.find((x) => x.id === id);
    if (!item) return;
    const freshQty = item.quantity + amount;
    await handleEditStockItem(id, { quantity: freshQty });
  }
}

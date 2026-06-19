/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { parseCustomDateToIso } from "./CajaDiariaV2";
import { auth } from "../lib/firebase";

// Authenticated api request helper for Caja operations
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

import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  X, 
  Sparkles, 
  DollarSign, 
  CreditCard, 
  Coins, 
  Layout, 
  Barcode, 
  ChevronRight,
  ClipboardList,
  Check,
  Lock,
  History,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Bookmark,
  Coffee,
  Receipt,
  User,
  Users,
  UserPlus,
  ArrowLeft,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  TrendingUp,
  Award,
  Edit2,
  Settings
} from "lucide-react";
import { StockItem, SaleItem, BarCategory, SaleTransaction, TableSession, TablePayment, CustomerProfile } from "../types";

interface SalesTabProps {
  stock: StockItem[];
  sales: SaleTransaction[];
  onAddSale: (saleData: {
    items: SaleItem[];
    method: "efectivo" | "tarjeta" | "bizum" | string;
    origin: "terminal" | "mesa" | "ticket_ai";
    table_number: string;
    notes?: string;
    caja_session_id?: string | null;
    customer_id?: string | null;
    customer_name?: string | null;
    is_debt?: boolean;
    debt_amount?: number;
    date?: string; // added
  }) => Promise<boolean>;
  rapidSaleCart: SaleItem[];
  setRapidSaleCart: React.Dispatch<React.SetStateAction<SaleItem[]>>;
  onTriggerAIScanTab: () => void;
  onNavigateToTab?: (tab: string) => void;
  tables?: TableSession[];
  customers?: CustomerProfile[];
  onAddTable?: (tableData: any) => Promise<any>;
  onEditTable?: (id: string, updatedFields: any) => Promise<any>;
  onDeleteTable?: (id: string) => Promise<boolean>;
  onDeleteSale?: (id: string) => Promise<boolean>;
  onAddCustomer?: (customerData: any) => Promise<any>;
  onLogMovement: (movement: any) => Promise<boolean>;
}

export const SalesTab: React.FC<SalesTabProps> = ({ 
  stock, 
  sales,
  onAddSale, 
  rapidSaleCart,
  setRapidSaleCart,
  onTriggerAIScanTab,
  onNavigateToTab,
  tables = [],
  customers = [],
  onAddTable,
  onEditTable,
  onDeleteTable,
  onDeleteSale,
  onAddCustomer,
  onLogMovement
}) => {
  // Navigation tabs: "mesas" (Gestión de Mesas), "mostrador" (Ventas Rápidas), "consumo" (Consumo Interno), "history" (Historial de Caja)
  const [activeTab, setActiveTab] = useState<"mesas" | "mostrador" | "consumo" | "history">("mesas");

  // Local active Caja session state synchronized from localStorage
  const [activeCajaSession, setActiveCajaSession] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("caja_v2_active_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isOpen && !parsed.isClosed) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    return null;
  });

  const [closedHistory, setClosedHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("caja_v2_closed_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Fetch closed caja history once on mount to save read quota resources
  useEffect(() => {
    const loadHistoryOnMount = async () => {
      try {
        const historyRes = await apiFetchCaja("/api/caja/history");
        if (historyRes.ok) {
          const hist = await historyRes.json();
          if (Array.isArray(hist)) {
            setClosedHistory(hist);
            localStorage.setItem("caja_v2_closed_history", JSON.stringify(hist));
          }
        }
      } catch (e) {
        console.error("Failed fetching closed history on mount in Bar sales screen:", e);
      }
    };
    loadHistoryOnMount();
  }, []);

  // Sync cash boxes from standard localstorage and remote Firestore databases
  useEffect(() => {
    let _active = true;
    const handleCheck = async () => {
      try {
        // 1. First run: attempt to read from local storage as immediate cached placeholder
        const savedSession = localStorage.getItem("caja_v2_active_session");
        let currentActive: any = null;
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            if (parsed && parsed.isOpen && !parsed.isClosed) {
              currentActive = parsed;
            }
          } catch {}
        }

        // 2. Fetch the true up-to-date active session from Firestore backend
        try {
          const activeRes = await apiFetchCaja("/api/caja/active");
          if (activeRes.ok) {
            const s = await activeRes.json();
            if (s && s.id && s.isOpen && !s.isClosed) {
              currentActive = s;
              // Sync back to local storage so other scripts (like other page modules) can access it
              localStorage.setItem("caja_v2_active_session", JSON.stringify(s));
            } else if (s === null) {
              currentActive = null;
              localStorage.removeItem("caja_v2_active_session");
            }
          }
        } catch (e) {
          // If network blips, fall back cleanly on localstorage info
        }

        if (!_active) return;

        setActiveCajaSession((prev: any) => {
          if ((!prev && currentActive) || (prev && !prev.id && currentActive) || (prev && currentActive && prev.id !== currentActive.id)) {
            // Reset active states if cash shift changes
            setCart([]);
            setNotes("");
            setSelectedTable(null);
          }
          return currentActive;
        });
      } catch (e) {
        console.error("Error keeping Caja state in sync inside bar screen:", e);
      }
    };

    // Run immediately. Polling removed due to daily quotas restrictions.
    handleCheck();
    return () => { _active = false; };
  }, []);

  // ---------------------------------------------------------
  // COUNTER / MOSTRADOR & COMPONENT STATES
  // ---------------------------------------------------------
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const cart = rapidSaleCart;
  const setCart = setRapidSaleCart;
  const [paymentMethod, setPaymentMethod] = useState<string>("efectivo");
  const [notes, setNotes] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  
  // Quick counter customer selection
  const [counterCustomerId, setCounterCustomerId] = useState<string>("");
  const counterCustomerObj = useMemo(() => {
    return customers.find(c => c.id === counterCustomerId) || null;
  }, [customers, counterCustomerId]);

  // ---------------------------------------------------------
  // TABLE MANAGEMENT STATES
  // ---------------------------------------------------------
  const [selectedTable, setSelectedTable] = useState<TableSession | null>(null);
  const [mesasFilter, setMesasFilter] = useState<"abiertas" | "cerradas" | "todas">("abiertas");
  const [searchMesaQuery, setSearchMesaQuery] = useState("");
  
  // Modals
  const [isOpeningTableModal, setIsOpeningTableModal] = useState(false);
  const [isPartialPaymentModal, setIsPartialPaymentModal] = useState(false);
  const [isNewCustomerModal, setIsNewCustomerModal] = useState(false);
  const [customTableModal, setCustomTableModal] = useState(false);

  // Opening Table fields
  const [searchCustomer, setSearchCustomer] = useState("");
  const [newTableForm, setNewTableForm] = useState({
    name: "",
    clientId: ""
  });

  // Create Customer Inline Form
  const [newCustomerForm, setNewCustomerForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    category: "Regular",
    internalNotes: "" // Registrada en blanco! Let's strictly keep preferences/internalNotes blank as requested!
  });

  // Partial Payment Form
  const [partialPaymentForm, setPartialPaymentForm] = useState({
    amount: "",
    method: "efectivo" as string,
    notes: ""
  });

  // Allowed custom payment methods list state
  const [paymentMethods, setPaymentMethods] = useState<string[]>(() => {
    const saved = localStorage.getItem("caja_payment_methods");
    return saved ? JSON.parse(saved) : ["efectivo", "tarjeta", "bizum"];
  });

  // Modal configuration for managing payment methods
  const [isManageMethodsModal, setIsManageMethodsModal] = useState(false);
  const [newMethodName, setNewMethodName] = useState("");
  const [editingMethod, setEditingMethod] = useState<string | null>(null);
  const [editMethodName, setEditMethodName] = useState("");

  // Active payment being modified (for editing a billing payment)
  const [editingPayment, setEditingPayment] = useState<TablePayment | null>(null);

  // ---------------------------------------------------------
  // COMMONS CATALOG FILTERS
  // ---------------------------------------------------------
  const allCategories = useMemo(() => {
    return Array.from(new Set([
      ...Object.values(BarCategory),
      ...stock.map(s => s.category)
    ])).filter(Boolean).sort();
  }, [stock]);

  const availableItems = useMemo(() => {
    return stock.filter(item => {
      const isActive = item.is_active !== false;
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
      return isActive && matchesSearch && matchesCategory;
    });
  }, [stock, search, selectedCategory]);

  // ---------------------------------------------------------
  // MESA LOGIC IMPLEMENTATIONS
  // ---------------------------------------------------------
  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchMesaQuery.toLowerCase()) ||
                            t.client_name.toLowerCase().includes(searchMesaQuery.toLowerCase());
      
      const isShiftOpen = t.status === "abierta" || t.status === "deuda";
      
      if (mesasFilter === "abiertas") return isShiftOpen && matchesSearch;
      if (mesasFilter === "cerradas") return t.status === "cerrada" && matchesSearch;
      return matchesSearch; // "todas"
    });
  }, [tables, searchMesaQuery, mesasFilter]);

  // Quick check if comanda is dirty (local comanda edits differ from DB items)
  const isComandaDirty = useMemo(() => {
    if (!selectedTable) return false;
    const dbTable = tables.find(t => t.id === selectedTable.id);
    if (!dbTable) return true;
    
    // Check lengths and details
    if (dbTable.items.length !== selectedTable.items.length) return true;
    for (let i = 0; i < selectedTable.items.length; i++) {
      const sItem = selectedTable.items[i];
      const dbItem = dbTable.items.find(x => x.stock_item_id === sItem.stock_item_id);
      if (!dbItem || dbItem.quantity !== sItem.quantity || dbItem.price !== sItem.price) {
        return true;
      }
    }
    return false;
  }, [selectedTable, tables]);

  // Direct table operations
  const handleSelectTableCard = (table: TableSession) => {
    if (table.status === "libre") {
      setNewTableForm({ name: table.name, clientId: "" });
      setSearchCustomer("");
      setIsOpeningTableModal(true);
    } else {
      setSelectedTable(JSON.parse(JSON.stringify(table))); // deeply copied for local comanda edits
    }
  };

  const handleOpenCustomTableBtn = () => {
    setNewTableForm({ name: "", clientId: "" });
    setSearchCustomer("");
    setCustomTableModal(true);
  };

  const handleCreateCustomerInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.fullName) return;
    try {
      if (onAddCustomer) {
        const addedCustObj = await onAddCustomer({
          fullName: newCustomerForm.fullName,
          phone: newCustomerForm.phone || "",
          email: newCustomerForm.email || "",
          category: newCustomerForm.category || "Regular",
          loyaltyTier: "Bronce",
          loyaltyPoints: 0,
          progressToNextPct: 0,
          outstandingCredit: 0,
          ytdSales: 0,
          internalNotes: "", // Mandated blank for blank preference initial default!
          is_active: true
        });
        alert(`¡Cliente "${newCustomerForm.fullName}" dado de alta con éxito!`);
        // Associate with table opening form
        setNewTableForm(prev => ({ ...prev, clientId: addedCustObj?.id || "" }));
        setIsNewCustomerModal(false);
        setNewCustomerForm({ fullName: "", phone: "", email: "", category: "Regular", internalNotes: "" });
      }
    } catch (err) {
      console.error(err);
      alert("Error registrando el cliente en el servidor.");
    }
  };

  const handleOpenTableFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tableName = newTableForm.name.trim();
    if (!tableName) {
      alert("Introduce un nombre o número para identificar la mesa.");
      return;
    }

    try {
      if (onAddTable) {
        const customerProfileModel = customers.find(c => c.id === newTableForm.clientId);
        const nameOfClient = customerProfileModel ? customerProfileModel.fullName : "Consumidor Final";
        
        const openTableDoc = {
          name: tableName,
          status: "abierta" as const,
          client_id: newTableForm.clientId || null,
          client_name: nameOfClient,
          items: [],
          payments: [],
          total_consumed: 0,
          total_paid: 0,
          outstanding_balance: 0,
          fecha_apertura: new Date().toISOString(),
          operator: activeCajaSession?.operator || "Operador Buffet",
        };

        const responseTable = await onAddTable(openTableDoc);
        setIsOpeningTableModal(false);
        setCustomTableModal(false);
        setSelectedTable(responseTable);
        alert(`Mesa "${tableName}" abierta para ${nameOfClient}.`);
      }
    } catch (err: any) {
      alert("Error abriendo comanda de mesa: " + err.message);
    }
  };

  // Add Item specifically to current selectedTable comanda
  const handleAddItemToMesaComanda = (item: StockItem) => {
    if (!selectedTable) return;
    
    setSelectedTable(prev => {
      if (!prev) return null;
      const idx = prev.items.findIndex((i) => i.stock_item_id === item.id);
      let updatedItems = [...prev.items];
      
      if (idx !== -1) {
        const existing = updatedItems[idx];
        const nextQty = existing.quantity + 1;
        updatedItems[idx] = {
          ...existing,
          quantity: nextQty,
          total: Number((nextQty * existing.price).toFixed(2))
        };
      } else {
        updatedItems.push({
          stock_item_id: item.id,
          name: item.name,
          quantity: 1,
          price: item.selling_price,
          total: item.selling_price
        });
      }

      const totalConsumedVal = updatedItems.reduce((acc, curr) => acc + curr.total, 0);
      const totalPaidVal = prev.payments.reduce((acc, curr) => acc + curr.amount, 0);

      return {
        ...prev,
        items: updatedItems,
        total_consumed: Number(totalConsumedVal.toFixed(2)),
        outstanding_balance: Number((totalConsumedVal - totalPaidVal).toFixed(2))
      };
    });
  };

  const handleUpdateQtyInMesaCart = (stock_item_id: string, qtyDelta: number) => {
    if (!selectedTable) return;
    
    setSelectedTable(prev => {
      if (!prev) return null;
      const updatedItems = prev.items.map(item => {
        if (item.stock_item_id === stock_item_id) {
          const nextQty = Math.max(1, item.quantity + qtyDelta);
          return {
            ...item,
            quantity: nextQty,
            total: Number((nextQty * item.price).toFixed(2))
          };
        }
        return item;
      });

      const totalConsumedVal = updatedItems.reduce((acc, curr) => acc + curr.total, 0);
      const totalPaidVal = prev.payments.reduce((acc, curr) => acc + curr.amount, 0);

      return {
        ...prev,
        items: updatedItems,
        total_consumed: Number(totalConsumedVal.toFixed(2)),
        outstanding_balance: Number((totalConsumedVal - totalPaidVal).toFixed(2))
      };
    });
  };

  const handleRemoveFromMesaCart = (stock_item_id: string) => {
    if (!selectedTable) return;
    setSelectedTable(prev => {
      if (!prev) return null;
      const updatedItems = prev.items.filter(item => item.stock_item_id !== stock_item_id);
      
      const totalConsumedVal = updatedItems.reduce((acc, curr) => acc + curr.total, 0);
      const totalPaidVal = prev.payments.reduce((acc, curr) => acc + curr.amount, 0);

      return {
        ...prev,
        items: updatedItems,
        total_consumed: Number(totalConsumedVal.toFixed(2)),
        outstanding_balance: Number((totalConsumedVal - totalPaidVal).toFixed(2))
      };
    });
  };

  // Persists item changes on Server progressively (does NOT deduct inventory stock yet)
  const handleSaveProgressiveComanda = async () => {
    if (!selectedTable || !onEditTable) return;
    try {
      const up = {
        items: selectedTable.items,
        total_consumed: selectedTable.total_consumed,
        outstanding_balance: selectedTable.outstanding_balance
      };
      await onEditTable(selectedTable.id, up);
      alert("Comanda de mesa guardada progresivamente en base de datos.");
    } catch (err: any) {
      alert("Error guardando comanda: " + err.message);
    }
  };

  const handleSavePaymentMethods = (updatedList: string[]) => {
    setPaymentMethods(updatedList);
    localStorage.setItem("caja_payment_methods", JSON.stringify(updatedList));
  };

  // Partial Payment
  const handleAddPartialPaymentClick = () => {
    setPartialPaymentForm({
      amount: "",
      method: "efectivo",
      notes: ""
    });
    setIsPartialPaymentModal(true);
  };

  const handlePartialPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payAmt = Number(partialPaymentForm.amount);
    if (isNaN(payAmt) || payAmt <= 0) {
      alert("Introduce un monto de abono válido.");
      return;
    }

    if (!selectedTable || !onEditTable) return;

    if (!editingPayment && payAmt > selectedTable.outstanding_balance) {
      if (!window.confirm(`El monto abonado ($${payAmt}) supera el saldo pendiente ($${selectedTable.outstanding_balance}). ¿Registrar el sobrante de igual forma?`)) {
        return;
      }
    }

    try {
      let nextPayments: TablePayment[] = [];
      if (editingPayment) {
        nextPayments = selectedTable.payments.map(p => {
          if (p.id === editingPayment.id) {
            return {
              ...p,
              amount: payAmt,
              method: partialPaymentForm.method,
              notes: partialPaymentForm.notes || "Abono modificado."
            };
          }
          return p;
        });
      } else {
        const newPayment: TablePayment = {
          id: "pay_" + Math.random().toString(36).slice(2, 9).toUpperCase(),
          amount: payAmt,
          date: new Date().toISOString().split("T")[0],
          time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          operator: activeCajaSession?.operator || "Operador Mesa",
          method: partialPaymentForm.method,
          notes: partialPaymentForm.notes || "Abono parcial de consumo en mesa."
        };
        nextPayments = [...selectedTable.payments, newPayment];
      }

      const nextPaid = Number(nextPayments.reduce((acc, p) => acc + p.amount, 0).toFixed(2));
      const nextBalance = Number((selectedTable.total_consumed - nextPaid).toFixed(2));

      const updatedFields = {
        items: selectedTable.items,
        total_consumed: selectedTable.total_consumed,
        payments: nextPayments,
        total_paid: nextPaid,
        outstanding_balance: nextBalance
      };

      const updatedModel = await onEditTable(selectedTable.id, updatedFields);
      setSelectedTable(updatedModel);
      setIsPartialPaymentModal(false);
      setEditingPayment(null);
      alert(editingPayment ? "Abono modificado exitosamente." : `Abono parcial de $${payAmt} registrado exitosamente. Saldo pendiente: $${nextBalance}.`);
    } catch (err: any) {
      alert("Error procesando abono: " + err.message);
    }
  };

  const handleStartEditPayment = (payment: TablePayment) => {
    setEditingPayment(payment);
    setPartialPaymentForm({
      amount: payment.amount.toString(),
      method: payment.method,
      notes: payment.notes || ""
    });
    setIsPartialPaymentModal(true);
  };

  const handleDeletePayment = async (targetId: string) => {
    if (!selectedTable || !onEditTable) return;
    if (!window.confirm("¿Estás seguro de que deseas eliminar este pago a cuenta? El saldo pendiente se recalculará inmediatamente.")) {
      return;
    }

    try {
      const nextPayments = selectedTable.payments.filter(p => p.id !== targetId);
      const nextPaid = Number(nextPayments.reduce((acc, p) => acc + p.amount, 0).toFixed(2));
      const nextBalance = Number((selectedTable.total_consumed - nextPaid).toFixed(2));

      const updatedFields = {
        items: selectedTable.items,
        total_consumed: selectedTable.total_consumed,
        payments: nextPayments,
        total_paid: nextPaid,
        outstanding_balance: nextBalance
      };

      const updatedModel = await onEditTable(selectedTable.id, updatedFields);
      setSelectedTable(updatedModel);
      alert("Abono eliminado con éxito.");
    } catch (err: any) {
      alert("Error eliminando abono: " + err.message);
    }
  };

  // Close and Settle definetely the Table Session (deducts stock and logs cash transaction)
  const handleFinalSettleAndCloseTable = async (withDebt: boolean = false) => {
    if (!selectedTable || !onEditTable) return;

    if (selectedTable.items.length === 0) {
      alert("No se puede cerrar una mesa sin productos consumidos. Si deseas anularla, elimínala.");
      return;
    }

    if (withDebt && (!selectedTable.client_id || selectedTable.client_name === "Consumidor Final")) {
      alert("Para cerrar la mesa dejando saldo pendiente como Deuda/Cuenta Corriente, primero debes asignar un Cliente nominal a la mesa (no puede ser Consumidor Final).");
      return;
    }

    const netToSettle = selectedTable.outstanding_balance;
    const finalMethod = paymentMethod;

    if (!withDebt && netToSettle > 0) {
      if (!window.confirm(`La mesa tiene un saldo pendiente de $${netToSettle}. ¿Se registrará un cobro final por $${netToSettle} bajo el método "${finalMethod.toUpperCase()}" para saldar la cuenta por completo?`)) {
        return;
      }
    }

    try {
      // 1. Process Definitive Sale Checkout to Deduct inventory and record Cash Movement
      let finalPaymentsList = [...selectedTable.payments];
      let closedStatus: "cerrada" | "deuda" = "cerrada";

      if (!withDebt && netToSettle > 0) {
        // Create matching payment
        const finalPayRecord: TablePayment = {
          id: "pay_close_" + Math.random().toString(36).slice(2, 9).toUpperCase(),
          amount: netToSettle,
          date: new Date().toISOString().split("T")[0],
          time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          operator: activeCajaSession?.operator || "Operador Cierre",
          method: finalMethod,
          notes: "Cobro de liquidación final al cerrar mesa."
        };
        finalPaymentsList.push(finalPayRecord);
      } else if (withDebt) {
        closedStatus = "deuda";
      }

      const verifiedTotalPaid = finalPaymentsList.reduce((acc, p) => acc + p.amount, 0);

      // Call API Sale Transaction:
      // It performs a secure Firebase Transaction: Deducts ingredients/recipes from stock, and creates standard SaleTransaction
      const saleSuccess = await onAddSale({
        items: selectedTable.items,
        method: finalMethod,
        origin: "mesa",
        table_number: selectedTable.name,
        notes: `Cerrado de Mesa: ${selectedTable.name}. Cliente: ${selectedTable.client_name}.` + (withDebt ? " Cuenta Corriente con Deuda." : ""),
        caja_session_id: activeCajaSession?.id || null,
        customer_id: selectedTable.client_id || null,
        customer_name: selectedTable.client_name || null,
        is_debt: withDebt,
        debt_amount: withDebt ? netToSettle : 0
      });

      if (!saleSuccess) {
        throw new Error("No se pudo completar la transacción definitiva de venta debido a stock insuficiente o error del servidor.");
      }

      // 2. Persist closure state of Table Session
      const updateData = {
        payments: finalPaymentsList,
        total_paid: Number(verifiedTotalPaid.toFixed(2)),
        outstanding_balance: withDebt ? selectedTable.outstanding_balance : 0,
        status: closedStatus,
        fecha_cierre: new Date().toISOString()
      };

      await onEditTable(selectedTable.id, updateData);
      
      setSelectedTable(null);
      alert(`Mesa "${selectedTable.name}" sellada y cerrada exitosamente.${withDebt ? ` Se cargó una deuda de $${netToSettle} en la cuenta corriente de ${selectedTable.client_name}.` : " Cuenta completamente saldada."}`);
    } catch (err: any) {
      alert("Error procesando cierre de mesa: " + err.message);
    }
  };

  const handleDeleteMesaComanda = async (tableId: string) => {
    if (!window.confirm("¿Estás absolutamente seguro de que deseas eliminar y anular el estado de esta mesa? No se deducirá ningún ingrediente de stock y se cancelarán los abonos.")) {
      return;
    }
    try {
      if (onDeleteTable) {
        await onDeleteTable(tableId);
        setSelectedTable(null);
        alert("Estructura de la mesa eliminada con éxito.");
      }
    } catch (err: any) {
      alert("Error eliminando mesa: " + err.message);
    }
  };

  // ---------------------------------------------------------
  // QUICK COUNTER / MOSTRADOR LOGIC
  // ---------------------------------------------------------
  // Helper to check if a product (or recipe) can be sold
  const getProductAvailability = (item: StockItem) => {
    if (!item.is_recipe) {
      return item.quantity;
    }
    
    if (!item.components || item.components.length === 0) {
      return item.quantity;
    }

    // For recipes, availability is limited by the component with least available portions
    let maxPortions = Infinity;
    item.components.forEach(comp => {
      const ingredient = stock.find(s => s.id === comp.stock_item_id);
      if (ingredient) {
        const availablePortions = Math.floor(ingredient.quantity / comp.quantity);
        maxPortions = Math.min(maxPortions, availablePortions);
      } else {
        maxPortions = 0;
      }
    });
    
    return maxPortions === Infinity ? 0 : maxPortions;
  };

  const handleAddToCart = (item: StockItem) => {
    const availableQty = getProductAvailability(item);
    if (availableQty <= 0) {
      if (!window.confirm(`⚠️ Atención: El producto "${item.name}" figura como AGOTADO en sistema. ¿Proceder con el cobro de todas formas?`)) {
        return;
      }
    }

    setCart((prev) => {
      const idx = prev.findIndex((i) => i.stock_item_id === item.id);
      if (idx !== -1) {
        const updated = [...prev];
        const existingItem = updated[idx];
        const nextQty = existingItem.quantity + 1;
        updated[idx] = {
          ...existingItem,
          quantity: nextQty,
          total: Number((nextQty * existingItem.price).toFixed(2))
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            stock_item_id: item.id,
            name: item.name,
            quantity: 1,
            price: item.selling_price,
            total: item.selling_price
          }
        ];
      }
    });
  };

  const handleUpdateQtyInCart = (stock_item_id: string, qty: number) => {
    setCart((prev) => {
      const updated = prev.map((i) => {
        if (i.stock_item_id === stock_item_id) {
          const newQty = Math.max(1, i.quantity + qty);
          return {
            ...i,
            quantity: newQty,
            total: Number((newQty * i.price).toFixed(2))
          };
        }
        return i;
      });
      return updated;
    });
  };

  const handleRemoveFromCart = (stock_item_id: string) => {
    setCart((prev) => prev.filter((i) => i.stock_item_id !== stock_item_id));
  };

  const cartTotalSum = cart.reduce((sum, item) => sum + item.total, 0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!activeCajaSession) {
      alert("No se puede registrar movimientos porque la caja diaria está cerrada.");
      return;
    }

    setIsSubmitting(true);
    const originToUse = activeTab === "consumo" ? "consumo_interno" : "terminal";
    const methodToUse = activeTab === "consumo" ? "efectivo" : paymentMethod;
    const notesToUse = notes || (activeTab === "consumo" ? "Consumo interno" : "Venta directa de buffet/mostrador.");

    try {
      const saleDate = activeCajaSession ? parseCustomDateToIso(activeCajaSession.dateStr) : undefined;
      
      const success = await onAddSale({
        items: cart,
        method: methodToUse as any,
        origin: originToUse as any,
        table_number: "Mostrador",
        notes: notesToUse,
        caja_session_id: activeCajaSession.id,
        date: saleDate,
        customer_id: counterCustomerId || null,
        customer_name: counterCustomerObj ? counterCustomerObj.fullName : "Consumidor Final"
      });

      if (success) {
        setCheckoutSuccess(true);
        setCart([]);
        setNotes("");
        if (activeTab !== "consumo") {
           setCounterCustomerId("");
        }
        setTimeout(() => setCheckoutSuccess(false), 4000);
      }
    } catch (err: any) {
      alert(err.message || "Error al registrar la venta de mostrador.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBarcodeSimulate = () => {
    if (stock.length > 0) {
      const index = Math.floor(Math.random() * stock.length);
      const randomItem = stock[index];
      handleAddToCart(randomItem);
    }
  };

  // ---------------------------------------------------------
  // HISTORIAL LOGIC (Sync with Caja Sessions)
  // ---------------------------------------------------------
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<string>("active");
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
  const [historyMethodFilter, setHistoryMethodFilter] = useState<string>("TODOS");
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [confirmDeleteSaleId, setConfirmDeleteSaleId] = useState<string | null>(null);

  const sessionsList = useMemo(() => {
    const list = [];
    if (activeCajaSession) {
      list.push({
        id: "active",
        sessionId: activeCajaSession.id,
        label: `🟢 Caja Abierta Actual (Iniciada: ${activeCajaSession.dateStr})`,
        dateStr: activeCajaSession.dateStr
      });
    }
    closedHistory.forEach((h) => {
      list.push({
        id: h.id,
        sessionId: h.id,
        label: `🔴 Caja Cerrada (${h.dateStr})`,
        dateStr: h.dateStr
      });
    });
    return list;
  }, [activeCajaSession, closedHistory]);

  useEffect(() => {
    if (sessionsList.length > 0 && selectedSessionFilter === "active" && !activeCajaSession) {
      setSelectedSessionFilter(sessionsList[0].id);
    }
  }, [sessionsList, activeCajaSession, selectedSessionFilter]);

  const filteredSalesForSession = useMemo(() => {
    const selectedSession = sessionsList.find(s => s.id === selectedSessionFilter);
    if (!selectedSession) return [];

    return sales.filter((sale) => {
      if (sale.caja_session_id && sale.caja_session_id === selectedSession.sessionId) {
        return true;
      }
      if (!sale.caja_session_id) {
        try {
          const fileDate = new Date(sale.date).toISOString().split("T")[0];
          const filterDateRaw = selectedSession.dateStr;
          let parsedFilterDate = filterDateRaw;
          if (filterDateRaw.includes("/")) {
            const parts = filterDateRaw.split("/");
            if (parts.length === 3) {
              parsedFilterDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }
          return fileDate === parsedFilterDate;
        } catch {
          return false;
        }
      }
      return false;
    });
  }, [sales, selectedSessionFilter, sessionsList]);

  const finalFilteredSales = useMemo(() => {
    return filteredSalesForSession.filter((s) => {
      const matchMethod = historyMethodFilter === "TODOS" || s.method === historyMethodFilter;
      const matchSearch = s.table_number?.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                          s.id.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                          (s.notes && s.notes.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                          (s.customer_name && s.customer_name.toLowerCase().includes(historySearchQuery.toLowerCase()));
      return matchMethod && matchSearch;
    });
  }, [filteredSalesForSession, historyMethodFilter, historySearchQuery]);

  const totalFilteredSalesRevenue = useMemo(() => {
    return finalFilteredSales.reduce((acc, s) => acc + s.total, 0);
  }, [finalFilteredSales]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  // ---------------------------------------------------------
  // INLINE CUSTOMER SEARCH HELPERS
  // ---------------------------------------------------------
  const filteredCustomers = useMemo(() => {
    if (!searchCustomer.trim()) return customers.slice(0, 5);
    return customers.filter(c => 
      c.fullName.toLowerCase().includes(searchCustomer.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchCustomer.toLowerCase())
    ).slice(0, 5);
  }, [customers, searchCustomer]);

  return (
    <div className="space-y-6">
      
      {/* Caja Imputation Warning Banner */}
      {activeCajaSession ? (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-3xs" id="active-caja-banner">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-600 text-white rounded-xl flex-shrink-0 animate-pulse mt-0.5 sm:mt-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-amber-800 font-extrabold tracking-widest uppercase">
                Imputación de Ventas Activa
              </p>
              <p className="text-sm text-slate-700 mt-0.5">
                Las transacciones registradas actualmente se imputarán automáticamente a la caja abierta del día <strong className="font-extrabold text-slate-900 underline decoration-amber-500 decoration-2">{activeCajaSession.dateStr}</strong> (Iniciada por: <span className="font-extrabold text-slate-800">{activeCajaSession.operator || "Sistema"}</span>).
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-250 uppercase tracking-widest self-start sm:self-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Caja Abierta
          </span>
        </div>
      ) : (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-3xs" id="closed-caja-banner">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl flex-shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-rose-800 font-extrabold tracking-widest uppercase">
                Caja Diaria Cerrada
              </p>
              <p className="text-sm text-slate-700 mt-0.5">
                La caja diaria está cerrada. Debe abrir una sesión en Caja Diaria para poder registrar ventas y comandas correctamente.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-250 uppercase tracking-widest self-start sm:self-center">
            <Lock className="w-3.5 h-3.5" />
            Cerrado
          </span>
        </div>
      )}

      {/* 1. Header Navigation and Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs" id="tpv_navigator_tabs">
        <div className="flex flex-col space-y-1">
          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-150 uppercase tracking-wider w-fit">
            Módulo Ventas & TPV V2
          </span>
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-1.5">
            <ShoppingCart className="w-5 h-5 text-indigo-700" /> Facturación y Comandas
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Triple sub-menu navigation with standard bordered layout */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border">
            <button
              onClick={() => { setActiveTab("mesas"); setSelectedTable(null); }}
              className={`flex items-center gap-1.5 py-2 px-4 rounded-lg text-xs font-black transition cursor-pointer select-none border-0 ${
                activeTab === "mesas"
                  ? "bg-slate-900 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 font-extrabold hover:bg-slate-200"
              }`}
            >
              <Layout className="w-4.5 h-4.5" />
              Salón de Mesas
            </button>

            <button
              onClick={() => { setActiveTab("mostrador"); setSelectedTable(null); }}
              className={`flex items-center gap-1.5 py-2 px-4 rounded-lg text-xs font-black transition cursor-pointer select-none border-0 ${
                activeTab === "mostrador"
                  ? "bg-slate-900 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 font-extrabold hover:bg-slate-200"
              }`}
            >
              <Coffee className="w-4.5 h-4.5" />
              Ventas Rápidas
            </button>

            <button
              onClick={() => { setActiveTab("consumo"); setSelectedTable(null); cart.length > 0 && setCart([]); }}
              className={`flex items-center gap-1.5 py-2 px-4 rounded-lg text-xs font-black transition cursor-pointer select-none border-0 ${
                activeTab === "consumo"
                  ? "bg-rose-900 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 font-extrabold hover:bg-slate-200"
              }`}
              title="Registrar consumo interno del personal u otros egresos de stock"
            >
              <Coffee className="w-4.5 h-4.5" />
              Consumo Interno
            </button>

            <button
              onClick={() => { setActiveTab("history"); setSelectedTable(null); }}
              className={`flex items-center gap-1.5 py-2 px-4 rounded-lg text-xs font-black transition cursor-pointer select-none border-0 ${
                activeTab === "history"
                  ? "bg-slate-900 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 font-extrabold hover:bg-slate-200"
              }`}
            >
              <History className="w-4.5 h-4.5" />
              Historial de Ventas
            </button>
          </div>

          <button
            onClick={() => setIsManageMethodsModal(true)}
            className="flex items-center gap-1.5 py-2 px-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-black text-slate-800 text-xs shadow-3xs cursor-pointer transition"
            title="Gestionar Métodos de Pago"
          >
            <Settings className="w-4 h-4 text-slate-505" />
            <span>Métodos de Pago</span>
          </button>
        </div>
      </div>

      {/* 2. Error Guard if Daily Shift box is CLOSED */}
      {activeCajaSession === null && activeTab !== "history" ? (
        <div className="bg-white p-12 rounded-2xl border text-center space-y-4 max-w-xl mx-auto shadow-sm" id="caja_session_lock_guard">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-full border border-amber-200 w-fit mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">Ventas del Buffet Inhabilitadas</h3>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Para registrar consumos o abrir comandas de mesas en el salón, primero se debe registrar la apertura de una hoja de control en el módulo de <strong>Caja Diaria</strong>.
          </p>
          {onNavigateToTab && (
            <div className="pt-2">
              <button
                onClick={() => onNavigateToTab("cash")}
                className="bg-slate-900 border-0 hover:bg-slate-800 text-white font-black text-xs py-2.5 px-6 rounded-xl transition cursor-pointer shadow-4xs"
              >
                Ir a Caja Diaria V2
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* A. VIEW: GESTIÓN DE MESAS (SALÓN) */}
          {activeTab === "mesas" && (
            <div className="space-y-4">
              
              {/* Table details editor view (if select a card) */}
              {selectedTable ? (
                <div className="space-y-4 animate-scale-up" id="active_mesa_editor_panel">
                  
                  {/* Table details Banner */}
                  <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm border border-slate-850">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedTable(null)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer border-0 transition"
                        title="Volver al Salón"
                      >
                        <ArrowLeft className="w-4.5 h-4.5" />
                      </button>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-black tracking-tight">{selectedTable.name}</h3>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border uppercase ${
                            selectedTable.status === "abierta" 
                              ? "bg-blue-500/20 text-blue-300 border-blue-400/30" 
                              : "bg-red-500/20 text-red-300 border-red-400/30"
                          }`}>
                            {selectedTable.status === "abierta" ? "● Abierta" : "● Cuentas Pendientes (Deuda)"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-semibold">
                          Cliente: <strong className="text-white">{selectedTable.client_name}</strong> • Abierta: {formatDate(selectedTable.fecha_apertura)} • Operador: {selectedTable.operator}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteMesaComanda(selectedTable.id)}
                        className="py-2.5 px-3 bg-red-650 hover:bg-red-700 text-white border-0 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" /> Anular Mesa
                      </button>
                      <button
                        onClick={() => setSelectedTable(null)}
                        className="py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-white border-0 rounded-xl text-xs font-bold cursor-pointer transition"
                      >
                        Volver al Salón
                      </button>
                    </div>
                  </div>

                  {/* Progressive orders screen divider: Catalog on Left, Table Comanda on Right */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* LEFT SIDE: Bar Catalogue */}
                    <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-150 shadow-3xs space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider block">Bebidas y Platos del Buffet</h4>
                        {isComandaDirty && (
                          <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 py-0.5 px-2 rounded-full font-bold animate-pulse">
                            ⚠️ Comanda sin guardar
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar bebida, ración, empanada..."
                            className="w-full pl-9 pr-4 py-2 border border-slate-205 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden bg-slate-50/50"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                        </div>
                        <button
                          onClick={() => {
                            if (stock.length > 0) {
                              const randomItem = stock[Math.floor(Math.random() * stock.length)];
                              handleAddItemToMesaComanda(randomItem);
                            }
                          }}
                          className="py-2 px-3 border border-slate-150 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-black rounded-xl flex items-center gap-1 transition cursor-pointer"
                        >
                          <Barcode className="w-4 h-4" /> Simulador Botella
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 pb-3">
                        <button
                          onClick={() => setSelectedCategory("ALL")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border-0 ${
                            selectedCategory === "ALL" 
                              ? "bg-slate-900 text-white" 
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          Todos
                        </button>
                        {allCategories.map((c) => (
                          <button
                            key={c}
                            onClick={() => setSelectedCategory(c)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border-0 ${
                              selectedCategory === c 
                                ? "bg-slate-900 text-white" 
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1">
                        {availableItems.map((item) => {
                            const availableQty = getProductAvailability(item);
                            const isOutOfStock = availableQty <= 0;
                            return (
                              <div
                                key={item.id}
                                onClick={() => handleAddItemToMesaComanda(item)}
                                className="p-3 bg-slate-50/70 border border-slate-150 hover:border-emerald-500 hover:bg-white rounded-xl transition cursor-pointer flex flex-col justify-between h-24 relative"
                              >
                                <div>
                                  <span className="text-[8px] font-bold text-slate-400 font-mono tracking-tight block">
                                    {item.sku || "BUFF-PRO"}
                                  </span>
                                  <h4 className="text-xs font-extrabold text-slate-800 truncate mt-0.5">
                                    {item.name}
                                  </h4>
                                </div>
                                <div className="flex items-end justify-between mt-2">
                                  <span className="font-mono text-xs font-bold text-slate-900">${item.selling_price.toFixed(2)}</span>
                                  {isOutOfStock ? (
                                    <span className="text-[8px] bg-amber-50 text-amber-700 leading-none py-1 px-1.5 rounded font-black uppercase">Sin Stock</span>
                                  ) : (
                                    <span className="text-[9px] text-slate-450 font-bold">{availableQty} un.</span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        }
                      </div>
                    </div>

                    {/* RIGHT SIDE: Table active comanda orders list and totals */}
                    <div className="lg:col-span-5 space-y-4">
                      
                      {/* Progressive Cart details */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider block border-b pb-2">Comanda de Consumos Activos</h4>
                        
                        {selectedTable.items.length === 0 ? (
                          <div className="text-center py-12 text-slate-400 text-xs font-semibold leading-relaxed">
                            <Coffee className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            Mesa vacía. Agrega productos del catálogo.
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-150 max-h-[220px] overflow-y-auto pr-1">
                            {selectedTable.items.map((cartItem) => (
                              <div key={cartItem.stock_item_id} className="py-2.5 flex items-center justify-between text-xs gap-2">
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-extrabold text-slate-800 truncate">{cartItem.name}</h5>
                                  <span className="text-[10px] text-slate-450 font-bold">${cartItem.price.toFixed(2)} c/u</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => handleUpdateQtyInMesaCart(cartItem.stock_item_id, -1)}
                                    className="w-5 h-5 bg-slate-100 hover:bg-slate-200 text-slate-700 border-0 rounded-sm flex items-center justify-center font-bold cursor-pointer"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="font-mono font-bold text-slate-800 w-6 text-center">{cartItem.quantity}</span>
                                  <button
                                    onClick={() => handleUpdateQtyInMesaCart(cartItem.stock_item_id, 1)}
                                    className="w-5 h-5 bg-slate-100 hover:bg-slate-200 text-slate-700 border-0 rounded-sm flex items-center justify-center font-bold cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveFromMesaCart(cartItem.stock_item_id)}
                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 border-0 rounded transition ml-1.5 cursor-pointer"
                                    title="Remover de comanda"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {isComandaDirty && (
                          <button
                            onClick={handleSaveProgressiveComanda}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer border-0 shadow-3xs flex items-center justify-center gap-1.5 sm:text-xs"
                          >
                            💾 Guardar Consumos en Mesa (Fijar sin cobrar)
                          </button>
                        )}
                      </div>

                      {/* Partial Payments / Abonos Audited Section */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider block">Auditoría de Abonos / Pagos</h4>
                          <span className="font-mono text-xs font-black text-[#15803d]">Abonado: ${selectedTable.total_paid.toFixed(2)}</span>
                        </div>

                        {selectedTable.payments.length === 0 ? (
                          <p className="text-[10px] text-slate-400 font-semibold italic">No se han registrado pagos parciales a cuenta todavía.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                            {selectedTable.payments.map((p, idx) => (
                              <div key={p.id || idx} className="bg-slate-50 p-2 rounded-lg text-[10px] border border-slate-150 flex items-center justify-between gap-2 hover:bg-slate-100 transition">
                                <div className="space-y-0.5 min-w-0 flex-1">
                                  <span className="font-bold text-slate-700 block truncate">Abono {p.method.toUpperCase()} - {p.date} a las {p.time}</span>
                                  <span className="text-slate-400 font-semibold italic block truncate">Registrado por: {p.operator} • "{p.notes}"</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="font-mono font-black text-slate-900 border bg-white px-1.5 py-0.5 rounded shadow-3xs">${p.amount.toFixed(2)}</span>
                                  <button
                                    onClick={() => handleStartEditPayment(p)}
                                    className="p-1 text-indigo-650 hover:bg-indigo-50 border-0 rounded transition cursor-pointer"
                                    title="Editar Abono"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePayment(p.id)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 border-0 rounded transition cursor-pointer"
                                    title="Eliminar Abono"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={handleAddPartialPaymentClick}
                          className="w-full py-2 bg-slate-100 hover:bg-slate-200 border-0 text-[#091426] text-xs font-black rounded-lg cursor-pointer transition select-none tracking-tight flex items-center justify-center gap-1"
                        >
                          <PlusCircle className="w-4 h-4 text-slate-600" /> + Registrar Abono a Cuenta (Pago Parcial)
                        </button>
                      </div>

                      {/* Definitive closure billing panel */}
                      <div className="bg-[#eff4ff]/60 p-5 rounded-2xl border border-[#eff4ff] shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b pb-2.5 border-[#eff4ff]">
                          <span className="text-xs font-black text-indigo-700 uppercase tracking-widest block">Resumen de Cuenta</span>
                          <span className="text-xs font-mono font-extrabold text-[#091426]">Consumo Total: ${selectedTable.total_consumed.toFixed(2)}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-500">Saldo Pendiente a Liquidar:</span>
                          <span className="font-mono text-2xl font-black text-indigo-950">${selectedTable.outstanding_balance.toFixed(2)}</span>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Método de cobro final si salda ahora:</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as any)}
                            className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden font-bold text-slate-800"
                          >
                            {paymentMethods.map(m => (
                              <option key={m} value={m}>
                                {m === "efectivo" ? "💵 Efectivo" : m === "tarjeta" ? "💳 Tarjeta Banco" : m === "bizum" ? "📱 Bizum Móvil" : `🔹 ${m.toUpperCase()}`}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                          <button
                            onClick={() => handleFinalSettleAndCloseTable(false)}
                            className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition border-0 cursor-pointer shadow-3xs"
                          >
                            🎉 Saldar y Cerrar Mesa
                          </button>
                          
                          <button
                            onClick={() => handleFinalSettleAndCloseTable(true)}
                            disabled={!selectedTable.client_id || selectedTable.client_name === "Consumidor Final"}
                            className="py-3 bg-indigo-950 text-white hover:bg-indigo-900 border-0 font-black text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer shadow-3xs"
                            title={(!selectedTable.client_id || selectedTable.client_name === "Consumidor Final") ? "Asigna un cliente nominal para guardar en su cuenta corriente/deuda" : ""}
                          >
                            📈 Cargar Deuda a Fiado
                          </button>
                        </div>
                      </div>

                    </div>

                  </div>

                </div>
              ) : (
                /* Salon Dashboard: Tables grid and views */
                <div className="space-y-4">
                  
                  {/* Filter Sub-Bar */}
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setMesasFilter("abiertas")}
                        className={`py-1.5 px-3.5 rounded-lg text-xs font-bold border-0 cursor-pointer transition select-none ${
                          mesasFilter === "abiertas" 
                            ? "bg-slate-900 text-white shadow-2xs" 
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Mesas Abiertas (Buffet Activo)
                      </button>
                      
                      <button
                        onClick={() => setMesasFilter("cerradas")}
                        className={`py-1.5 px-3.5 rounded-lg text-xs font-bold border-0 cursor-pointer transition select-none ${
                          mesasFilter === "cerradas" 
                            ? "bg-slate-900 text-white shadow-2xs" 
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Mesas Cerradas (Auditoría Histórica)
                      </button>

                      <button
                        onClick={() => setMesasFilter("todas")}
                        className={`py-1.5 px-3.5 rounded-lg text-xs font-bold border-0 cursor-pointer transition select-none ${
                          mesasFilter === "todas" 
                            ? "bg-slate-900 text-white shadow-2xs" 
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Ver Todas
                      </button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-60">
                        <input
                          type="text"
                          value={searchMesaQuery}
                          onChange={(e) => setSearchMesaQuery(e.target.value)}
                          placeholder="Buscar mesa o cliente..."
                          className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-hidden"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      </div>
                      <button
                        onClick={handleOpenCustomTableBtn}
                        className="py-1.5 px-3 bg-indigo-600 text-white rounded-lg text-xs font-black cursor-pointer border-0 hover:bg-indigo-700 transition shrink-0 flex items-center gap-1 shadow-4xs"
                      >
                        + Abrir Mesa
                      </button>
                    </div>
                  </div>

                  {/* Tables grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredTables.length === 0 ? (
                      <div className="col-span-full bg-white dark:bg-slate-900 border border-slate-150 rounded-2xl py-14 text-center text-slate-500 space-y-2">
                        <Coffee className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-extrabold text-slate-700">No hay comandas registradas en esta vista.</p>
                        <p className="text-[10px] text-slate-450 font-bold">Crea una nueva mesa comanda desde el botón "+ Abrir Mesa".</p>
                      </div>
                    ) : (
                      filteredTables.map((table) => {
                        return (
                          <div
                            key={table.id}
                            onClick={() => handleSelectTableCard(table)}
                            className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-4 hover:shadow-2xs select-none bg-white relative overflow-hidden ${
                              table.status === "abierta" 
                                ? "border-blue-200 hover:border-blue-400" 
                                : table.status === "deuda"
                                ? "border-red-200 hover:border-red-400"
                                : table.status === "cerrada"
                                ? "border-slate-200 hover:border-slate-400 bg-slate-50/50"
                                : "border-slate-200 hover:border-emerald-400" // libre
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="text-sm font-black text-slate-800 tracking-tight">{table.name}</h4>
                                <span className={`text-[8px] font-black leading-none py-1 px-1.5 rounded-full border uppercase ${
                                  table.status === "abierta" 
                                    ? "bg-blue-50 text-blue-700 border-blue-200" 
                                    : table.status === "deuda"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : table.status === "cerrada"
                                    ? "bg-slate-100 text-slate-755 border-slate-300"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}>
                                  {table.status === "abierta" ? "Abierta" : table.status === "deuda" ? "Adeuda" : table.status === "cerrada" ? "Cerrada" : "Libre"}
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" /> {table.client_name}
                              </p>
                            </div>

                            {table.status === "abierta" || table.status === "deuda" || table.status === "cerrada" ? (
                              <div className="space-y-2 border-t pt-2.5 border-slate-100">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                  <span>Consumido:</span>
                                  <span className="font-mono text-slate-700">${table.total_consumed.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                  <span>Pagado:</span>
                                  <span className="font-mono text-emerald-700">${table.total_paid.toFixed(2)}</span>
                                </div>
                                {table.outstanding_balance > 0 && (
                                  <div className="flex items-center justify-between text-[10px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                    <span>Saldo pendiente:</span>
                                    <span className="font-mono">${table.outstanding_balance.toFixed(2)}</span>
                                  </div>
                                )}
                                
                                {table.status === "cerrada" && (
                                  <div className="text-[8px] text-slate-400 font-bold pt-1 border-t border-dashed border-slate-200 flex justify-between">
                                    <span>Completado</span>
                                    <span>{formatDate(table.fecha_cierre || table.fecha_apertura)}</span>
                                  </div>
                                )}

                                {table.status !== "cerrada" && (
                                  <div className="text-[8px] text-slate-400 font-bold pt-1 border-t border-dashed border-slate-200 flex justify-between">
                                    <span>Apertura:</span>
                                    <span>{formatDate(table.fecha_apertura).split(",")[1]?.trim() || "N/D"}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 font-medium italic pt-2 border-t border-dashed border-slate-200">
                                Disponible • Haz clic para abrir comanda
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                </div>
              )}

            </div>
          )}

          {/* B. VIEW: VENTAS DIRECTAS DE MOSTRADOR / CONSUMO INTERNO */}
          {(activeTab === "mostrador" || activeTab === "consumo") && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-scale-up" id="tpv_quick_mostrador_view">
              
              {/* Left Column: Product Selection Grid */}
              <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-150 shadow-3xs space-y-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar bebida, bocadillo, refresco..."
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden bg-slate-50/50"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  </div>
                  <button
                    onClick={onTriggerAIScanTab}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-xs border-0 cursor-pointer"
                    title="Escanear tique o foto con IA"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">Escanear Tique IA</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 pb-3">
                  <button
                    onClick={() => setSelectedCategory("ALL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border-0 ${
                      selectedCategory === "ALL" 
                        ? "bg-[#091426] text-white" 
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Todos
                  </button>
                  {allCategories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedCategory(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border-0 ${
                        selectedCategory === c 
                          ? "bg-[#091426] text-white animate-scale-up" 
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[440px] overflow-y-auto pr-1">
                  {availableItems.length === 0 ? (
                    <p className="text-xs text-center py-12 text-slate-400 font-semibold col-span-3 font-mono">No hay productos disponibles.</p>
                  ) : (
                    availableItems.map((item) => {
                      const availableQty = getProductAvailability(item);
                      const isOutOfStock = availableQty <= 0;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleAddToCart(item)}
                          className="p-3 bg-slate-50/50 border border-slate-150 hover:border-emerald-500 hover:bg-white rounded-xl transition cursor-pointer flex flex-col justify-between h-28 relative group"
                        >
                          <div>
                            <span className="text-[8px] font-bold text-slate-400 font-mono block">
                              {item.sku || "TPV-PRO"}
                            </span>
                            <h4 className="text-xs font-black text-slate-805 truncate mt-1 group-hover:text-amber-700" title={item.name}>
                              {item.name}
                            </h4>
                          </div>

                          <div className="flex items-end justify-between mt-3">
                            <span className="font-mono text-sm font-bold text-slate-900">${item.selling_price.toFixed(2)}</span>
                            {isOutOfStock ? (
                              <span className="text-[8px] bg-red-150 text-red-800 leading-none py-1 px-1.5 rounded-md font-bold uppercase border-0">Agotado</span>
                            ) : (
                              <span className="text-[9px] text-slate-400 font-bold">{availableQty} un.</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: checkout order items details */}
              <div className="lg:col-span-5 flex flex-col space-y-4">
                
                <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-md space-y-4">
                  
                  <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingCart className="w-4.5 h-4.5 text-slate-800" />
                      {activeTab === "consumo" ? "Registro de Consumo Interno" : "Comanda Mostrador (Venta Directa)"}
                    </h3>
                    <span className={`text-[10px] py-0.5 px-2 rounded-full font-bold uppercase border ${
                      activeTab === "consumo" ? "bg-rose-50 text-rose-800 border-rose-150" : "bg-emerald-50 text-emerald-800 border-emerald-150"
                    }`}>
                      {activeTab === "consumo" ? "Modo Consumo ✔" : "Mostrador Activo ✔"}
                    </span>
                  </div>

                  {checkoutSuccess && (
                    <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2 animate-scale-up border border-emerald-200">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>¡Cobro registrado! Los productos de mostrador se descontaron del inventario.</span>
                    </div>
                  )}

                  {cart.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 text-xs font-semibold leading-relaxed space-y-2">
                      <p>La banda de cobro está vacía.</p>
                      <p className="text-[10px] text-slate-450 font-bold">Selecciona productos de la cuadrícula para iniciar el checkout rápido.</p>
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-1">
                        {cart.map((cartItem) => (
                          <div key={cartItem.stock_item_id} className="py-2 flex items-center justify-between text-xs gap-2">
                            <div className="flex-1 min-w-0">
                              <h5 className="font-extrabold text-slate-800 truncate">{cartItem.name}</h5>
                              <span className="text-[10px] text-slate-400 font-bold">${cartItem.price.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleUpdateQtyInCart(cartItem.stock_item_id, -1)}
                                className="w-5 h-5 bg-slate-100 hover:bg-slate-200 text-slate-700 border-0 rounded flex items-center justify-center font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-mono font-bold w-6 text-center">{cartItem.quantity}</span>
                              <button
                                onClick={() => handleUpdateQtyInCart(cartItem.stock_item_id, 1)}
                                className="w-5 h-5 bg-slate-100 hover:bg-slate-200 text-slate-700 border-0 rounded flex items-center justify-center font-bold cursor-pointer"
                              >
                                +
                              </button>
                              <button
                                onClick={() => handleRemoveFromCart(cartItem.stock_item_id)}
                                className="p-1 text-slate-400 hover:text-red-500 rounded border-0 transition cursor-pointer"
                                title="Eliminar fila"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <form onSubmit={handleCheckoutSubmit} className="space-y-4 border-t pt-4 border-slate-100">
                        
                        {activeTab === "mostrador" && (
                          <div className="space-y-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-150">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Asociar Cliente CRM (Opcional):</label>
                            <select
                              value={counterCustomerId}
                              onChange={(e) => setCounterCustomerId(e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-bold text-slate-700"
                            >
                              <option value="">👤 Consumidor Final (Por defecto)</option>
                              {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.fullName} ({c.category})</option>
                              ))}
                            </select>
                            {counterCustomerObj && (
                              <div className="text-[9px] text-[#15803d] font-bold flex items-center gap-1">
                                <Award className="w-3 h-3 text-[#16a34a]" /> Recibirá {Math.round(cartTotalSum / 10)} puntos de fidelización en su cuenta.
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          {activeTab === "mostrador" ? (
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-[#51637c] uppercase tracking-wider block">MÉTODO DE COBRO</label>
                              <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden font-bold text-slate-800"
                              >
                                {paymentMethods.map(m => (
                                  <option key={m} value={m}>
                                    {m === "efectivo" ? "💵 Efectivo" : m === "tarjeta" ? "💳 Tarjeta Banco" : m === "bizum" ? "📱 Bizum Móvil" : `🔹 ${m.toUpperCase()}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="space-y-1 flex flex-col justify-center text-[10px] text-rose-700 font-bold bg-rose-50 rounded-lg px-3">
                              <span className="uppercase text-[9px] text-rose-500">MÉTODO DE PAGO</span>
                              <span>No Aplica (Consumo)</span>
                            </div>
                          )}

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-[#51637c] uppercase tracking-wider block">
                              {activeTab === "consumo" ? "Motivo / Comentarios" : "Anotación de Comanda"}
                            </label>
                            <input
                              type="text"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              required={activeTab === "consumo"}
                              placeholder={activeTab === "consumo" ? "Ej. Brindis fin de año" : "Ej. Sin hielo..."}
                              className="w-full px-2.5 py-1.5 border border-slate-210 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 bg-white"
                            />
                          </div>
                        </div>

                        <div className={`p-4 rounded-xl flex items-center justify-between text-xs border ${
                          activeTab === "consumo" ? "bg-rose-50/60 border-rose-100" : "bg-[#eff4ff]/60 border-[#eff4ff]"
                        }`}>
                          <span className="font-extrabold text-slate-500">
                            {activeTab === "consumo" ? "Monto Total Consumido :" : "Monto Neto a Cobrar :"}
                          </span>
                          <span className="font-mono text-xl font-black text-slate-900">${cartTotalSum.toFixed(2)}</span>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className={`w-full py-3.5 shadow-sm font-black text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition select-none border-0 ${
                            isSubmitting 
                              ? "bg-slate-300 text-slate-500" 
                              : activeTab === "consumo" 
                              ? "bg-rose-600 hover:bg-rose-700 text-white" 
                              : "bg-slate-900 hover:bg-slate-800 text-white"
                          }`}
                        >
                          {isSubmitting ? "PROCESANDO..." : `CONFIRMAR ${activeTab === "consumo" ? "CONSUMO INTERNO" : "VENTA RÁPIDA (Mostrador)"}`}
                        </button>
                      </form>
                    </>
                  )}

                </div>
              </div>

            </div>
          )}

          {/* C. VIEW: SALES HISTORY GROUPED BY CAJA SESSION */}
          {activeTab === "history" && (
            <div className="space-y-6 animate-scale-up animate-duration-150" id="sales_history_sub_layout">
              
              {/* Controls bar */}
              <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-3xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  
                  {/* Dynamic Cage Select filter box */}
                  <div className="flex flex-col space-y-1 min-w-[240px]">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Filtrar por Historial de Caja
                    </label>
                    
                    {sessionsList.length === 0 ? (
                      <div className="text-xs font-bold text-slate-450 py-2">
                        Sin cajas registradas. Abre una caja diaria.
                      </div>
                    ) : (
                      <select
                        value={selectedSessionFilter}
                        onChange={(e) => setSelectedSessionFilter(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-205 rounded-xl text-xs font-black text-slate-800 bg-white focus:outline-hidden cursor-pointer"
                      >
                        {sessionsList.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Text search */}
                  <div className="flex flex-col space-y-1 flex-1 min-w-[180px]">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Buscar ticket
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="ID, mesa, cliente, notas..."
                        value={historySearchQuery}
                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  {/* Method filtration dropdown */}
                  <div className="flex flex-col space-y-1 min-w-[125px]">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Método de pago
                    </label>
                    <select
                      value={historyMethodFilter}
                      onChange={(e) => setHistoryMethodFilter(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-205 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="TODOS">Todos</option>
                      {paymentMethods.map(m => (
                        <option key={m} value={m}>
                          {m === "efectivo" ? "💵 Efectivo" : m === "tarjeta" ? "💳 Tarjeta" : m === "bizum" ? "📱 Bizum" : `🔹 ${m.toUpperCase()}`}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>

                {/* Total balance of selected filtered card */}
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-right flex flex-col justify-center min-w-[170px] shrink-0">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-0.5">RECAUDACIÓN DE ESTA CAJA :</span>
                  <span className="text-lg font-black text-indigo-950 font-mono leading-none">${totalFilteredSalesRevenue.toFixed(2)}</span>
                  <span className="text-[9px] text-slate-401 font-bold mt-1">{finalFilteredSales.length} comandas en total</span>
                </div>

              </div>

              {/* List of transactions cards */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-100">
                  
                  {finalFilteredSales.length === 0 ? (
                    <div className="py-20 text-center space-y-2 text-slate-500">
                      <Receipt className="w-9 h-9 text-slate-350 mx-auto animate-pulse" />
                      <p className="text-xs font-black text-slate-705">No se encontraron ventas finalizadas para este turno de caja.</p>
                      <p className="text-[10px] text-indigo-805 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded w-fit mx-auto font-semibold">
                        Sella o cierra una comanda de Mesa o procesa una Venta Rápida para registrar movimientos.
                      </p>
                    </div>
                  ) : (
                    finalFilteredSales.map((sale) => {
                      const isExpanded = expandedSaleId === sale.id;
                      return (
                        <div key={sale.id} className="p-4 hover:bg-slate-50/50 transition">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[10px] uppercase font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150">
                                Ticket #{sale.id.slice(0, 6).toUpperCase()}
                              </span>
                              <span className="text-slate-450 font-extrabold flex items-center gap-1 whitespace-nowrap">
                                <Clock className="w-3.5 h-3.5 text-slate-400" /> {formatDate(sale.date)}
                              </span>
                              <span className="text-slate-700 font-extrabold bg-slate-100/80 border py-0.5 px-2 rounded-md">
                                {sale.table_number || "Mostrador"}
                              </span>
                              {sale.customer_name && (
                                <span className="font-semibold text-slate-500 hover:text-slate-900">
                                  👤 {sale.customer_name}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                sale.method === "efectivo" 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-150" 
                                  : sale.method === "tarjeta"
                                  ? "bg-blue-50 text-blue-700 border-blue-150"
                                  : sale.method === "consumo"
                                  ? "bg-rose-50 text-rose-700 border-rose-150"
                                  : "bg-indigo-50 text-indigo-700 border-indigo-150"
                              }`}>
                                {sale.method === "efectivo" ? "Efectivo" : sale.method === "tarjeta" ? "Tarjeta (Posnet)" : sale.method === "consumo" ? "Consumo Interno" : "Bizum Móvil"}
                              </span>
                              <span className="font-mono font-black text-slate-905 block text-sm">${sale.total.toFixed(2)}</span>
                              
                              {onDeleteSale && (
                                <div className="flex items-center gap-1.5 transition-all">
                                  {confirmDeleteSaleId === sale.id ? (
                                    <>
                                      <span className="text-[10px] text-rose-600 font-extrabold animate-pulse whitespace-nowrap bg-rose-50 px-1.5 py-0.5 rounded border border-rose-150">
                                        ¿Eliminar venta?
                                      </span>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            await fetch("/api/dev-logs", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ log: `[FRONTEND-1] ID exacto de la venta seleccionada: ${sale.id}` })
                                            }).catch(() => {});
                                            await fetch("/api/dev-logs", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ log: `[FRONTEND-2] Confirmado clic de eliminación en el frontend` })
                                            }).catch(() => {});
                                          } catch (err) {}
                                          await onDeleteSale(sale.id);
                                          setConfirmDeleteSaleId(null);
                                        }}
                                        className="p-1 text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                                        title="Confirmar eliminación"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteSaleId(null);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 cursor-pointer"
                                        title="Cancelar"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteSaleId(sale.id);
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 bg-slate-100 rounded hover:bg-rose-50 border-0 cursor-pointer"
                                      title="Eliminar venta"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              )}

                              <button
                                onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                                className="p-1 text-slate-505 hover:text-slate-805 bg-slate-100 rounded hover:bg-slate-205 border-0 cursor-pointer"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3.5 p-4 bg-slate-50/50 rounded-xl border border-slate-150 space-y-3 font-medium text-slate-650 text-xs animate-scale-up">
                              <div className="space-y-1">
                                <span className="text-[9px] font-extrabold text-slate-450 uppercase block tracking-wider">Productos de la Orden</span>
                                <div className="divide-y divide-slate-150 border-t border-b border-slate-150">
                                  {sale.items.map((i, idx) => (
                                    <div key={idx} className="py-1.5 flex justify-between">
                                      <span>{i.name} <strong>x{i.quantity}</strong></span>
                                      <span className="font-mono text-slate-800">${(i.total || (i.price * i.quantity)).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {sale.notes && (
                                <p className="text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-150 italic font-semibold">
                                  Anotaciones: "{sale.notes}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* ========================================================== */}
      {/* 4. MODALS PREVIEW FOR OPENINGS AND CREATIONS */}
      {/* ========================================================== */}
      
      {/* Modal: Apertura de Mesa */}
      {isOpeningTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in" id="open_table_session_dialog">
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 space-y-4 animate-scale-up">
            
            <button
              onClick={() => setIsOpeningTableModal(false)}
              className="absolute text-slate-400 hover:text-slate-600 top-4 right-4 bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b pb-3">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">Apertura de Comanda: {newTableForm.name}</h3>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Turno de Operador Activo</p>
              </div>
            </div>

            <form onSubmit={handleOpenTableFormSubmit} className="space-y-4">
              
              {/* Cliente nominal select OR inline create */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cliente de la Mesa</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewCustomerModal(true);
                      setNewCustomerForm({
                        fullName: "",
                        phone: "",
                        email: "",
                        category: "Regular",
                        internalNotes: "" // Registrada en blanco! Let's strictly keep preferences/internalNotes blank as requested!
                      });
                    }}
                    className="text-[10px] text-indigo-600 font-black hover:underline hover:text-indigo-800 bg-transparent border-0 cursor-pointer"
                  >
                    + Nuevo Cliente CRM
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="🔍 Filtrar o buscar clientes por nombre o celular..."
                    value={searchCustomer}
                    onChange={(e) => setSearchCustomer(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-205 rounded-xl text-xs font-bold text-slate-700"
                  />
                  
                  {/* Results preview */}
                  <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50/50">
                    <div
                      onClick={() => setNewTableForm(prev => ({ ...prev, clientId: "" }))}
                      className={`p-2 text-xs flex items-center justify-between cursor-pointer select-none font-bold ${
                        newTableForm.clientId === "" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span>👤 Consumidor Final (Ocasional)</span>
                      {newTableForm.clientId === "" && <Check className="w-3.5 h-3.5" />}
                    </div>
                    {filteredCustomers.map(cust => (
                      <div
                        key={cust.id}
                        onClick={() => setNewTableForm(prev => ({ ...prev, clientId: cust.id }))}
                        className={`p-2 text-xs flex items-center justify-between cursor-pointer select-none font-bold ${
                          newTableForm.clientId === cust.id ? "bg-indigo-50 text-indigo-700 animate-pulse" : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{cust.fullName}</span>
                          <span className="text-[9px] text-slate-450 font-medium">Categoría: {cust.category} • Cel: {cust.phone || "No registra"}</span>
                        </div>
                        {newTableForm.clientId === cust.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                    ))}
                  </div>

                </div>

              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition border-0 cursor-pointer shadow-3xs text-center"
                >
                  ABRIR HOJA DE CONSUMO EN SALÓN
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal: Nueva Mesa con Nombre Personalizado */}
      {customTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in" id="custom_mesa_creator_dialog">
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 space-y-4 animate-scale-up">
            
            <button
              onClick={() => setCustomTableModal(false)}
              className="absolute text-slate-400 hover:text-slate-500 top-4 right-4 bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b pb-3">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-805">Abrir Nueva Mesa Personalizada</h3>
                <p className="text-[10px] text-slate-401 font-semibold">Salón, Canchas VIP o Barra libre</p>
              </div>
            </div>

            <form onSubmit={handleOpenTableFormSubmit} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">ID o Nombre de la Mesa (Libre):</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Mesa VIP, Barra 2, Cumpleaños de Raúl, Box 1..."
                  value={newTableForm.name}
                  onChange={(e) => setNewTableForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-1.8 border border-slate-205 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
                />
              </div>

              {/* Cliente Nominal selection block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Asociar Cliente CRM</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewCustomerModal(true);
                      setNewCustomerForm({
                        fullName: "",
                        phone: "",
                        email: "",
                        category: "Regular",
                        internalNotes: "" // Registrada en blanco! Let's strictly keep preferences/internalNotes blank as requested!
                      });
                    }}
                    className="text-[10px] text-indigo-600 font-black hover:underline bg-transparent border-0 cursor-pointer"
                  >
                    + Nuevo Cliente
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="🔍 Filtrar o buscar clientes..."
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-205 rounded-xl text-xs font-bold text-slate-700"
                />
                
                <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50/50 max-h-36 overflow-y-auto">
                  <div
                    onClick={() => setNewTableForm(prev => ({ ...prev, clientId: "" }))}
                    className={`p-2 text-xs flex items-center justify-between cursor-pointer select-none font-bold ${
                      newTableForm.clientId === "" ? "bg-indigo-50 text-indigo-700 animate-pulse" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>👤 Consumidor Final (Ocasional)</span>
                    {newTableForm.clientId === "" && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  {filteredCustomers.map(cust => (
                    <div
                      key={cust.id}
                      onClick={() => setNewTableForm(prev => ({ ...prev, clientId: cust.id }))}
                      className={`p-2 text-xs flex items-center justify-between cursor-pointer select-none font-bold ${
                        newTableForm.clientId === cust.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{cust.fullName}</span>
                        <span className="text-[9px] text-slate-401 font-semibold">{cust.category} • Cel: {cust.phone || "No registra"}</span>
                      </div>
                      {newTableForm.clientId === cust.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition border-0 cursor-pointer shadow-3xs"
                >
                  Confirmar y Abrir Comanda
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal: Registrar Abono Parcial */}
      {isPartialPaymentModal && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in" id="mesa_abono_capture_dialog">
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 space-y-4 animate-scale-up">
            
            <button
              onClick={() => { setIsPartialPaymentModal(false); setEditingPayment(null); }}
              className="absolute text-slate-400 hover:text-slate-500 top-4 right-4 bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b pb-3">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-805">
                  {editingPayment ? "✏️ Modificar Abono" : "Abono a Cuenta"} en {selectedTable.name}
                </h3>
                <p className="text-[10px] text-slate-401 font-semibold">
                  Saldo Pendiente: ${selectedTable.outstanding_balance.toFixed(2)}
                </p>
              </div>
            </div>

            <form onSubmit={handlePartialPaymentSubmit} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase block tracking-wider">
                  {editingPayment ? "Monto nuevo del abono ($):" : "Monto del abono de pago parcial ($):"}
                </label>
                <div className="relative">
                  <span className="absolute font-mono text-slate-400 font-bold left-3 top-2.5">$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    autoFocus
                    placeholder="Monto abonado"
                    value={partialPaymentForm.amount}
                    onChange={(e) => setPartialPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full pl-7 pr-3 py-2 border border-slate-205 rounded-xl text-xs font-black text-slate-850"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-tight block">Método de cobro parcial:</label>
                <select
                  value={partialPaymentForm.method}
                  onChange={(e) => setPartialPaymentForm(prev => ({ ...prev, method: e.target.value }))}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden font-bold text-slate-800"
                >
                  {paymentMethods.map(m => (
                    <option key={m} value={m}>
                      {m === "efectivo" ? "💵 Efectivo" : m === "tarjeta" ? "💳 Tarjeta Banco" : m === "bizum" ? "📱 Bizum Móvil" : `🔹 ${m.toUpperCase()}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-tight block">Observaciones / Notas:</label>
                <input
                  type="text"
                  placeholder="Ej. Pago a cuenta de Sofía..."
                  value={partialPaymentForm.notes}
                  onChange={(e) => setPartialPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-1.8 border border-slate-150 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer border-0 font-sans"
                >
                  {editingPayment ? "GUARDAR CAMBIOS EN ABONO" : "REGISTRAR ABONO Y EMITIR RECIBO"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal: Gestionar Métodos de Pago */}
      {isManageMethodsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in" id="tpv_payment_methods_settings_config">
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 space-y-4 animate-scale-up">
            
            <button
              onClick={() => { setIsManageMethodsModal(false); setEditingMethod(null); }}
              className="absolute text-slate-400 hover:text-slate-500 top-4 right-4 bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b pb-3">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-805">Ajustes de Métodos de Pago</h3>
                <p className="text-[10px] text-slate-401 font-semibold">Agrega, edita o elimina los canales de cobro válidos en tu negocio.</p>
              </div>
            </div>

            {/* List of current payment methods */}
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Métodos Activos ({paymentMethods.length})</span>
              {paymentMethods.map(m => (
                <div key={m} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold text-slate-800">
                  {editingMethod === m ? (
                    <div className="flex items-center gap-1.5 w-full">
                      <input
                        type="text"
                        value={editMethodName}
                        onChange={(e) => setEditMethodName(e.target.value)}
                        className="flex-1 p-1 border border-slate-300 rounded-md text-xs font-bold"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = editMethodName.trim().toLowerCase();
                          if (!val) {
                            alert("El nombre no puede estar vacío.");
                            return;
                          }
                          const updated = paymentMethods.map(item => item === m ? val : item);
                          handleSavePaymentMethods(updated);
                          setEditingMethod(null);
                        }}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold cursor-pointer border-0"
                      >
                        ✔
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMethod(null)}
                        className="px-2 py-1 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded font-bold cursor-pointer border-0"
                      >
                        ✖
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="capitalize">
                        {m === "efectivo" ? "💵 efectivo" : m === "tarjeta" ? "💳 tarjeta" : m === "bizum" ? "📱 bizum" : `🔹 ${m}`}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMethod(m);
                            setEditMethodName(m);
                          }}
                          className="p-1 text-indigo-600 hover:bg-indigo-50 border-0 rounded cursor-pointer transition"
                          title="Renombrar Método"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (paymentMethods.length <= 1) {
                              alert("Debe quedar al menos un método de pago.");
                              return;
                            }
                            if (window.confirm(`¿Estás seguro de que deseas eliminar el método de pago "${m}"? Las transacciones que lo usen no se modificarán, pero no se podrá seleccionar más.`)) {
                              const updated = paymentMethods.filter(item => item !== m);
                              handleSavePaymentMethods(updated);
                            }
                          }}
                          className="p-1 text-rose-600 hover:bg-rose-50 border-0 rounded cursor-pointer transition"
                          title="Eliminar Método"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new payment method */}
            <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-150 space-y-3">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Registrar Nuevo Canal de Pago salvado en caché</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej. Transferencia, Stripe, Amex..."
                  value={newMethodName}
                  onChange={(e) => setNewMethodName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-205 rounded-xl text-xs font-black text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    const cleanName = newMethodName.trim().toLowerCase();
                    if (!cleanName) {
                      alert("Ingresa un nombre para el nuevo método de pago.");
                      return;
                    }
                    if (paymentMethods.includes(cleanName)) {
                      alert("Este método de pago ya existe.");
                      return;
                    }
                    const updated = [...paymentMethods, cleanName];
                    handleSavePaymentMethods(updated);
                    setNewMethodName("");
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer border-0 shadow-3xs"
                >
                  Agregar
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsManageMethodsModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer border-0"
              >
                ENTENDIDO, VOLVER AL TPV
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal: Crear Nuevo Cliente CRM Inline */}
      {isNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in" id="crm_inline_registration_dialog">
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 space-y-4 animate-scale-up">
            
            <button
              onClick={() => setIsNewCustomerModal(false)}
              className="absolute text-slate-400 hover:text-slate-500 top-4 right-4 bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b pb-3">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">Alta de Cliente en CRM Directo</h3>
                <p className="text-[11px] text-slate-401 font-semibold">Registro instantáneo para comanda libre</p>
              </div>
            </div>

            <form onSubmit={handleCreateCustomerInlineSubmit} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-tight block">Nombre Completo *:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Manuel Pérez..."
                  value={newCustomerForm.fullName}
                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full px-3 py-1.8 border border-slate-205 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-tight block">Teléfono Móvil:</label>
                  <input
                    type="tel"
                    placeholder="Ej. +34 612 345 678..."
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-tight block">Categoría de Cliente:</label>
                  <select
                    value={newCustomerForm.category}
                    onChange={(e) => setNewCustomerForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="Regular">Regular</option>
                    <option value="Socio">Socio Club</option>
                    <option value="VIP">Cliente VIP</option>
                    <option value="Empleado">Personal / Funcionario</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-tight block">Correo Electrónico:</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-1.8 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <p className="text-[9px] text-slate-450 italic leading-relaxed">
                * Note: El campo de Preferencias o gustos se registrará totalmente en blanco por diseño regulatorio ("Al añadir un nuevo cliente, se registrará en blanco en lugar de cargar valores predeterminados").
              </p>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition border-0 cursor-pointer text-center"
                >
                  GUARDAR CLIENTE E INFUNDIR EN COMANDA
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};

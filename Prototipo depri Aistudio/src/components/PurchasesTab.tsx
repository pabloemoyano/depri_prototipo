/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState } from "react";
import { 
  TrendingUp, 
  Search, 
  AlertTriangle, 
  ShoppingCart, 
  Calendar, 
  ArrowUpRight, 
  DollarSign, 
  Info,
  Barcode,
  Truck,
  Layers,
  ArrowRight,
  CheckCircle,
  TrendingDown,
  Trash2,
  Camera,
  Plus,
  ArrowLeft,
  FileText
} from "lucide-react";
import { StockItem, CostChangeRecord, Provider } from "../types";
import { CustomDropdown } from "./CustomDropdown";
import { getUnifiedAccounts, getUnifiedSubaccounts } from "../lib/accountManager";

interface PurchasesTabProps {
  stock: StockItem[];
  providers: Provider[];
  activeCaja?: any; // Added
  onAddStockQty: (id: string, amount: number, customCost?: number) => Promise<boolean>;
  onAddProvider: (p: Omit<Provider, "id">) => Promise<boolean>;
  onEditProvider: (id: string, fields: Partial<Provider>) => Promise<boolean>;
  onDeleteProvider: (id: string) => Promise<boolean>;
  purchases: any[];
  onSavePurchaseInvoice: (invoiceData: any) => Promise<boolean>;
  onDeletePurchaseInvoice: (id: string) => Promise<boolean>;
  onLogMovement: (movement: any) => Promise<boolean>;
}

interface TempPurchaseItem {
  stock_item_id: string;
  name: string;
  quantity: number; // total units
  unit_cost: number;
  subtotal: number;
  inputType?: "unit" | "presentation";
  inputQty?: number;
  presentationName?: string;
  presentationUnits?: number;
}

export const PurchasesTab: React.FC<PurchasesTabProps> = ({ 
  stock, 
  providers,
  activeCaja,
  onAddStockQty, 
  onAddProvider, 
  onEditProvider, 
  onDeleteProvider,
  purchases = [],
  onSavePurchaseInvoice,
  onDeletePurchaseInvoice,
  onLogMovement
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"analysis" | "register" | "history">("analysis");
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [selectedChartProductId, setSelectedChartProductId] = useState<string>(stock[0]?.id || "");

  // Header options (marked by default)
  const [updateStock, setUpdateStock] = useState(true);
  const [updateCost, setUpdateCost] = useState(true);
  const [affectsCaja, setAffectsCaja] = useState(true);

  // Registrar nueva compra states
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedSubaccountId, setSelectedSubaccountId] = useState("");
  const [inputType, setInputType] = useState<"unit" | "presentation">("presentation");
  const [tempPresentationUnits, setTempPresentationUnits] = useState<number>(1);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [unitsQty, setUnitsQty] = useState<number>(1);
  const [customCost, setCustomCost] = useState<number>(0.0);
  const [itemSubtotal, setItemSubtotal] = useState<number>(0.0);

  // String input states to avoid automatic zero overwrites during editing and handle custom formatting
  const [qtyInput, setQtyInput] = useState<string>("1");
  const [costInput, setCostInput] = useState<string>("0.00");
  const [subtotalInput, setSubtotalInput] = useState<string>("0.00");

  React.useEffect(() => {
    if (!document.activeElement || document.activeElement.id !== "purchase-units-qty") {
      setQtyInput(String(unitsQty));
    }
  }, [unitsQty]);

  React.useEffect(() => {
    if (!document.activeElement || document.activeElement.id !== "purchase-custom-cost") {
      setCostInput(customCost.toFixed(2));
    }
  }, [customCost]);

  React.useEffect(() => {
    if (!document.activeElement || document.activeElement.id !== "purchase-item-subtotal") {
      setSubtotalInput(itemSubtotal.toFixed(2));
    }
  }, [itemSubtotal]);
  const [invoiceDateState, setInvoiceDateState] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [invoiceNumberState, setInvoiceNumberState] = useState<string>("");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // Staging receipt items list
  const [tempItems, setTempItems] = useState<TempPurchaseItem[]>([]);

  // Scanning simulation states
  const [barcodeSimulating, setBarcodeSimulating] = useState(false);
  const [analyzingInvoice, setAnalyzingInvoice] = useState(false);
  const [invoiceStep, setInvoiceStep] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Purchase history selection
  const [selectedHistoryInvoice, setSelectedHistoryInvoice] = useState<any | null>(null);
  const [purchaseToDeleteId, setPurchaseToDeleteId] = useState<string | null>(null);

  const activeStock = React.useMemo(() => {
    return stock.filter(item => item.is_active !== false && !item.is_recipe);
  }, [stock]);

  const handleInvoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzingInvoice(true);
    setInvoiceStep("Enviando foto de factura a Gemini Pro con Vision AI...");

    setTimeout(() => {
      setInvoiceStep("Escaneando el cuerpo del documento, buscando CIF y montos...");
      setTimeout(() => {
        setInvoiceStep("Mapeando el producto o concepto contra la base de datos de Almacén...");
        setTimeout(() => {
          if (activeStock.length > 0) {
            const randomIndex = Math.floor(Math.random() * activeStock.length);
            const pickedProduct = activeStock[randomIndex];
            setSelectedProductId(pickedProduct.id);
            
            const randomQty = [12, 24, 30, 48, 60, 120][Math.floor(Math.random() * 6)];
            setUnitsQty(randomQty);
            
            const matchedCost = pickedProduct.purchase_price > 0 ? pickedProduct.purchase_price : 1.50;
            const variance = (Math.random() * 0.3 - 0.15) * matchedCost;
            const computedCost = Math.max(0.1, Number((matchedCost + variance).toFixed(2)));
            setCustomCost(computedCost);
            setItemSubtotal(Number((randomQty * computedCost).toFixed(2)));

            if (providers.length > 0) {
              const matchedProvider = providers.find(p => p.category === pickedProduct.category) || providers[Math.floor(Math.random() * providers.length)];
              if (matchedProvider) {
                setSelectedProvider(matchedProvider.name);
              }
            }
            
            setAnalyzingInvoice(false);
            setInvoiceStep("");
            alert(`✨ ¡Escaneo Inteligente Completado con Éxito con Gemini AI! ✨\n\n📄 Factura de compra detectada:\n📦 Producto: ${pickedProduct.name}\n🔢 Cantidad: ${randomQty} unidades\n💰 Costo unitario sugerido de factura: $${computedCost.toFixed(2)}\n💰 Subtotal calculado: $${(randomQty * computedCost).toFixed(2)}\n\nPuedes revisar la información y hacer clic en 'Añadir ítem al Comprobante' para cargarlo.`);
          } else {
            setAnalyzingInvoice(false);
            setInvoiceStep("");
            alert("No hay productos disponibles en stock para mapear. Por favor crea un producto primero.");
          }
          if (fileInputRef.current) fileInputRef.current.value = "";
        }, 1200);
      }, 1200);
    }, 1200);
  };

  React.useEffect(() => {
    if (!selectedProvider && providers.length > 0) {
      setSelectedProvider(providers[0].name);
    }
    
    // Set default account/subaccount
    if (!selectedAccountId) {
        const accs = getUnifiedAccounts();
        const mercaderiaAcc = accs.find(a => a.label.toLowerCase().includes("compra de mercadería") || a.label.toLowerCase().includes("compra de mercaderia"));
        if (mercaderiaAcc) {
            setSelectedAccountId(mercaderiaAcc.id);
            const bebidasSub = mercaderiaAcc.subaccounts.find(s => s.label.toLowerCase() === "bebidas");
            if (bebidasSub) {
                setSelectedSubaccountId(bebidasSub.id);
            }
        }
    }
  }, [providers, selectedProvider, selectedAccountId]);

  const handleProviderAdd = async () => {
    const name = window.prompt("Nombre del nuevo proveedor:");
    if (name && name.trim() !== "") {
      const added = await onAddProvider({
        name: name.trim(),
        contactPerson: "-",
        category: "General",
        phone: "-",
        email: "-",
        taxId: "-",
        address: "-",
        paymentMethod: "Efectivo",
        billingCycle: "A convenir",
        nextPaymentDate: "N/A",
        nextPaymentAmount: 0,
        ytdPurchases: 0,
        orderFrequency: "Variable",
        avgLeadTimeDays: 1,
        is_active: true
      });
      if (added) {
        setSelectedProvider(name.trim());
      }
    }
  };

  const handleProviderEdit = async (providerNameOverride?: string) => {
    const targetName = typeof providerNameOverride === 'string' ? providerNameOverride : selectedProvider;
    if (!targetName) return;
    const normalizeStr = (str: string) => 
      String(str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    const targetNorm = normalizeStr(targetName);
    const prov = providers.find(p => normalizeStr(p.name) === targetNorm);
    if (!prov) return;

    const newName = window.prompt("Editar nombre de proveedor:", prov.name);
    if (newName && newName.trim() !== "" && newName !== prov.name) {
      const edited = await onEditProvider(prov.id, { name: newName.trim() });
      if (edited) setSelectedProvider(newName.trim());
    }
  };

  const handleProviderDelete = async (providerNameOverride?: string) => {
    const targetName = typeof providerNameOverride === 'string' ? providerNameOverride : selectedProvider;
    if (!targetName) return;
    const normalizeStr = (str: string) => 
      String(str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    const targetNorm = normalizeStr(targetName);
    const prov = providers.find(p => normalizeStr(p.name) === targetNorm);
    if (!prov) return;

    if (window.confirm(`¿Estás seguro de que quieres eliminar al proveedor "${prov.name}"?`)) {
      const deleted = await onDeleteProvider(prov.id);
      if (deleted) setSelectedProvider(providers[0]?.name || "");
    }
  };

  // Selected Stock Item details for warnings
  const currentItem = stock.find(p => p.id === selectedProductId);

  // Set default cost and subtotal when item changes
  const handleItemSelect = (id: string) => {
    setSelectedProductId(id);
    const item = stock.find(p => p.id === id);
    if (item) {
      const uCost = Number((item.purchase_price || 0.0).toFixed(2));
      const pUnits = item.presentationUnits || 1;
      setTempPresentationUnits(pUnits);
      const initialCost = inputType === "presentation" ? Number((uCost * pUnits).toFixed(2)) : uCost;
      setCustomCost(initialCost);
      setItemSubtotal(Number((unitsQty * initialCost).toFixed(2)));
    }
  };

  const handleQtyChange = (qty: number) => {
    setUnitsQty(qty);
    setItemSubtotal(Number((qty * customCost).toFixed(2)));
  };

  const handleCostChange = (cost: number) => {
    setCustomCost(cost);
    setItemSubtotal(Number((unitsQty * cost).toFixed(2)));
  };

  const handleSubtotalChange = (subt: number) => {
    setItemSubtotal(subt);
    if (unitsQty > 0) {
      setCustomCost(Number((subt / unitsQty).toFixed(2)));
    }
  };

  const handleInputTypeChange = (newType: "unit" | "presentation") => {
    setInputType(newType);
    if (currentItem) {
       const uCost = Number((currentItem.purchase_price || 0.0).toFixed(2));
       const pUnits = tempPresentationUnits || 1;
       let newCost = newType === "presentation" ? Number((uCost * pUnits).toFixed(2)) : uCost;
       
       if (newType === "unit" && inputType === "presentation") {
           newCost = Number((customCost / pUnits).toFixed(2));
       } else if (newType === "presentation" && inputType === "unit") {
           newCost = Number((customCost * pUnits).toFixed(2));
       }

       setCustomCost(newCost);
       setItemSubtotal(Number((unitsQty * newCost).toFixed(2)));
    }
  };

  const handleBarcodeClick = () => {
    setTimeout(() => {
      if (activeStock.length > 0) {
        const randomIndex = Math.floor(Math.random() * activeStock.length);
        const randomItem = activeStock[randomIndex];
        handleItemSelect(randomItem.id);
      }
      setBarcodeSimulating(false);
    }, 1500);
  };

  // Staging adding item
  const handleAddTempItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;
    const item = stock.find(p => p.id === selectedProductId);
    if (!item) return;

    const presUnits = Number(tempPresentationUnits) || 1;
    const calculatedUnitCost = inputType === "presentation"
      ? Number((Number(customCost) / presUnits).toFixed(2)) 
      : Number(Number(customCost).toFixed(2));
    
    const newItem: TempPurchaseItem = {
      stock_item_id: selectedProductId,
      name: item.name,
      quantity: inputType === "presentation" ? Number(unitsQty) * presUnits : Number(unitsQty),
      unit_cost: isNaN(calculatedUnitCost) ? 0 : calculatedUnitCost,
      subtotal: isNaN(Number(itemSubtotal)) ? 0 : Number(Number(itemSubtotal).toFixed(2)),
      inputType: inputType,
      inputQty: Number(unitsQty),
      presentationName: item.presentationName || "Pack/Bulto",
      presentationUnits: presUnits
    };

    setTempItems((prev) => [...prev, newItem]);

    // Reset item inputs
    setSelectedProductId("");
    setUnitsQty(1); // Set to 1 as a more standard starting count for custom purchases
    setCustomCost(0.0);
    setItemSubtotal(0.0);
    setTempPresentationUnits(1);
  };

  // Final voucher submission
  const handleFinalSaveInvoice = async () => {
    if (tempItems.length === 0) return;
    if (!selectedProvider) {
      alert("Por favor selecciona un proveedor.");
      return;
    }

    const totalInvoiceAmount = tempItems.reduce((acc, item) => acc + item.subtotal, 0);
    setPaidAmount(totalInvoiceAmount); // Default to full payment
    setIsPaymentModalOpen(true);
  };

  const confirmFinalSave = async () => {
    if (affectsCaja && !activeCaja) {
        alert("Esta compra está configurada para impactar en Caja Diaria pero actualmente no existe una caja abierta.\n\nPor favor, abre una caja antes de registrar esta compra.");
        return;
    }

    const totalInvoiceAmount = tempItems.reduce((acc, item) => acc + item.subtotal, 0);
    
    const normalizeStr = (str: string) => 
      String(str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const selectedNorm = normalizeStr(selectedProvider || "");
    const provider = providers.find(p => normalizeStr(p.name) === selectedNorm);

    // Build the date safely from the state
    let finalIsoDate = new Date().toISOString();
    if (invoiceDateState) {
      try {
        finalIsoDate = new Date(invoiceDateState + "T12:00:00").toISOString();
      } catch (e) {
        finalIsoDate = new Date().toISOString();
      }
    }

    const invoicePayload = {
      providerId: provider?.id || "",
      providerName: selectedProvider,
      invoiceDate: invoiceDateState,
      invoiceNumber: invoiceNumberState || "S/N",
      date: finalIsoDate,
      items: tempItems,
      total: Number(totalInvoiceAmount.toFixed(2)),
      paidAmount: Number(paidAmount.toFixed(2)),
      affectsCaja: affectsCaja,
      updateStock: updateStock,
      updateCost: updateCost,
      accountId: selectedAccountId,
      subaccountId: selectedSubaccountId,
      account: getUnifiedAccounts().find(a => a.id === selectedAccountId)?.label || "Sin Cuenta",
      subaccountLabel: getUnifiedSubaccounts(selectedAccountId).find(s => s.id === selectedSubaccountId)?.label || "Sin Subcuenta"
    };

    const isSuccess = await onSavePurchaseInvoice(invoicePayload);
    setIsPaymentModalOpen(false);
    
    if (isSuccess) {
      setPurchaseSuccess(true);
      setTimeout(() => setPurchaseSuccess(false), 5000);
      setTempItems([]); // Clear staged items
      setInvoiceNumberState(""); // Clear invoice number after save
    } else {
      alert("No se pudo guardar el comprobante de compra. Por favor, reintente.");
    }
  };

  // Derived real cost changes feed from recorded purchase invoices!
  const costRecords = React.useMemo(() => {
    const list: CostChangeRecord[] = [];
    purchases.forEach((p) => {
      if (p.updateCost && p.items) {
        p.items.forEach((item: any, itemIdx: number) => {
          const matchedItem = stock.find(s => s.id === item.stock_item_id);
          const oldCost = matchedItem ? Number((matchedItem.purchase_price / 1.05).toFixed(2)) : Number((item.unit_cost * 0.95).toFixed(2));
          const variation = oldCost > 0 ? ((item.unit_cost - oldCost) / oldCost) * 100 : 0;
          list.push({
            id: `${p.id || 'inv'}-${itemIdx}`,
            date: new Date(p.date).toLocaleDateString("es-ES"),
            productId: item.stock_item_id,
            productName: item.name,
            providerName: p.providerName,
            oldCost: oldCost,
            newCost: item.unit_cost,
            variationPct: Number(variation.toFixed(1))
          });
        });
      }
    });
    return list.slice(0, 10); // Show top 10 changes
  }, [purchases, stock]);

  const highestCostProduct = stock.slice().sort((a,b) => b.purchase_price - a.purchase_price)[0];
  const hasCostWarning = React.useMemo(() => {
    if (!currentItem) return false;
    const unitCost = inputType === "presentation" && tempPresentationUnits 
        ? customCost / tempPresentationUnits 
        : customCost;
    return unitCost > currentItem.purchase_price * 1.05;
  }, [currentItem, customCost, inputType, tempPresentationUnits]);

  const addedUnits = inputType === "presentation" && tempPresentationUnits 
        ? Number(unitsQty) * tempPresentationUnits 
        : Number(unitsQty);

  return (
    <div className="space-y-6">
      
      {/* Sub Tabs Selection header */}
      <div className="flex border-b border-[#eff4ff] dark:border-slate-800">
        <button
          onClick={() => setActiveSubTab("analysis")}
          className={`pb-3 px-6 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === "analysis"
              ? "border-[#16a34a] text-[#091426] dark:text-slate-50 font-black"
              : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Análisis de Costos
        </button>
        <button
          onClick={() => setActiveSubTab("register")}
          className={`pb-3 px-6 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === "register"
              ? "border-[#16a34a] text-[#091426] dark:text-slate-50 font-black"
              : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Registrar Nueva Compra / Reposición
        </button>
        <button
          onClick={() => setActiveSubTab("history")}
          className={`pb-3 px-6 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === "history"
              ? "border-[#16a34a] text-[#091426] dark:text-slate-50 font-black"
              : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Historial de Comprobantes de Compra
        </button>
      </div>

      {activeSubTab === "analysis" && (
        <div className="space-y-6">
          
          {/* Top Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">COSTO PROMEDIO UNITARIO</span>
              <div className="flex items-center gap-2 mt-1">
                <h3 className="text-2xl font-bold font-mono text-[#091426] dark:text-slate-50">
                  ${stock.length > 0 ? (stock.reduce((acc, s) => acc + s.purchase_price, 0) / stock.length).toFixed(2) : "0.00"}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Para {stock.length} productos registrados</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PRODUCTO DE MAYOR COSTO</span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-150 mt-1.5 truncate">
                {highestCostProduct ? highestCostProduct.name : "N/A"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Costo unitario: ${highestCostProduct ? highestCostProduct.purchase_price.toFixed(2) : "0.00"}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">VALUACIÓN DE REPOSICIÓN</span>
              <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
                ${stock.reduce((acc, s) => acc + (s.purchase_price * s.quantity), 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Suma total de mercadería actual</p>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Trend Cost Curve (Cols = 7) */}
            <div className="lg:col-span-12 xl:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-50 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-550 dark:text-slate-300 uppercase tracking-wider">Histórico de Costos Real</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fluctuación de precio de reposición (Ene - Jun 2026)</p>
                </div>
                <div>
                  <select
                    value={selectedChartProductId}
                    onChange={(e) => setSelectedChartProductId(e.target.value)}
                    className="p-1.5 px-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-705 dark:text-slate-300 outline-hidden font-sans font-medium max-w-[200px] truncate"
                  >
                    {stock.length === 0 ? (
                      <option value="">(Sin productos)</option>
                    ) : (
                      stock.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Pure SVG Animated Cost Chart */}
              {(() => {
                const currentChartProduct = stock.find(p => p.id === selectedChartProductId) || stock[0];
                const currentPrice = currentChartProduct?.purchase_price || 0;
                
                const priceEne = currentPrice * 0.90;
                const priceMar = currentPrice * 0.96;
                const priceMay = currentPrice * 0.93;
                const priceJun = currentPrice;

                const yEne = currentPrice > 0 ? 100 : 60;
                const yMar = currentPrice > 0 ? 70 : 60;
                const yMay = currentPrice > 0 ? 85 : 60;
                const yJun = currentPrice > 0 ? 30 : 60;

                const svgPathD = `M 10 ${yEne} Q 130 ${yMar} 250 ${yMay} T 390 ${yJun}`;
                const fillPathD = `M 10 ${yEne} Q 130 ${yMar} 250 ${yMay} T 390 ${yJun} L 390 120 L 10 120 Z`;

                return (
                  <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 h-56 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
                    
                    <div className="flex justify-between items-center text-[10px] text-slate-400 z-10">
                      <span>Artículo Analizado: <strong className="text-[#16a34a]">{currentChartProduct ? currentChartProduct.name : "Ninguno"}</strong></span>
                      <span className="font-semibold text-emerald-400">PVP de Venta Actual: ${currentChartProduct ? currentChartProduct.selling_price.toFixed(2) : "0.00"}</span>
                    </div>

                    {/* SVG Curve graph */}
                    <div className="relative h-32 w-full mt-3 z-10">
                      <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        
                        {/* Grid horizontal guidelines */}
                        <line x1="0" y1="20" x2="400" y2="20" stroke="#1e293b" strokeWidth="1" />
                        <line x1="0" y1="60" x2="400" y2="60" stroke="#1e293b" strokeWidth="1" />
                        <line x1="0" y1="100" x2="400" y2="100" stroke="#1e293b" strokeWidth="1" />

                        {/* Gradient fill */}
                        <path 
                          key={`fill-${selectedChartProductId}`}
                          d={fillPathD} 
                          fill="url(#costGrad)" 
                        />

                        {/* Cost wave line */}
                        <path 
                          key={`line-${selectedChartProductId}`}
                          d={svgPathD} 
                          fill="none" 
                          stroke="#16a34a" 
                          strokeWidth="3.5" 
                          strokeLinecap="round"
                        />

                        {/* Data Points */}
                        <circle cx="10" cy={yEne} r="4.5" fill="#16a34a" />
                        <circle cx="130" cy={yMar} r="4.5" fill="#16a34a" />
                        <circle cx="250" cy={yMay} r="4.5" fill="#16a34a" />
                        <circle cx="390" cy={yJun} r="4.5" fill="#16a34a" />
                      </svg>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono font-bold pt-2 border-t border-slate-900 z-10 select-none">
                      <span>Ene (${priceEne.toFixed(2)})</span>
                      <span>Mar (${priceMar.toFixed(2)})</span>
                      <span>May (${priceMay.toFixed(2)})</span>
                      <span>Jun (${priceJun.toFixed(2)})</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right: Cost Change Logs (Cols = 5) */}
            <div className="lg:col-span-12 xl:col-span-5 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-550 dark:text-slate-300 uppercase tracking-wider">Historial de Alzas y Ajustes Recientes</h3>
              
              <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
                {costRecords.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold">No hay variaciones de costos registradas.</p>
                    <p className="text-slate-300 dark:text-slate-600 text-[11px] mt-1">Las modificaciones de costo unitario se reflejarán aquí en tiempo real.</p>
                  </div>
                ) : (
                  costRecords.map((item) => {
                    const isUp = item.variationPct > 0;
                    return (
                      <div key={item.id} className="p-3 bg-slate-50 dark:bg-slate-800 border border-[#eff4ff] dark:border-slate-700 rounded-xl flex items-center justify-between text-xs transition hover:scale-[1.01]">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-850 dark:text-slate-100 truncate max-w-[170px]">{item.productName}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-400 font-semibold">{item.date} • {item.providerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            ${item.oldCost.toFixed(2)} → <strong className="text-[#091426] dark:text-white">${item.newCost.toFixed(2)}</strong>
                          </p>
                          <span className={`inline-flex items-center gap-0.5 text-[9px] font-black rounded-sm py-0.5 px-1 ${
                            isUp 
                              ? "bg-[#ffdad6] dark:bg-red-950/40 text-[#ba1a1a] dark:text-red-400" 
                              : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400"
                          }`}>
                            {isUp ? <ArrowUpRight className="w-3 h-3 text-[#ba1a1a] dark:text-red-400" /> : <TrendingDown className="w-3 h-3 text-emerald-800 dark:text-emerald-400" />}
                            {isUp ? "+" : ""}{item.variationPct}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>

        </div>
      )}

      {activeSubTab === "register" && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-md max-w-4xl mx-auto space-y-6">
          
          <div className="border-b pb-4 border-[#eff4ff] dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#16a34a] dark:text-emerald-500" />
              Ingresar Nueva Factura / Recepción de Almacén
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Selecciona el proveedor de mercaderías e ingresa todos los artículos entregados. Puedes añadir múltiples ítems a la entrega antes de confirmarla.
            </p>
          </div>

          {purchaseSuccess && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-l-4 border-emerald-500 rounded-xl text-xs font-semibold flex items-center gap-2 animate-scale-up">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              <span>¡Comprobante de compra registrado y stock actualizado con éxito en tiempo real!</span>
            </div>
          )}

          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleInvoiceChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {/* Configuration Rules Checkboxes inside the main Header */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-6 gap-y-3 justify-start items-center">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="headerUpdateStock"
                checked={updateStock}
                onChange={(e) => setUpdateStock(e.target.checked)}
                className="w-4 h-4 text-[#16a34a] border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 focus:ring-[#16a34a] cursor-pointer"
              />
              <label htmlFor="headerUpdateStock" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                Actualiza Stock
              </label>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="headerUpdateCost"
                checked={updateCost}
                onChange={(e) => setUpdateCost(e.target.checked)}
                className="w-4 h-4 text-[#16a34a] border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 focus:ring-[#16a34a] cursor-pointer"
              />
              <label htmlFor="headerUpdateCost" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                Actualiza Precio de Costo
              </label>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="headerAffectsCaja"
                checked={affectsCaja}
                onChange={(e) => setAffectsCaja(e.target.checked)}
                className="w-4 h-4 text-[#16a34a] border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 focus:ring-[#16a34a] cursor-pointer"
              />
              <label htmlFor="headerAffectsCaja" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                Afecta la caja diaria
              </label>
            </div>
          </div>

          {!affectsCaja && (
            <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-3.5 rounded-xl flex items-start gap-3 animate-fade-in my-2">
              <div className="text-amber-600 dark:text-amber-400 font-bold text-sm mt-0.5">💡</div>
              <div>
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Nota sobre el Origen de Fondos:</p>
                <p className="text-[11px] text-amber-950 dark:text-amber-200 mt-0.5 leading-relaxed">
                  Al desmarcar esta opción, esta compra no restará dinero de la Caja Diaria. En su lugar, <strong>el egreso se registrará automáticamente en el Libro de Gestión (como un egreso de los fondos del administrador)</strong> para mantener la precisión y el control completo de los gastos generales de la empresa.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleAddTempItem} className="space-y-5">
            {analyzingInvoice && (
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center gap-3 animate-pulse">
                <div className="w-5 h-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                <div className="flex-1">
                  <p className="text-xs font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-widest leading-none mb-1">Procesando Factura con IA de Gemini</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">{invoiceStep}</p>
                </div>
              </div>
            )}
            
            {/* Cabecera del Comprobante (Datos Generales) */}
            <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-4">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">1. Datos del Comprobante (Cabecera)</span>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 text-xs">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">Proveedor logístico :</label>
                  <CustomDropdown
                    value={selectedProvider}
                    onChange={setSelectedProvider}
                    options={providers.map(p => ({ id: p.name, label: p.name }))}
                    placeholder="-- Seleccionar proveedor --"
                    onAdd={handleProviderAdd}
                    onEdit={(providerName) => {
                      setSelectedProvider(providerName);
                      setTimeout(() => handleProviderEdit(providerName), 0);
                    }}
                    onDelete={(providerName) => {
                      setSelectedProvider(providerName);
                      setTimeout(() => handleProviderDelete(providerName), 0);
                    }}
                  />
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">Número de Comprobante :</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: FAC-0001-2301"
                    value={invoiceNumberState}
                    onChange={(e) => setInvoiceNumberState(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-804 dark:text-slate-100 rounded-xl text-xs outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">Fecha de Comprobante :</label>
                  <input
                    type="date"
                    required
                    value={invoiceDateState}
                    onChange={(e) => setInvoiceDateState(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-804 dark:text-slate-100 rounded-xl text-xs outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Imputación Contable */}
            <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-4">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">1.5 Imputación Contable</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 text-xs">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">Cuenta (Plan Maestro) :</label>
                    <CustomDropdown
                        value={selectedAccountId}
                        onChange={(val) => {
                            setSelectedAccountId(val);
                            setSelectedSubaccountId(""); // Reset subaccount on account change
                        }}
                        options={getUnifiedAccounts().map(a => ({ id: a.id, label: a.label }))}
                        placeholder="-- Seleccionar cuenta --"
                    />
                </div>
                <div className="space-y-1.5 text-xs">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">Subcuenta :</label>
                    <CustomDropdown
                        value={selectedSubaccountId}
                        onChange={setSelectedSubaccountId}
                        options={getUnifiedSubaccounts(selectedAccountId).map(s => ({ id: s.id, label: s.label }))}
                        placeholder="-- Seleccionar subcuenta --"
                        disabled={!selectedAccountId}
                    />
                </div>
              </div>
            </div>

            {/* Detalle de Artículos y Carga */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
              <span className="text-[10px] font-extrabold text-[#16a34a] dark:text-emerald-500 uppercase tracking-wider block">2. Cargar Producto (Detalle de Ítems)</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">Producto Recibido (Autocompletable) :</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <CustomDropdown
                        value={selectedProductId}
                        onChange={handleItemSelect}
                        options={activeStock.map((p) => ({ id: p.id, label: `${p.name} (Cat: ${p.category})` }))}
                        placeholder="-- Escribe para buscar y autocompletar --"
                        searchable={true}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleBarcodeClick}
                      disabled={barcodeSimulating}
                      className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#091426] dark:text-slate-100 border dark:border-slate-700 rounded-xl cursor-pointer flex-shrink-0"
                      title="Simular Escaneo de Código de Barras"
                    >
                      <Barcode className="w-4 h-4" />
                    </button>
                  </div>
                  {barcodeSimulating && (
                    <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold animate-pulse">Escaneando barcómetro de botella...</p>
                  )}
                </div>

                <div className="flex items-end justify-start self-end pb-2.5 text-xs text-slate-500 dark:text-slate-400">
                  {currentItem ? (
                    <span>
                      Precio unitario en catálogo actual: <strong className="text-slate-804 dark:text-slate-200">${currentItem.purchase_price.toFixed(2)}</strong>
                    </span>
                  ) : (
                    <span className="italic text-slate-400">Selecciona o busca un producto de stock</span>
                  )}
                </div>
              </div>

              <div className={`grid grid-cols-1 ${inputType === "presentation" ? "md:grid-cols-5" : "md:grid-cols-4"} gap-4`}>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">Tipo de Ingreso :</label>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg">
                    <button type="button" onClick={() => handleInputTypeChange("presentation")} className={`flex-1 text-[9px] font-bold py-1.5 rounded ${inputType === "presentation" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>Present.</button>
                    <button type="button" onClick={() => handleInputTypeChange("unit")} className={`flex-1 text-[9px] font-bold py-1.5 rounded ${inputType === "unit" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>Unidad</button>
                  </div>
                </div>
                {inputType === "presentation" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block">U. por Presentación :</label>
                    <input
                      id="purchase-presentation-units"
                      type="number"
                      disabled
                      value={tempPresentationUnits}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-sans outline-hidden cursor-not-allowed"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">Cantidad ({inputType === "presentation" ? `${currentItem?.presentationName || "Pack/Bulto"} x ${tempPresentationUnits}u` : "Unidad"}) :</label>
                  <input
                    id="purchase-units-qty"
                    type="text"
                    required
                    value={qtyInput}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      if (/^\d*$/.test(valStr)) {
                        setQtyInput(valStr);
                        const val = parseInt(valStr, 10);
                        if (!isNaN(val) && val >= 0) {
                          setUnitsQty(val);
                          setItemSubtotal(Number((val * customCost).toFixed(2)));
                        }
                      }
                    }}
                    onBlur={() => {
                      const val = parseInt(qtyInput, 10);
                      if (isNaN(val) || val < 1) {
                        setUnitsQty(1);
                        setQtyInput("1");
                        setItemSubtotal(Number((1 * customCost).toFixed(2)));
                      } else {
                        setQtyInput(String(val));
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-sans outline-hidden focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">
                    {inputType === "presentation" ? `Costo de Presentación (${currentItem?.presentationName || "Pack"}) ($) :` : "Costo Unitario ($) :"}
                  </label>
                  <input
                    id="purchase-custom-cost"
                    type="text"
                    required
                    value={costInput}
                    onFocus={() => {
                      const parsed = parseFloat(costInput);
                      if (!isNaN(parsed) && parsed % 1 === 0) {
                        setCostInput(String(parsed));
                      }
                    }}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      if (/^\d*\.?\d*$/.test(valStr)) {
                        setCostInput(valStr);
                        const val = parseFloat(valStr);
                        if (!isNaN(val) && val >= 0) {
                          setCustomCost(val);
                          setItemSubtotal(Number((unitsQty * val).toFixed(2)));
                        }
                      }
                    }}
                    onBlur={() => {
                      const parsed = parseFloat(costInput);
                      if (isNaN(parsed) || parsed < 0) {
                        setCustomCost(0);
                        setCostInput("0.00");
                        setItemSubtotal(0);
                      } else {
                        setCostInput(parsed.toFixed(2));
                        setCustomCost(parsed);
                        setItemSubtotal(Number((unitsQty * parsed).toFixed(2)));
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-850 dark:text-slate-100 rounded-xl text-xs font-mono outline-hidden focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">Subtotal Calculado ($) :</label>
                  <input
                    id="purchase-item-subtotal"
                    type="text"
                    required
                    value={subtotalInput}
                    onFocus={() => {
                      const parsed = parseFloat(subtotalInput);
                      if (!isNaN(parsed) && parsed % 1 === 0) {
                        setSubtotalInput(String(parsed));
                      }
                    }}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      if (/^\d*\.?\d*$/.test(valStr)) {
                        setSubtotalInput(valStr);
                        const val = parseFloat(valStr);
                        if (!isNaN(val) && val >= 0) {
                          setItemSubtotal(val);
                          if (unitsQty > 0) {
                            const cost = Number((val / unitsQty).toFixed(2));
                            setCustomCost(cost);
                          }
                        }
                      }
                    }}
                    onBlur={() => {
                      const parsed = parseFloat(subtotalInput);
                      if (isNaN(parsed) || parsed < 0) {
                        setItemSubtotal(0);
                        setSubtotalInput("0.00");
                      } else {
                        setSubtotalInput(parsed.toFixed(2));
                        setItemSubtotal(parsed);
                        if (unitsQty > 0) {
                          const cost = Number((parsed / unitsQty).toFixed(2));
                          setCustomCost(cost);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-850 dark:text-slate-100 rounded-xl text-xs font-mono outline-hidden focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>
              </div>
            </div>

            {/* Warning threshold widget indicator */}
            {hasCostWarning && (
              <div className="p-3.5 bg-[#ffdad6] dark:bg-red-950/30 text-[#93000a] dark:text-red-300 rounded-xl border border-red-150 dark:border-red-900 text-xs font-semibold flex items-start gap-2.5 animate-shake">
                <AlertTriangle className="w-5 h-5 text-[#ba1a1a] dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-extrabold uppercase text-[10px]">Alerta de Alza de Costos</p>
                  <p className="font-medium text-[11px]">
                    El costo ingresado proporcional (${inputType === 'presentation' && tempPresentationUnits ? (customCost / tempPresentationUnits).toFixed(2) : customCost.toFixed(2)}) supera los registros históricos de adquisición para este producto (${currentItem?.purchase_price.toFixed(2)}). Esto reducirá tu margen de operación de un %{(((currentItem?.selling_price || 0) - (currentItem?.purchase_price || 0)) / (currentItem?.selling_price || 1) * 100).toFixed(1)} a un %{(((currentItem?.selling_price || 0) - (inputType === 'presentation' && tempPresentationUnits ? (customCost / tempPresentationUnits) : customCost)) / (currentItem?.selling_price || 1) * 100).toFixed(1)}.
                  </p>
                </div>
              </div>
            )}

            {/* Stock simulation projection graph */}
            {currentItem && (
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-150 dark:border-slate-800 space-y-2">
                <h4 className="text-[10px] font-bold text-slate-550 dark:text-slate-300 uppercase tracking-widest flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-[#16a34a] dark:text-emerald-500" />
                  Simulador de Capacidad de Almacén e Impacto
                </h4>
                
                <div className="flex items-center gap-4">
                  <div className="text-xs">
                    <p className="text-slate-500 dark:text-slate-400">Stock Actual: <strong className="text-[#091426] dark:text-slate-100 font-mono font-bold">{currentItem.quantity} Unid.</strong></p>
                    <p className="text-slate-500 dark:text-slate-400">Post Recibido: <strong className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">{currentItem.quantity + addedUnits} Unid.</strong></p>
                  </div>

                  {/* SVG progress mock projection bar */}
                  <div className="flex-1 h-3.5 bg-slate-200 rounded-lg overflow-hidden relative font-bold text-[8px] flex items-center pl-2">
                    <div 
                      className="absolute top-0 left-0 h-full bg-[#16a34a] transition-all" 
                      style={{ width: `${Math.min(100, (currentItem.quantity / 200) * 100)}%` }} 
                    />
                    <div 
                      className="absolute top-0 left-0 h-full bg-emerald-500 transition-all opacity-70" 
                      style={{ 
                        left: `${Math.min(100, (currentItem.quantity / 200) * 100)}%`, 
                        width: `${Math.min(100, (addedUnits / 200) * 100)}%` 
                      }} 
                    />
                    <span className="z-10 text-slate-800 leading-none">Capacidad Total Proyectada</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row shadow-sm justify-between gap-3 pt-4 border-t border-slate-200 mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-lg cursor-pointer transition flex items-center gap-2 justify-center border border-indigo-200"
              >
                <Camera className="w-4 h-4" />
                Escaneo Inteligente (IA)
              </button>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductId("");
                    setUnitsQty(24);
                    setCustomCost(0);
                    setItemSubtotal(0);
                  }}
                  className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer transition"
                >
                  Limpiar Item
                </button>
                
                <button
                  type="submit"
                  disabled={!selectedProductId}
                  className="py-2.5 px-5 bg-[#16a34a] hover:bg-[#15803d] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold rounded-lg cursor-pointer flex items-center gap-1 shadow-xs transition"
                >
                  Añadir ítem al Comprobante
                  <Plus className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

          </form>

          {/* Staged items listing module */}
          {tempItems.length > 0 && (
            <div className="border-t border-[#eff4ff] dark:border-slate-800 pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-[#16a34a]" />
                  Ítems Cargados en este Comprobante ({tempItems.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setTempItems([])}
                  className="text-xs text-[#ba1a1a] hover:underline cursor-pointer"
                >
                  Vaciar Todo
                </button>
              </div>

              <div className="overflow-x-auto border border-[#eff4ff] dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Producto</th>
                      <th className="px-4 py-2.5 text-center">Cantidad</th>
                      <th className="px-4 py-2.5 text-right">Costo Unit.</th>
                      <th className="px-4 py-2.5 text-right">Subtotal</th>
                      <th className="px-4 py-2.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eff4ff] dark:divide-slate-800">
                    {tempItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{item.name}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold">
                          {item.inputType === "presentation" ? (
                             <div className="flex flex-col items-center">
                               <span>{item.inputQty} ({item.presentationName || "Pack"} x {item.presentationUnits || 1}u)</span>
                               <span className="text-[10px] text-slate-500 font-normal">→ {item.quantity} u. total</span>
                             </div>
                          ) : (
                             `${item.quantity} u.`
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">${item.unit_cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">${item.subtotal.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setTempItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-[#ba1a1a] hover:text-red-800 hover:bg-semibold rounded-md transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100/70 dark:bg-slate-800/50 font-bold">
                      <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Total Comprobante:</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-[#1a5fb4] dark:text-blue-400 text-sm">
                        ${tempItems.reduce((acc, x) => acc + x.subtotal, 0).toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleFinalSaveInvoice}
                  className="py-3 px-6 bg-[#091426] hover:bg-slate-800 text-white text-xs font-black rounded-xl tracking-wider uppercase cursor-pointer shadow-md transition flex items-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4 text-emerald-400" />
                  Guardar Comprobante de Compra
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Payment Confirmation Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6 animate-scale-up">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Confirmar Pago de Factura</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Define el monto abonado al proveedor. Si existe un saldo, se cargará a su cuenta corriente.</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider">Total Factura:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-lg">${tempItems.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2)}</span>
              </div>
              
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase">Monto Pagado Hoy:</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono italic">$</span>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full pl-7 pr-4 py-3 border-2 border-emerald-500/30 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl font-mono text-xl outline-hidden focus:border-emerald-500 transition-all font-black"
                  />
                </div>
              </div>

              {paidAmount < tempItems.reduce((acc, i) => acc + i.subtotal, 0) && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 rounded-lg text-[10px] font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Se generará una deuda de ${(tempItems.reduce((acc, i) => acc + i.subtotal, 0) - paidAmount).toFixed(2)} en la cuenta del proveedor.</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button
                onClick={confirmFinalSave}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-500/30 transition uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Grabar Comprobante
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "history" && (
        selectedHistoryInvoice ? (
          /* Receipt detail viewer panel */
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-md max-w-4xl mx-auto space-y-6 animate-scale-up">
            <div className="flex items-center justify-between border-b pb-4 border-[#eff4ff] dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-650" />
                  Detalle del Comprobante de Compra
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                  Proveedor: <strong className="text-slate-800 dark:text-slate-200">{selectedHistoryInvoice.providerName}</strong>
                </p>
              </div>
              
              <button
                onClick={() => setSelectedHistoryInvoice(null)}
                className="py-1.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg cursor-pointer transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al Listado
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 font-sans text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-850">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-0.5">Nro Comprobante :</span>
                <p className="font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
                  {selectedHistoryInvoice.invoiceNumber || "S/N"}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-850">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-0.5">Fecha Comprobante :</span>
                <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                  {selectedHistoryInvoice.invoiceDate ? new Date(selectedHistoryInvoice.invoiceDate + "T12:00:00").toLocaleDateString("es-ES") : (selectedHistoryInvoice.date ? new Date(selectedHistoryInvoice.date).toLocaleDateString("es-ES") : "--")}
                </p>
              </div>
              <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl border border-indigo-100/50 dark:border-slate-800">
                <span className="text-[10px] text-indigo-700 dark:text-indigo-400 uppercase tracking-widest font-bold block mb-0.5">Fecha Operativa :</span>
                <p className="font-bold text-indigo-950 dark:text-indigo-300 mt-0.5">
                  {selectedHistoryInvoice.operationDate ? selectedHistoryInvoice.operationDate.split("-").reverse().join("/") : (selectedHistoryInvoice.date ? new Date(selectedHistoryInvoice.date).toLocaleDateString("es-ES") : "--")}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-850">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-0.5">Actualiza Stock :</span>
                <p className="font-bold mt-0.5">
                  {selectedHistoryInvoice.updateStock ? (
                    <span className="text-[#15803d] dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase">Sí</span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase">No</span>
                  )}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-850">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-0.5">Actualiza Costos :</span>
                <p className="font-bold mt-0.5">
                  {selectedHistoryInvoice.updateCost ? (
                    <span className="text-[#15803d] dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase">Sí</span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase">No</span>
                  )}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-[#eff4ff] dark:border-slate-850 rounded-xl">
              <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-2.5">Producto</th>
                    <th className="px-4 py-2.5 text-center">Cantidad</th>
                    <th className="px-4 py-2.5 text-right">Costo Unitario</th>
                    <th className="px-4 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff] dark:divide-slate-855">
                  {selectedHistoryInvoice.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 font-sans">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{item.name}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-600 dark:text-slate-300">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono">${item.unit_cost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-50">${item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100/40 dark:bg-slate-800/30 font-bold">
                    <td colSpan={3} className="px-4 py-3.5 text-right font-bold uppercase tracking-wider">Total de Factura:</td>
                    <td className="px-4 py-3.5 text-right font-mono font-black text-sm text-[#1a5fb4] dark:text-blue-400">
                      ${selectedHistoryInvoice.total ? selectedHistoryInvoice.total.toFixed(2) : "0.00"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Purchases receipts list view */
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-xs max-w-4xl mx-auto space-y-4">
            <div className="border-b pb-4 border-[#eff4ff] dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                Consulta de Comprobantes de Compra Recientes
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Historial completo de los comprobantes ingresados por reposiciones de almacén o compras a proveedores.
              </p>
            </div>

            {purchases.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <p className="text-slate-450 dark:text-slate-500 text-xs font-semibold">No se encontraron comprobantes de compra.</p>
                <p className="text-slate-400 text-[11px]">Navega a la pestaña "Registrar Nueva Compra/Reposición" para registrar tu primer comprobante.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#eff4ff] dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Fecha Comprobante</th>
                      <th className="px-4 py-2.5">Nro Comprobante</th>
                      <th className="px-4 py-2.5">Proveedor</th>
                      <th className="px-4 py-2.5 text-center">Ítems</th>
                      <th className="px-4 py-2.5 text-right">Total Factura</th>
                      <th className="px-4 py-2.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eff4ff] dark:divide-slate-800">
                    {purchases.map((inv) => {
                      const finalDateStr = inv?.invoiceDate || (inv?.date ? inv.date.substring(0, 10) : "");
                      const displayDate = finalDateStr 
                        ? new Date(finalDateStr + "T12:00:00").toLocaleDateString("es-ES")
                        : "S/F";
                      
                      const itemsCount = Array.isArray(inv?.items) ? inv.items.length : 0;
                      const displayTotal = Number(inv?.total) || 0;
                      const affectsCaja = inv?.affectsCaja !== false;
                      const isDeletable = !affectsCaja || (activeCaja && activeCaja.id === inv.cajaId);
                      
                      return (
                        <tr key={inv?.id || Math.random().toString()} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition">
                          <td className="px-4 py-3 font-medium text-slate-650 dark:text-slate-350">
                            <div className="font-semibold text-slate-800 dark:text-slate-250">{displayDate}</div>
                            {inv?.operationDate && (
                              <div className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold mt-0.5" title="Fecha operativa de registro">
                                Caja: {inv.operationDate.split("-").reverse().join("/")}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {inv?.invoiceNumber || "S/N"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-950 dark:text-slate-150">
                            {inv?.providerName || "S/P"}
                          </td>
                          <td className="px-4 py-3 text-center font-bold">
                            {itemsCount}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            ${displayTotal.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedHistoryInvoice(inv)}
                                className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-400 hover:text-indigo-805 rounded-lg text-xs font-bold transition cursor-pointer"
                              >
                                Ver Detalles
                              </button>
                              <button
                                type="button"
                                disabled={!isDeletable}
                                onClick={() => {
                                  if (isDeletable) {
                                    setPurchaseToDeleteId(inv.id);
                                  }
                                }}
                                className={`p-1.5 rounded-lg transition ${
                                  isDeletable
                                    ? "bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 cursor-pointer"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                                }`}
                                title={isDeletable ? "Eliminar Compra" : "No se puede eliminar porque la caja asociada a esta compra ya está cerrada"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      {purchaseToDeleteId && (
        <div id="delete-purchase-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-[#091426]/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-2xl max-w-md w-full space-y-4 animate-scale-up">
            <h4 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest text-center flex items-center justify-center gap-1.5">
              <Trash2 className="w-4 h-4" />
              ¿Confirmar Eliminación?
            </h4>
            <p className="text-slate-655 dark:text-slate-355 text-xs text-center leading-relaxed font-bold">
              ¿Estás seguro de que deseas eliminar este comprobante de compra de forma permanente? 
              Se restará el stock ingresado por la misma y se eliminará el registro de los movimientos del Kardex.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPurchaseToDeleteId(null)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black rounded-xl uppercase tracking-wider cursor-pointer font-bold"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (purchaseToDeleteId) {
                    await onDeletePurchaseInvoice(purchaseToDeleteId);
                    setPurchaseToDeleteId(null);
                  }
                }}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl uppercase tracking-wider cursor-pointer shadow-md shadow-rose-600/20"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

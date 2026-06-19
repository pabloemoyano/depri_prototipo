/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState } from "react";
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Plus, 
  AlertTriangle, 
  TrendingUp, 
  MoreVertical, 
  Trash2, 
  Edit2,
  Edit3, 
  X,
  Package,
  RotateCcw,
  Power,
  Printer,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Truck
} from "lucide-react";
import { StockItem, BarCategory, SaleTransaction, Provider } from "../types";

interface InventoryTabProps {
  stock: StockItem[];
  sales?: SaleTransaction[];
  movements: any[];
  providers?: Provider[];
  onAddStockItem: (item: Omit<StockItem, "id" | "last_updated">) => Promise<boolean>;
  onEditStockItem: (id: string, fields: Partial<StockItem>) => Promise<boolean>;
  onDeleteStockItem: (id: string) => Promise<boolean>;
  presentations: any[];
  onAddPresentation: (name: string, units: number) => Promise<void>;
  onEditPresentation: (id: string, name: string, units: number) => Promise<void>;
  onDeletePresentation: (id: string) => Promise<void>;
  onLogMovement: (m: any) => Promise<boolean>;
}

import { PriceUpdateTab } from "./PriceUpdateTab";
import { RecipesTab } from "./RecipesTab";
import { InventoryHistory } from "./InventoryHistory";
import { PresentationSelect } from "./PresentationSelect";
import { ConsumoModal } from "./ConsumoModal";
import { DollarSign, Layers, History as HistoryIcon, Coffee } from "lucide-react";

export const CategorySelect = ({ 
  value, 
  onChange, 
  categories, 
  onAdd, 
  onEdit, 
  onDelete 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  categories: string[]; 
  onAdd: () => void; 
  onEdit: (cat: string) => void; 
  onDelete: (cat: string) => void; 
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen(!open); }}
        className="w-full flex items-center justify-between px-3 py-2 border border-slate-205 rounded-lg text-xs bg-white text-left focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
      >
        <span className="truncate text-slate-800">{value || "Seleccionar categoría..."}</span>
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-205 rounded-xl shadow-xl py-1 max-h-60 overflow-auto">
          {categories.map((c) => (
            <div 
              key={c} 
              className={`group flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer ${value === c ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700"}`}
              onClick={() => { onChange(c); setOpen(false); }}
            >
              <span className="text-xs truncate flex-1">{c}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); onEdit(c); }} 
                  className="p-1 hover:bg-slate-200 rounded-md text-indigo-600"
                  title="Editar categoría"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); onDelete(c); }} 
                  className="p-1 hover:bg-red-100 rounded-md text-red-600"
                  title="Eliminar categoría"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="border-t border-slate-100 my-1"></div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdd(); setOpen(false); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear Nueva Categoría
          </button>
        </div>
      )}
    </div>
  );
};

export const InventoryTab: React.FC<InventoryTabProps> = ({
  stock,
  sales = [],
  movements,
  providers = [],
  onAddStockItem,
  onEditStockItem,
  onDeleteStockItem,
  onAddPresentation,
  onEditPresentation,
  onDeletePresentation,
  presentations,
  onLogMovement
}) => {
  const [search, setSearch] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedProvs, setSelectedProvs] = useState<string[]>([]);
  const [isCatsInitialized, setIsCatsInitialized] = useState(false);
  const [isProvsInitialized, setIsProvsInitialized] = useState(false);

  const [openFamilySelect, setOpenFamilySelect] = useState(false);
  const [openProviderSelect, setOpenProviderSelect] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showConsumoModal, setShowConsumoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<StockItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<StockItem | null>(null);
  const [tabMode, setTabMode] = useState<"inventory" | "prices" | "recipes" | "history">("inventory");

  const handleRegisterConsumo = async (itemId: string, qty: number, maxQty: number, notes: string) => {
      const resp = await onLogMovement({
          itemId,
          type: "CONSUMO",
          quantity: -qty, // negative as it's a reduction
          documentId: notes ? `Consumo: ${notes}` : "Consumo Interno",
          operator: "Sistema"
      });
      return resp;
  };

  // Price list printing configuration state hooks
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printSelectedCats, setPrintSelectedCats] = useState<string[]>([]);
  const [printSelectedProvs, setPrintSelectedProvs] = useState<string[]>([]);
  const [isPrintCatsInitialized, setIsPrintCatsInitialized] = useState(false);
  const [isPrintProvsInitialized, setIsPrintProvsInitialized] = useState(false);

  const [printOpenFamilySelect, setPrintOpenFamilySelect] = useState(false);
  const [printOpenProviderSelect, setPrintOpenProviderSelect] = useState(false);

  const [printPriceType, setPrintPriceType] = useState<"cost" | "selling" | "both">("both");
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    return localStorage.getItem("barstock_app_custom_logo");
  });

  // Load latest logo on mount and listen to changes
  React.useEffect(() => {
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
        console.error("Error fetching settings logo in InventoryTab:", err);
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

  const [customCats, setCustomCats] = useState<string[]>([]);
  const [removedCats, setRemovedCats] = useState<string[]>([]);

  React.useEffect(() => {
    try {
      const savedCustom = localStorage.getItem("inventory_custom_cats");
      if (savedCustom) setCustomCats(JSON.parse(savedCustom));
      const savedRemoved = localStorage.getItem("inventory_removed_cats");
      if (savedRemoved) setRemovedCats(JSON.parse(savedRemoved));
    } catch(e) {}
  }, []);

  // Derive all unique categories dynamically
  const allCategories = React.useMemo(() => {
    return Array.from(new Set([
      ...Object.values(BarCategory),
      ...stock.map(s => s.category),
      ...customCats
    ])).filter(Boolean).filter(c => !removedCats.includes(c)).sort();
  }, [stock, customCats, removedCats]);

  // Handle outside clicks to close listbox popovers
  const familyDropdownRef = React.useRef<HTMLDivElement>(null);
  const providerDropdownRef = React.useRef<HTMLDivElement>(null);
  const printFamilyDropdownRef = React.useRef<HTMLDivElement>(null);
  const printProviderDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (familyDropdownRef.current && !familyDropdownRef.current.contains(event.target as Node)) {
        setOpenFamilySelect(false);
      }
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
        setOpenProviderSelect(false);
      }
      if (printFamilyDropdownRef.current && !printFamilyDropdownRef.current.contains(event.target as Node)) {
        setPrintOpenFamilySelect(false);
      }
      if (printProviderDropdownRef.current && !printProviderDropdownRef.current.contains(event.target as Node)) {
        setPrintOpenProviderSelect(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync initial selections
  React.useEffect(() => {
    if (allCategories.length > 0 && !isCatsInitialized) {
      setSelectedCats(allCategories.filter(cat => cat.toLowerCase() !== "envases" && cat.toLowerCase() !== "envase"));
      setIsCatsInitialized(true);
    }
  }, [allCategories, isCatsInitialized]);

  React.useEffect(() => {
    if (providers.length > 0 && !isProvsInitialized) {
      setSelectedProvs(providers.filter(p => p.is_active !== false).map(p => p.name));
      setIsProvsInitialized(true);
    }
  }, [providers, isProvsInitialized]);

  React.useEffect(() => {
    if (allCategories.length > 0 && !isPrintCatsInitialized) {
      setPrintSelectedCats(allCategories.filter(cat => cat.toLowerCase() !== "envases" && cat.toLowerCase() !== "envase"));
      setIsPrintCatsInitialized(true);
    }
  }, [allCategories, isPrintCatsInitialized]);

  React.useEffect(() => {
    if (providers.length > 0 && !isPrintProvsInitialized) {
      setPrintSelectedProvs(providers.filter(p => p.is_active !== false).map(p => p.name));
      setIsPrintProvsInitialized(true);
    }
  }, [providers, isPrintProvsInitialized]);

  // Derived filtered items for the printable list
  const filteredPrintItems = React.useMemo(() => {
    return stock.filter(item => {
      // 1. Show only active products
      if (item.is_active === false) return false;

      // 2. Filter by category
      const matchesCategory = printSelectedCats.includes(item.category);

      // 3. Filter by provider matching category
      let matchesProvider = true;
      const activeProviders = providers.filter(p => p.is_active !== false);
      const allActiveProviderNames = activeProviders.map(p => p.name);
      
      const isAllProvidersSelected = activeProviders.length === 0 || 
        allActiveProviderNames.every(name => printSelectedProvs.includes(name));

      if (!isAllProvidersSelected) {
        // Categories matching the checked active providers
        const checkedProviderCategories = providers
          .filter(p => p.is_active !== false && printSelectedProvs.includes(p.name))
          .map(p => p.category);
          
        matchesProvider = checkedProviderCategories.includes(item.category);
      }

      return matchesCategory && matchesProvider;
    });
  }, [stock, printSelectedCats, printSelectedProvs, providers]);

  const handleAddCategory = () => {
    const name = window.prompt("Nueva categoría de producto:");
    if (name && name.trim()) {
      const t = name.trim();
      const newC = [...customCats, t];
      setCustomCats(newC);
      localStorage.setItem("inventory_custom_cats", JSON.stringify(newC));
      if (showAddModal) setNewCategory(t);
      if (showEditModal) setEditCategory(t);
    }
  };

  const handleEditCategory = async (currentCat: string) => {
    if (!currentCat || currentCat === "__CUSTOM__") return;
    const name = window.prompt("Editar nombre de la categoría (se actualizarán los productos):", currentCat);
    if (name && name.trim() && name !== currentCat) {
      const t = name.trim();
      const newC = customCats.map(c => c === currentCat ? t : c);
      if (!newC.includes(t)) newC.push(t);
      setCustomCats(newC);
      const newR = [...removedCats, currentCat];
      setRemovedCats(newR);
      localStorage.setItem("inventory_custom_cats", JSON.stringify(newC));
      localStorage.setItem("inventory_removed_cats", JSON.stringify(newR));
      
      // Update all stock items referencing this cat
      const itemsToUpdate = stock.filter(s => s.category === currentCat);
      for (const item of itemsToUpdate) {
        await onEditStockItem(item.id, { category: t });
      }
      
      if (showAddModal && newCategory === currentCat) setNewCategory(t);
      if (showEditModal && editCategory === currentCat) setEditCategory(t);
    }
  };

  const handleDeleteCategory = (currentCat: string) => {
    if (!currentCat || currentCat === "__CUSTOM__") return;
    if (window.confirm(`¿Eliminar la categoría "${currentCat}"? Los productos se mantendrán pero la categoría se quitará de la lista.`)) {
      const newR = [...removedCats, currentCat];
      setRemovedCats(newR);
      localStorage.setItem("inventory_removed_cats", JSON.stringify(newR));
      
      if (showAddModal && newCategory === currentCat) setNewCategory(allCategories.find(c => c !== currentCat) || "");
      if (showEditModal && editCategory === currentCat) setEditCategory(allCategories.find(c => c !== currentCat) || "");
    }
  };

  // Form states for New Item
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<string>(BarCategory.CERVEZAS);
  const [newCustomCategoryName, setNewCustomCategoryName] = useState("");
  const [newQuantity, setNewQuantity] = useState(10);
  const [newMinQty, setNewMinQty] = useState(5);
  const [newPurchasePrice, setNewPurchasePrice] = useState<number | "">("");
  const [newSellingPrice, setNewSellingPrice] = useState<number | "">("");
  const [newSku, setNewSku] = useState("");
  const [newPresentationName, setNewPresentationName] = useState("");
  const [newPresentationUnits, setNewPresentationUnits] = useState<number | "">(1);
  const [newImageUrl, setNewImageUrl] = useState("");

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<string>(BarCategory.CERVEZAS);
  const [editCustomCategoryName, setEditCustomCategoryName] = useState("");
  const [editQuantity, setEditQuantity] = useState(0);
  const [editMinQty, setEditMinQty] = useState(0);
  const [editPurchasePrice, setEditPurchasePrice] = useState(0);
  const [editSellingPrice, setEditSellingPrice] = useState(0);
  const [editSku, setEditSku] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");

  // Statistics
  const totalItemsCount = stock.filter(item => item.is_active !== false && !item.is_recipe).length;
  const criticalItemsCount = stock.filter(item => item.is_active !== false && !item.is_recipe && item.quantity <= item.min_quantity).length;
  const totalValuationCost = stock.filter(item => item.is_active !== false && !item.is_recipe).reduce((acc, item) => acc + (item.quantity * item.purchase_price), 0);
  
  // Rotation KPI (dynamic representing percentage of quantity sold relative to current stock + sold)
  const totalQtyInStock = stock.filter(item => item.is_active !== false && !item.is_recipe).reduce((acc, item) => acc + item.quantity, 0);
  const totalQtySold = sales.reduce((acc, sale) => acc + sale.items.reduce((sum, item) => sum + item.quantity, 0), 0);
  const rotationRatePct = (totalQtyInStock + totalQtySold) > 0 
    ? Number(((totalQtySold / (totalQtyInStock + totalQtySold)) * 100).toFixed(1)) 
    : 0;

  // Filter & Search stock
  const filteredStock = React.useMemo(() => {
    return stock.filter(item => {
      const isActive = item.is_active !== false;
      if (!isActive || item.is_recipe) return false;
      
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                            (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()));
      
      // Match categories
      const matchesCategory = selectedCats.includes(item.category);
      
      // Match active provider
      let matchesProvider = true;
      const activeProviders = providers.filter(p => p.is_active !== false);
      const allActiveProviderNames = activeProviders.map(p => p.name);
      
      const isAllProvidersSelected = activeProviders.length === 0 || 
        allActiveProviderNames.every(name => selectedProvs.includes(name));

      if (!isAllProvidersSelected) {
        // Categories matching the checked active providers
        const checkedProviderCategories = providers
          .filter(p => p.is_active !== false && selectedProvs.includes(p.name))
          .map(p => p.category);
          
        matchesProvider = checkedProviderCategories.includes(item.category);
      }
      
      return matchesSearch && matchesCategory && matchesProvider;
    });
  }, [stock, search, selectedCats, selectedProvs, providers]);

  const handleOpenEdit = (item: StockItem) => {
    setShowEditModal(item);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditQuantity(item.quantity);
    setEditMinQty(item.min_quantity);
    setEditPurchasePrice(item.purchase_price);
    setEditSellingPrice(item.selling_price);
    setEditSku(item.sku || "");
    setEditImageUrl(item.image_url || "");
  };

  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    
    const finalCategory = newCategory;
    
    const success = await onAddStockItem({
      presentationName: newPresentationName || undefined,
      presentationUnits: typeof newPresentationUnits === 'number' ? newPresentationUnits : undefined,
      name: newName,
      category: finalCategory,
      quantity: Number(newQuantity),
      min_quantity: Number(newMinQty),
      purchase_price: Number(newPurchasePrice),
      selling_price: Number(newSellingPrice),
      sku: newSku || "SKU-" + Math.floor(Math.random() * 100000),
      image_url: newImageUrl.trim() || undefined
    });
    if (success) {
      setShowAddModal(false);
      resetNewForm();
    }
  };

  const resetNewForm = () => {
    setNewName("");
    setNewCategory(allCategories[0] || "General");
    setNewCustomCategoryName("");
    setNewQuantity(10);
    setNewMinQty(5);
    setNewPurchasePrice("");
    setNewSellingPrice("");
    setNewSku("");
    setNewImageUrl("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal || !editName) return;
    
    const finalCategory = editCategory;
    
    const success = await onEditStockItem(showEditModal.id, {
      name: editName,
      category: finalCategory,
      quantity: Number(editQuantity),
      min_quantity: Number(editMinQty),
      purchase_price: Number(editPurchasePrice),
      selling_price: Number(editSellingPrice),
      sku: editSku,
      image_url: editImageUrl.trim() || undefined,
      presentationName: showEditModal.presentationName,
      presentationUnits: showEditModal.presentationUnits
    });
    if (success) {
      setShowEditModal(null);
    }
  };

  const handleRegisterWaste = async (item: StockItem) => {
    const amountStr = prompt(`Registrar Merma para ${item.name}. Cantidad a descontar:`, "1");
    if (amountStr) {
      const amt = Number(amountStr);
      if (!isNaN(amt) && amt > 0) {
        const newQty = Math.max(0, item.quantity - amt);
        await onEditStockItem(item.id, { quantity: newQty });
      }
    }
  };

  const handleQuickAdd = async (item: StockItem, qty: number) => {
    await onEditStockItem(item.id, { quantity: item.quantity + qty });
  };

  return (
    <div className="space-y-6">
      
      {/* Top Navbar for Inventory sections */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setTabMode("inventory")}
          className={`pb-4 px-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            tabMode === "inventory" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Package className="w-4 h-4" />
          Gestión de Stock
        </button>
        <button
          onClick={() => setTabMode("prices")}
          className={`pb-4 px-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            tabMode === "prices" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Actualización de Precios
        </button>
        <button
          onClick={() => setTabMode("recipes")}
          className={`pb-4 px-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            tabMode === "recipes" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Layers className="w-4 h-4" />
          Recetas / Combos
        </button>
        <button
          onClick={() => setTabMode("history")}
          className={`pb-4 px-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            tabMode === "history" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <HistoryIcon className="w-4 h-4" />
          Kardex (Historial)
        </button>
      </div>

      {tabMode === "prices" ? (
         <PriceUpdateTab stock={stock} onEditStockItem={onEditStockItem} providers={providers} />
      ) : tabMode === "recipes" ? (
         <RecipesTab 
           stock={stock}
           onAddStockItem={onAddStockItem}
           onEditStockItem={onEditStockItem}
           onDeleteStockItem={onDeleteStockItem}
           categories={allCategories}
           onAddCategory={handleAddCategory}
           onEditCategory={handleEditCategory}
           onDeleteCategory={handleDeleteCategory}
         />
      ) : tabMode === "history" ? (
        <InventoryHistory stock={stock} movements={movements} />
      ) : (
      <>
        {/* High-Level Overview Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">VALOR TOTAL DE INVENTARIO</span>
          <h3 className="text-2xl font-bold font-mono text-[#091426] dark:text-slate-50 tracking-tight mt-1">
            ${totalValuationCost.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Costo total de adquisición activo</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ITEMS EN MÍNIMO</span>
          <div className="flex items-center gap-2 mt-1">
            <h3 className={`text-2xl font-bold font-mono tracking-tight ${criticalItemsCount > 0 ? "text-[#ba1a1a] dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {criticalItemsCount} CRÍTICO
            </h3>
            {criticalItemsCount > 0 && <AlertTriangle className="w-5 h-5 text-[#ba1a1a] dark:text-red-400 animate-pulse" />}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Requieren reabastecimiento urgente</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">ÍTEMS ACTIVOS</span>
          <h3 className="text-2xl font-bold font-mono text-[#091426] dark:text-slate-50 tracking-tight mt-1">{totalItemsCount}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Líneas registradas en catálogo</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ROTACIÓN DEL ALMACÉN</span>
          <h3 className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight mt-1">%{rotationRatePct}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Ratio estimado de reposición (30D)</p>
        </div>

      </div>

      {/* Main Stock Table and Control Board container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-xs overflow-hidden">
        
        {/* Table Filters header */}
        <div className="p-5 border-b border-[#eff4ff] bg-slate-50/40 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
          
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            {/* Listbox: Familias */}
            <div className="relative" ref={familyDropdownRef}>
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Filtrar por Familia :</label>
              <button
                type="button"
                onClick={() => {
                  setOpenFamilySelect(!openFamilySelect);
                  setOpenProviderSelect(false);
                }}
                className="w-full sm:w-56 flex items-center justify-between gap-3.5 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-705 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition cursor-pointer shadow-3xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">
                    {selectedCats.length === allCategories.length 
                      ? "Todas las Familias" 
                      : selectedCats.length === 0 
                      ? "Ninguna Familia" 
                      : `${selectedCats.length} Familias`}
                  </span>
                </div>
                {openFamilySelect ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>

              {openFamilySelect && (
                <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl shadow-xl z-40 p-3.5 space-y-3 animate-fade-in text-slate-800 dark:text-slate-150">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Seleccionar Familias</span>
                    <div className="flex gap-2 text-[10px] font-black">
                      <button
                        type="button"
                        onClick={() => setSelectedCats(allCategories)}
                        className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 uppercase cursor-pointer"
                      >
                        Todas
                      </button>
                      <span className="text-slate-200 dark:text-slate-800">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCats([])}
                        className="text-rose-600 hover:text-rose-700 uppercase cursor-pointer"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {allCategories.map((cat) => {
                      const isChecked = selectedCats.includes(cat);
                      return (
                        <label
                          key={cat}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-100/10 cursor-pointer transition text-xs font-semibold text-slate-705 dark:text-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedCats(selectedCats.filter(c => c !== cat));
                              } else {
                                setSelectedCats([...selectedCats, cat]);
                              }
                            }}
                            className="w-4 h-4 text-emerald-600 border-slate-300 dark:border-slate-750 rounded-sm focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                          />
                          <span className="truncate">{cat}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Listbox: Proveedores */}
            <div className="relative" ref={providerDropdownRef}>
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Filtrar por Proveedor :</label>
              <button
                type="button"
                onClick={() => {
                  setOpenProviderSelect(!openProviderSelect);
                  setOpenFamilySelect(false);
                }}
                className="w-full sm:w-56 flex items-center justify-between gap-3.5 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-705 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition cursor-pointer shadow-3xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">
                    {providers.length === 0 
                      ? "Sin Proveedores" 
                      : selectedProvs.length === providers.filter(p => p.is_active !== false).length 
                      ? "Todos los Proveedores" 
                      : selectedProvs.length === 0 
                      ? "Ningún Proveedor" 
                      : `${selectedProvs.length} Prov.`}
                  </span>
                </div>
                {openProviderSelect ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>

              {openProviderSelect && (
                <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl shadow-xl z-40 p-3.5 space-y-3 animate-fade-in text-slate-800 dark:text-slate-150">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Seleccionar Proveedores</span>
                    <div className="flex gap-2 text-[10px] font-black">
                      <button
                        type="button"
                        onClick={() => setSelectedProvs(providers.filter(p => p.is_active !== false).map(p => p.name))}
                        className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 uppercase cursor-pointer"
                      >
                        Todos
                      </button>
                      <span className="text-slate-200 dark:text-slate-800">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedProvs([])}
                        className="text-rose-600 hover:text-rose-700 uppercase cursor-pointer"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {providers.filter(p => p.is_active !== false).length === 0 ? (
                      <p className="text-[11px] italic text-slate-400 p-2">No hay proveedores activos registrados.</p>
                    ) : (
                      providers.filter(p => p.is_active !== false).map((p) => {
                        const isChecked = selectedProvs.includes(p.name);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-100/10 cursor-pointer transition text-xs font-semibold text-slate-705 dark:text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedProvs(selectedProvs.filter(name => name !== p.name));
                                } else {
                                  setSelectedProvs([...selectedProvs, p.name]);
                                }
                              }}
                              className="w-4 h-4 text-emerald-600 border-slate-300 dark:border-slate-750 rounded-sm focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                            />
                            <span className="truncate">{p.name} <span className="text-[10px] text-slate-400 font-normal">({p.category})</span></span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 mt-2 xl:mt-0 pt-3 xl:pt-0 border-t border-slate-100 xl:border-0">
            <div className="relative flex-1 sm:w-56 shrink-0">
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Filtrar por Nombre :</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por SKU o Nombre..."
                className="w-full pl-9 pr-4 py-2 border border-slate-205 rounded-xl text-xs focus:outline-hidden focus:border-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-7" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setPrintSelectedCats([...selectedCats]);
                  setPrintSelectedProvs([...selectedProvs]);
                  setShowPrintModal(true);
                }}
                className="flex-1 sm:flex-none justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer leading-none whitespace-nowrap"
                title="Configurar e imprimir catálogo de precios"
              >
                <Printer className="w-4 h-4 text-white" />
                <span>IMPRIMIR</span>
              </button>

              <button
                onClick={() => setShowConsumoModal(true)}
                className="flex-1 sm:flex-none justify-center bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-2.5 px-4 rounded-xl shadow-3xs flex items-center gap-1.5 cursor-pointer leading-none whitespace-nowrap transition border border-rose-200"
              >
                <Coffee className="w-4 h-4 text-rose-600" />
                CONSUMO
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="flex-1 sm:flex-none justify-center bg-[#091426] hover:bg-[#1e293b] text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer leading-none whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-white" />
                NUEVO PRODUCTO
              </button>
            </div>
          </div>

        </div>

        {/* Dense Stock Table view */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50/50 border-b border-[#eff4ff] text-slate-400 font-bold uppercase tracking-wider text-[9px] select-none">
                <th className="py-3 px-4">SKU / ID</th>
                <th className="py-3 px-4">Nombre de Producto</th>
                <th className="py-3 px-4">Categoría Familia</th>
                <th className="py-3 px-4 text-center w-[160px]">Nivel Stock Actual</th>
                <th className="py-3 px-4 text-center">Mín. Crítico</th>
                <th className="py-3 px-4 text-right">Costo unit.</th>
                <th className="py-3 px-4 text-right">PVP Cliente</th>
                <th className="py-3 px-4 text-center w-[150px]">Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eff4ff] font-medium text-slate-800">
              {filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-405 font-bold">
                    No se encontraron productos coincidentes en el inventario.
                  </td>
                </tr>
              ) : (
                filteredStock.map((item) => {
                  const isLow = item.quantity <= item.min_quantity;
                  const ratio = Math.min(100, Math.max(0, (item.quantity / 200) * 100)); // Capacity relative to 200 items max
                  const isActive = item.is_active !== false;
                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/50 transition cursor-pointer ${!isActive ? "bg-slate-50/30 opacity-75" : ""}`} onClick={() => handleOpenEdit(item)}>
                      
                      {/* SKU / CODE */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] text-slate-400 font-bold">
                          {item.sku || `PRO-${item.id.replace("prod_", "")}`}
                        </span>
                      </td>

                      {/* Product Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-8 h-8 rounded-lg object-cover border border-slate-100 shrink-0"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-100 dark:border-slate-700 font-bold text-xs select-none">
                              📦
                            </div>
                          )}
                          <div className="flex flex-col justify-center">
                            <span className={`font-semibold block truncate max-w-[180px] ${!isActive ? "text-slate-400 line-through italic" : "text-slate-900 dark:text-slate-100"}`} title={item.name}>
                              {item.name}
                            </span>
                            {!isActive && (
                              <span className="text-[8px] font-extrabold tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 py-0.5 px-1.5 rounded-sm uppercase leading-none w-max">
                                Inactivo
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3 px-4">
                        <span className="inline-block py-0.5 px-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md font-sans text-[10px] font-bold">
                          {item.category}
                        </span>
                      </td>

                      {/* Current Stock indicators with inline progress bars */}
                      <td className="py-3 px-4 text-center">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className={`font-mono font-bold ${isLow ? "text-[#ba1a1a] dark:text-red-400 font-black" : "text-emerald-700 dark:text-emerald-400"}`}>
                              {item.quantity} Unid.
                            </span>
                            {isLow && (
                              <span className="text-[9px] bg-[#ffdad6] dark:bg-red-950/40 text-[#93000a] dark:text-red-300 leading-none py-0.5 px-1.5 rounded-md font-bold uppercase font-sans">
                                Alerta
                              </span>
                            )}
                          </div>
                          {/* Capacity ratio bar */}
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${isLow ? "bg-[#ba1a1a]" : "bg-emerald-500"}`}
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Min Critical */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-semibold text-slate-400 dark:text-slate-350">
                          {item.min_quantity}
                        </span>
                      </td>

                      {/* Cost */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                          ${item.purchase_price.toFixed(2)}
                        </span>
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-50">
                          ${item.selling_price.toFixed(2)}
                        </span>
                      </td>

                      {/* Quick refinement actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          <button
                            onClick={() => handleQuickAdd(item, 10)}
                            disabled={!isActive}
                            className={`py-1 px-1.5 rounded-md font-extrabold text-[10px] tracking-wide cursor-pointer transition ${
                              isActive 
                                ? "bg-slate-100 hover:bg-slate-200 text-[#091426]" 
                                : "bg-slate-50 text-slate-350 opacity-50 cursor-not-allowed"
                            }`}
                            title={isActive ? "Sumar +10 unidades" : "Producto inactivo (Habilítelo primero)"}
                          >
                            +10
                          </button>

                          <button
                            onClick={() => handleRegisterWaste(item)}
                            disabled={!isActive}
                            className={`py-1 px-1.5 rounded-md font-bold text-[10px] cursor-pointer transition ${
                              isActive 
                                ? "bg-[#ffdad6] hover:bg-[#ffb4ab] text-[#93000a]" 
                                : "bg-slate-50 text-slate-350 opacity-50 cursor-not-allowed"
                            }`}
                            title={isActive ? "Registrar merma/mermas" : "Producto inactivo (Habilítelo primero)"}
                          >
                            Merma
                          </button>

                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
                            title="Editar propiedades de producto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={async () => {
                              const toggleState = !isActive;
                              await onEditStockItem(item.id, { is_active: toggleState });
                            }}
                            className={`p-1 cursor-pointer transition ${
                              isActive 
                                ? "text-emerald-600 hover:text-amber-500" 
                                : "text-amber-500 hover:text-emerald-600"
                            }`}
                            title={isActive ? "Desactivar temporariamente" : "Habilitar item"}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirmItem(item)}
                            className="p-1 text-slate-400 hover:text-[#ba1a1a] cursor-pointer"
                            title="Eliminar del inventario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info displaying record counts */}
        <div className="p-4 border-t border-[#eff4ff] bg-slate-50/20 text-center text-[11px] text-slate-400 font-semibold select-none">
          Mostrando {filteredStock.length} de {totalItemsCount} productos listados en la base de datos local db.json.
        </div>

      </div>

      {/* --- ADD MODAL DIALOG --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#091426]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-205 shadow-xl max-w-md w-full overflow-hidden animate-scale-up">
            
            <div className="p-5 border-b border-[#eff4ff] flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-slate-500" />
                Registrar Nuevo Artículo
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-slate-250 cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-550" />
              </button>
            </div>

            <form onSubmit={handleSaveNew} className="p-5 space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Código SKU (Opcional)</label>
                  <input
                    type="text"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="Ej. BEV-GIN-01"
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Categoría</label>
                  <CategorySelect
                    value={newCategory}
                    categories={allCategories}
                    onChange={setNewCategory}
                    onAdd={handleAddCategory}
                    onEdit={handleEditCategory}
                    onDelete={handleDeleteCategory}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Presentación</label>
                <PresentationSelect
                  presentations={presentations}
                  value={newPresentationName ? `${newPresentationName} (${newPresentationUnits} unid)` : ""}
                  onChange={(presentation) => {
                    setNewPresentationName(presentation.name);
                    setNewPresentationUnits(presentation.units);
                  }}
                  onAdd={() => {
                      const name = window.prompt("Nombre de la presentación:");
                      if (!name) return;
                      const units = Number(window.prompt("Unidades:"));
                      if (name && units) onAddPresentation(name, units);
                  }}
                  onEdit={(id, name) => {
                      const newName = window.prompt("Nuevo nombre:", name);
                      if (!newName) return;
                      const units = Number(window.prompt("Nuevas unidades:"));
                      if (newName && units) onEditPresentation(id, newName, units);
                  }}
                  onDelete={(id) => {
                      if (window.confirm("¿Eliminar presentación?")) onDeletePresentation(id);
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre del Producto</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Casillero del Diablo Cabernet"
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Stock Inicial</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Mínimo Crítico</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newMinQty}
                    onChange={(e) => setNewMinQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Costo unitario ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Precio de Venta ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newSellingPrice}
                    onChange={(e) => setNewSellingPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">URL de Imagen del Producto (Opcional)</label>
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://ejemplo.com/imagen.jpg"
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#eff4ff] justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2 px-4 bg-slate-100 text-slate-705 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 bg-[#091426] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Guardar Producto
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL DIALOG --- */}
      {showEditModal && (
        <div className="fixed inset-0 bg-[#091426]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-205 shadow-xl max-w-md w-full overflow-hidden animate-scale-up">
            
            <div className="p-5 border-b border-[#eff4ff] flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-slate-550" />
                Editar Propiedades de Producto
              </h3>
              <button 
                onClick={() => setShowEditModal(null)}
                className="p-1 rounded-lg hover:bg-slate-250 cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-550" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Código SKU</label>
                  <input
                    type="text"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Categoría</label>
                  <CategorySelect
                    value={editCategory}
                    categories={allCategories}
                    onChange={setEditCategory}
                    onAdd={handleAddCategory}
                    onEdit={handleEditCategory}
                    onDelete={handleDeleteCategory}
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Presentación</label>
                <PresentationSelect
                  presentations={presentations}
                  value={showEditModal?.presentationName ? `${showEditModal.presentationName} (${showEditModal.presentationUnits} unid)` : ""}
                  onChange={(presentation) => {
                       setShowEditModal(prev => prev ? {...prev, presentationName: presentation.name, presentationUnits: presentation.units} : null);
                  }} 
                  onAdd={() => {
                      const name = window.prompt("Nombre de la presentación:");
                      if (!name) return;
                      const units = Number(window.prompt("Unidades:"));
                      if (name && units) onAddPresentation(name, units);
                  }}
                  onEdit={(id, name) => {
                      const newName = window.prompt("Nuevo nombre:", name);
                      if (!newName) return;
                      const units = Number(window.prompt("Nuevas unidades:"));
                      if (newName && units) onEditPresentation(id, newName, units);
                  }}
                  onDelete={(id) => {
                      if (window.confirm("¿Eliminar presentación?")) onDeletePresentation(id);
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre del Producto</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Stock Actual</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Mínimo Crítico</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editMinQty}
                    onChange={(e) => setEditMinQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Costo unitario ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editPurchasePrice}
                    onChange={(e) => setEditPurchasePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Precio de Venta ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editSellingPrice}
                    onChange={(e) => setEditSellingPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">URL de Imagen del Producto (Opcional)</label>
                <input
                  type="url"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="https://ejemplo.com/imagen.jpg"
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#eff4ff] justify-end">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="py-2 px-4 bg-slate-100 text-slate-705 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 bg-[#091426] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {deleteConfirmItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl p-6 max-w-sm w-full space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-rose-600 animate-pulse">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">¿Eliminar Producto?</h3>
              <p className="text-xs text-slate-500">
                ¿Seguro que deseas eliminar <strong className="text-slate-800">{deleteConfirmItem.name}</strong>? Se borrará del catálogo y de la base de datos de stock de forma permanente.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteStockItem(deleteConfirmItem.id);
                  setDeleteConfirmItem(null);
                }}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showConsumoModal && (
          <ConsumoModal 
            stock={stock} 
            onClose={() => setShowConsumoModal(false)}
            onConfirm={handleRegisterConsumo}
          />
      )}

      {showPrintModal && (
        <>
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #print-price-list-section, #print-price-list-section * {
                visibility: visible;
              }
              #print-price-list-section {
                position: absolute;
                left: 10mm;
                top: 10mm;
                width: 190mm;
              }
              header, nav, sidebar, footer, .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in no-print bg-slate-900/70">
            <div className="bg-white rounded-2xl p-6 md:p-8 max-w-4xl w-full shadow-2xl relative space-y-6 max-h-[95vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:p-0 print:border-0 print:rounded-none text-slate-800">
              
              {/* Controls Panel - Hidden during Print */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5 print:hidden">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Printer className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-base font-black uppercase tracking-wider font-sans">Imprimir Lista de Precios</h3>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Configure los filtros antes de mandar a imprimir o guardar como PDF.</p>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      try {
                        window.focus();
                        setTimeout(() => {
                          window.print();
                        }, 150);
                      } catch (e) {
                        window.print();
                      }
                    }}
                    className="flex-1 sm:flex-none py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 uppercase cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-white" />
                    <span>Imprimir Lista</span>
                  </button>
                  <button
                    onClick={() => setShowPrintModal(false)}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              {/* Filters Configuration Board - Hidden during Print */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-250/60 grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden z-10">
                {/* 1. Categorías Filter */}
                <div className="space-y-1.5 relative" ref={printFamilyDropdownRef}>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block font-sans">Filtrar por Familia :</label>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintOpenFamilySelect(!printOpenFamilySelect);
                      setPrintOpenProviderSelect(false);
                    }}
                    className="w-full text-left bg-white text-slate-850 border border-slate-200 py-2.5 px-3.5 rounded-xl text-xs font-bold focus:outline-hidden flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate">
                      {printSelectedCats.length === allCategories.length 
                        ? "Todas las Familias" 
                        : printSelectedCats.length === 0 
                        ? "Ninguna Familia" 
                        : `${printSelectedCats.length} Seleccionadas`}
                    </span>
                    {printOpenFamilySelect ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  </button>

                  {printOpenFamilySelect && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 space-y-2 max-h-56 overflow-y-auto">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-[9px] font-black uppercase text-slate-400">
                        <span>Seleccionar</span>
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => setPrintSelectedCats(allCategories)} className="text-emerald-700 hover:text-emerald-800 uppercase">Todas</button>
                          <span>|</span>
                          <button type="button" onClick={() => setPrintSelectedCats([])} className="text-rose-600 hover:text-rose-700 uppercase">Limpiar</button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {allCategories.map(cat => {
                          const isChecked = printSelectedCats.includes(cat);
                          return (
                            <label key={cat} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-705">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setPrintSelectedCats(printSelectedCats.filter(c => c !== cat));
                                  } else {
                                    setPrintSelectedCats([...printSelectedCats, cat]);
                                  }
                                }}
                                className="w-3.5 h-3.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                              />
                              <span className="truncate">{cat}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Proveedores Filter */}
                <div className="space-y-1.5 relative" ref={printProviderDropdownRef}>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block font-sans">Filtrar por Proveedor :</label>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintOpenProviderSelect(!printOpenProviderSelect);
                      setPrintOpenFamilySelect(false);
                    }}
                    className="w-full text-left bg-white text-slate-850 border border-slate-200 py-2.5 px-3.5 rounded-xl text-xs font-bold focus:outline-hidden flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate">
                      {providers.length === 0 
                        ? "Sin Proveedores" 
                        : printSelectedProvs.length === providers.filter(p => p.is_active !== false).length 
                        ? "Todos los Proveedores" 
                        : printSelectedProvs.length === 0 
                        ? "Ningún Proveedor" 
                        : `${printSelectedProvs.length} Seleccionados`}
                    </span>
                    {printOpenProviderSelect ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  </button>

                  {printOpenProviderSelect && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 space-y-2 max-h-56 overflow-y-auto">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-[9px] font-black uppercase text-slate-400">
                        <span>Seleccionar</span>
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => setPrintSelectedProvs(providers.filter(p => p.is_active !== false).map(p => p.name))} className="text-emerald-700 hover:text-emerald-800 uppercase">Todos</button>
                          <span>|</span>
                          <button type="button" onClick={() => setPrintSelectedProvs([])} className="text-rose-600 hover:text-rose-700 uppercase">Limpiar</button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {providers.filter(p => p.is_active !== false).length === 0 ? (
                          <p className="text-[11px] italic text-slate-400 p-1 font-semibold">No hay proveedores activos registrados.</p>
                        ) : (
                          providers.filter(p => p.is_active !== false).map(p => {
                            const isChecked = printSelectedProvs.includes(p.name);
                            return (
                              <label key={p.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-705">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setPrintSelectedProvs(printSelectedProvs.filter(name => name !== p.name));
                                    } else {
                                      setPrintSelectedProvs([...printSelectedProvs, p.name]);
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                                />
                                <span className="truncate">{p.name} <span className="text-[10px] text-slate-400 font-normal">({p.category})</span></span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Listas Display Filter */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block font-sans">Columnas de Tarifas :</label>
                  <div className="grid grid-cols-3 gap-1 grid-flow-row">
                    <button
                      onClick={() => setPrintPriceType("selling")}
                      className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition ${printPriceType === "selling" ? "bg-[#091426] text-white border-[#091426]" : "bg-white text-slate-600 border-slate-200"}`}
                    >
                      Solo PVP
                    </button>
                    <button
                      onClick={() => setPrintPriceType("cost")}
                      className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition ${printPriceType === "cost" ? "bg-[#091426] text-white border-[#091426]" : "bg-white text-slate-600 border-slate-200"}`}
                    >
                      Solo Costo
                    </button>
                    <button
                      onClick={() => setPrintPriceType("both")}
                      className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition ${printPriceType === "both" ? "bg-[#091426] text-white border-[#091426]" : "bg-white text-slate-600 border-slate-200"}`}
                    >
                      Costos y PVP
                    </button>
                  </div>
                </div>
              </div>

              {/* Printable Section Layout */}
              <div id="print-price-list-section" className="space-y-6 text-slate-900 font-sans print:text-black">
                
                {/* Printable Header */}
                <div className="text-center pb-4 border-b-2 border-dashed border-slate-300 flex flex-col items-center">
                  {customLogo && (
                    <img 
                      src={customLogo} 
                      alt="Logo De Primera" 
                      className="w-20 h-20 object-contain mb-3"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <h1 className="text-xl font-black uppercase tracking-widest text-slate-800 print:text-black">
                    DE PRIMERA - Tarifa de Precios
                  </h1>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1 print:text-black">
                    Fútbol & Eventos • Catálogo Oficial de Precios
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs">
                    <div>
                      Fecha Emisión: <span className="font-extrabold text-slate-800 print:text-black">{new Date().toLocaleDateString("es-ES")}</span>
                    </div>
                    {printSelectedCats.length < allCategories.length && (
                      <div>
                        Familias: <span className="font-bold font-mono text-slate-650 print:text-black">
                          {printSelectedCats.length === 0 ? "Ninguna" : printSelectedCats.join(", ")}
                        </span>
                      </div>
                    )}
                    {printSelectedProvs.length < providers.filter(p => p.is_active !== false).length && (
                      <div>
                        Proveedores: <span className="font-bold text-slate-650 print:text-black">
                          {printSelectedProvs.length === 0 ? "Ninguno" : printSelectedProvs.map(p => p).join(", ")}
                        </span>
                      </div>
                    )}
                    <div>
                      Tipo: <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold print:bg-transparent print:p-0">
                        {printPriceType === "selling" ? "Solo Precios de Venta" : printPriceType === "cost" ? "Solo Precios de Costo" : "Costos y Precios de Venta"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Printable Table */}
                <div className="overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-600 print:text-black bg-slate-50/50">
                        <th className="py-2.5 px-3">SKU / ID</th>
                        <th className="py-2.5 px-3">Nombre del Producto</th>
                        <th className="py-2.5 px-3">Familia / Categoría</th>
                        {(printPriceType === "cost" || printPriceType === "both") && (
                          <th className="py-2.5 px-3 text-right">Precio Costo ($)</th>
                        )}
                        {(printPriceType === "selling" || printPriceType === "both") && (
                          <th className="py-2.5 px-3 text-right text-emerald-800 print:text-black font-black">PVP Cliente ($)</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredPrintItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 font-bold italic">
                            No hay productos que coincidan con estos filtros establecidos.
                          </td>
                        </tr>
                      ) : (
                        filteredPrintItems.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-400 print:text-black text-[10px]">
                              {item.sku || `PRO-${item.id.replace("prod_", "")}`}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-800 print:text-black text-xs">
                              {item.name}
                            </td>
                            <td className="py-2 px-3 text-slate-500 print:text-black text-xs font-medium">
                              {item.category}
                            </td>
                            {(printPriceType === "cost" || printPriceType === "both") && (
                              <td className="py-2 px-3 text-right font-mono text-slate-800 print:text-black text-xs font-semibold">
                                ${item.purchase_price.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            )}
                            {(printPriceType === "selling" || printPriceType === "both") && (
                              <td className="py-2 px-3 text-right font-mono text-emerald-700 print:text-black text-xs font-bold">
                                ${item.selling_price.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Printable Footer / Disclaimer */}
                <div className="pt-6 border-t-2 border-dashed border-slate-300 flex justify-between items-center text-[10px] text-slate-400 print:text-black font-semibold">
                  <span>De Primera Fútbol & Eventos - Sistema Administrativo</span>
                  <span>Total {filteredPrintItems.length} artículos impresos</span>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      </>
      )}

    </div>
  );
};

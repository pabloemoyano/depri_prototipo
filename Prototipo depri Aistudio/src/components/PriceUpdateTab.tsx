import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StockItem, CostChangeRecord, Provider } from '../types';
import { Search, Percent, Save, History, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Filter, Truck } from 'lucide-react';

interface PriceUpdateTabProps {
  stock: StockItem[];
  onEditStockItem: (id: string, updatedFields: Partial<StockItem>) => Promise<boolean>;
  providers?: Provider[];
}

export const PriceUpdateTab: React.FC<PriceUpdateTabProps> = ({ stock, onEditStockItem, providers = [] }) => {
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [priceHistory, setPriceHistory] = useState<CostChangeRecord[]>([]);

  // Bulk percentage application
  const [percentApplyTo, setPercentApplyTo] = useState<"cost" | "selling" | "both">("both");
  const [percentValue, setPercentValue] = useState<number>(0);

  useEffect(() => {
    const savedHistory = localStorage.getItem("inventory_price_history");
    if (savedHistory) {
      try {
        setPriceHistory(JSON.parse(savedHistory));
      } catch(e) {}
    }
  }, []);

  const saveHistory = (records: CostChangeRecord[]) => {
    setPriceHistory(prev => {
      const merged = [...records, ...prev];
      localStorage.setItem("inventory_price_history", JSON.stringify(merged));
      return merged;
    });
  };

  // Filter active stock
  const activeStock = useMemo(() => {
    return stock.filter(item => item.is_active !== false);
  }, [stock]);

  // Derive categories from active products only
  const allCategories = useMemo(() => {
    return Array.from(new Set(activeStock.map(s => s.category))).filter(Boolean).sort();
  }, [activeStock]);

  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedProvs, setSelectedProvs] = useState<string[]>([]);
  const [isCatsInitialized, setIsCatsInitialized] = useState(false);
  const [isProvsInitialized, setIsProvsInitialized] = useState(false);

  const [openFamilySelect, setOpenFamilySelect] = useState(false);
  const [openProviderSelect, setOpenProviderSelect] = useState(false);
  const familyDropdownRef = useRef<HTMLDivElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);

  // States for History Filters
  const [historyStartDate, setHistoryStartDate] = useState<string>("");
  const [historyEndDate, setHistoryEndDate] = useState<string>("");
  const [selectedHistoryProds, setSelectedHistoryProds] = useState<string[]>([]);
  const [isHistoryProdsInitialized, setIsHistoryProdsInitialized] = useState(false);
  const [openHistoryProdSelect, setOpenHistoryProdSelect] = useState(false);
  const [searchHistoryProd, setSearchHistoryProd] = useState("");
  const historyProdDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (familyDropdownRef.current && !familyDropdownRef.current.contains(event.target as Node)) {
        setOpenFamilySelect(false);
      }
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
        setOpenProviderSelect(false);
      }
      if (historyProdDropdownRef.current && !historyProdDropdownRef.current.contains(event.target as Node)) {
        setOpenHistoryProdSelect(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // History Products helper memo
  const uniqueHistoryProducts = useMemo(() => {
    return Array.from(new Set(priceHistory.map(h => h.productName))).filter(Boolean).sort();
  }, [priceHistory]);

  useEffect(() => {
    if (uniqueHistoryProducts.length > 0 && !isHistoryProdsInitialized) {
      setSelectedHistoryProds(uniqueHistoryProducts);
      setIsHistoryProdsInitialized(true);
    }
  }, [uniqueHistoryProducts, isHistoryProdsInitialized]);

  const filteredPriceHistory = useMemo(() => {
    return priceHistory.filter(record => {
      // Date bounds
      if (historyStartDate) {
        const start = new Date(historyStartDate);
        start.setHours(0, 0, 0, 0);
        const recordDate = new Date(record.date);
        if (recordDate < start) return false;
      }
      if (historyEndDate) {
        const end = new Date(historyEndDate);
        end.setHours(23, 59, 59, 999);
        const recordDate = new Date(record.date);
        if (recordDate > end) return false;
      }

      // Products checks bounds
      return selectedHistoryProds.includes(record.productName);
    });
  }, [priceHistory, historyStartDate, historyEndDate, selectedHistoryProds]);

  useEffect(() => {
    if (allCategories.length > 0 && !isCatsInitialized) {
      setSelectedCats(allCategories.filter(cat => cat.toLowerCase() !== "envases" && cat.toLowerCase() !== "envase"));
      setIsCatsInitialized(true);
    }
  }, [allCategories, isCatsInitialized]);

  useEffect(() => {
    const activeProvs = providers.filter(p => p.is_active !== false).map(p => p.name);
    if (activeProvs.length > 0 && !isProvsInitialized) {
      setSelectedProvs(activeProvs);
      setIsProvsInitialized(true);
    }
  }, [providers, isProvsInitialized]);

  // Filtered Stock of active products
  const filteredStock = useMemo(() => {
    return activeStock.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
        (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()));
      
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
  }, [activeStock, search, selectedCats, selectedProvs, providers]);

  // Local state for modified prices
  // Map of stock_id -> { purchase_price, selling_price }
  const [modifiedPrices, setModifiedPrices] = useState<Record<string, { purchase_price: number; selling_price: number }>>({});

  // Initialize from stock or modified
  const getPrice = (id: string, type: "purchase_price" | "selling_price") => {
    if (modifiedPrices[id]) return modifiedPrices[id][type];
    const item = stock.find(s => s.id === id);
    return item ? item[type] : 0;
  };

  // Live calculated recipe cost based on stock and pending modified costs of components
  const getRecipeCost = (item: StockItem) => {
    if (!item.is_recipe || !item.components || item.components.length === 0) return item.purchase_price;
    return item.components.reduce((sum, comp) => {
      const ing = stock.find(s => s.id === comp.stock_item_id);
      if (!ing) return sum;
      // Use the pending modified cost of the ingredient from modifiedPrices, otherwise its active cost in stock
      const ingCost = modifiedPrices[ing.id]?.purchase_price ?? ing.purchase_price;
      return sum + (ingCost * comp.quantity);
    }, 0);
  };

  const handlePriceChange = (id: string, type: "purchase_price" | "selling_price", value: number) => {
    setModifiedPrices(prev => {
      const current = prev[id] || { 
        purchase_price: stock.find(s => s.id === id)?.purchase_price || 0,
        selling_price: stock.find(s => s.id === id)?.selling_price || 0
      };
      return {
        ...prev,
        [id]: { ...current, [type]: value }
      };
    });
  };

  const handleApplyPercentage = () => {
    if (percentValue === 0) return;
    
    setModifiedPrices(prev => {
      const next = { ...prev };
      const multiplier = 1 + (percentValue / 100);
      
      filteredStock.forEach(item => {
        const currentModified = next[item.id] || { purchase_price: item.purchase_price, selling_price: item.selling_price };
        if (!item.is_recipe && (percentApplyTo === "cost" || percentApplyTo === "both")) {
          currentModified.purchase_price = parseFloat((currentModified.purchase_price * multiplier).toFixed(2));
        }
        if (percentApplyTo === "selling" || percentApplyTo === "both") {
          currentModified.selling_price = parseFloat((currentModified.selling_price * multiplier).toFixed(2));
        }
        next[item.id] = currentModified;
      });
      return next;
    });
  };

  const handleSaveAll = async () => {
    const keys = Object.keys(modifiedPrices);
    if (keys.length === 0) return;

    const historyRecords: CostChangeRecord[] = [];
    const now = new Date().toISOString();

    if (confirm(`¿Actualizar los precios de ${keys.length} productos?`)) {
      for (const id of keys) {
        const original = stock.find(s => s.id === id);
        if (!original) continue;
        
        const mods = modifiedPrices[id];
        const hasCostChanged = original.purchase_price !== mods.purchase_price;
        const hasSellingChanged = original.selling_price !== mods.selling_price;
        
        if (hasCostChanged || hasSellingChanged) {
          // Perform edit via existing App function
          await onEditStockItem(id, {
            purchase_price: mods.purchase_price,
            selling_price: mods.selling_price
          });
          
          if (hasCostChanged) {
             historyRecords.push({
               id: `cost_${Date.now()}_${id}`,
               date: now,
               productId: id,
               productName: original.name,
               providerName: "General", // Using General since Provider entity isn't strongly attached to StockItem
               oldCost: original.purchase_price,
               newCost: mods.purchase_price,
               variationPct: ((mods.purchase_price - original.purchase_price) / original.purchase_price) * 100
             });
          }
        }
      }
      
      if (historyRecords.length > 0) {
        saveHistory(historyRecords);
      }
      setModifiedPrices({});
      alert("✅ ¡Precios actualizados exitosamente!");
    }
  };

  const hasPendingChanges = Object.keys(modifiedPrices).length > 0;

  if (showHistory) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              Historial de Cambios de Costo
            </h3>
            <button
              onClick={() => setShowHistory(false)}
              className="text-xs font-bold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              Volver a Precios
            </button>
          </div>

          {/* History Filters Panel */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row gap-3 mb-5 items-stretch md:items-end">
            {/* Start Date */}
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">Fecha Inicio :</label>
              <input
                type="date"
                value={historyStartDate}
                onChange={(e) => setHistoryStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans font-semibold text-slate-700"
              />
            </div>

            {/* End Date */}
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">Fecha Fin :</label>
              <input
                type="date"
                value={historyEndDate}
                onChange={(e) => setHistoryEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans font-semibold text-slate-700"
              />
            </div>

            {/* Listbox: Products under History */}
            <div className="flex-1 min-w-[200px] relative" ref={historyProdDropdownRef}>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">Filtrar por Producto :</label>
              <button
                type="button"
                onClick={() => setOpenHistoryProdSelect(!openHistoryProdSelect)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-3xs text-left"
              >
                <div className="flex items-center gap-2 truncate">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">
                    {uniqueHistoryProducts.length === 0
                      ? "Sin Productos"
                      : selectedHistoryProds.length === uniqueHistoryProducts.length
                      ? "Todos los Prod."
                      : selectedHistoryProds.length === 0
                      ? "Ningún Prod."
                      : `${selectedHistoryProds.length} Prod.`}
                  </span>
                </div>
                {openHistoryProdSelect ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>

              {openHistoryProdSelect && (
                <div className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-40 p-3.5 space-y-3 animate-fade-in text-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Seleccionar Productos</span>
                    <div className="flex gap-2 text-[10px] font-black">
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryProds(uniqueHistoryProducts)}
                        className="text-emerald-600 hover:text-emerald-700 uppercase cursor-pointer"
                      >
                        Todos
                      </button>
                      <span className="text-slate-200">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryProds([])}
                        className="text-rose-600 hover:text-rose-700 uppercase cursor-pointer"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  {/* Internal product search inside dropdown */}
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrar lista..."
                      value={searchHistoryProd}
                      onChange={(e) => setSearchHistoryProd(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 border border-slate-200 rounded-lg text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans bg-white"
                    />
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {uniqueHistoryProducts.filter(name => name.toLowerCase().includes(searchHistoryProd.toLowerCase())).length === 0 ? (
                      <p className="text-[11px] italic text-slate-400 p-2 text-center font-sans">No se encontraron productos.</p>
                    ) : (
                      uniqueHistoryProducts
                        .filter(name => name.toLowerCase().includes(searchHistoryProd.toLowerCase()))
                        .map((prodName) => {
                          const isChecked = selectedHistoryProds.includes(prodName);
                          return (
                            <label
                              key={prodName}
                              className="flex items-center gap-2.5 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer transition text-xs font-semibold text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedHistoryProds(selectedHistoryProds.filter(n => n !== prodName));
                                  } else {
                                    setSelectedHistoryProds([...selectedHistoryProds, prodName]);
                                  }
                                }}
                                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                              />
                              <span className="truncate font-sans">{prodName}</span>
                            </label>
                          );
                        })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Clear All Filters Button */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  setHistoryStartDate("");
                  setHistoryEndDate("");
                  setSelectedHistoryProds(uniqueHistoryProducts);
                  setSearchHistoryProd("");
                }}
                className="w-full px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer bg-white"
              >
                Restablecer Filtros
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#eff4ff]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-[#eff4ff]">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4 text-right">Costo Anterior</th>
                  <th className="py-3 px-4 text-right">Costo Nuevo</th>
                  <th className="py-3 px-4 text-right">Variación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eff4ff]">
                {filteredPriceHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs font-medium font-sans">
                      {priceHistory.length === 0 ? "No hay historial registrado." : "No se hallaron registros con los filtros seleccionados."}
                    </td>
                  </tr>
                ) : (
                  [...filteredPriceHistory].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(record => (
                    <tr key={record.id} className="hover:bg-slate-50 border-b border-slate-100">
                      <td className="py-3 px-4 text-xs font-medium text-slate-600 font-sans">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-xs font-bold text-slate-800 font-sans">{record.productName}</td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-600 text-right">${record.oldCost.toFixed(2)}</td>
                      <td className="py-3 px-4 text-xs font-mono font-bold text-slate-900 text-right">${record.newCost.toFixed(2)}</td>
                      <td className="py-3 px-4 text-xs font-bold text-right">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${record.variationPct > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                           {record.variationPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                           {Math.abs(record.variationPct).toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Action Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs flex flex-col gap-4">
         
         <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-end justify-between">
           {/* Filters */}
           <div className="flex flex-col md:flex-row gap-3 flex-1 items-stretch md:items-end">
             {/* Search */}
             <div className="flex-1 min-w-[200px]">
               <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">Buscar Producto :</label>
               <div className="relative">
                 <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                 <input
                   type="text"
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   placeholder="Buscar por nombre o SKU..."
                   className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                 />
               </div>
             </div>

             {/* Listbox: Familias */}
             <div className="relative min-w-[180px]" ref={familyDropdownRef}>
               <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 font-sans">Filtrar por Familia :</label>
               <button
                 type="button"
                 onClick={() => {
                   setOpenFamilySelect(!openFamilySelect);
                   setOpenProviderSelect(false);
                 }}
                 className="w-full flex items-center justify-between gap-3 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-3xs"
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
                 <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-40 p-3.5 space-y-3 animate-fade-in text-slate-800">
                   <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                     <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-sans">Seleccionar Familias</span>
                     <div className="flex gap-2 text-[10px] font-black">
                       <button
                         type="button"
                         onClick={() => setSelectedCats(allCategories)}
                         className="text-emerald-600 hover:text-emerald-700 uppercase cursor-pointer"
                       >
                         Todas
                       </button>
                       <span className="text-slate-200">|</span>
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
                           className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition text-xs font-semibold text-slate-700"
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
                             className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer accent-emerald-600"
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
             <div className="relative min-w-[180px]" ref={providerDropdownRef}>
               <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">Filtrar por Proveedor :</label>
               <button
                 type="button"
                 onClick={() => {
                   setOpenProviderSelect(!openProviderSelect);
                   setOpenFamilySelect(false);
                 }}
                 className="w-full flex items-center justify-between gap-3 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-3xs"
               >
                 <div className="flex items-center gap-2 truncate">
                   <Truck className="w-3.5 h-3.5 text-slate-400" />
                   <span className="truncate">
                     {providers.length === 0 
                       ? "Sin Proveedores" 
                       : selectedProvs.length === providers.filter(p => p.is_active !== false).length 
                       ? "Todos los Prov." 
                       : selectedProvs.length === 0 
                       ? "Ningún Prov." 
                       : `${selectedProvs.length} Prov.`}
                   </span>
                 </div>
                 {openProviderSelect ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
               </button>

               {openProviderSelect && (
                 <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-40 p-3.5 space-y-3 animate-fade-in text-slate-800">
                   <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                     <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-sans">Seleccionar Proveedores</span>
                     <div className="flex gap-2 text-[10px] font-black">
                       <button
                         type="button"
                         onClick={() => setSelectedProvs(providers.filter(p => p.is_active !== false).map(p => p.name))}
                         className="text-emerald-600 hover:text-emerald-700 uppercase cursor-pointer"
                       >
                         Todos
                       </button>
                       <span className="text-slate-200">|</span>
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
                       <p className="text-[11px] italic text-slate-400 p-2 font-sans">No hay proveedores activos.</p>
                     ) : (
                       providers.filter(p => p.is_active !== false).map((p) => {
                         const isChecked = selectedProvs.includes(p.name);
                         return (
                           <label
                             key={p.id}
                             className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition text-xs font-semibold text-slate-700"
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
                               className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                             />
                             <span className="truncate font-sans">{p.name} <span className="text-[10px] text-slate-400 font-normal">({p.category})</span></span>
                           </label>
                         );
                       })
                     )}
                   </div>
                 </div>
               )}
             </div>
           </div>

           {/* Buttons */}
           <div className="flex flex-col sm:flex-row gap-2 items-stretch xl:items-end mt-2 xl:mt-0 shrink-0">
             <button
               onClick={() => setShowHistory(true)}
               className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-2 cursor-pointer bg-white"
             >
               <History className="w-4 h-4" />
               Consultar Historial
             </button>
             <button
               onClick={handleSaveAll}
               disabled={!hasPendingChanges}
               className={`px-6 py-2.5 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-3xs cursor-pointer ${
                 hasPendingChanges ? "bg-[#091426] text-white hover:bg-slate-800" : "bg-slate-100 text-slate-400 cursor-not-allowed"
               }`}
             >
               <Save className="w-4 h-4" />
               {hasPendingChanges ? "Guardar Modificaciones" : "Sin Modificaciones"}
             </button>
           </div>
         </div>

         {/* Percentage application box */}
         <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
           <Percent className="w-4 h-4 text-indigo-500" />
           <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest mr-2 font-sans">Aplicar a tabla actual</span>
           
           <input
             type="number"
             value={percentValue}
             onChange={(e) => setPercentValue(Number(e.target.value))}
             className="w-20 px-2 py-1 text-center border-b-2 border-indigo-200 bg-transparent text-sm font-bold text-indigo-900 focus:outline-none"
             placeholder="10"
           />
           <span className="text-xs font-bold text-slate-500">%</span>
           
           <select 
             value={percentApplyTo}
             onChange={(e: any) => setPercentApplyTo(e.target.value)}
             className="ml-2 px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:outline-none font-sans font-semibold text-slate-700"
           >
             <option value="both">Costo y Venta</option>
             <option value="cost">Solo Costo</option>
             <option value="selling">Solo Venta</option>
           </select>
           
           <button
             onClick={handleApplyPercentage}
             className="ml-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-lg transition font-sans cursor-pointer shadow-3xs"
           >
             Aplicar Filtro
           </button>
         </div>

      </div>

      {/* Pricing Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-3xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#f8fafc] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Producto (Cat)</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right w-44">Precio Costo Actual</th>
                <th className="py-3 px-4 text-xs font-black text-rose-600 uppercase tracking-wider w-44 bg-rose-50/50">Nuevo Costo</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right w-44">Precio Venta Actual</th>
                <th className="py-3 px-4 text-xs font-black text-emerald-600 uppercase tracking-wider w-44 bg-emerald-50/50">Nuevo Venta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStock.map(item => {
                const isRecipe = item.is_recipe === true;
                const liveRecipeCost = isRecipe ? getRecipeCost(item) : 0;
                
                const originalCost = item.purchase_price;
                const displayNewCost = isRecipe ? liveRecipeCost : (getPrice(item.id, "purchase_price") || 0);
                const isCostChanged = isRecipe 
                  ? parseFloat(liveRecipeCost.toFixed(2)) !== parseFloat(item.purchase_price.toFixed(2))
                  : getPrice(item.id, "purchase_price") !== item.purchase_price;
                
                const isSellingChanged = getPrice(item.id, "selling_price") !== item.selling_price;
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-sm text-slate-800">{item.name}</div>
                      <div className="text-[10px] font-black uppercase text-slate-400 mt-0.5">
                        {item.category} {item.sku && `• ${item.sku}`} {isRecipe && <span className="ml-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-650 font-bold uppercase tracking-wider text-[8px]">Receta</span>}
                      </div>
                    </td>
                    
                    <td className="py-3 px-4 text-right">
                      <span className={`font-mono text-xs ${isCostChanged ? "text-slate-400 line-through" : "text-slate-700"}`}>${originalCost.toFixed(2)}</span>
                    </td>
                    <td className="py-3 px-4 bg-rose-50/20">
                      <div className="relative">
                        {isRecipe ? (
                          <div className={`w-full pr-2 py-1.5 text-right font-mono text-sm border rounded-lg bg-slate-100 border-slate-300 font-bold text-slate-500`}>
                            ${displayNewCost.toFixed(2)}
                            <span className="ml-1.5 text-[8px] bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded font-black tracking-wider uppercase">Auto</span>
                          </div>
                        ) : (
                          <>
                            <span className="absolute left-3 top-1.5 text-xs text-rose-400">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={getPrice(item.id, "purchase_price") || ""}
                              onChange={(e) => handlePriceChange(item.id, "purchase_price", parseFloat(e.target.value) || 0)}
                              className={`w-full pl-6 pr-2 py-1.5 text-right font-mono text-sm border rounded-lg focus:ring-1 focus:ring-rose-400 ${isCostChanged ? "font-bold text-rose-700 bg-rose-50 border-rose-300" : "bg-white border-slate-200"}`}
                            />
                          </>
                        )}
                      </div>
                    </td>
                    
                    <td className="py-3 px-4 text-right">
                      <span className={`font-mono text-xs ${isSellingChanged ? "text-slate-400 line-through" : "text-slate-700"}`}>${item.selling_price.toFixed(2)}</span>
                    </td>
                    <td className="py-3 px-4 bg-emerald-50/20">
                      <div className="relative">
                        <span className="absolute left-3 top-1.5 text-xs text-emerald-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={getPrice(item.id, "selling_price") || ""}
                          onChange={(e) => handlePriceChange(item.id, "selling_price", parseFloat(e.target.value) || 0)}
                          className={`w-full pl-6 pr-2 py-1.5 text-right font-mono text-sm border rounded-lg focus:ring-1 focus:ring-emerald-400 ${isSellingChanged ? "font-bold text-emerald-700 bg-emerald-50 border-emerald-300" : "bg-white border-slate-200"}`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

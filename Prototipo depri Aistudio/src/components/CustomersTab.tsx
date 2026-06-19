/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Users, 
  Search, 
  Plus, 
  User, 
  Award, 
  DollarSign, 
  FileSpreadsheet, 
  PlusCircle, 
  MinusCircle, 
  Clock, 
  Heart, 
  MapPin, 
  Phone, 
  Mail, 
  Sparkles,
  CheckCircle,
  X,
  Edit2,
  Edit3,
  Trash2,
  ChevronRight,
  Power
} from "lucide-react";
import { CustomerProfile, CustomerPurchase } from "../types";
import { CustomDropdown } from "./CustomDropdown";

interface CustomersTabProps {
  customers: CustomerProfile[];
  onAddCustomer: (cust: Omit<CustomerProfile, "id" | "purchaseHistory">) => Promise<void>;
  onEditCustomer: (cust: CustomerProfile) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({
  customers = [],
  onAddCustomer,
  onEditCustomer,
  onDeleteCustomer
}) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<CustomerProfile | null>(null);
  
  // Modals status
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdjustPointsModal, setShowAdjustPointsModal] = useState(false);
  
  // Points adjustment state
  const [ptsToAdjust, setPtsToAdjust] = useState("500");

  // CRM Toast notification
  const [crmToast, setCrmToast] = useState<string | null>(null);

  // Form states for creating/editing
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCategory, setFormCategory] = useState<CustomerProfile["category"]>("Regular");
  const [formTier, setFormTier] = useState<CustomerProfile["loyaltyTier"]>("STANDARD TIER");
  const [formPoints, setFormPoints] = useState("0");
  const [formPreferredStock, setFormPreferredStock] = useState("");
  const [formOutstanding, setFormOutstanding] = useState("0.00");
  const [formYTDSales, setFormYTDSales] = useState("0.00");
  const [formNotes, setFormNotes] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");

  const [catsList, setCatsList] = useState<string[]>(["Regular", "VIP", "Corporativo", "Nuevo"]);
  const [tiersList, setTiersList] = useState<string[]>(["STANDARD TIER", "SILVER TIER", "GOLD TIER", "PLATINUM TIER"]);

  React.useEffect(() => {
    const savedCats = localStorage.getItem("crm_categories_v2");
    if (savedCats) {
      try { setCatsList(JSON.parse(savedCats)); } catch(e){}
    }
    const savedTiers = localStorage.getItem("crm_tiers_v2");
    if (savedTiers) {
      try { setTiersList(JSON.parse(savedTiers)); } catch(e){}
    }
  }, []);

  const saveCatsList = (newList: string[]) => {
    setCatsList(newList);
    localStorage.setItem("crm_categories_v2", JSON.stringify(newList));
  };

  const saveTiersList = (newList: string[]) => {
    setTiersList(newList);
    localStorage.setItem("crm_tiers_v2", JSON.stringify(newList));
  };

  const handleAddCat = () => {
    const name = window.prompt("Nueva Categoría:");
    if (name && name.trim()) {
      if (!catsList.includes(name.trim())) {
        saveCatsList([...catsList, name.trim()]);
      }
      setFormCategory(name.trim() as any);
    }
  };

  const handleEditCat = () => {
    const name = window.prompt("Editar Categoría (esto solo cambiará el nombre en la lista):", formCategory);
    if (name && name.trim() && name !== formCategory) {
      const newList = catsList.map(c => c === formCategory ? name.trim() : c);
      saveCatsList(newList);
      setFormCategory(name.trim() as any);
    }
  };

  const handleDeleteCat = () => {
    if (catsList.length <= 1) return alert("Debe quedar al menos una categoría.");
    if (window.confirm(`Eliminar categoría "${formCategory}"?`)) {
      const newList = catsList.filter(c => c !== formCategory);
      saveCatsList(newList);
      setFormCategory(newList[0] as any);
    }
  };

  const handleAddTier = () => {
    const name = window.prompt("Nuevo Nivel de Lealtad:");
    if (name && name.trim()) {
      if (!tiersList.includes(name.trim())) {
        saveTiersList([...tiersList, name.trim()]);
      }
      setFormTier(name.trim() as any);
    }
  };

  const handleEditTier = () => {
    const name = window.prompt("Editar Nivel de Lealtad:", formTier);
    if (name && name.trim() && name !== formTier) {
      const newList = tiersList.map(t => t === formTier ? name.trim() : t);
      saveTiersList(newList);
      setFormTier(name.trim() as any);
    }
  };

  const handleDeleteTier = () => {
    if (tiersList.length <= 1) return alert("Debe quedar al menos un nivel.");
    if (window.confirm(`Eliminar nivel "${formTier}"?`)) {
      const newList = tiersList.filter(t => t !== formTier);
      saveTiersList(newList);
      setFormTier(newList[0] as any);
    }
  };

  const triggerToast = (msg: string) => {
    setCrmToast(msg);
    setTimeout(() => setCrmToast(null), 3000);
  };

  // Filter customers array (only active)
  const filteredCustomers = customers.filter((c) => {
    if (c.is_active === false) return false;
    const matchesSearch = 
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    
    if (categoryFilter === "todos") return matchesSearch;
    return matchesSearch && c.category === categoryFilter;
  });

  // Get currently selected customer (only active)
  const activeCustomer = filteredCustomers.find(c => c.id === selectedCustomerId) || filteredCustomers[0] || null;

  const handleOpenAdd = () => {
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormCategory("Regular");
    setFormTier("STANDARD TIER");
    setFormPoints("0");
    setFormPreferredStock("");
    setFormOutstanding("0.00");
    setFormYTDSales("0.00");
    setFormNotes("");
    setFormImageUrl("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (c: CustomerProfile) => {
    setFormName(c.fullName);
    setFormPhone(c.phone);
    setFormEmail(c.email);
    setFormCategory(c.category);
    setFormTier(c.loyaltyTier);
    setFormPoints(c.loyaltyPoints.toString());
    setFormPreferredStock(c.preferredStock);
    setFormOutstanding(c.outstandingCredit.toString());
    setFormYTDSales(c.ytdSales.toString());
    setFormNotes(c.internalNotes);
    setFormImageUrl(c.image_url || "");
    setShowEditModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("Por favor ingresa un nombre para el cliente.");
      return;
    }
    const pts = Math.max(0, Number(formPoints) || 0);
    const ytd = Math.max(0, Number(formYTDSales) || 0);
    const balance = Math.max(0, Number(formOutstanding) || 0);

    const payload = {
      fullName: formName,
      phone: formPhone || "S/T",
      email: formEmail || "S/K",
      category: formCategory,
      loyaltyTier: formTier,
      loyaltyPoints: pts,
      progressToNextPct: Math.min(100, Math.round((pts / 15000) * 100)),
      nextReward: pts > 2000 ? "Botella Reserva de Regreso" : "Ración de Bravas Gratis",
      ytdSales: ytd,
      outstandingCredit: balance,
      preferredStock: formPreferredStock || "",
      internalNotes: formNotes || "Cliente registrado en predio.",
      image_url: formImageUrl.trim() || undefined
    };

    try {
      await onAddCustomer(payload);
      setShowAddModal(false);
      triggerToast("¡Nuevo perfil de cliente registrado con éxito!");
    } catch (err) {
      console.error(err);
      alert("No se pudo agregar el cliente.");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;

    const pts = Math.max(0, Number(formPoints) || 0);
    const ytd = Math.max(0, Number(formYTDSales) || 0);
    const balance = Math.max(0, Number(formOutstanding) || 0);

    const updated: CustomerProfile = {
      ...activeCustomer,
      fullName: formName,
      phone: formPhone,
      email: formEmail,
      category: formCategory,
      loyaltyTier: formTier,
      loyaltyPoints: pts,
      progressToNextPct: Math.min(100, Math.round((pts / 15000) * 100)),
      ytdSales: ytd,
      outstandingCredit: balance,
      preferredStock: formPreferredStock,
      internalNotes: formNotes,
      image_url: formImageUrl.trim() || undefined
    };

    try {
      await onEditCustomer(updated);
      setShowEditModal(false);
      triggerToast("¡Perfil de cliente modificado con éxito!");
    } catch (err) {
      console.error(err);
      alert("No se pudo modificar el perfil.");
    }
  };

  const handleAdjustPointsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;
    const adjustment = Number(ptsToAdjust);
    if (isNaN(adjustment) || adjustment === 0) return;

    const newPoints = Math.max(0, activeCustomer.loyaltyPoints + adjustment);
    const nextProgress = Math.min(100, Math.round((newPoints / 15000) * 100));

    const updated: CustomerProfile = {
      ...activeCustomer,
      loyaltyPoints: newPoints,
      progressToNextPct: nextProgress
    };

    try {
      await onEditCustomer(updated);
      setShowAdjustPointsModal(false);
      triggerToast("¡Puntos de lealtad ajustados correctamente!");
    } catch (err) {
      console.error(err);
      alert("Fallo al ajustar puntos.");
    }
  };

  const handleRedeemGift = async () => {
    if (!activeCustomer) return;
    if (activeCustomer.loyaltyPoints < 2000) {
      alert("⚠️ Redención denegada: Este cliente requiere al menos 2.000 puntos de lealtad para canjear un premio.");
      return;
    }
    if (confirm(`¿Seguro que deseas canjear 2.000 puntos de ${activeCustomer.fullName} para emitir un vale de Barra VIP gratis?`)) {
      const newPoints = Math.max(0, activeCustomer.loyaltyPoints - 2000);
      const nextProgress = Math.min(100, Math.round((newPoints / 15000) * 100));
      
      const newPurchase: CustomerPurchase = {
        id: "crm_" + Date.now(),
        date: new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
        invoiceNumber: "CANJE-RECOMPENSA",
        items: "1x Vale Canje Regalo de Lealtad (Copa / Aperitivo Premium)",
        total: 0
      };

      const updatedAndGifted: CustomerProfile = {
        ...activeCustomer,
        loyaltyPoints: newPoints,
        progressToNextPct: nextProgress,
        purchaseHistory: [newPurchase, ...(activeCustomer.purchaseHistory || [])]
      };

      try {
        await onEditCustomer(updatedAndGifted);
        triggerToast("Voucher emitido. Se restaron 2.000 pts.");
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search client input */}
      <div className="bg-white p-5 rounded-2xl border border-[#eff4ff] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 w-full">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente en base de datos CRM..."
              className="w-full pl-9 pr-4 py-2 border border-slate-205 rounded-xl text-xs focus:outline-hidden"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
          </div>

          <div className="flex bg-slate-50 border rounded-xl p-0.5 w-full sm:w-auto">
            {["todos", "VIP", "Regular", "Corporativo"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`flex-1 sm:flex-none uppercase text-[9px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer select-none leading-none ${
                  categoryFilter === cat 
                    ? "bg-[#091426] text-white shadow-3xs" 
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        
        <button
          onClick={handleOpenAdd}
          className="bg-[#091426] hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs cursor-pointer select-none leading-none flex items-center gap-1 w-full md:w-auto justify-center"
        >
          <Plus className="w-3.5 h-3.5" />
          REGISTRAR NUEVO CLIENTE
        </button>
      </div>

      {crmToast && (
        <div className="p-3 bg-emerald-50 text-[#10b981] font-black rounded-xl text-xs flex items-center gap-2 shadow-xs border border-emerald-100 animate-scale-up">
          <CheckCircle className="w-4 h-4 text-[#10b981]" />
          <span>{crmToast}</span>
        </div>
      )}

      {customers.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-[#eff4ff] shadow-xs flex flex-col items-center justify-center gap-3">
          <Users className="w-10 h-10 text-slate-350" />
          <div className="space-y-1">
            <h4 className="font-bold text-slate-700 text-xs">CRM Vacío</h4>
            <p className="text-slate-400 text-[11px] max-w-sm">No hay perfiles de clientes registrados. Haz clic en "Registrar nuevo cliente" o carga los datos oficiales de prueba en el panel de sincronización de arriba.</p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="mt-2 text-xs font-bold text-[#16a34a] hover:underline cursor-pointer"
          >
            Añadir cliente manualmente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left: Client roster list (Cols = 5) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#eff4ff] shadow-xs overflow-hidden flex flex-col max-h-[640px]">
            <div className="p-4 border-b border-slate-100">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Cartera CRM ({filteredCustomers.length})</span>
            </div>
            
            <div className="overflow-y-auto divide-y divide-slate-100 divide-dotted flex-1">
              {filteredCustomers.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  Ningún cliente coincide con la búsqueda.
                </div>
              ) : (
                filteredCustomers.map((c) => {
                  const isSelect = activeCustomer?.id === c.id;
                  let categoryBadge = "bg-slate-100 text-slate-600";
                  if (c.category === "VIP") categoryBadge = "bg-[#ffdad6] text-[#ba1a1a] font-bold";
                  if (c.category === "Corporativo") categoryBadge = "bg-[#e5eeff] text-[#0061a4] font-bold";

                  const isActive = c.is_active !== false;

                  return (
                    <div 
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={`p-3.5 flex items-center justify-between cursor-pointer transition-all select-none ${
                        isSelect 
                          ? "bg-slate-50/70 border-l-4 border-[#16a34a] pl-2.5" 
                          : "hover:bg-slate-50/30"
                      } ${!isActive ? "opacity-65" : ""}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {c.image_url ? (
                          <img
                            src={c.image_url}
                            alt={c.fullName}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold border uppercase text-xs flex-shrink-0 ${
                            !isActive 
                              ? "bg-slate-50 text-slate-400 border-slate-100" 
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}>
                            {c.fullName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className={`font-bold text-[11.5px] truncate ${!isActive ? "text-slate-400 line-through italic" : "text-slate-800"}`}>
                            {c.fullName}
                            {!isActive && (
                              <span className="text-[8px] font-extrabold bg-slate-100 text-slate-400 py-0.5 px-1 ml-1.5 rounded-sm uppercase">
                                Inactivo
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-450 mt-1 flex items-center gap-1 font-mono">
                            <Phone className="w-2.5 h-2.5 text-slate-350" />
                            {c.phone}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <span className={`text-[8.5px] tracking-wide uppercase px-1.5 py-0.5 rounded-md leading-none ${categoryBadge}`}>
                          {c.category}
                        </span>
                        <span className="font-mono text-purple-700 text-[10.5px] font-black">{c.loyaltyPoints.toLocaleString()} pts</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Selected customer details dashboard (Cols = 7) */}
          <div className="lg:col-span-7 space-y-6">
            {!activeCustomer ? (
              <div className="bg-slate-50/40 p-12 text-center rounded-2xl border border-dotted border-slate-200">
                <p className="text-xs text-slate-400 font-bold">Selecciona un cliente de la lista de la izquierda para ver su ficha completa.</p>
              </div>
            ) : (
              <>
                {/* Header Profile / Contact Details Card */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-xs space-y-4">
                  
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {activeCustomer.image_url ? (
                        <img
                          src={activeCustomer.image_url}
                          alt={activeCustomer.fullName}
                          className="w-11 h-11 rounded-2xl object-cover border border-slate-200"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-[#091426] dark:bg-slate-800 text-white flex items-center justify-center font-black uppercase text-sm">
                          {activeCustomer.fullName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-black font-display text-slate-900 dark:text-slate-50 leading-none">{activeCustomer.fullName}</h3>
                        <p className="text-[9.5px] text-slate-400 dark:text-slate-350 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1 bg-slate-50 dark:bg-slate-850 border border-slate-150 dark:border-slate-800 px-1.5 py-0.5 rounded-md w-fit">
                          <span>Id de Perfil: {activeCustomer.id}</span>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <span className="text-[#16a34a] dark:text-emerald-400">{activeCustomer.category}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={async () => {
                          const nextState = activeCustomer.is_active === false ? true : false;
                          await onEditCustomer({ ...activeCustomer, is_active: nextState });
                        }}
                        className={`p-1.5 border rounded-lg cursor-pointer transition-colors ${
                          activeCustomer.is_active === false 
                            ? "bg-slate-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-500 hover:bg-emerald-50 hover:text-emerald-700" 
                            : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-850 text-emerald-700 hover:bg-slate-100"
                        }`}
                        title={activeCustomer.is_active === false ? "Activar cliente" : "Desactivar cliente"}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(activeCustomer)}
                        className="p-1.5 border border-slate-205 dark:border-slate-800 rounded-lg text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                        title="Editar ficha"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirmCustomer(activeCustomer);
                        }}
                        className="p-1.5 border border-slate-205 dark:border-slate-800 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Eliminar cliente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] font-sans">
                    <div className="space-y-2">
                      <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-mono text-slate-800 dark:text-slate-150">{activeCustomer.phone}</span>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate text-slate-800 dark:text-slate-150">{activeCustomer.email}</span>
                      </p>
                    </div>

                    <div className="space-y-2">
                       <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-[#ba1a1a] flex-shrink-0" />
                        <span>Gusto: <strong className="text-slate-800 dark:text-slate-150">{activeCustomer.preferredStock}</strong></span>
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-150 dark:border-slate-800 text-[11px] text-slate-550 dark:text-slate-300 leading-relaxed font-semibold italic">
                    "{activeCustomer.internalNotes || "Sin anotaciones internas sobre preferencias de partidos o barra."}"
                  </div>

                </div>

                {/* Loyalty Program widget banner */}
                <div className="bg-[#091426] text-[#bcc7de] p-5 rounded-2xl border border-slate-800 space-y-4">
                  
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-[#16a34a] uppercase tracking-widest leading-none block mb-1">PROGRAMA DE LEALTAD</span>
                      <h4 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-[#16a34a]" />
                        Club de Socios: {activeCustomer.loyaltyTier}
                      </h4>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] font-bold text-slate-405 block uppercase">PUNTOS</span>
                      <span className="text-xl font-black font-mono text-[#16a34a] leading-none">{activeCustomer.loyaltyPoints.toLocaleString()} pts</span>
                    </div>
                  </div>

                  {/* Loyalty points slider towards next tier */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span>Progreso hacia Nivel Platino (15.000 pts) :</span>
                      <span className="font-mono font-bold text-[#16a34a]">{activeCustomer.progressToNextPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-600 to-[#16a34a] rounded-lg transition-all"
                        style={{ width: `${activeCustomer.progressToNextPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-850">
                    <button
                      type="button"
                      onClick={() => setShowAdjustPointsModal(true)}
                      className="py-1.5 px-3 bg-[#1e293b] hover:bg-slate-800 text-slate-200 text-[10.5px] font-bold rounded-lg border border-slate-700 cursor-pointer transition select-none flex items-center gap-1 leading-none"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-[#16a34a]" />
                      Sumar / Restar Puntos
                    </button>

                    <button
                      type="button"
                      onClick={handleRedeemGift}
                      className="py-1.5 px-3.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-[10.5px] font-black rounded-lg cursor-pointer transition select-none flex items-center gap-1 leading-none font-sans"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-slate-905 animate-pulse" />
                      Canjear Premio (2.000 pts)
                    </button>
                  </div>

                </div>

                {/* financial statistics */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-white p-4 rounded-xl border border-[#eff4ff] shadow-3xs">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">TOTAL COMPRADO (YTD)</span>
                    <p className="text-base font-bold text-slate-900 font-mono mt-1">
                      ${(activeCustomer.ytdSales ?? 0).toFixed(2)}
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-[#eff4ff] shadow-3xs">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">SALDO DE CRÉDITO CORRIENTE</span>
                    <p className="text-base font-bold text-emerald-600 font-mono mt-1">
                      ${(activeCustomer.outstandingCredit ?? 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Interactive purchase history */}
                <div className="bg-white p-5 rounded-2xl border border-[#eff4ff] shadow-xs space-y-3">
                  <h4 className="text-xs font-bold text-slate-550 uppercase tracking-wider flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                    Historial de Visitas y Compras Recientes
                  </h4>

                  <div className="divide-y divide-[#eff4ff] max-h-48 overflow-y-auto">
                    {(activeCustomer.purchaseHistory || []).length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-6">Este cliente no registra facturas pasadas asociadas a su perfil.</p>
                    ) : (
                      (activeCustomer.purchaseHistory || []).map((inv) => (
                        <div key={inv.id} className="py-2 flex items-center justify-between text-[11px] hover:bg-slate-50/20 px-1">
                          <div className="space-y-0.5 pr-3">
                            <p className="font-mono text-slate-800 font-bold">{inv.invoiceNumber}</p>
                            <p className="text-slate-450 text-[10px] truncate max-w-sm" title={inv.items}>{inv.items}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="font-mono font-bold text-[#091426] block">${(inv.total ?? 0).toFixed(2)}</span>
                            <span className="text-[9px] text-[#8590a6]">{inv.date}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* MODAL 1: REGISTRAR NUEVO CLIENTE */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#060e1d]/85 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-xl w-full max-w-md overflow-hidden animate-scale-up">
            
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wide">
                👥 Registrar Nuevo Cliente CRM
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Por ej: Carmen de la Torre / Lucas Riquelme"
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Teléfono Móvil</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Categoría Cliente</label>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <CustomDropdown
                        value={formCategory}
                        onChange={(val) => setFormCategory(val as any)}
                        options={catsList.map(c => ({ id: c, label: c }))}
                        onAdd={handleAddCat}
                        onEdit={(val) => {
                          setFormCategory(val as any);
                          setTimeout(() => handleEditCat(), 0);
                        }}
                        onDelete={(val) => {
                          setFormCategory(val as any);
                          setTimeout(() => handleDeleteCat(), 0);
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Nivel Lealtad Inicial</label>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <CustomDropdown
                        value={formTier}
                        onChange={(val) => setFormTier(val as any)}
                        options={tiersList.map(t => ({ id: t, label: t }))}
                        onAdd={handleAddTier}
                        onEdit={(val) => {
                          setFormTier(val as any);
                          setTimeout(() => handleEditTier(), 0);
                        }}
                        onDelete={(val) => {
                          setFormTier(val as any);
                          setTimeout(() => handleDeleteTier(), 0);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Puntos Iniciales</label>
                  <input
                    type="number"
                    value={formPoints}
                    onChange={(e) => setFormPoints(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Monto YTD ($)</label>
                  <input
                    type="text"
                    value={formYTDSales}
                    onChange={(e) => setFormYTDSales(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Deuda Crédito ($)</label>
                  <input
                    type="text"
                    value={formOutstanding}
                    onChange={(e) => setFormOutstanding(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">Preferencias o Gustos</label>
                <input
                  type="text"
                  value={formPreferredStock}
                  onChange={(e) => setFormPreferredStock(e.target.value)}
                  placeholder="Por ej: Estrella Quinto o Rueda Copa Blanco..."
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">Notas de Auditoría / Preferencias de Cancha</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Escribe detalles de comportamiento, reservas o mesa preferida..."
                  rows={2}
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">URL de la Imagen del Cliente (Opcional)</label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://ejemplo.com/avatar.jpg"
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-205 rounded-xl hover:bg-slate-50 text-[#091426] cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl cursor-pointer shadow-3xs"
                >
                  DAR DE ALTA CLIENTE
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR FICHA CLIENTE */}
      {showEditModal && activeCustomer && (
        <div className="fixed inset-0 bg-[#060e1d]/85 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-xl w-full max-w-md overflow-hidden animate-scale-up">
            
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wide">
                ✏️ Editar Ficha de Cliente
              </h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Categoría</label>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <CustomDropdown
                        value={formCategory}
                        onChange={(val) => setFormCategory(val as any)}
                        options={catsList.map(c => ({ id: c, label: c }))}
                        onAdd={handleAddCat}
                        onEdit={(val) => {
                          setFormCategory(val as any);
                          setTimeout(() => handleEditCat(), 0);
                        }}
                        onDelete={(val) => {
                          setFormCategory(val as any);
                          setTimeout(() => handleDeleteCat(), 0);
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Loyalty Tier</label>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <CustomDropdown
                        value={formTier}
                        onChange={(val) => setFormTier(val as any)}
                        options={tiersList.map(t => ({ id: t, label: t }))}
                        onAdd={handleAddTier}
                        onEdit={(val) => {
                          setFormTier(val as any);
                          setTimeout(() => handleEditTier(), 0);
                        }}
                        onDelete={(val) => {
                          setFormTier(val as any);
                          setTimeout(() => handleDeleteTier(), 0);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Puntos</label>
                  <input
                    type="number"
                    value={formPoints}
                    onChange={(e) => setFormPoints(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">YTD Compra ($)</label>
                  <input
                    type="text"
                    value={formYTDSales}
                    onChange={(e) => setFormYTDSales(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Crédito ($)</label>
                  <input
                    type="text"
                    value={formOutstanding}
                    onChange={(e) => setFormOutstanding(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">Preferencias o Gustos</label>
                <input
                  type="text"
                  value={formPreferredStock}
                  onChange={(e) => setFormPreferredStock(e.target.value)}
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">Anotaciones de Cuenta Internas</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">URL de la Imagen del Cliente (Opcional)</label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://ejemplo.com/avatar.jpg"
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-205 rounded-xl hover:bg-slate-5 hover:text-slate-800 text-[#091426] cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl cursor-pointer"
                >
                  GUARDAR CAMBIOS
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PUNTOS MANUAL */}
      {showAdjustPointsModal && activeCustomer && (
        <div className="fixed inset-0 bg-[#060e1d]/85 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-xl max-w-sm w-full overflow-hidden animate-scale-up">
            
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
                ⚙️ Ajuste de Puntos - CRM
              </h3>
              <button 
                onClick={() => setShowAdjustPointsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-20 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-550 dark:text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAdjustPointsSubmit} className="p-4 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Cantidad de puntos (números positivos o negativos)</label>
                <input
                  type="text"
                  required
                  value={ptsToAdjust}
                  onChange={(e) => setPtsToAdjust(e.target.value)}
                  placeholder="Por ej: +500 o -200"
                  className="w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-hidden"
                />
                <p className="text-[9px] text-slate-400">Puntos actuales del socio: {activeCustomer.loyaltyPoints.toLocaleString()} pts</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAdjustPointsModal(false)}
                  className="py-1.5 px-3 bg-slate-100 text-slate-705 font-bold rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-1.5 px-4 bg-[#091426] text-white font-extrabold rounded-lg cursor-pointer"
                >
                  Aplicar Ajuste de Puntos
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {deleteConfirmCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl p-6 max-w-sm w-full space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400 animate-pulse">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">¿Eliminar Cliente?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ¿Seguro que deseas ELIMINAR el perfil de <strong className="text-slate-800 dark:text-slate-200">"{deleteConfirmCustomer.fullName}"</strong>? Se borrarán sus datos y puntos de forma irreversible.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmCustomer(null)}
                className="flex-1 py-2 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onDeleteCustomer(deleteConfirmCustomer.id);
                    setSelectedCustomerId(null);
                    setDeleteConfirmCustomer(null);
                    triggerToast("Perfil eliminado correctamente.");
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

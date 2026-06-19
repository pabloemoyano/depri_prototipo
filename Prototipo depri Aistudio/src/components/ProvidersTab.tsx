/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Truck, 
  Search, 
  Plus, 
  MapPin, 
  Phone, 
  Mail, 
  DollarSign, 
  FileText, 
  Calendar, 
  CheckCircle,
  X,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Layers,
  Edit2,
  Edit3,
  Trash2,
  Power
} from "lucide-react";
import { Provider } from "../types";
import { CustomDropdown } from "./CustomDropdown";

interface ProvidersTabProps {
  providers: Provider[];
  purchases?: any[];
  onAddProvider: (prov: Omit<Provider, "id">) => Promise<void>;
  onEditProvider: (prov: Provider) => Promise<void>;
  onDeleteProvider: (id: string) => Promise<void>;
  onNavigateToPurchases?: () => void;
}

export const ProvidersTab: React.FC<ProvidersTabProps> = ({ 
  providers = [],
  purchases = [],
  onAddProvider,
  onEditProvider,
  onDeleteProvider,
  onNavigateToPurchases 
}) => {
  const [search, setSearch] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [deleteConfirmProvider, setDeleteConfirmProvider] = useState<Provider | null>(null);
  
  // Modal configurations
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states for adding/editing
  const [formName, setFormName] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formCategory, setFormCategory] = useState("Bebidas y Alcoholes");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTaxId, setFormTaxId] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPaymentM, setFormPaymentM] = useState("Transferencia Bancaria");
  const [formCycle, setFormCycle] = useState("Mensual");
  const [formNextAmount, setFormNextAmount] = useState("0.00");
  const [formFrequency, setFormFrequency] = useState("Semanal");
  const [formLeadTime, setFormLeadTime] = useState("2");
  const [formYTDPurchases, setFormYTDPurchases] = useState("0");
  const [formImageUrl, setFormImageUrl] = useState("");

  const [providerCatsList, setProviderCatsList] = useState<string[]>(["Bebidas y Alcoholes", "Destilados Premium", "Tapas y Alimentos Frescos", "Servicios de Coctelería", "Insumos Técnicos"]);

  React.useEffect(() => {
    const savedCats = localStorage.getItem("crm_provider_categories_v2");
    if (savedCats) {
      try { setProviderCatsList(JSON.parse(savedCats)); } catch (e) {}
    }
  }, []);

  const saveProviderCatsList = (newList: string[]) => {
    setProviderCatsList(newList);
    localStorage.setItem("crm_provider_categories_v2", JSON.stringify(newList));
  };

  const handleAddCat = () => {
    const name = window.prompt("Nueva Categoría:");
    if (name && name.trim()) {
      if (!providerCatsList.includes(name.trim())) {
        saveProviderCatsList([...providerCatsList, name.trim()]);
      }
      setFormCategory(name.trim());
    }
  };

  const handleEditCat = () => {
    const name = window.prompt("Editar Categoría (esto solo cambiará el nombre en la lista):", formCategory);
    if (name && name.trim() && name !== formCategory) {
      const newList = providerCatsList.map(c => c === formCategory ? name.trim() : c);
      saveProviderCatsList(newList);
      setFormCategory(name.trim());
    }
  };

  const handleDeleteCat = () => {
    if (providerCatsList.length <= 1) return alert("Debe quedar al menos una categoría.");
    if (window.confirm(`Eliminar categoría "${formCategory}"?`)) {
      const newList = providerCatsList.filter(c => c !== formCategory);
      saveProviderCatsList(newList);
      setFormCategory(newList[0]);
    }
  };

  const filteredProviders = providers.filter(p => 
    p.is_active !== false && (
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    )
  );

  const selectedProvider = filteredProviders.find(p => p.id === selectedProviderId) || filteredProviders[0] || null;

  const currentYear = new Date().getFullYear();

  const providerPurchases = React.useMemo(() => {
    if (!selectedProvider) return [];
    const normalizeStr = (str: string) => 
      String(str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const selectedNormName = normalizeStr(selectedProvider.name);

    return purchases.filter((p: any) => {
      if (p.providerId && p.providerId === selectedProvider.id) {
        return true;
      }
      if (p.providerName) {
        return normalizeStr(p.providerName) === selectedNormName;
      }
      return false;
    });
  }, [purchases, selectedProvider]);

  const dynamicYtdPurchases = React.useMemo(() => {
    return providerPurchases
      .filter((p: any) => {
        const dateStr = p.invoiceDate || (p.date ? p.date.substring(0, 10) : "");
        if (!dateStr) return false;
        try {
          return new Date(dateStr + "T12:00:00").getFullYear() === currentYear;
        } catch (e) {
          return false;
        }
      })
      .reduce((sum: number, p: any) => sum + (Number(p.total) || 0), 0);
  }, [providerPurchases, currentYear]);

  const dynamicPendingBalance = React.useMemo(() => {
    return providerPurchases.reduce((sum: number, p: any) => {
      const total = Number(p.total) || 0;
      const paid = Number(p.paidAmount) || 0;
      return sum + Math.max(0, total - paid);
    }, 0);
  }, [providerPurchases]);

  const handleOpenAdd = () => {
    setFormName("");
    setFormContact("");
    setFormCategory("Bebidas y Alcoholes");
    setFormPhone("");
    setFormEmail("");
    setFormTaxId("");
    setFormAddress("");
    setFormPaymentM("Transferencia Bancaria");
    setFormCycle("Mensual");
    setFormNextAmount("0.00");
    setFormFrequency("Semanal");
    setFormLeadTime("2");
    setFormYTDPurchases("0");
    setFormImageUrl("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (p: Provider) => {
    setFormName(p.name);
    setFormContact(p.contactPerson);
    setFormCategory(p.category);
    setFormPhone(p.phone);
    setFormEmail(p.email);
    setFormTaxId(p.taxId);
    setFormAddress(p.address);
    setFormPaymentM(p.paymentMethod);
    setFormCycle(p.billingCycle);
    setFormNextAmount(p.nextPaymentAmount.toString());
    setFormFrequency(p.orderFrequency);
    setFormLeadTime(p.avgLeadTimeDays.toString());
    setFormYTDPurchases(p.ytdPurchases.toString());
    setFormImageUrl(p.image_url || "");
    setShowEditModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) {
      alert("Por favor ingresa un nombre para el proveedor.");
      return;
    }

    const payload = {
      name: formName,
      contactPerson: formContact || "Pendiente",
      category: formCategory,
      phone: formPhone || "N/A",
      email: formEmail || "N/A",
      taxId: formTaxId || "N/A",
      address: formAddress || "N/A",
      paymentMethod: formPaymentM,
      billingCycle: formCycle,
      nextPaymentDate: "15 " + new Date().toLocaleString("es-ES", { month: "short" }),
      nextPaymentAmount: Number(formNextAmount) || 0,
      ytdPurchases: Number(formYTDPurchases) || 0,
      orderFrequency: formFrequency,
      avgLeadTimeDays: Number(formLeadTime) || 2,
      image_url: formImageUrl.trim() || undefined
    };

    try {
      await onAddProvider(payload);
      setShowAddModal(false);
    } catch (err) {
      console.error(err);
      alert("No se pudo inscribir al proveedor.");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider) return;

    const updated: Provider = {
      ...selectedProvider,
      name: formName,
      contactPerson: formContact,
      category: formCategory,
      phone: formPhone,
      email: formEmail,
      taxId: formTaxId,
      address: formAddress,
      paymentMethod: formPaymentM,
      billingCycle: formCycle,
      nextPaymentAmount: Number(formNextAmount) || 0,
      ytdPurchases: Number(formYTDPurchases) || 0,
      orderFrequency: formFrequency,
      avgLeadTimeDays: Number(formLeadTime) || 2,
      image_url: formImageUrl.trim() || undefined
    };

    try {
      await onEditProvider(updated);
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      alert("No se pudo modificar el proveedor.");
    }
  };

  const totalYtdSuppliers = providers.reduce((sum, p) => sum + p.ytdPurchases, 0);

  return (
    <div className="space-y-6">
      
      {/* Upper stats card */}
      <div className="bg-white p-6 rounded-2xl border border-[#eff4ff] shadow-3xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#e5eeff] text-[#091426] rounded-xl flex items-center justify-center border border-[#eff4ff]">
            <Truck className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Abastecimiento Directo</span>
            <h2 className="text-xl font-bold font-display text-slate-900 mt-1">Directorio de Proveedores y Logística</h2>
            <p className="text-xs text-slate-500">Gestión de condiciones de crédito, facturación, plazos de entrega y cuentas corrientes.</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase">VOLUMEN DE COMPRA ACUMULADO (YTD)</span>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-slate-900">${totalYtdSuppliers.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-slate-405">Total sumado de transacciones históricas</p>
          </div>

          {onNavigateToPurchases && (
            <button
              onClick={onNavigateToPurchases}
              className="bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs leading-none select-none cursor-pointer flex items-center gap-1.5"
            >
              <TrendingUp className="w-4 h-4 text-white" />
              REGISTRAR COMPRA / MERMA
            </button>
          )}
        </div>
      </div>

      {/* SEARCH AND ADD CONTROL PANEL */}
      <div className="bg-white p-5 rounded-2xl border border-[#eff4ff] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full md:max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por proveedor o contacto..."
            className="w-full pl-9 pr-4 py-2 border border-slate-205 rounded-xl text-xs focus:outline-hidden"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
        </div>
        
        <button
          onClick={handleOpenAdd}
          className="bg-[#091426] hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs cursor-pointer select-none leading-none flex items-center gap-1.5 w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4 text-white" />
          AGREGAR NUEVO PROVEEDOR
        </button>
      </div>

      {providers.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-[#eff4ff] shadow-xs flex flex-col items-center justify-center gap-3">
          <Truck className="w-10 h-10 text-slate-355" />
          <div className="space-y-1">
            <h4 className="font-bold text-slate-700 text-xs">Directorio Vacío</h4>
            <p className="text-slate-400 text-[11px] max-w-sm font-sans">No hay proveedores registrados. Añade uno haciendo clic en el botón de arriba o carga los datos demo.</p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="text-xs font-bold text-[#16a34a] hover:underline cursor-pointer"
          >
            Añadir manualmente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Supplier roster list (Cols = 5) */}
          <div className="lg:col-span-5 bg-white border border-[#eff4ff] rounded-2xl shadow-xs overflow-hidden flex flex-col max-h-[640px]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Registrados ({filteredProviders.length})</span>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 divide-dotted flex-1">
              {filteredProviders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Ningún proveedor coincide con la búsqueda.
                </div>
              ) : (
                filteredProviders.map((p) => {
                  const isSelect = selectedProvider?.id === p.id;
                  const isActive = p.is_active !== false;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProviderId(p.id)}
                      className={`p-4 flex items-center justify-between cursor-pointer transition-all select-none ${
                        isSelect 
                          ? "bg-slate-50/70 border-l-4 border-[#16a34a] pl-3" 
                          : "hover:bg-slate-50/30"
                      } ${!isActive ? "opacity-65" : ""}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-400 border border-slate-200 flex-shrink-0 text-xs">
                            🏢
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className={`font-bold text-[12px] truncate ${!isActive ? "text-slate-400 line-through italic" : "text-slate-800"}`}>
                            {p.name}
                            {!isActive && (
                              <span className="text-[8px] font-extrabold bg-slate-100 text-slate-500 py-0.5 px-1.5 ml-1.5 rounded-sm uppercase">
                                Inactivo
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-slate-450 mt-1 truncate">{p.contactPerson} • {p.category}</p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-400 ${isSelect ? "translate-x-1 text-[#16a34a]" : ""}`} />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Supplier details panel (Cols = 7) */}
          <div className="lg:col-span-7 space-y-6">
            {!selectedProvider ? (
              <div className="bg-slate-50/40 p-12 text-center rounded-2xl border border-dotted border-slate-200 text-slate-400 text-xs">
                Selecciona un proveedor de la lista de la izquierda para desplegar sus condiciones fiscales e informes mercantiles.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#eff4ff] shadow-xs overflow-hidden space-y-6 p-6">
                
                {/* Dossier header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div className="flex gap-4">
                    {selectedProvider.image_url ? (
                      <img
                        src={selectedProvider.image_url}
                        alt={selectedProvider.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 flex-shrink-0 animate-fade-in"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 font-bold text-lg flex items-center justify-center flex-shrink-0 select-none">
                        🏢
                      </div>
                    )}
                    <div className="space-y-1">
                      <span className="text-[9.5px] uppercase font-bold text-slate-400 bg-slate-50 border border-slate-150 py-0.5 px-2 rounded-md block w-fit">
                        #{selectedProvider.id}
                      </span>
                      <h3 className="text-base font-black text-slate-900 mt-1">{selectedProvider.name}</h3>
                      <p className="text-[11px] text-slate-500 font-medium">Asesor Mercantil: <strong>{selectedProvider.contactPerson}</strong> • {selectedProvider.category}</p>
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={async () => {
                        const nextState = selectedProvider.is_active === false ? true : false;
                        await onEditProvider({ ...selectedProvider, is_active: nextState });
                      }}
                      className={`p-2 border rounded-xl cursor-pointer transition-colors ${
                        selectedProvider.is_active === false 
                          ? "bg-slate-50 border-amber-200 text-amber-500 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200" 
                          : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-slate-100 hover:text-slate-505 hover:border-slate-300"
                      }`}
                      title={selectedProvider.is_active === false ? "Habilitar proveedor" : "Inhabilitar/Desactivar proveedor"}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(selectedProvider)}
                      className="p-2 border border-slate-205 rounded-xl text-slate-500 hover:text-slate-804 cursor-pointer"
                      title="Modificar condiciones"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteConfirmProvider(selectedProvider);
                      }}
                      className="p-2 border border-slate-205 rounded-xl text-slate-400 hover:text-red-655 cursor-pointer"
                      title="Dejar de operar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Fiscal & Contact Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Canales de Comunicación</h4>
                    <p className="flex items-center gap-2.5 text-slate-650 font-medium">
                      <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>{selectedProvider.phone}</span>
                    </p>
                    <p className="flex items-center gap-2.5 text-slate-655 font-medium truncate">
                      <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{selectedProvider.email}</span>
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Información Impositiva</h4>
                    <p className="flex items-start gap-2.5 text-slate-655 leading-relaxed font-semibold">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span>{selectedProvider.address}</span>
                    </p>
                    <p className="flex items-center gap-2.5 text-slate-655 font-semibold pl-6">
                      <span>C.I.F Fiscal: <strong>{selectedProvider.taxId}</strong></span>
                    </p>
                  </div>
                </div>

                {/* Supply Rules Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-100">
                  <div className="p-4 bg-slate-50 border rounded-xl space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Reglas y Logística</span>
                    <div className="space-y-1.5 font-sans">
                      <p className="flex items-center justify-between text-slate-600 font-medium">
                        <span>Frecuencia Pedidos:</span>
                        <strong className="text-slate-800">{selectedProvider.orderFrequency}</strong>
                      </p>
                      <p className="flex items-center justify-between text-slate-600 font-medium">
                        <span>Tiempo de Entrega:</span>
                        <strong className="text-slate-800">{selectedProvider.avgLeadTimeDays} días</strong>
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border rounded-xl space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Condiciones de Crédito y Pago</span>
                    <div className="space-y-1.5 font-sans">
                      <p className="flex items-center justify-between text-slate-600 font-medium">
                        <span>Método:</span>
                        <strong className="text-slate-800">{selectedProvider.paymentMethod}</strong>
                      </p>
                      <p className="flex items-center justify-between text-slate-600 font-medium">
                        <span>Periodo de Corte:</span>
                        <strong className="text-slate-800">{selectedProvider.billingCycle}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Financial overview */}
                <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border dark:border-slate-800 rounded-xl">
                    <span className="text-[10.5px] font-bold text-slate-405 block uppercase">PENDIENTE DE PAGO CARTERA</span>
                    <p className="text-base font-black text-red-600 font-mono mt-1">
                      ${(providerPurchases.length > 0 ? dynamicPendingBalance : (selectedProvider.nextPaymentAmount || 0)).toFixed(2)}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-1">Corte pactado: {selectedProvider.nextPaymentDate}</p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border dark:border-slate-800 rounded-xl">
                    <span className="text-[10.5px] font-bold text-slate-405 block uppercase">HISTORIAL DE COMPRAS (YTD)</span>
                    <p className="text-base font-black text-slate-905 dark:text-slate-100 font-mono mt-1">
                      ${(providerPurchases.length > 0 ? dynamicYtdPurchases : (selectedProvider.ytdPurchases || 0)).toFixed(2)}
                    </p>
                    <p className="text-[9px] text-slate-405 mt-1">Suma consolidada año en curso</p>
                  </div>
                </div>

                {/* Visual history of recent receipts for this supplier */}
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[10px] font-bold text-slate-404 uppercase tracking-wider block">Comprobantes de Compra Recientes</h4>
                  {providerPurchases.length === 0 ? (
                    <p className="text-[11px] text-slate-450 italic">No hay comprobantes de compra registrados para este proveedor.</p>
                  ) : (
                    <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/30">
                      <table className="w-full text-[11px] text-left text-slate-600 dark:text-slate-300">
                        <thead className="bg-[#eff4ff] dark:bg-slate-800 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-3 py-2">Fecha</th>
                            <th className="px-3 py-2">Factura No.</th>
                            <th className="px-3 py-2 text-right">Monto</th>
                            <th className="px-3 py-2 text-right">Saldo Pend.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {providerPurchases.slice(0, 5).map((p: any, idx: number) => {
                            const dateStr = p.invoiceDate || (p.date ? p.date.substring(0, 10) : "");
                            const formattedDate = dateStr 
                              ? new Date(dateStr + "T12:00:00").toLocaleDateString("es-ES")
                              : "S/F";
                            const owed = Math.max(0, (Number(p.total) || 0) - (Number(p.paidAmount) || 0));
                            return (
                              <tr key={p.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 font-sans">
                                <td className="px-3 py-2 font-medium">{formattedDate}</td>
                                <td className="px-3 py-2 font-mono font-semibold">{p.invoiceNumber || "S/N"}</td>
                                <td className="px-3 py-2 text-right font-mono">${(Number(p.total) || 0).toFixed(2)}</td>
                                <td className={`px-3 py-2 text-right font-mono font-semibold ${owed > 0 ? "text-rose-600" : "text-emerald-605"}`}>
                                  ${owed.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL: NUEVO PROVEEDOR */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#060e1d]/85 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#eff4ff] shadow-xl w-full max-w-md overflow-hidden animate-scale-up">
            
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                🚛 Inscribir Proveedor de Almacén
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">Nombre Comercial de Empresa *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Por ej: Coca Cola / Distribuidores Mallorca"
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Representante de Ventas</label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="Elena Rodríguez"
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Categoría Abastecimiento</label>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <CustomDropdown
                        value={formCategory}
                        onChange={(val) => setFormCategory(val)}
                        options={providerCatsList.map(c => ({ id: c, label: c }))}
                        onAdd={handleAddCat}
                        onEdit={(val) => {
                          setFormCategory(val);
                          setTimeout(() => handleEditCat(), 0);
                        }}
                        onDelete={(val) => {
                          setFormCategory(val);
                          setTimeout(() => handleDeleteCat(), 0);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Teléfono Móvil</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+34 600..."
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Email Comercio</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="reparto@comercio.es"
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">C.I.F Fiscal / Tax ID</label>
                  <input
                    type="text"
                    value={formTaxId}
                    onChange={(e) => setFormTaxId(e.target.value)}
                    placeholder="B-XXXXXXXX"
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Frecuencia de Reparto</label>
                  <CustomDropdown
                    value={formFrequency}
                    onChange={(val) => setFormFrequency(val)}
                    options={[
                      { id: "Semanal", label: "Semanal" },
                      { id: "Quincenal", label: "Quincenal" },
                      { id: "Mensual", label: "Mensual" },
                      { id: "Bajo demanda", label: "Bajo demanda" }
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col">
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1 h-[28px] overflow-hidden">Demora en Entrega (días)</label>
                  <input
                    type="number"
                    value={formLeadTime}
                    onChange={(e) => setFormLeadTime(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono mt-auto"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1 h-[28px] overflow-hidden">Pagar factura ($)</label>
                  <input
                    type="text"
                    value={formNextAmount}
                    onChange={(e) => setFormNextAmount(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono mt-auto"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1 h-[28px] overflow-hidden">Gasto Histórico YTD ($)</label>
                  <input
                    type="text"
                    value={formYTDPurchases}
                    onChange={(e) => setFormYTDPurchases(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono mt-auto"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">Dirección Postal / Almacén Central</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Calle, nave o polígono..."
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">Condiciones de Pago Preferidas</label>
                <CustomDropdown
                  value={formPaymentM}
                  onChange={(val) => setFormPaymentM(val)}
                  options={[
                    { id: "Transferencia Bancaria", label: "Transferencia Bancaria" },
                    { id: "Giro de Caja Directo", label: "Giro de Caja Directo" },
                    { id: "Tarjeta de Crédito / Prepago", label: "Tarjeta de Crédito / Prepago" },
                    { id: "Efectivo contra-entrega", label: "Efectivo contra-entrega" }
                  ]}
                />
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">URL de la Imagen del Proveedor (Opcional)</label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://ejemplo.com/proveedor.jpg"
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
                  className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl cursor-pointer"
                >
                  INSCRIBIR PROVEEDOR
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR PROVEEDOR */}
      {showEditModal && selectedProvider && (
        <div className="fixed inset-0 bg-[#060e1d]/85 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#eff4ff] shadow-xl w-full max-w-md overflow-hidden animate-scale-up">
            
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                ✏️ Editar Condiciones de Proveedor
              </h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">Nombre Comercial *</label>
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
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Representante</label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Categoría</label>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <CustomDropdown
                        value={formCategory}
                        onChange={(val) => setFormCategory(val)}
                        options={providerCatsList.map(c => ({ id: c, label: c }))}
                        onAdd={handleAddCat}
                        onEdit={(val) => {
                          setFormCategory(val);
                          setTimeout(() => handleEditCat(), 0);
                        }}
                        onDelete={(val) => {
                          setFormCategory(val);
                          setTimeout(() => handleDeleteCat(), 0);
                        }}
                      />
                    </div>
                  </div>
                </div>
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
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">C.I.F Fiscal</label>
                  <input
                    type="text"
                    value={formTaxId}
                    onChange={(e) => setFormTaxId(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1">Frecuencia Pedidos</label>
                  <CustomDropdown
                    value={formFrequency}
                    onChange={(val) => setFormFrequency(val)}
                    options={[
                      { id: "Semanal", label: "Semanal" },
                      { id: "Quincenal", label: "Quincenal" },
                      { id: "Mensual", label: "Mensual" },
                      { id: "Bajo demanda", label: "Bajo demanda" }
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col">
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1 h-[28px] overflow-hidden">Demora Pedidos (días)</label>
                  <input
                    type="number"
                    value={formLeadTime}
                    onChange={(e) => setFormLeadTime(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono mt-auto"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1 h-[28px] overflow-hidden">Corte Pendiente ($)</label>
                  <input
                    type="text"
                    value={formNextAmount}
                    onChange={(e) => setFormNextAmount(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono mt-auto"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1 h-[28px] overflow-hidden">Compra YTD ($)</label>
                  <input
                    type="text"
                    value={formYTDPurchases}
                    onChange={(e) => setFormYTDPurchases(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden font-mono mt-auto"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">Dirección Física</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">Método de Cobro Pactado</label>
                <CustomDropdown
                  value={formPaymentM}
                  onChange={(val) => setFormPaymentM(val)}
                  options={[
                    { id: "Transferencia Bancaria", label: "Transferencia Bancaria" },
                    { id: "Giro de Caja Directo", label: "Giro de Caja Directo" },
                    { id: "Tarjeta de Crédito / Prepago", label: "Tarjeta de Crédito / Prepago" },
                    { id: "Efectivo contra-entrega", label: "Efectivo contra-entrega" }
                  ]}
                />
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase mb-1">URL de la Imagen del Proveedor (Opcional)</label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://ejemplo.com/proveedor.jpg"
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-205 rounded-xl hover:bg-slate-50 text-[#091426] cursor-pointer"
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

      {deleteConfirmProvider && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl p-6 max-w-sm w-full space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-rose-600 animate-pulse">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">¿Eliminar Proveedor?</h3>
              <p className="text-xs text-slate-500">
                ¿Seguro que deseas eliminar al proveedor <strong className="text-slate-800">"{deleteConfirmProvider.name}"</strong>? Esta acción lo removerá de la base de datos de manera definitiva.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmProvider(null)}
                className="flex-1 py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-705 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onDeleteProvider(deleteConfirmProvider.id);
                    setSelectedProviderId(null);
                    setDeleteConfirmProvider(null);
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

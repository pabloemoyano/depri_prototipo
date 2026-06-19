import React, { useState, useEffect } from "react";
import { X, Check, Save, Trash2, AlertCircle, Plus, ChevronRight } from "lucide-react";
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { PendingClassification } from "../types";
import { Pillar, Account, Subaccount, getUnifiedPlan, saveUnifiedPlan } from "../lib/accountManager";

interface AdminClassificationModalProps {
  onClose: () => void;
  onResolved: () => void;
}

export const AdminClassificationModal: React.FC<AdminClassificationModalProps> = ({ onClose, onResolved }) => {
  const [pendings, setPendings] = useState<PendingClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [masterPlan, setMasterPlan] = useState<Pillar[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Resolution state for each item
  const [resolutions, setResolutions] = useState<Record<string, {
    action: "create" | "associate" | "reject",
    targetSubaccountId?: string,
    newSubaccountLabel?: string
  }>>({});

  useEffect(() => {
    fetchPendings();
    setMasterPlan(getUnifiedPlan());
  }, []);

  const fetchPendings = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "pending_classifications"), where("status", "==", "PENDIENTE"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PendingClassification));
      setPendings(data);
    } catch (err) {
      console.error("Error fetching pendings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleActionChange = (id: string, action: "create" | "associate" | "reject") => {
    setResolutions(prev => ({
      ...prev,
      [id]: { 
        action, 
        newSubaccountLabel: action === "create" ? pendings.find(p => p.id === id)?.suggestedSubaccount : "",
        targetSubaccountId: "" 
      }
    }));
  };

  const handleResolve = async (id: string) => {
    const pending = pendings.find(p => p.id === id);
    const resolution = resolutions[id];
    if (!pending || !resolution) return;

    setResolvingId(id);
    try {
      let finalSubaccountId = "";

      if (resolution.action === "create") {
        // 1. Update Master Plan
        const currentPlan = getUnifiedPlan();
        const allAccounts = currentPlan.flatMap(p => p.accounts);
        const targetAcc = allAccounts.find(a => a.id === pending.accountId);
        
        if (targetAcc) {
          const newSub: Subaccount = {
            id: "sub_" + Date.now(),
            label: resolution.newSubaccountLabel || pending.suggestedSubaccount || "Sin Nombre"
          };
          targetAcc.subaccounts.push(newSub);
          saveUnifiedPlan(currentPlan);
          setMasterPlan(getUnifiedPlan());
          finalSubaccountId = newSub.id;
        }
      } else if (resolution.action === "associate") {
        finalSubaccountId = resolution.targetSubaccountId || "";
      }

      // 2. Update the pending document
      const docRef = doc(db, "pending_classifications", id);
      await updateDoc(docRef, {
        status: resolution.action === "reject" ? "RECHAZADO" : "RESUELTO",
        resolvedSubaccountId: finalSubaccountId,
        resolutionDate: new Date().toISOString()
      });

      // 3. Update the original movement if it was a sale/receipt (advanced integration would be needed here)
      // For now, the user says "El movimiento deja de estar pendiente. Queda correctamente vinculado a Cuenta y Subcuenta."

      setPendings(prev => prev.filter(p => p.id !== id));
      onResolved();
    } catch (err) {
      console.error("Error resolving:", err);
      alert("Error al resolver la clasificación.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Gestión de Clasificaciones</h2>
              <p className="text-xs text-slate-500 font-medium italic">Resuelve sugerencias de subcuentas de los operadores</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition cursor-pointer">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando pendientes...</span>
            </div>
          ) : pendings.length === 0 ? (
            <div className="text-center py-20">
              <Check className="w-16 h-16 text-emerald-500 mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-bold text-slate-300 uppercase tracking-tighter">No hay pendientes</h3>
              <p className="text-slate-400 text-sm italic">Todo está correctamente clasificado.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendings.map(item => {
                const account = masterPlan.flatMap(p => p.accounts).find(a => a.id === item.accountId);
                const res = resolutions[item.id] || { action: "create", newSubaccountLabel: item.suggestedSubaccount };

                return (
                  <div key={item.id} className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50 shadow-sm transition hover:shadow-md">
                    <div className="grid grid-cols-1 md:grid-cols-2">
                      {/* Movement Data */}
                      <div className="p-4 bg-white border-b md:border-b-0 md:border-r border-slate-100">
                        <div className="flex justify-between items-start mb-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${item.type === 'INGRESO' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {item.type}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{new Date(item.date).toLocaleDateString()}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                            CUENTA: <span className="text-slate-900">{account?.label || "Desconocida"}</span>
                          </div>
                          <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                            SUGERENCIA: <span className="text-amber-600 italic">"{item.suggestedSubaccount}"</span>
                          </div>
                        </div>
                        <div className="mt-3 p-2 bg-slate-100/50 rounded text-xs font-medium text-slate-600 line-clamp-2">
                          {item.description || "Sin descripción"}
                        </div>
                        <div className="mt-3 border-t border-slate-100 pt-2 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400">Usuario: {item.user.split('@')[0]}</span>
                          <span className="text-sm font-black text-slate-900">${item.amount.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Resolution Flow */}
                      <div className="p-4 flex flex-col gap-3">
                        <div className="flex gap-1 bg-slate-200 p-1 rounded-lg">
                          {[
                            { action: "create", label: "CREAR NUEVA", icon: Plus },
                            { action: "associate", label: "ASOCIAR EXISTENTE", icon: ChevronRight },
                            { action: "reject", label: "RECHAZAR", icon: Trash2 }
                          ].map(btn => (
                            <button
                              key={btn.action}
                              onClick={() => handleActionChange(item.id, btn.action as any)}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-black uppercase transition cursor-pointer ${
                                res.action === btn.action 
                                  ? "bg-white text-slate-900 shadow-sm translate-y-[-1px]" 
                                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                              }`}
                            >
                              <btn.icon className="w-3 h-3" />
                              {btn.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex-1">
                          {res.action === "create" && (
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Confirmar Nombre de Subcuenta</label>
                              <input 
                                type="text"
                                value={res.newSubaccountLabel || ""}
                                onChange={(e) => setResolutions(prev => ({ ...prev, [item.id]: { ...res, newSubaccountLabel: e.target.value }}))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                              />
                            </div>
                          )}

                          {res.action === "associate" && (
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Seleccionar Subcuenta Existente</label>
                              <select 
                                value={res.targetSubaccountId || ""}
                                onChange={(e) => setResolutions(prev => ({ ...prev, [item.id]: { ...res, targetSubaccountId: e.target.value }}))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                              >
                                <option value="">-- Seleccionar --</option>
                                {account?.subaccounts.map(sub => (
                                  <option key={sub.id} value={sub.id}>{sub.label}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {res.action === "reject" && (
                            <div className="h-full flex items-center justify-center bg-rose-50 rounded-lg border border-rose-100 p-4">
                              <p className="text-[10px] font-medium text-rose-700 italic text-center leading-relaxed">
                                Se marcará como rechazada. El movimiento quedará sin subcuenta oficial pero documentado con la descripción original.
                              </p>
                            </div>
                          )}
                        </div>

                        <button
                          disabled={resolvingId === item.id || (res.action === 'associate' && !res.targetSubaccountId) || (res.action === 'create' && !res.newSubaccountLabel)}
                          onClick={() => handleResolve(item.id)}
                          className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition cursor-pointer ${
                             res.action === 'reject' 
                               ? "bg-rose-600 text-white hover:bg-rose-700" 
                               : "bg-emerald-600 text-white hover:bg-emerald-700"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {resolvingId === item.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              CONFIRMAR RESOLUCIÓN
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-100/50 border-t border-slate-100 flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {pendings.length} PENDIENTES EN COLA
          </span>
          <button onClick={onClose} className="px-5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 transition">
            CERRAR PANEL
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { FolderTree, Plus, RefreshCw, Trash2, Edit2, Save } from "lucide-react";
import { AddAccountButton } from "./AddAccountButton";
import { 
    getUnifiedPlan, 
    Pillar, 
    Account, 
    Subaccount, 
    resetPlanAssignments, 
    addAccount, 
    deleteAccount, 
    editAccount, 
    addSubaccount, 
    deleteSubaccount, 
    editSubaccount, 
    saveUnifiedPlan,
    fetchMasterPlanFromServer,
    pushMasterPlanToServer
} from "../lib/accountManager";
import { auth } from "../lib/firebase";

interface Props {
    apiFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

export const PlanCuentasMaestro: React.FC<Props> = ({ apiFetch }) => {
    const [discovered, setDiscovered] = useState<string[]>([]);
    const [debugData, setDebugData] = useState<any>(null); // New debug state
    const [plan, setPlan] = useState<Pillar[]>(getUnifiedPlan());
    const [loading, setLoading] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [selectedPillarId, setSelectedPillarId] = useState<string | null>(plan[0]?.id || null);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

    // Initial sync
    useEffect(() => {
        if (!apiFetch) return;
        const sync = async () => {
            setLoading(true);
            try {
                const remotePlan = await fetchMasterPlanFromServer(apiFetch);
                
                // If remote is empty but local has data, push local to remote (migration)
                const localPlan = getUnifiedPlan();
                const localHasAccounts = localPlan.some(p => p.accounts.length > 0);
                const remoteHasAccounts = remotePlan.some(p => p.accounts.length > 0);

                if (!remoteHasAccounts && localHasAccounts) {
                    console.log("Migrating local plan to server...");
                    await pushMasterPlanToServer(apiFetch, localPlan);
                }
                
                setPlan(remotePlan);
            } catch (e) {
                console.error("Sync error:", e);
                setSyncError("Error al sincronizar con el servidor");
            } finally {
                setLoading(false);
            }
        };
        sync();
    }, [apiFetch]);

    useEffect(() => {
        const fetchDiscovered = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) return;
                const res = await fetch("/api/admin/raw-caja-dump", { 
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const data = await res.json();
                setDebugData(data); // Populate
                setDiscovered(data.uniqueAccounts || []);
            } catch (e) { console.error("Error fetching discovered accounts:", e); }
        };
        fetchDiscovered();
    }, []);

    const classifiedAccountLabels = plan.flatMap(p => p.accounts.map(a => a.label));
    const pendingAccounts = discovered.filter(label => !classifiedAccountLabels.includes(label));

    const selectedPillar = plan.find(p => p.id === selectedPillarId);
    const selectedAccount = selectedPillar?.accounts.find(a => a.id === selectedAccountId);

    const updatePlan = (newPlan: Pillar[]) => {
        setPlan(newPlan);
        saveUnifiedPlan(newPlan);
        if (apiFetch) {
            pushMasterPlanToServer(apiFetch, newPlan).catch(err => {
                console.error("Failed to push plan to server:", err);
                setSyncError("Error al guardar cambios en el servidor");
            });
        }
    };

    const [editingAccount, setEditingAccount] = useState<{id: string, label: string} | null>(null);
    const [editingSubaccount, setEditingSubaccount] = useState<{accId: string, subId: string, label: string} | null>(null);

    const handleAddAccount = (pillarId: string, label: string) => {
        updatePlan(addAccount(pillarId, label));
    };

    const handleDeleteAccount = (pillarId: string, accountId: string) => {
        if (selectedAccountId === accountId) setSelectedAccountId(null);
        updatePlan(deleteAccount(pillarId, accountId));
    };

    const handleManualAddAccount = () => {
        const defaultName = "Nueva Cuenta";
        let uniqueLabel = defaultName;
        let counter = 1;
        
        const allLabels = plan.flatMap(p => p.accounts.map(a => a.label.toLowerCase()));
        while (allLabels.includes(uniqueLabel.toLowerCase())) {
            uniqueLabel = `${defaultName} ${counter++}`;
        }

        const newPlan = addAccount(selectedPillarId!, uniqueLabel);
        updatePlan(newPlan);
        
        const pillar = newPlan.find(p => p.id === selectedPillarId);
        if (pillar) {
            const newAcc = pillar.accounts.find(a => a.label === uniqueLabel);
            if (newAcc) {
                setEditingAccount(newAcc);
                setSelectedAccountId(newAcc.id);
            }
        }
    };

    const handleEditAccount = (pillarId: string, accountId: string, label: string) => {
        const trimmedLabel = label.trim();
        if (!trimmedLabel) {
            setEditingAccount(null);
            return;
        }

        // Search for collision across all pillars
        const allAccounts = plan.flatMap(p => p.accounts);
        const collision = allAccounts.find(a => a.id !== accountId && a.label.toLowerCase() === trimmedLabel.toLowerCase());
        
        if (collision) {
            const targetPillar = plan.find(p => p.accounts.some(a => a.id === collision.id));
            alert(`Error: La cuenta "${trimmedLabel}" ya existe en el pilar "${targetPillar?.label}".`);
            setEditingAccount(null);
            return;
        }

        updatePlan(editAccount(pillarId, accountId, trimmedLabel));
        setEditingAccount(null);
    };

    const handleAddSubaccount = (pillarId: string, accountId: string, label: string) => {
        const newPlan = addSubaccount(pillarId, accountId, label);
        updatePlan(newPlan);
        // Find the subaccount to edit
        const pillar = newPlan.find(p => p.id === pillarId);
        const acc = pillar?.accounts.find(a => a.id === accountId);
        const sub = acc?.subaccounts[acc.subaccounts.length - 1];
        if (sub) setEditingSubaccount({ accId: accountId, subId: sub.id, label: sub.label });
    };

    const handleDeleteSubaccount = (pillarId: string, accountId: string, subaccountId: string) => {
        updatePlan(deleteSubaccount(pillarId, accountId, subaccountId));
    };

    const handleEditSubaccount = (pillarId: string, accountId: string, subaccountId: string, label: string) => {
        updatePlan(editSubaccount(pillarId, accountId, subaccountId, label));
        setEditingSubaccount(null);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-black uppercase text-slate-900">Plan de Cuentas Maestro</h2>
                <div className="flex items-center gap-2">
                    {loading && <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />}
                    {syncError && <span className="text-[10px] text-amber-600 font-medium px-2 py-0.5 bg-amber-50 rounded border border-amber-100">{syncError}</span>}
                </div>
            </div>

            <div className="flex gap-4 p-4 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">
                <span>Total Detectadas: {discovered.length}</span>
                <span>Total Clasificadas: {classifiedAccountLabels.length}</span>
                <span>Total Pendientes: {pendingAccounts.length}</span>
            </div>

            <button 
                onClick={() => {
                    // Immediate action for now to avoid iframe issues with confirm()
                    setPlan(resetPlanAssignments());
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded text-xs font-bold hover:bg-amber-200"
            >
                <RefreshCw className="w-3 h-3" /> Vaciar y Reiniciar Plan
            </button>
            
            <div className="grid grid-cols-3 gap-6">
                {/* Pillars */}
                <div className="bg-white p-4 border rounded-xl shadow-3xs">
                    <h3 className="font-bold text-sm mb-4">Pilares (Fijos)</h3>
                    <div className="space-y-2">
                        {plan.map(pillar => (
                            <button 
                                key={pillar.id}
                                onClick={() => { setSelectedPillarId(pillar.id); setSelectedAccountId(null); }}
                                className={`w-full text-left p-2 rounded ${selectedPillarId === pillar.id ? 'bg-indigo-100' : 'hover:bg-slate-50'}`}
                            >
                                {pillar.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Accounts */}
                <div className="bg-white p-4 border rounded-xl shadow-3xs overflow-hidden flex flex-col">
                    <h3 className="font-bold text-sm mb-4">Cuentas (Asignar)</h3>
                    {selectedPillar ? (
                        <div className="flex-1 flex flex-col min-h-0 space-y-4">
                            <div className="flex-1 overflow-auto space-y-2 pr-1">
                                {selectedPillar.accounts.length === 0 ? (
                                    <p className="text-xs text-slate-400 py-4 text-center italic">No hay cuentas asignadas</p>
                                ) : (
                                    selectedPillar.accounts.map(acc => (
                                        <div 
                                            key={acc.id} 
                                            className={`flex items-center justify-between p-2 rounded group ${selectedAccountId === acc.id ? 'bg-indigo-100' : 'hover:bg-slate-50'}`}
                                        >
                                            <button 
                                                type="button" 
                                                onClick={() => setSelectedAccountId(acc.id)} 
                                                className="flex-1 text-left text-sm truncate"
                                            >
                                                {editingAccount?.id === acc.id ? (
                                                    <input 
                                                        autoFocus 
                                                        className="w-full bg-white border border-indigo-300 rounded px-1"
                                                        defaultValue={acc.label} 
                                                        onBlur={(e) => handleEditAccount(selectedPillar.id, acc.id, e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleEditAccount(selectedPillar.id, acc.id, e.currentTarget.value);
                                                            if (e.key === 'Escape') setEditingAccount(null);
                                                        }}
                                                    />
                                                ) : acc.label}
                                            </button>
                                            <div className="flex items-center gap-1.5 ml-2">
                                                <button 
                                                    type="button"
                                                    title="Editar"
                                                    onClick={(e) => { e.stopPropagation(); setEditingAccount(acc); }}
                                                    className="p-1 hover:bg-white rounded transition-colors text-slate-400 hover:text-indigo-600"
                                                >
                                                    <Edit2 className="w-3 h-3"/>
                                                </button>
                                                <button 
                                                    type="button"
                                                    title="Eliminar"
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteAccount(selectedPillar.id, acc.id); }}
                                                    className="p-1 hover:bg-white rounded transition-colors text-slate-400 hover:text-rose-600"
                                                >
                                                    <Trash2 className="w-3 h-3"/>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            <div className="pt-2 border-t">
                                <AddAccountButton onClick={handleManualAddAccount} />
                            </div>

                            <div className="pt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-auto">
                                <p className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-wider">Cuentas Pendientes de Asignar:</p>
                                <div className="max-h-40 overflow-auto space-y-1">
                                    {pendingAccounts.length === 0 ? (
                                        <p className="text-[10px] text-slate-400 italic">No hay cuentas pendientes.</p>
                                    ) : (
                                        pendingAccounts.map(accId => (
                                            <button 
                                                key={accId} 
                                                onClick={() => handleAddAccount(selectedPillar.id, accId)} 
                                                className="w-full text-left p-1.5 text-[11px] rounded bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 flex items-center justify-between group transition-all"
                                            >
                                                <span className="truncate">{accId}</span>
                                                <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl">
                            <p className="text-slate-400 text-sm">Selecciona un pilar</p>
                        </div>
                    )}
                </div>

                {/* Subaccounts */}
                <div className="bg-white p-4 border rounded-xl shadow-3xs flex flex-col">
                    <h3 className="font-bold text-sm mb-4">Subcuentas</h3>
                    {selectedAccount ? (
                        <div className="flex-1 flex flex-col min-h-0 space-y-4">
                            <div className="flex-1 overflow-auto space-y-2 pr-1">
                                {selectedAccount.subaccounts.length === 0 ? (
                                    <p className="text-xs text-slate-400 py-4 text-center italic">No hay subcuentas</p>
                                ) : (
                                    selectedAccount.subaccounts.map(sub => (
                                        <div key={sub.id} className="flex items-center justify-between p-2 border rounded group hover:bg-slate-50 transition-colors">
                                            <span className="text-sm truncate flex-1">
                                                {editingSubaccount?.subId === sub.id ? (
                                                    <input 
                                                        autoFocus 
                                                        className="w-full bg-white border border-indigo-300 rounded px-1"
                                                        defaultValue={sub.label} 
                                                        onBlur={(e) => handleEditSubaccount(selectedPillarId!, selectedAccount.id, sub.id, e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleEditSubaccount(selectedPillarId!, selectedAccount.id, sub.id, e.currentTarget.value);
                                                            if (e.key === 'Escape') setEditingSubaccount(null);
                                                        }}
                                                    />
                                                ) : sub.label}
                                            </span>
                                            <div className="flex items-center gap-1.5 ml-2 relative z-20">
                                                <button 
                                                    type="button" 
                                                    title="Editar"
                                                    onClick={() => setEditingSubaccount({accId: selectedAccount.id, subId: sub.id, label: sub.label})}
                                                    className="p-1 hover:bg-white rounded transition-colors text-slate-400 hover:text-indigo-600"
                                                >
                                                    <Edit2 className="w-3 h-3"/>
                                                </button>
                                                <button 
                                                    type="button" 
                                                    title="Eliminar"
                                                    onClick={() => handleDeleteSubaccount(selectedPillarId!, selectedAccount.id, sub.id)}
                                                    className="p-1 hover:bg-white rounded transition-colors text-slate-400 hover:text-rose-600"
                                                >
                                                    <Trash2 className="w-3 h-3"/>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <button 
                                type="button"
                                onClick={() => {
                                    handleAddSubaccount(selectedPillarId!, selectedAccount.id, "Nueva Subcuenta");
                                }} 
                                className="mt-auto w-full flex items-center justify-center gap-2 p-2 rounded bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors"
                            >
                                <Plus className="w-4 h-4"/> Añadir subcuenta
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl">
                            <p className="text-slate-400 text-sm">Selecciona una cuenta</p>
                        </div>
                    )}
                </div>
            </div>
            {debugData && (
                <div className="mt-8 p-4 bg-slate-900 text-white font-mono text-xs overflow-auto">
                    <pre>{JSON.stringify(debugData, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

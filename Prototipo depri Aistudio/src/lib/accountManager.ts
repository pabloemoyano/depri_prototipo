export interface Subaccount {
    id: string;
    label: string;
}

export interface Account {
    id: string;
    label: string;
    subaccounts: Subaccount[];
}

export interface Pillar {
    id: string;
    label: string;
    accounts: Account[];
}

const DEFAULT_PILLARS: Pillar[] = [
    { id: "Ingresos por Venta", label: "Ingresos por Venta", accounts: [] },
    { id: "Costos de Venta", label: "Costos de Venta", accounts: [] },
    { id: "Gastos Estructurales", label: "Gastos Estructurales", accounts: [] },
    { id: "Movimientos de Capital", label: "Movimientos de Capital", accounts: [] },
    { id: "Retiro de Dueños", label: "Retiro de Dueños", accounts: [] },
    { id: "Eventos Extraordinarios", label: "Eventos Extraordinarios", accounts: [] },
    { id: "Inversiones", label: "Inversiones", accounts: [] },
    { id: "Tasas e Impuestos", label: "Tasas e Impuestos", accounts: [] },
    { id: "Otros Movimientos", label: "Otros Movimientos", accounts: [] }
];

export const getUnifiedPlan = (): Pillar[] => {
    const data = localStorage.getItem("unified_plan_cuentas");
    return data ? JSON.parse(data) : DEFAULT_PILLARS;
};

export const saveUnifiedPlan = (plan: Pillar[]) => {
    localStorage.setItem("unified_plan_cuentas", JSON.stringify(plan));
};

export const resetPlanAssignments = () => {
    const newPlan = DEFAULT_PILLARS.map(p => ({ ...p, accounts: [] }));
    saveUnifiedPlan(newPlan);
    return newPlan;
};

export const getUnifiedAccounts = (): Account[] => {
    return getUnifiedPlan().flatMap(p => p.accounts);
};

export const getUnifiedSubaccounts = (accountId: string): Subaccount[] => {
    const plan = getUnifiedPlan();
    for (const pillar of plan) {
        const account = pillar.accounts.find(a => a.id === accountId);
        if (account) return account.subaccounts;
    }
    return [];
};

export const getAccountLabel = (idOrLabel: string): string => {
    if (!idOrLabel) return "";
    
    // 1. Look up in unified accounts by ID or label
    const accounts = getUnifiedAccounts();
    const found = accounts.find(a => a.id === idOrLabel || a.label === idOrLabel);
    if (found) return found.label;

    // 2. Parse if it follows the ID format: {pillarId}_{label}_{timestamp}
    const parts = idOrLabel.split("_");
    if (parts.length >= 3) {
        const lastPart = parts[parts.length - 1];
        if (/^\d{10,15}$/.test(lastPart)) {
            return parts[parts.length - 2];
        }
    }
    
    return idOrLabel;
};

export const getSubaccountLabel = (accountIdOrLabel: string, subIdOrLabel: string): string => {
    if (!subIdOrLabel) return "";
    
    // 1. Look up by subaccountId or label under the accountIdOrLabel
    const subs = getUnifiedSubaccounts(accountIdOrLabel);
    const found = subs.find(s => s.id === subIdOrLabel || s.label === subIdOrLabel);
    if (found) return found.label;

    // 2. Look up globally under any account
    const allAccounts = getUnifiedAccounts();
    for (const acc of allAccounts) {
        const sFound = acc.subaccounts.find(s => s.id === subIdOrLabel || s.label === subIdOrLabel);
        if (sFound) return sFound.label;
    }

    // 3. Parse if it follows the ID format: {accountId}_{label}_{timestamp}
    const parts = subIdOrLabel.split("_");
    if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1];
        if (/^\d{10,15}$/.test(lastPart)) {
            return parts[parts.length - 2];
        }
    }
    
    return subIdOrLabel;
};

export const saveUnifiedAccounts = (accounts: Account[]) => {
    const plan = getUnifiedPlan();
    // Prefer "Gastos Estructurales" or "Otros Movimientos" as fallback
    let pillar = plan.find(p => p.id === "Gastos Estructurales") || plan.find(p => p.id === "Otros Movimientos") || plan[2]; 
    if (pillar) {
        // Merge or replace depending on intent. Here we seem to want to store them somewhere.
        // But usually accounts should belong to specific pillars.
        // For simplicity in this legacy helper, we update the first matching one.
        pillar.accounts = accounts;
        saveUnifiedPlan(plan);
    }
};

export const saveUnifiedSubaccounts = (accountId: string, subaccounts: Subaccount[]) => {
    const plan = getUnifiedPlan();
    let found = false;
    for (const pillar of plan) {
        const account = pillar.accounts.find(a => a.id === accountId);
        if (account) {
            account.subaccounts = subaccounts;
            found = true;
            break;
        }
    }
    
    // If account not found, add it to Gastos Estructurales to allow subaccount saving
    if (!found) {
        const targetPillar = plan.find(p => p.id === "Gastos Estructurales") || plan[2];
        if (targetPillar) {
            targetPillar.accounts.push({
                id: accountId,
                label: accountId,
                subaccounts: subaccounts
            });
        }
    }
    saveUnifiedPlan(plan);
};

export const addAccount = (pillarId: string, label: string) => {
    const plan = getUnifiedPlan();
    // Check if this label already exists in ANY pillar
    const exists = plan.some(p => p.accounts.some(a => a.label.toLowerCase() === label.toLowerCase()));
    if (exists) {
        console.warn(`Account label "${label}" already exists in the plan.`);
        return plan;
    }

    const newPlan = plan.map(p => {
        if (p.id === pillarId) {
            return {
                ...p,
                accounts: [...p.accounts, { id: `${pillarId}_${label}_${Date.now()}`, label, subaccounts: [] }]
            };
        }
        return p;
    });
    saveUnifiedPlan(newPlan);
    return newPlan;
};

export const deleteAccount = (pillarId: string, accountId: string) => {
    const plan = getUnifiedPlan();
    const newPlan = plan.map(p => {
        if (p.id === pillarId) {
            return {
                ...p,
                accounts: p.accounts.filter(a => a.id !== accountId)
            };
        }
        return p;
    });
    saveUnifiedPlan(newPlan);
    return newPlan;
};

export const editAccount = (pillarId: string, accountId: string, newLabel: string) => {
    const plan = getUnifiedPlan();
    // Check if the new label already exists in ANY other account across all pillars
    const exists = plan.some(p => p.accounts.some(a => a.id !== accountId && a.label.toLowerCase() === newLabel.toLowerCase()));
    if (exists) {
        console.warn(`Account label "${newLabel}" already exists in the plan.`);
        return plan;
    }

    const newPlan = plan.map(p => {
        if (p.id === pillarId) {
            return {
                ...p,
                accounts: p.accounts.map(a => a.id === accountId ? { ...a, label: newLabel } : a)
            };
        }
        return p;
    });
    saveUnifiedPlan(newPlan);
    return newPlan;
};

export const addSubaccount = (pillarId: string, accountId: string, label: string) => {
    const plan = getUnifiedPlan();
    const newPlan = plan.map(p => {
        if (p.id === pillarId) {
            return {
                ...p,
                accounts: p.accounts.map(a => {
                    if (a.id === accountId) {
                        return {
                            ...a,
                            subaccounts: [...a.subaccounts, { id: `${accountId}_${label}_${Date.now()}`, label }]
                        };
                    }
                    return a;
                })
            };
        }
        return p;
    });
    saveUnifiedPlan(newPlan);
    return newPlan;
};

export const deleteSubaccount = (pillarId: string, accountId: string, subaccountId: string) => {
    const plan = getUnifiedPlan();
    const newPlan = plan.map(p => {
        if (p.id === pillarId) {
            return {
                ...p,
                accounts: p.accounts.map(a => {
                    if (a.id === accountId) {
                        return {
                            ...a,
                            subaccounts: a.subaccounts.filter(s => s.id !== subaccountId)
                        };
                    }
                    return a;
                })
            };
        }
        return p;
    });
    saveUnifiedPlan(newPlan);
    return newPlan;
};

export const editSubaccount = (pillarId: string, accountId: string, subaccountId: string, newLabel: string) => {
    const plan = getUnifiedPlan();
    const newPlan = plan.map(p => {
        if (p.id === pillarId) {
            return {
                ...p,
                accounts: p.accounts.map(a => {
                    if (a.id === accountId) {
                        return {
                            ...a,
                            subaccounts: a.subaccounts.map(s => s.id === subaccountId ? { ...s, label: newLabel } : s)
                        };
                    }
                    return a;
                })
            };
        }
        return p;
    });
    saveUnifiedPlan(newPlan);
    return newPlan;
};

export const migrateFromCajaDiaria = () => {
    // 1. Load legacy data
    const legacyIngresos = JSON.parse(localStorage.getItem("caja_v2_otros_ingresos_accounts") || "[]");
    const legacyEgresos = JSON.parse(localStorage.getItem("caja_v2_otros_egresos_accounts") || "[]");
    const legacyPersonal = JSON.parse(localStorage.getItem("caja_v2_personnel_accounts") || "[]");

    const plan = getUnifiedPlan();

    // Mapping legacy to pillars (simple heuristic)
    const updatePlanForLegacy = (pillarId: string, accounts: string[]) => {
        const pillar = plan.find(p => p.id === pillarId);
        if (pillar) {
            accounts.forEach(accLabel => {
                if (!pillar.accounts.find(a => a.label === accLabel)) {
                    pillar.accounts.push({ id: accLabel, label: accLabel, subaccounts: [] });
                }
            });
        }
    };

    updatePlanForLegacy("Otros", legacyIngresos);
    updatePlanForLegacy("Otros", legacyEgresos);
    updatePlanForLegacy("Sueldos", legacyPersonal);

    saveUnifiedPlan(plan);
    return plan;
};

// --- FIRESTORE SYNC LOGIC ---

/**
 * Fetches the Master Chart of Accounts from the server and updates local storage.
 */
export const fetchMasterPlanFromServer = async (apiFetch: any): Promise<Pillar[]> => {
    try {
        const res = await apiFetch("/api/accounts/master");
        if (res.ok) {
            const remotePlan = await res.json();
            if (Array.isArray(remotePlan) && remotePlan.length > 0) {
                saveUnifiedPlan(remotePlan);
                return remotePlan;
            }
        }
    } catch (err) {
        console.error("Error fetching master plan from server:", err);
    }
    return getUnifiedPlan();
};

/**
 * Pushes the current local plan to the server.
 */
export const pushMasterPlanToServer = async (apiFetch: any, plan: Pillar[]) => {
    try {
        const res = await apiFetch("/api/accounts/master", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(plan)
        });
        return res.ok;
    } catch (err) {
        console.error("Error pushing master plan to server:", err);
        return false;
    }
};

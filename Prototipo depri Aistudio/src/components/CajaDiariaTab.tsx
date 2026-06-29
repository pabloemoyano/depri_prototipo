/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState } from "react";
import { SaleTransaction, StockItem, CustomerProfile, SaleItem } from "../types";
import { CajaDiariaV2 } from "./CajaDiariaV2";
import { CajaConsolidadaReport } from "./CajaConsolidadaReport";
import { LibroGestion } from "./LibroGestion";
import { PresupuestoMensual } from "./PresupuestoMensual";
import { ResultadoEconomico } from "./ResultadoEconomico";
import { PuntoEquilibrio } from "./PuntoEquilibrio";
import { ClasificacionHistorica } from "./ClasificacionHistorica";
import { 
  Clock, 
  Calendar, 
  Layers, 
  PiggyBank, 
  Briefcase, 
  Scale,
  Tag
} from "lucide-react";

interface CajaDiariaTabProps {
  sales: SaleTransaction[];
  stock: StockItem[];
  customers: CustomerProfile[];
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onAddSale?: (saleData: {
    items: SaleItem[];
    method: "efectivo" | "tarjeta" | "bizum" | string;
    origin: "terminal" | "mesa" | "ticket_ai";
    table_number: string;
    notes?: string;
  }) => Promise<boolean>;
  onAddCustomer?: (customerData: any) => Promise<boolean>;
  onEditCustomer?: (customerData: CustomerProfile) => Promise<void>;
  onDeleteCustomer?: (id: string) => Promise<void>;
  activeSubTab: string;
  setActiveSubTab: (tab: string) => void;
}

export const CajaDiariaTab: React.FC<CajaDiariaTabProps> = ({ 
  sales, 
  stock, 
  customers, 
  apiFetch,
  onAddSale, 
  onAddCustomer,
  onEditCustomer,
  onDeleteCustomer,
  activeSubTab,
  setActiveSubTab
}) => {
  type SubTabType = "fin_caja" | "fin_consolidada" | "fin_libro" | "fin_presupuesto" | "fin_clasificacion" | "fin_resultado" | "fin_punto";

  const tabs: { id: SubTabType; label: string; icon: React.ComponentType<any> }[] = [
    { id: "fin_caja", label: "Caja Diaria", icon: Clock },
    { id: "fin_consolidada", label: "Caja Consolidada", icon: Calendar },
    { id: "fin_libro", label: "Libro de Gestión", icon: Layers },
    { id: "fin_presupuesto", label: "Presupuesto", icon: PiggyBank },
    { id: "fin_clasificacion", label: "Clasificación Histórica", icon: Tag },
    { id: "fin_resultado", label: "Resultado Económico", icon: Briefcase },
    { id: "fin_punto", label: "Punto de Equilibrio", icon: Scale }
  ];

  return (
    <div className="space-y-6">
      
      {/* Render subcomponents dynamically with state passing */}
      <div className="tab-content transition duration-200">
        {activeSubTab === "fin_caja" && (
          <CajaDiariaV2 
            sales={sales} 
            customers={customers} 
            onAddSale={onAddSale} 
            onAddCustomer={onAddCustomer} 
            onEditCustomer={onEditCustomer}
            onDeleteCustomer={onDeleteCustomer}
          />
        )}

        {activeSubTab === "fin_consolidada" && (
          <CajaConsolidadaReport 
            sales={sales}
            apiFetch={apiFetch}
          />
        )}

        {activeSubTab === "fin_libro" && (
          <LibroGestion 
            sales={sales}
            apiFetch={apiFetch}
          />
        )}

        {activeSubTab === "fin_presupuesto" && (
          <PresupuestoMensual 
            apiFetch={apiFetch}
          />
        )}

        {activeSubTab === "fin_clasificacion" && (
          <ClasificacionHistorica 
            apiFetch={apiFetch}
          />
        )}

        {activeSubTab === "fin_resultado" && (
          <ResultadoEconomico 
            sales={sales}
            apiFetch={apiFetch}
          />
        )}

        {activeSubTab === "fin_punto" && (
          <PuntoEquilibrio 
            sales={sales}
            apiFetch={apiFetch}
          />
        )}
      </div>

    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from "react";
import { 
  Search, 
  Eye, 
  TrendingDown, 
  Clock, 
  AlertTriangle,
  X,
  CheckCircle,
  Save,
  FileText,
  User,
  Activity,
  DollarSign
} from "lucide-react";
import { AuditLogEntry, AuditDraftItem, StockItem, InventoryMovement } from "../types";
import { auth } from "../lib/firebase";

interface WeeklyAuditTabProps {
  stock: StockItem[];
  movements: InventoryMovement[];
  audits: AuditLogEntry[];
  onSaveAudit: (auditPayload: { responsible: string; note: string; adjustments: any[] }) => Promise<boolean>;
}

export const WeeklyAuditTab: React.FC<WeeklyAuditTabProps> = ({ stock, movements, audits = [], onSaveAudit }) => {
  const [activeSubTab, setActiveSubTab] = useState<"history" | "new_audit">("history");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSessionOk, setShowSessionOk] = useState(false);
  
  const getRealResponsible = (name: string) => {
    if (!name || name === "Marcos Inventory") {
      return auth.currentUser?.email || auth.currentUser?.displayName || "btndeportes@gmail.com";
    }
    return name;
  };

  // Custom Session fields
  const [sessionResponsible, setSessionResponsible] = useState(() => {
    return auth.currentUser?.email || auth.currentUser?.displayName || "btndeportes@gmail.com";
  });
  const [sessionNote, setSessionNote] = useState("Auditoría de Control Físico de Barra");
  const [showFilter, setShowFilter] = useState<"all" | "diff">("all");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setSessionResponsible(user.email || user.displayName || "btndeportes@gmail.com");
      }
    });
    return () => unsubscribe();
  }, []);

  // Selected audit for detailed view modal
  const [selectedAudit, setSelectedAudit] = useState<AuditLogEntry | null>(null);

  // Print function inside modal utilizing a beautifully styled new print window (A4 report structure)
  const handlePrintAudit = (audit: AuditLogEntry) => {
    try {
      const customLogo = localStorage.getItem("barstock_app_custom_logo") || "/src/assets/images/deprimera_logo_1780923105846.png";
      const printWindow = window.open("", "_blank", "width=850,height=1100,scrollbars=yes,resizable=yes");
      
      if (!printWindow) {
        alert("El bloqueo de ventanas emergentes impidió abrir el reporte. Por favor, habilite los permisos de popups.");
        return;
      }

      const formattedDate = audit.date.includes("T") 
        ? new Date(audit.date).toLocaleDateString("es-ES") + " " + new Date(audit.date).toLocaleTimeString("es-ES", {hour: "2-digit", minute:"2-digit"})
        : audit.date;

      const items = audit.items || [];
      
      const formatPrintQty = (val: number) => {
        if (Number.isInteger(val)) return val.toString();
        return val.toFixed(2);
      };

      let totalTheoretical = 0;
      let totalReal = 0;
      let totalDifference = 0;
      let totalCostImpact = 0;
      let totalSalesImpact = 0;

      // Always calculate statistics based on the full list of products
      items.forEach((item) => {
        const diff = item.difference !== undefined ? item.difference : (item.real - item.theoretical);
        const costImpact = diff * (item.valCosto || 0);
        const stockItem = stock.find(s => s.id === item.id);
        const valVenta = item.valVenta !== undefined ? item.valVenta : (stockItem ? stockItem.selling_price : 0);
        const salesImpact = diff * valVenta;

        totalTheoretical += item.theoretical || 0;
        totalReal += item.real || 0;
        totalDifference += diff;
        totalCostImpact += costImpact;
        totalSalesImpact += salesImpact;
      });

      const adjustedCount = items.filter(item => {
        const diff = item.difference !== undefined ? item.difference : (item.real - item.theoretical);
        return diff !== 0;
      }).length;

      // Filter rows dynamically using user's active screen preference
      const visibleItems = showFilter === "all"
        ? items
        : items.filter(item => {
            const diff = item.difference !== undefined ? item.difference : (item.real - item.theoretical);
            return diff !== 0;
          });

      const itemsRowsHtml = visibleItems.map((item) => {
        const diff = item.difference !== undefined ? item.difference : (item.real - item.theoretical);
        const costImpact = diff * (item.valCosto || 0);
        const stockItem = stock.find(s => s.id === item.id);
        const valVenta = item.valVenta !== undefined ? item.valVenta : (stockItem ? stockItem.selling_price : 0);
        const salesImpact = diff * valVenta;

        const diffColor = diff < 0 ? "#dc2626" : diff > 0 ? "#15803d" : "#475569";
        const diffText = diff > 0 ? `+${formatPrintQty(diff)}` : `${formatPrintQty(diff)}`;

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; page-break-inside: avoid;">
            <td style="padding: 6px 4px; font-size: 8.5pt; font-family: monospace; color: #64748b; white-space: normal; word-break: break-all;">${item.sku || "-"}</td>
            <td style="padding: 6px 4px; font-size: 8.5pt; font-weight: bold; color: #1e293b; white-space: normal; word-break: break-word;" title="${item.name}">${item.name}</td>
            <td style="padding: 6px 4px; font-size: 8.5pt; text-align: center; font-family: monospace;">${formatPrintQty(item.theoretical)}</td>
            <td style="padding: 6px 4px; font-size: 8.5pt; text-align: center; font-family: monospace; font-weight: bold; color: #4338ca;">${formatPrintQty(item.real)}</td>
            <td style="padding: 6px 4px; font-size: 8.5pt; text-align: center; font-family: monospace; font-weight: 900; color: ${diffColor};">${diff === 0 ? "0" : diffText}</td>
            <td style="padding: 6px 4px; font-size: 8.5pt; text-align: right; font-family: monospace; color: #64748b;">$${(item.valCosto || 0).toFixed(2)}</td>
            <td style="padding: 6px 4px; font-size: 8.5pt; text-align: right; font-family: monospace; color: #64748b;">$${valVenta.toFixed(2)}</td>
            <td style="padding: 6px 4px; font-size: 8.5pt; text-align: right; font-family: monospace; font-weight: bold; color: ${costImpact < 0 ? "#dc2626" : costImpact > 0 ? "#15803d" : "#64748b"}; font-weight: bold; white-space: nowrap;">
              ${costImpact === 0 ? "$0.00" : (costImpact > 0 ? "+" : "") + "$" + costImpact.toFixed(2)}
            </td>
            <td style="padding: 6px 4px; font-size: 8.5pt; text-align: right; font-family: monospace; font-weight: bold; color: ${salesImpact < 0 ? "#dc2626" : salesImpact > 0 ? "#15803d" : "#64748b"}; font-weight: bold; white-space: nowrap;">
              ${salesImpact === 0 ? "$0.00" : (salesImpact > 0 ? "+" : "") + "$" + salesImpact.toFixed(2)}
            </td>
            <td style="padding: 6px 4px; font-size: 8.5pt; color: #475569; word-break: break-word; white-space: normal;">${item.reason || "Sin novedad"}</td>
          </tr>
        `;
      }).join("");

      const logoStyle = "max-height: 48px; min-height: 48px; object-fit: contain;";

      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Reporte de Auditoría - #${audit.id}</title>
          <style>
            @media print {
              @page {
                size: portrait;
                margin: 0.5cm;
              }
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                font-family: system-ui, -apple-system, sans-serif;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
              }
              .paper {
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                background: transparent !important;
                overflow: visible !important;
                height: auto !important;
                width: 100% !important;
              }
              tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              table {
                page-break-inside: auto !important;
                break-inside: auto !important;
                overflow: visible !important;
                height: auto !important;
                width: 100% !important;
              }
              thead {
                display: table-header-group !important;
              }
              .table-container {
                overflow: visible !important;
                height: auto !important;
                max-height: none !important;
                width: 100% !important;
              }
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              color: #1f2937;
              padding: 24px;
              max-width: 1100px;
              margin: 0 auto;
              background-color: #f8fafc;
              overflow-x: hidden;
            }
            .paper {
              background-color: #ffffff;
              padding: 30px;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
            }
            .header-grid {
              display: grid;
              grid-template-columns: 1fr auto;
              align-items: center;
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 16px;
              margin-bottom: 20px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1.2fr 1fr 1fr;
              gap: 16px;
              background-color: #f1f5f9;
              padding: 16px;
              border-radius: 8px;
              margin-bottom: 24px;
            }
            .meta-item {
              font-size: 9pt;
            }
            .meta-label {
              font-weight: bold;
              color: #475569;
              text-transform: uppercase;
              font-size: 8pt;
              margin-bottom: 4px;
            }
            .table-container {
              margin-top: 16px;
              margin-bottom: 24px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            th {
              background-color: #f8fafc;
              color: #475569;
              font-weight: bold;
              font-size: 8pt;
              text-transform: uppercase;
              padding: 6px 4px;
              border-bottom: 2px solid #cbd5e1;
              text-align: left;
            }
            .totals-container {
              display: flex;
              justify-content: flex-end;
              margin-top: 16px;
              border-top: 2px solid #e2e8f0;
              padding-top: 16px;
            }
            .totals-table {
              width: 320px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              font-size: 9.5pt;
              margin-bottom: 6px;
            }
            .totals-label {
              font-weight: bold;
              color: #475569;
            }
            .totals-val {
              font-family: monospace;
              font-weight: bold;
            }
            .footer-note {
              margin-top: 40px;
              border-top: 1px dashed #cbd5e1;
              padding-top: 16px;
              font-size: 8pt;
              color: #64748b;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="paper">
            <div class="header-grid">
              <div>
                <h1 style="margin: 0; font-size: 18pt; color: #1e3a8a; font-weight: 800; letter-spacing: -0.5px;">REPORTE DE AUDITORÍA FÍSICA</h1>
                <p style="margin: 4px 0 0 0; font-size: 10pt; color: #4b5563; font-weight: 600;">Control Administrativo de Existencias</p>
              </div>
              <div>
                <img src="${customLogo}" alt="Logo" style="${logoStyle}" onerror="this.src='/src/assets/images/deprimera_logo_1780923105846.png';">
              </div>
            </div>

            <div class="meta-grid">
              <div>
                <div class="meta-item" style="margin-bottom: 10px;">
                  <div class="meta-label">ID de Auditoría</div>
                  <div style="font-size: 11pt; font-weight: bold; font-family: monospace; color: #1e3a8a;">#${audit.id}</div>
                </div>
                <div class="meta-item">
                  <div class="meta-label">Responsable / Auditor</div>
                  <div style="font-weight: bold; color: #0f172a;">${getRealResponsible(audit.responsible)}</div>
                </div>
              </div>
              <div>
                <div class="meta-item" style="margin-bottom: 10px;">
                  <div class="meta-label">Fecha y Hora de Emisión</div>
                  <div style="font-family: monospace; font-weight: bold; color: #0f172a;">${formattedDate}</div>
                </div>
                <div class="meta-item">
                  <div class="meta-label">Observaciones generales</div>
                  <div style="color: #334155; font-style: italic;">${audit.note || "Sin observaciones específicas"}</div>
                </div>
              </div>
              <div>
                <div class="meta-item" style="margin-bottom: 10px;">
                  <div class="meta-label">Productos Auditados</div>
                  <div style="font-size: 11.5pt; font-family: monospace; font-weight: bold; color: #0f172a;">${items.length}</div>
                </div>
                <div class="meta-item">
                  <div class="meta-label">Productos Ajustados</div>
                  <div style="font-size: 11.5pt; font-family: monospace; font-weight: bold; color: #b45309;">${adjustedCount}</div>
                </div>
              </div>
              <div>
                <div class="meta-item" style="margin-bottom: 10px;">
                  <div class="meta-label">Impacto en Costos</div>
                  <div style="font-size: 11pt; font-family: monospace; font-weight: bold; color: ${totalCostImpact < 0 ? "#dc2626" : totalCostImpact > 0 ? "#15803d" : "#475569"};">
                    ${totalCostImpact > 0 ? "+" : ""}$${totalCostImpact.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div class="meta-item">
                  <div class="meta-label">Impacto Precio Venta (PVP)</div>
                  <div style="font-size: 11pt; font-family: monospace; font-weight: bold; color: ${totalSalesImpact < 0 ? "#dc2626" : totalSalesImpact > 0 ? "#15803d" : "#475569"};">
                    ${totalSalesImpact > 0 ? "+" : ""}$${totalSalesImpact.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th style="width: 8%;">SKU</th>
                    <th style="width: 24%;">Producto</th>
                    <th style="text-align: center; width: 6%;">Teórico</th>
                    <th style="text-align: center; width: 6%;">Físico</th>
                    <th style="text-align: center; width: 5%;">Diff</th>
                    <th style="text-align: right; width: 8%;">Costo U.</th>
                    <th style="text-align: right; width: 8%;">PVP U.</th>
                    <th style="text-align: right; width: 11%;">Var. Costo</th>
                    <th style="text-align: right; width: 11%;">Var. Venta</th>
                    <th style="width: 13%;">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRowsHtml}
                </tbody>
              </table>
            </div>

            <div class="totals-container" style="page-break-inside: avoid;">
              <table class="totals-table" style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background-color: #f8fafc; border-collapse: collapse;">
                <tr style="height: 24px;">
                  <td class="totals-label" style="font-size: 9pt; font-weight: bold; padding: 4px;">Unidades Teóricas:</td>
                  <td class="totals-val" style="text-align: right; font-size: 9.5pt; padding: 4px;">${formatPrintQty(totalTheoretical)} Un.</td>
                </tr>
                <tr style="height: 24px;">
                  <td class="totals-label" style="font-size: 9pt; font-weight: bold; padding: 4px;">Unidades Reales:</td>
                  <td class="totals-val" style="text-align: right; font-size: 9.5pt; color: #4338ca; padding: 4px;">${formatPrintQty(totalReal)} Un.</td>
                </tr>
                <tr style="height: 24px;">
                  <td class="totals-label" style="font-size: 9pt; font-weight: bold; padding: 4px;">Variación Unidades:</td>
                  <td class="totals-val" style="text-align: right; font-size: 9.5pt; color: ${totalDifference < 0 ? "#b91c1c" : totalDifference > 0 ? "#15803d" : "#000000"}; padding: 4px;">${totalDifference > 0 ? "+" : ""}${formatPrintQty(totalDifference)} Un.</td>
                </tr>
                <tr style="height: 28px; border-top: 1px solid #e2e8f0;">
                  <td class="totals-label" style="font-size: 9.5pt; font-weight: 800; padding: 6px 4px 4px 4px;">Diferencia Costo total:</td>
                  <td class="totals-val" style="text-align: right; font-size: 10pt; font-weight: 900; color: ${totalCostImpact < 0 ? "#b91c1c" : totalCostImpact > 0 ? "#15803d" : "#000000"}; padding: 6px 4px 4px 4px;">
                    ${totalCostImpact > 0 ? "+" : ""}$${totalCostImpact.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr style="height: 28px;">
                  <td class="totals-label" style="font-size: 9.5pt; font-weight: 800; padding: 4px;">Diferencia Venta total:</td>
                  <td class="totals-val" style="text-align: right; font-size: 10pt; font-weight: 900; color: ${totalSalesImpact < 0 ? "#b91c1c" : totalSalesImpact > 0 ? "#15803d" : "#000000"}; padding: 4px;">
                    ${totalSalesImpact > 0 ? "+" : ""}$${totalSalesImpact.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </table>
            </div>

            <div class="footer-note">
              <p style="margin: 0 0 4px 0; font-weight: bold;">Documento Administrativo de Inventario de Barra</p>
              <p style="margin: 0;">Sincronizado de forma segura y autorizada a través de la plataforma transaccional de DePrimera.</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error("Error al imprimir la auditoría:", err);
    }
  };

  // Calculate Kardex stock for each product dinamically from movements
  const getKardexStock = (p: StockItem) => {
    const itemMovements = movements ? movements.filter(m => m.itemId === p.id && m.reversed !== true) : [];
    return itemMovements.reduce((sum, m) => sum + m.quantity, 0);
  };

  const formatQuantityVal = (val: number) => {
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(2);
  };

  // Setup/Refresh Audit Form
  const startNewAudit = () => {
    const activeProducts = stock.filter(p => p.is_active !== false);
    const sortedProducts = [...activeProducts].sort((a, b) => a.name.localeCompare(b.name, "es"));
    const newDraft = sortedProducts.map((p, idx) => {
      const theoreticalQty = getKardexStock(p);
      return {
        id: p.id,
        sku: p.sku || `BEV-ART-${idx + 1}`,
        name: p.name,
        theoretical: theoreticalQty,
        real: theoreticalQty,
        difference: 0,
        valCosto: p.purchase_price,
        valVenta: p.selling_price,
        reason: "Sin Novedad"
      };
    });
    setDraftItems(newDraft);
    setActiveSubTab("new_audit");
  };

  // Draft state initialized
  const [draftItems, setDraftItems] = useState<AuditDraftItem[]>(() => {
    const activeProducts = stock.filter(p => p.is_active !== false);
    const sortedProducts = [...activeProducts].sort((a, b) => a.name.localeCompare(b.name, "es"));
    return sortedProducts.map((p, idx) => {
      const theoreticalQty = getKardexStock(p);
      return {
        id: p.id,
        sku: p.sku || `BEV-ART-${idx + 1}`,
        name: p.name,
        theoretical: theoreticalQty,
        real: theoreticalQty,
        difference: 0,
        valCosto: p.purchase_price,
        valVenta: p.selling_price,
        reason: "Sin Novedad"
      };
    });
  });

  const handleDraftRealQtyChange = (itemId: string, newReal: number) => {
    setDraftItems((prev) => {
      const index = prev.findIndex(item => item.id === itemId);
      if (index === -1) return prev;
      const updated = [...prev];
      updated[index].real = newReal;
      updated[index].difference = Number((newReal - updated[index].theoretical).toFixed(2));
      return updated;
    });
  };

  const handleDraftReasonChange = (itemId: string, newReason: string) => {
    setDraftItems((prev) => {
      const index = prev.findIndex(item => item.id === itemId);
      if (index === -1) return prev;
      const updated = [...prev];
      updated[index].reason = newReason;
      return updated;
    });
  };

  // Submit and commit session adjustments
  const handleSaveAuditSession = async () => {
    // Only register non-zero differences or all audit sheet for documentation
    const success = await onSaveAudit({
      responsible: sessionResponsible,
      note: sessionNote,
      adjustments: draftItems.map((d) => ({
        id: d.id,
        sku: d.sku,
        name: d.name,
        theoretical: d.theoretical,
        real: d.real,
        difference: d.difference,
        valCosto: d.valCosto,
        valVenta: d.valVenta,
        reason: d.difference === 0 ? "Sin Novedad" : d.reason
      }))
    });

    if (success) {
      setShowSessionOk(true);
      setTimeout(() => setShowSessionOk(false), 5000);
      setActiveSubTab("history");
    }
  };

  const totalNetAdjustmentsLineCost = audits.reduce((acc, log) => acc + (log.adjustmentCost || 0), 0);

  const selectedSalesImpact = selectedAudit
    ? (selectedAudit.items && selectedAudit.items.length > 0 
        ? selectedAudit.items.reduce((acc, item) => {
            const diff = item.difference !== undefined ? item.difference : (item.real - item.theoretical);
            const stockItem = stock.find(s => s.id === item.id);
            const valVenta = item.valVenta !== undefined ? item.valVenta : (stockItem ? stockItem.selling_price : 0);
            return acc + (diff * valVenta);
          }, 0)
        : (selectedAudit.adjustmentSales || 0))
    : 0;

  const filteredLogs = audits.filter((log) => {
    const matchSearch = log.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        log.responsible.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (log.note && log.note.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchSearch;
  });

  const sortedFilteredLogs = [...filteredLogs].sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeB - timeA;
  });

  let draftCostImpact = 0;
  let draftSalesImpact = 0;
  draftItems.forEach((d) => {
    const diff = d.difference;
    if (diff !== 0) {
      draftCostImpact += diff * d.valCosto;
      draftSalesImpact += diff * d.valVenta;
    }
  });

  return (
    <div className="space-y-6">
      
      {/* Sub Tabs Toggle bar */}
      <div className="flex border-b border-[#eff4ff] dark:border-slate-850">
        <button
          onClick={() => setActiveSubTab("history")}
          className={`pb-3 px-6 text-xs font-bold transition border-b-2 cursor-pointer ${
            activeSubTab === "history"
              ? "border-[#16a34a] text-[#091426] dark:text-slate-50 font-black"
              : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Historial de Auditorías
        </button>
        <button
          onClick={startNewAudit}
          className={`pb-3 px-6 text-xs font-bold transition border-b-2 cursor-pointer ${
            activeSubTab === "new_audit"
              ? "border-[#16a34a] text-[#091426] dark:text-slate-50 font-black"
              : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Nueva Auditoría
        </button>
      </div>

      {activeSubTab === "history" ? (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header metrics */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">MÓDULO DE AUDITORÍAS</span>
              <h2 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100 mt-1">Bitácora Documental de Auditorías</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Verifica y detalla las conciliaciones realizadas. Cada fila representa un único documento de auditoría.</p>
            </div>
            
            <div className="bg-[#ba1a1a]/10 dark:bg-red-950/20 border-l-4 border-[#ba1a1a] p-4 rounded-xl flex items-center gap-4 text-xs">
              <TrendingDown className="w-8 h-8 text-[#ba1a1a] dark:text-red-400" />
              <div className="text-right">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">COSTO NETO DE DIFERENCIAS (TOTAL)</span>
                <span className="text-lg font-black font-mono text-[#ba1a1a] dark:text-red-400">
                  ${totalNetAdjustmentsLineCost.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                </span>
                <p className="text-[9px] text-[#ba1a1a] dark:text-red-400 font-bold">Alineado dinámicamente con movimientos Kardex</p>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-xs">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Buscar por ID, operador u observaciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-transparent text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Audit History Log Tab */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-[#eff4ff] dark:border-slate-750 text-slate-400 font-bold uppercase tracking-wider text-[9px] select-none">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">ID Auditoría</th>
                    <th className="py-3 px-4">Responsable</th>
                    <th className="py-3 px-4">Observaciones</th>
                    <th className="py-3 px-4 text-right">Ajuste Costo ($)</th>
                    <th className="py-3 px-4 text-right">Ajuste Venta ($)</th>
                    <th className="py-3 px-4 text-center">Ítems Auditados</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center w-[80px]">Ver Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff] dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-300">
                  {sortedFilteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500 font-semibold bg-slate-50/25 dark:bg-slate-800/20">
                        No hay registradas conciliaciones de stock en el sistema. Presione "Nueva Auditoría" para registrar un cuadre de inventario.
                      </td>
                    </tr>
                  ) : (
                    sortedFilteredLogs.map((log) => {
                      const isLoss = (log.adjustmentCost || 0) < 0;
                      const formattedDate = log.date.includes("T") 
                        ? new Date(log.date).toLocaleDateString("es-ES") + " " + new Date(log.date).toLocaleTimeString("es-ES", {hour: "2-digit", minute:"2-digit"})
                        : log.date;
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">{formattedDate}</td>
                          <td className="py-3 px-4"><span className="font-mono font-bold text-slate-900 dark:text-slate-100">#{log.id}</span></td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{getRealResponsible(log.responsible)}</td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-450 truncate max-w-[200px]" title={log.note || ""}>{log.note || "Sin observaciones"}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-mono font-bold ${(log.adjustmentCost || 0) < 0 ? "text-rose-650 dark:text-rose-400" : (log.adjustmentCost || 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                               {(log.adjustmentCost || 0) > 0 ? "+" : ""}${Number(log.adjustmentCost || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-mono font-bold ${(log.adjustmentSales || 0) < 0 ? "text-rose-650 dark:text-rose-400" : (log.adjustmentSales || 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                               {(log.adjustmentSales || 0) > 0 ? "+" : ""}${Number(log.adjustmentSales || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-600 dark:text-slate-400">{log.productCount} ítems</td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900">
                              {log.status || "Completado"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setSelectedAudit(log)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg cursor-pointer transition flex items-center justify-center mx-auto"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-[#eff4ff] dark:border-slate-800 bg-slate-50/25 dark:bg-slate-800/25 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-bold select-none">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Tiempo de Auditoría: Alineación del Kardex automática.
              </span>
              <span>Precisión Global: Toda diferencia genera ajustes vinculados por ID de Auditoría.</span>
            </div>
          </div>

          {/* Audit Detail Modal (Show detailed list of products audited inside standard document audits database) */}
          {selectedAudit && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-250 dark:border-slate-850 shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col pointer-events-auto">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 tracking-wider block">ID: #{selectedAudit.id}</span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-150 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      Detalles de Auditoría Física
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePrintAudit(selectedAudit)}
                      className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer leading-none"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Imprimir
                    </button>
                    <button 
                      onClick={() => setSelectedAudit(null)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Audit general details metadata card */}
                <div className="p-4 bg-slate-50/50 dark:bg-slate-805/30 border-b border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">RESPONSABLE</p>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{getRealResponsible(selectedAudit.responsible)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">FECHA REGISTRO</p>
                      <p className="font-mono text-slate-900 dark:text-slate-100">
                        {selectedAudit.date.includes("T") ? new Date(selectedAudit.date).toLocaleDateString("es-ES") + " " + new Date(selectedAudit.date).toLocaleTimeString("es-ES", {hour: "2-digit", minute:"2-digit"}) : selectedAudit.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">NOTAS / OBSERVACIONES</p>
                      <p className="text-slate-700 dark:text-slate-300 truncate font-bold" title={selectedAudit.note || ""}>
                        {selectedAudit.note || "Ninguna"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Filter/Toggle controls for Historical view */}
                <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-805/40 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Filtro de visualización:</span>
                    <div className="inline-flex rounded-lg p-0.5 bg-slate-200/65 dark:bg-slate-800 border border-slate-300/40 dark:border-slate-700/60">
                      <button
                        type="button"
                        id="btn-modal-filter-all"
                        onClick={() => setShowFilter("all")}
                        className={`py-1 px-3 text-xs font-bold rounded-md transition cursor-pointer select-none ${
                          showFilter === "all"
                            ? "bg-white dark:bg-slate-705 text-slate-900 dark:text-slate-100 shadow-xs"
                            : "text-slate-500 dark:text-slate-450 hover:text-slate-705 dark:hover:text-slate-300"
                        }`}
                      >
                        Mostrar todos
                      </button>
                      <button
                        type="button"
                        id="btn-modal-filter-diff"
                        onClick={() => setShowFilter("diff")}
                        className={`py-1 px-3 text-xs font-bold rounded-md transition cursor-pointer select-none ${
                          showFilter === "diff"
                            ? "bg-white dark:bg-slate-705 text-slate-900 dark:text-slate-100 shadow-xs"
                            : "text-slate-500 dark:text-slate-450 hover:text-slate-705 dark:hover:text-slate-300"
                        }`}
                      >
                        Sólo diferencias
                      </button>
                    </div>
                  </div>
                  
                  {/* Control statistics */}
                  <div className="grid grid-cols-2 md:flex md:flex-row gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-bold">
                    <div>Productos auditados: <strong className="text-slate-800 dark:text-slate-200 font-mono">{(selectedAudit.items || []).length}</strong></div>
                    <div>Productos ajustados: <strong className="text-amber-600 dark:text-amber-450 font-mono">{(selectedAudit.items || []).filter(item => { const diff = item.difference !== undefined ? item.difference : (item.real - item.theoretical); return diff !== 0; }).length}</strong></div>
                    <div>Impacto costo: <strong className={`font-mono ${(selectedAudit.adjustmentCost || 0) < 0 ? "text-[#ba1a1a] dark:text-rose-450" : (selectedAudit.adjustmentCost || 0) > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>{(selectedAudit.adjustmentCost || 0) >= 0 ? "+" : ""}${Number(selectedAudit.adjustmentCost || 0).toFixed(2)}</strong></div>
                    <div>Impacto venta: <strong className={`font-mono ${selectedSalesImpact < 0 ? "text-[#ba1a1a] dark:text-rose-450" : selectedSalesImpact > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>{selectedSalesImpact >= 0 ? "+" : ""}${selectedSalesImpact.toFixed(2)}</strong></div>
                  </div>
                </div>

                {/* Scrolled list table */}
                <div className="p-4 overflow-y-auto flex-1">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px] border-b border-slate-200 dark:border-slate-850">
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 text-center">Teórico</th>
                        <th className="py-2.5 px-3 text-center">Observado Real</th>
                        <th className="py-2.5 px-3 text-center">Diferencia</th>
                        <th className="py-2.5 px-3 text-right">Costo unit.</th>
                        <th className="py-2.5 px-3 text-right">PVP Venta</th>
                        <th className="py-2.5 px-3 text-right">Variación Costo ($)</th>
                        <th className="py-2.5 px-3 text-right">Impacto Venta ($)</th>
                        <th className="py-2.5 px-3">Motivo Ajuste</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-705 dark:text-slate-300">
                      {selectedAudit.items && selectedAudit.items.length > 0 ? (
                        selectedAudit.items
                          .filter((item) => {
                            if (showFilter === "all") return true;
                            const diff = item.difference !== undefined ? item.difference : (item.real - item.theoretical);
                            return diff !== 0;
                          })
                          .map((item, idx) => {
                          const diff = item.difference !== undefined ? item.difference : (item.real - item.theoretical);
                           const isDiffNeg = diff < 0;
                           const isDiffPos = diff > 0;
                           const costImpact = diff * (item.valCosto || 0);
                           const stockItem = stock.find(s => s.id === item.id);
                           const valVenta = item.valVenta !== undefined ? item.valVenta : (stockItem ? stockItem.selling_price : 0);
                           const salesImpact = diff * valVenta;
                           return (
                            <tr key={item.id || idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40">
                              <td className="py-2 px-3 font-mono text-[10px] text-slate-400">{item.sku}</td>
                              <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{item.name}</td>
                              <td className="py-2 px-3 text-center font-mono">{formatQuantityVal(item.theoretical)}</td>
                              <td className="py-2 px-3 text-center font-mono text-indigo-650 dark:text-indigo-400">{formatQuantityVal(item.real)}</td>
                              <td className="py-2 px-3 text-center font-mono">
                                 {diff === 0 ? (
                                   <span className="text-slate-400">---</span>
                                 ) : (
                                   <span className={`font-black ${isDiffNeg ? "text-[#ba1a1a]" : "text-emerald-700"}`}>
                                     {isDiffPos ? "+" : ""}{formatQuantityVal(diff)} Un.
                                   </span>
                                 )}
                               </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-400">${(item.valCosto || 0).toFixed(2)}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-400">${valVenta.toFixed(2)}</td>
                              <td className="py-2 px-3 text-right font-mono">
                                 {costImpact === 0 ? (
                                   <span className="text-slate-400">$0.00</span>
                                 ) : (
                                   <span className={`font-bold ${costImpact < 0 ? "text-[#ba1a1a]" : "text-emerald-700"}`}>
                                    {costImpact > 0 ? "+" : ""}${costImpact.toFixed(2)}
                                   </span>
                                 )}
                               </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-800 dark:text-slate-200">
                                {salesImpact === 0 ? (
                                  <span className="text-slate-400">$0.00</span>
                                ) : (
                                  <span className={`font-bold ${salesImpact < 0 ? "text-[#ba1a1a]" : "text-emerald-700"}`}>
                                    {salesImpact > 0 ? "+" : ""}${salesImpact.toFixed(2)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                 <span className={`inline-block text-[10px] font-semibold ${diff === 0 ? "text-slate-400" : "text-indigo-650 dark:text-indigo-400"}`}>
                                   {item.reason || "Sin ajuste necesario"}
                                 </span>
                               </td>
                             </tr>
                           );
                         })
                       ) : (
                         <tr>
                           <td colSpan={10} className="py-4 text-center text-slate-400">
                             No se guardaron desglose de ítems en esta auditoría.
                           </td>
                         </tr>
                       )}
                     </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-805/50 rounded-b-2xl flex items-center justify-between">
                  <span className="text-xs text-slate-450 dark:text-slate-400 leading-none">Las desviaciones han sido corregidas como tipo "AJUSTE" directamente en el Kardex de movimientos de inventario.</span>
                  <button
                    onClick={() => setSelectedAudit(null)}
                    className="py-1.5 px-4 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-lg cursor-pointer transition select-none"
                  >
                    Entendido / Cerrar
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      ) : (
        /* Nueva sesión de auditoría Spreadsheet draft */
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-md space-y-6 max-w-5xl mx-auto animate-fade-in">
          
          {/* Settings inputs for audit metadata */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-[#eff4ff] dark:border-slate-750 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Auditor / Responsable</label>
              <input
                type="text"
                value={sessionResponsible}
                onChange={(e) => setSessionResponsible(e.target.value)}
                className="w-full py-1.5 px-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Observaciones Generales</label>
              <input
                type="text"
                value={sessionNote}
                onChange={(e) => setSessionNote(e.target.value)}
                className="w-full py-1.5 px-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="border-b pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-[#eff4ff] dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-[#14532d] dark:text-emerald-400 uppercase tracking-widest leading-none">Auditoría de Control Físico</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-display mt-1">Planilla de Conciliación de Almacén</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Modifica las cantidades reales observadas. La diferencia se registrará automáticamente.</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (confirm("¿Descartar borrador actual?")) setActiveSubTab("history");
                }}
                className="py-2 px-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={handleSaveAuditSession}
                className="py-2 px-5 bg-slate-900 hover:bg-slate-850 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer leading-none"
              >
                <Save className="w-4 h-4 text-white dark:text-slate-900" />
                CONCILIAR Y GUARDAR SESIÓN
              </button>
            </div>
          </div>

          {showSessionOk && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border border-emerald-250 dark:border-emerald-950 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              <span>Auditoría procesada y stock actualizado correctamente. Las diferencias han sido contabilizadas a través de movimientos de AJUSTE.</span>
            </div>
          )}

          {/* Visualization filter and control statistics banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-805/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Filtro de visualización:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-slate-200/65 dark:bg-slate-800 border border-slate-300/40 dark:border-slate-700/60">
                <button
                  type="button"
                  id="btn-filter-all"
                  onClick={() => setShowFilter("all")}
                  className={`py-1 px-3 text-xs font-bold rounded-md transition cursor-pointer select-none ${
                    showFilter === "all"
                      ? "bg-white dark:bg-slate-705 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  Mostrar todos
                </button>
                <button
                  type="button"
                  id="btn-filter-diff"
                  onClick={() => setShowFilter("diff")}
                  className={`py-1 px-3 text-xs font-bold rounded-md transition cursor-pointer select-none ${
                    showFilter === "diff"
                      ? "bg-white dark:bg-slate-705 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  Sólo diferencias
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:flex md:flex-row gap-x-6 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold">
              <div>Productos auditados: <strong className="text-slate-800 dark:text-slate-200 font-mono">{draftItems.length}</strong></div>
              <div>Productos ajustados: <strong className="text-amber-600 dark:text-amber-450 font-mono">{draftItems.filter(item => item.difference !== 0).length}</strong></div>
            </div>
          </div>

          {/* Table Spreadsheet layout matching screen 1 */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[9px] select-none">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Producto a Auditorar</th>
                    <th className="py-2.5 px-3 text-center w-[110px]">Inventario Teórico</th>
                    <th className="py-2.5 px-3 text-center w-[110px]">Inventario Real</th>
                    <th className="py-2.5 px-3 text-center w-[100px]">Diferencia</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-400">Val. Costo</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-400">Val. Venta</th>
                    <th className="py-2.5 px-3 w-[150px]">Motivo del Ajuste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff] dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                  {draftItems
                    .filter((item) => showFilter === "all" || item.difference !== 0)
                    .map((item) => {
                      const diff = item.difference;
                      const isDiffNegative = diff < 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                          
                          {/* Code SKU */}
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 font-bold">{item.sku}</span>
                          </td>

                          {/* Name */}
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block truncate max-w-[170px]" title={item.name}>
                              {item.name}
                            </span>
                          </td>

                          {/* Theoretical quantity */}
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono font-bold text-slate-500">{formatQuantityVal(item.theoretical)} Un.</span>
                          </td>

                          {/* Real observed quantity editable */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={formatQuantityVal(item.real)}
                              onChange={(e) => handleDraftRealQtyChange(item.id, Number(e.target.value) || 0)}
                              className="w-full py-1 text-center bg-slate-50 dark:bg-slate-805 border border-slate-200 dark:border-slate-700 text-[#091426] dark:text-slate-100 rounded-md font-mono font-bold focus:border-indigo-500 focus:outline-hidden"
                            />
                          </td>

                          {/* Difference computed live (diferencia = stockReal - stockTeorico) */}
                          <td className="py-2.5 px-3 text-center">
                            {diff === 0 ? (
                              <span className="text-[#a1a1aa] dark:text-slate-600 font-bold">---</span>
                            ) : (
                              <span className={`font-mono font-black ${isDiffNegative ? "text-[#ba1a1a]" : "text-emerald-700 dark:text-emerald-450"}`}>
                                {diff > 0 ? "+" : ""}{formatQuantityVal(diff)} Un.
                              </span>
                            )}
                          </td>

                          {/* Cost Impact */}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            ${item.valCosto.toFixed(2)}
                          </td>

                          {/* Sales value */}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-100 font-bold">
                            ${item.valVenta.toFixed(2)}
                          </td>

                          {/* Reason select dropdown matching screen 2 */}
                          <td className="py-2 px-2">
                            <select
                              disabled={diff === 0}
                              value={item.reason}
                              onChange={(e) => handleDraftReasonChange(item.id, e.target.value)}
                              className="w-full py-1.5 px-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden text-slate-700 dark:text-slate-350 font-medium cursor-pointer"
                            >
                              <option value="Sin Novedad">Sin Novedad</option>
                              <option value="Botella rota tras barra">Botella rota tras barra</option>
                              <option value="Merma de Comanda">Merma de Comanda</option>
                              <option value="Error de Inventario">Error de Inventario</option>
                              <option value="Error de Empaque">Compra Dañada</option>
                              <option value="Consumo de Personal">Consumo de Personal</option>
                            </select>
                          </td>

                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span>Carga de Datos: <strong className="text-indigo-600 dark:text-indigo-400">Planilla en Vivo</strong></span>
              
              <div className="flex gap-4 font-mono">
                <span>Impacto Costo total: <strong className={draftCostImpact < 0 ? "text-[#ba1a1a] dark:text-rose-450" : "text-emerald-700 dark:text-emerald-400"}>${draftCostImpact >= 0 ? "+" : ""}{draftCostImpact.toFixed(2)}</strong></span>
                <span>Impacto PVP total: <strong className={draftSalesImpact < 0 ? "text-[#ba1a1a] dark:text-rose-450" : "text-emerald-700 dark:text-emerald-400"}>${draftSalesImpact >= 0 ? "+" : ""}{draftSalesImpact.toFixed(2)}</strong></span>
              </div>
            </div>

          </div>

          <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/55 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shadow-3xs">
            <AlertTriangle className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="text-slate-600 dark:text-slate-350 leading-relaxed font-semibold">
              <strong>Advertencia de Responsabilidad:</strong> Confirmar esta planilla ingresará movimientos individuales de AJUSTE directamente al Kardex en Firestore por el diferencial de cada artículo auditado. La auditoría en sí se guardará como un único registro documental central.
            </p>
          </div>

        </div>
      )}

    </div>
  );
};

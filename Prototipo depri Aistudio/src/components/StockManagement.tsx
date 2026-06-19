/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  AlertTriangle, 
  Filter, 
  ArrowUpDown, 
  RotateCw, 
  X,
  CheckCircle2,
  PackagePlus,
  TrendingDown
} from "lucide-react";
import { StockItem, BarCategory } from "../types";

interface StockManagementProps {
  stock: StockItem[];
  onAddStockItem: (itemData: Omit<StockItem, "id" | "last_updated">) => Promise<boolean>;
  onEditStockItem: (id: string, itemData: Partial<StockItem>) => Promise<boolean>;
  onDeleteStockItem: (id: string) => Promise<boolean>;
}

export const StockManagement: React.FC<StockManagementProps> = ({
  stock,
  onAddStockItem,
  onEditStockItem,
  onDeleteStockItem
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("TODOS");
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  
  // New Item Form State
  const [newName, setNewName] = useState<string>("");
  const [newCategory, setNewCategory] = useState<BarCategory>(BarCategory.CERVEZAS);
  const [newQuantity, setNewQuantity] = useState<string>("50");
  const [newMinQuantity, setNewMinQuantity] = useState<string>("10");
  const [newPurchasePrice, setNewPurchasePrice] = useState<string>("");
  const [newSellingPrice, setNewSellingPrice] = useState<string>("");

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>("");
  const [editMinQuantity, setEditMinQuantity] = useState<string>("");
  const [editSellingPrice, setEditSellingPrice] = useState<string>("");
  const [editPurchasePrice, setEditPurchasePrice] = useState<string>("");
  
  // Status feedback
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const displayFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Filters stock list
  const filteredStock = useMemo(() => {
    return stock.filter((item) => {
      const isActive = item.is_active !== false;
      const matchCategory = selectedCategory === "TODOS" || item.category === selectedCategory;
      const matchQuery = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return isActive && matchCategory && matchQuery;
    });
  }, [stock, selectedCategory, searchQuery]);

  // Handler: Add stock item
  const handleAddNewItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      displayFeedback("error", "Escribe el nombre del artículo.");
      return;
    }

    setActionLoading(true);
    try {
      const success = await onAddStockItem({
        name: newName.trim(),
        category: newCategory,
        quantity: Number(newQuantity) || 0,
        min_quantity: Number(newMinQuantity) || 0,
        purchase_price: Number(newPurchasePrice) || 0,
        selling_price: Number(newSellingPrice) || 0,
      });

      if (success) {
        displayFeedback("success", `¡"${newName}" registrado en stock exitosamente!`);
        setNewName("");
        setNewQuantity("50");
        setNewMinQuantity("10");
        setNewPurchasePrice("");
        setNewSellingPrice("");
        setShowAddForm(false);
      } else {
        displayFeedback("error", "No se pudo añadir el producto.");
      }
    } catch {
      displayFeedback("error", "Error de conexión.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Save edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setActionLoading(true);
    try {
      const success = await onEditStockItem(editingItem.id, {
        quantity: Number(editQuantity) || 0,
        min_quantity: Number(editMinQuantity) || 0,
        purchase_price: Number(editPurchasePrice) || 0,
        selling_price: Number(editSellingPrice) || 0,
      });

      if (success) {
        displayFeedback("success", "Stock actualizado.");
        setEditingItem(null);
      } else {
        displayFeedback("error", "No se pudo actualizar el producto.");
      }
    } catch {
      displayFeedback("error", "Error inesperado.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Delete Stock Item
  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`¿Estás completamente seguro de eliminar "${name}" del catálogo? Esto borrará el producto de las listas de ventas.`)) {
      return;
    }

    try {
      const success = await onDeleteStockItem(id);
      if (success) {
        displayFeedback("success", "Producto eliminado con éxito.");
      } else {
        displayFeedback("error", "No se pudo eliminar el producto.");
      }
    } catch {
      displayFeedback("error", "Fallo de conexión.");
    }
  };

  return (
    <div className="space-y-6" id="stock_inventory_section">
      
      {/* Upper command row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        
        {/* Search & Category Pickers */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar artículo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 shadow-3xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-white border rounded-xl px-2.5 py-1 text-slate-500 shadow-3xs">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs font-bold leading-tight bg-transparent border-none py-1 focus:outline-hidden pr-6"
            >
              <option value="TODOS">Todas las Categorías</option>
              {Object.values(BarCategory).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Add Product launcher */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? "CERRAR FORMULARIO" : "AÑADIR NUEVO PRODUCTO"}
        </button>

      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-2 text-sm font-semibold shadow-xs ${
          feedback.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-250" 
            : "bg-rose-50 text-rose-800 border-rose-250 animate-shake"
        }`}>
          <CheckCircle2 className="w-4 h-4" />
          {feedback.text}
        </div>
      )}

      {/* Slide down form panel to Add Products */}
      {showAddForm && (
        <form onSubmit={handleAddNewItemSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-md space-y-4 animate-slide-down">
          <div className="flex items-center gap-2 text-indigo-900 border-b pb-2 mb-2">
            <PackagePlus className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-sm tracking-wide uppercase">Dar de Alta Producto en Catálogo</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase">Nombre Comercial del Producto :</label>
              <input
                type="text"
                placeholder="Ej: Fanta Limón 33cl (Lata)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase">Categoría :</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as BarCategory)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:indigo-500"
              >
                {Object.values(BarCategory).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase">Stock Inicial :</label>
              <input
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
              />
            </div>

            {/* Min Alarm quantity */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
                Stock Mínimo Alerta : <span className="text-[10px] text-slate-400 capitalize">(Límite rápido)</span>
              </label>
              <input
                type="number"
                min="0"
                value={newMinQuantity}
                onChange={(e) => setNewMinQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
              />
            </div>

            {/* Purchase Price */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase">Precio Unitario Coste COSTE ($) :</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newPurchasePrice}
                onChange={(e) => setNewPurchasePrice(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden animate-gently"
              />
            </div>

            {/* Selling Price */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase">Precio Unitario de Venta P.V.P ($) :</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newSellingPrice}
                onChange={(e) => setNewSellingPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
              />
            </div>

          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={actionLoading}
              className="py-2.5 px-6 bg-slate-900 text-white font-bold text-xs rounded-lg transition"
            >
              {actionLoading ? "GUARDANDO..." : "COMPLETAR ALTA DE PRODUCTO"}
            </button>
          </div>
        </form>
      )}

      {/* Main Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="stock_items_list">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 font-bold">Concepto Articulo</th>
                <th className="py-3.5 px-4 font-bold">Categoría</th>
                <th className="py-3.5 px-4 font-bold text-center">Unidades Stock</th>
                <th className="py-3.5 px-4 font-bold text-center">Mínimo Alerta</th>
                <th className="py-3.5 px-4 font-bold text-right">Coste Unitario</th>
                <th className="py-3.5 px-4 font-bold text-right">Precio Venta (PVP)</th>
                <th className="py-3.5 px-4 font-bold text-right">Margen Neto Unitario</th>
                <th className="py-3.5 px-4 font-bold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-500 text-sm">
                    No hay productos en esta selección. Prueba a quitar los filtros de búsqueda o categoría.
                  </td>
                </tr>
              ) : (
                filteredStock.map((item) => {
                  const isOut = item.quantity <= 0;
                  const isLow = item.quantity <= item.min_quantity && !isOut;
                  const netMargin = item.selling_price - item.purchase_price;
                  const marginPercent = item.selling_price > 0 ? (netMargin / item.selling_price) * 100 : 0;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/50 transition duration-150 group ${
                        isOut ? "bg-red-50/10 text-rose-800" : isLow ? "bg-amber-50/10 text-amber-800" : "text-slate-900"
                      }`}
                      id={`row_${item.id}`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 flex flex-col justify-start">
                        <span>{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal font-mono">ID: {item.id}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-slate-100 text-slate-650 border border-slate-200">
                          {item.category}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`text-sm font-black ${
                            isOut ? "text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md" : isLow ? "text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md" : "text-slate-900"
                          }`}>
                            {item.quantity} ud
                          </span>
                          
                          {isOut ? (
                            <span className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-100 px-1 py-0.5 rounded-sm flex items-center gap-0.5 leading-none">
                              <AlertTriangle className="w-2.5 h-2.5 animate-pulse" /> Sin Stock
                            </span>
                          ) : isLow ? (
                            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-100 px-1 py-0.5 rounded-sm flex items-center gap-0.5 leading-none animate-pulse">
                              <AlertTriangle className="w-2.5 h-2.5" /> Stock Bajo
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center text-slate-500 font-mono text-xs font-bold">
                        {item.min_quantity} ud
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-slate-550">
                        ${item.purchase_price.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-sm font-black text-slate-900">
                        ${item.selling_price.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-xs">
                        <div className="flex flex-col items-end">
                          <span className="text-emerald-700 font-bold">+${netMargin.toFixed(2)}</span>
                          <span className="text-[9px] text-emerald-500 font-bold">({marginPercent.toFixed(0)}%)</span>
                        </div>
                      </td>

                      {/* Operations */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setEditQuantity(String(item.quantity));
                              setEditMinQuantity(String(item.min_quantity));
                              setEditPurchasePrice(String(item.purchase_price));
                              setEditSellingPrice(String(item.selling_price));
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition border border-transparent hover:border-slate-200 cursor-pointer"
                            title="Editar stock o precios"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-100 cursor-pointer"
                            title="Borrar artículo"
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
      </div>

      {/* Editing Dialog Modal Box */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <form 
            onSubmit={handleSaveEdit} 
            className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-scale-up"
          >
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <h3 className="font-extrabold text-sm text-slate-900 uppercase">Modificar: {editingItem.name}</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-705 p-1 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              
              {/* Qty edit */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700">CANTIDAD EN STOCK ACTUAL :</label>
                <input
                  type="number"
                  min="0"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                />
              </div>

              {/* Min alert level */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-700">MÍNIMO ALARMA DE STOCK :</label>
                <input
                  type="number"
                  min="0"
                  value={editMinQuantity}
                  onChange={(e) => setEditMinQuantity(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                />
              </div>

              {/* Purchase edit */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700">COST UNITARIO ($) :</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPurchasePrice}
                    onChange={(e) => setEditPurchasePrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700">PVP DE VENTA ($) :</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editSellingPrice}
                    onChange={(e) => setEditSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                  />
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="py-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-xs"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

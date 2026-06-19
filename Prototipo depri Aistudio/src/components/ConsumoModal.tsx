import React, { useState } from "react";
import { StockItem } from "../types";
import { X, Search } from "lucide-react";

interface ConsumoModalProps {
  stock: StockItem[];
  onClose: () => void;
  onConfirm: (itemId: string, qty: number, maxQty: number, notes: string) => Promise<boolean>;
}

export const ConsumoModal: React.FC<ConsumoModalProps> = ({ stock, onClose, onConfirm }) => {
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [qty, setQty] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeStock = stock.filter(item => !item.is_recipe && item.quantity > 0);
  const filteredStock = activeStock.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedItem = activeStock.find(i => i.id === selectedItemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !qty || Number(qty) <= 0 || Number(qty) > selectedItem.quantity) return;
    
    setIsSubmitting(true);
    const success = await onConfirm(selectedItem.id, Number(qty), selectedItem.quantity, notes);
    setIsSubmitting(false);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#091426]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-205 shadow-xl max-w-md w-full overflow-hidden animate-scale-up">
        <div className="p-5 border-b border-[#eff4ff] flex items-center justify-between bg-slate-50">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            Registro de Consumo Interno
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
            
          <div className="space-y-2 relative">
             <label className="text-[10px] font-bold text-slate-500 uppercase block">Buscar Artículo a dar de baja:</label>
             <div className="relative">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por SKU o Nombre..."
                    autoFocus
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
             </div>
             
             {search && !selectedItemId && (
                 <div className="absolute top-14 left-0 right-0 bg-white border border-slate-200 shadow-xl rounded-xl z-10 max-h-48 overflow-y-auto">
                     {filteredStock.map(item => (
                         <div 
                           key={item.id} 
                           className="px-3 py-2 hover:bg-indigo-50 border-b border-slate-50 cursor-pointer text-xs"
                           onClick={() => { setSelectedItemId(item.id); setSearch(""); }}
                         >
                            <span className="font-bold text-slate-800">{item.name}</span>
                            <span className="block text-[10px] text-slate-500 font-mono mt-0.5">Stock disponible: {item.quantity}u.</span>
                         </div>
                     ))}
                     {filteredStock.length === 0 && (
                         <div className="px-3 py-4 text-center text-xs text-slate-400 italic">No se encontraron artículos con stock positivo.</div>
                     )}
                 </div>
             )}
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col items-center justify-center min-h-[60px]">
             {selectedItem ? (
                 <div className="text-center w-full relative">
                    <p className="text-xs font-bold text-indigo-700">{selectedItem.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Stock actual: {selectedItem.quantity} unidades</p>
                    <button type="button" onClick={() => setSelectedItemId("")} className="absolute right-0 top-0 p-1 text-slate-400 hover:text-rose-500 cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                    </button>
                 </div>
             ) : (
                 <p className="text-xs text-slate-400 italic">No ha seleccionado ningún artículo.</p>
             )}
          </div>

          {selectedItem && (
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase block">Cantidad:</label>
                   <input
                     type="number"
                     min="1"
                     max={selectedItem.quantity}
                     step="0.01"
                     value={qty}
                     onChange={(e) => setQty(e.target.value as any)}
                     className="w-full px-3 py-2 border border-slate-200 rounded-xl text-center font-mono font-black text-slate-700 focus:outline-hidden focus:border-indigo-400"
                     required
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase block">Notas / Motivo:</label>
                   <input
                     type="text"
                     placeholder="Ej: Consumo de personal, Mermas..."
                     value={notes}
                     onChange={(e) => setNotes(e.target.value)}
                     className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden focus:border-indigo-400"
                   />
                </div>
             </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="py-2.5 px-4 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedItem || !qty || Number(qty) <= 0 || Number(qty) > selectedItem!.quantity}
              className="py-2.5 px-6 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Registrando..." : "Registrar Baja"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

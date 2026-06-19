/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Beer, 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Sparkles, 
  MapPin, 
  CreditCard,
  UtensilsCrossed 
} from "lucide-react";
import { StockItem, BarCategory, SaleItem } from "../types";

interface POSProps {
  stock: StockItem[];
  onAddSale: (saleData: {
    items: SaleItem[];
    method: "efectivo" | "tarjeta" | "bizum";
    origin: "terminal" | "mesa" | "ticket_ai";
    table_number: string;
    notes?: string;
  }) => Promise<boolean>;
}

export const POS: React.FC<POSProps> = ({ stock, onAddSale }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("TODOS");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  
  // Sale details state
  const [tableNumber, setTableNumber] = useState<string>("Barra");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "tarjeta" | "bizum">("efectivo");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // List of tables for fast picker
  const quickTables = ["Barra", "Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Terraza A", "Terraza B"];

  // Filter products by category and query
  const filteredProducts = useMemo(() => {
    return stock.filter((item) => {
      const matchCategory = selectedCategory === "TODOS" || item.category === selectedCategory;
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [stock, selectedCategory, searchQuery]);

  // Helper to calculate stock, either direct quantity or virtual stock of recipe
  const getAvailableStock = (item: StockItem): number => {
    if (item.is_recipe && item.components && item.components.length > 0) {
      let minStock = Infinity;
      for (const comp of item.components) {
        const baseItem = stock.find(bi => bi.id === comp.stock_item_id);
        if (!baseItem) return 0;
        const possibleProducts = baseItem.quantity / comp.quantity;
        if (possibleProducts < minStock) {
          minStock = possibleProducts;
        }
      }
      return minStock === Infinity ? 0 : Number(minStock.toFixed(2));
    }
    return item.quantity;
  };

  // Cart operations
  const addToCart = (product: StockItem) => {
    const currentQty = cart[product.id] || 0;
    const available = getAvailableStock(product);
    if (available <= currentQty) {
      triggerAlert("error", `No hay suficiente stock de "${product.name}" (${available} disponibles).`);
      return;
    }
    setCart((prev) => ({
      ...prev,
      [product.id]: currentQty + 1,
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const copy = { ...prev };
      if (copy[productId] <= 1) {
        delete copy[productId];
      } else {
        copy[productId] -= 1;
      }
      return copy;
    });
  };

  const clearItemFromCart = (productId: string) => {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  const clearCart = () => {
    setCart({});
  };

  const triggerAlert = (type: "success" | "error", text: string) => {
    setAlertMessage({ type, text });
    setTimeout(() => {
      setAlertMessage(null);
    }, 4000);
  };

  // Convert cart object structure to SaleItem list
  const cartItems = useMemo(() => {
    return Object.entries(cart).map(([id, quantity]) => {
      const qty = Number(quantity);
      const product = stock.find((item) => item.id === id);
      const price = product?.selling_price || 0;
      return {
        stock_item_id: id,
        name: product?.name || "Producto Desconocido",
        quantity: qty,
        price,
        total: Number((qty * price).toFixed(2)),
      };
    });
  }, [cart, stock]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.total, 0);
  }, [cartItems]);

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      triggerAlert("error", "Añade productos al tique para cobrar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onAddSale({
        items: cartItems,
        method: paymentMethod,
        origin: tableNumber.startsWith("Mesa") || tableNumber.startsWith("Terraza") ? "mesa" : "terminal",
        table_number: tableNumber,
        notes,
      });

      if (success) {
        triggerAlert("success", "¡Venta registrada con éxito y stock actualizado!");
        clearCart();
        setNotes("");
      } else {
        triggerAlert("error", "Error del servidor al guardar la venta.");
      }
    } catch (err: any) {
      triggerAlert("error", err.message || "Error inesperado al registrar la venta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]" id="pos_section">
      
      {/* 1. Left Catalog view (Cols = 7 or 8) */}
      <div className="lg:col-span-7 flex flex-col space-y-4">
        
        {/* Search and Categories bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, cerveza, comida, copas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:bg-white transition"
            />
          </div>

          {/* Categories Horizontal scroll list */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
            <button
              onClick={() => setSelectedCategory("TODOS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === "TODOS"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-50 hover:bg-slate-150 text-slate-650 border border-slate-100"
              }`}
            >
              Todos
            </button>
            {Object.values(BarCategory).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-50 hover:bg-slate-150 text-slate-650 border border-slate-150"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[500px] pr-1 pb-4">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 bg-white border rounded-xl text-center space-y-2 text-slate-500">
              <Beer className="w-8 h-8 text-slate-300 mx-auto animate-pulse" />
              <p className="text-sm font-semibold">Ningún artículo coincide con tu búsqueda.</p>
              <p className="text-xs">Crea el producto en la pestaña Inventario si aún no existe.</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const inCartQty = cart[product.id] || 0;
              const available = getAvailableStock(product);
              const isOut = available <= 0;
              const isLow = !product.is_recipe && product.quantity <= product.min_quantity && !isOut;

              return (
                <button
                  key={product.id}
                  onClick={() => !isOut && addToCart(product)}
                  disabled={isOut}
                  className={`relative p-3 bg-white text-left rounded-xl border border-slate-100 shadow-3xs transition hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 flex flex-col justify-between h-[120px] group overflow-hidden ${
                    isOut ? "opacity-55 cursor-not-allowed bg-slate-50/50" : "cursor-pointer"
                  }`}
                  id={`pos_prod_${product.id}`}
                >
                  <div className="space-y-1 w-full z-10">
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                        {product.category}
                      </span>
                      {available > 0 && (
                        <span className={`text-[9px] font-bold py-0.5 px-1.5 rounded-md leading-none ${
                          isLow 
                            ? "bg-rose-50 text-rose-700 font-bold border border-rose-100" 
                            : "bg-slate-50 text-slate-600 border border-slate-100"
                        }`}>
                          {product.is_recipe ? `Virt: ${available}` : `St: ${available}`}
                        </span>
                      )}
                    </div>
                    
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition leading-tight line-clamp-2 pr-1">
                      {product.name}
                    </h4>
                  </div>

                  <div className="flex items-end justify-between w-full mt-2 z-10">
                    <span className="text-sm font-black text-slate-900 tracking-tight">
                      ${product.selling_price.toFixed(2)}
                    </span>

                    {/* Active cart count helper indicator */}
                    {inCartQty > 0 ? (
                      <span className="h-5 w-5 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                        {inCartQty}
                      </span>
                    ) : (
                      <span className="p-1 rounded-md bg-slate-50 border border-slate-100 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition">
                        <Plus className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  {/* Out of Stock Overlay / Alert banner */}
                  {isOut && (
                    <div className="absolute inset-x-0 bottom-0 py-1 bg-red-650 text-white text-[10px] font-black text-center tracking-wider uppercase z-20 shadow-sm">
                      AGOTADO
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Right Cart and Sale summary Panel (Cols = 5) */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-slate-100 shadow-md flex flex-col justify-between max-h-[620px] overflow-hidden" id="pos_cart_panel">
        
        {/* Ticket Header */}
        <div className="p-4 border-b border-rose-50 bg-rose-50/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 tracking-tight">Tique Ticket Actual</h3>
          </div>
          <button
            onClick={clearCart}
            disabled={cartItems.length === 0}
            className="text-xs font-semibold text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 px-2 py-1 rounded-md transition cursor-pointer"
          >
            Limpiar tique
          </button>
        </div>

        {/* Ticket Items scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/20">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-12 text-slate-500">
              <UtensilsCrossed className="w-10 h-10 text-slate-350 animate-bounce" />
              <p className="text-sm font-semibold">Tique de bar vacío.</p>
              <p className="text-xs text-slate-400">Pulsa sobre los artículos del catálogo de la izquierda para construir la comanda.</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div 
                key={item.stock_item_id} 
                className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between"
                id={`cart_item_${item.stock_item_id}`}
              >
                <div className="space-y-1 pr-2 flex-1">
                  <p className="text-xs font-bold text-slate-900 leading-tight">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium font-mono">
                    ${item.price.toFixed(2)} x {item.quantity} = ${item.total.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-100 rounded-lg p-0.5 bg-slate-50/50">
                    <button
                      onClick={() => removeFromCart(item.stock_item_id)}
                      className="p-1 hover:bg-white text-slate-600 rounded-md transition cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 text-xs font-bold font-mono text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => {
                        const prod = stock.find((x) => x.id === item.stock_item_id);
                        if (prod) addToCart(prod);
                      }}
                      className="p-1 hover:bg-white text-slate-600 rounded-md transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => clearItemFromCart(item.stock_item_id)}
                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition border border-transparent hover:border-rose-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Ticket controls, table selector, payment mode */}
        <div className="p-4 border-t border-slate-100 bg-white space-y-4 shadow-xl">
          
          {/* Quick status Messages */}
          {alertMessage && (
            <div className={`p-2.5 rounded-lg text-xs font-semibold border ${
              alertMessage.type === "success" 
                ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                : "bg-rose-50 text-rose-800 border-rose-100 animate-shake"
            }`}>
              {alertMessage.text}
            </div>
          )}

          {/* Table location picker */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-500" /> UBICACIÓN / DESTINO:
            </span>
            <div className="flex gap-1 overflow-x-auto pb-1 max-w-full">
              {quickTables.map((tbl) => (
                <button
                  key={tbl}
                  type="button"
                  onClick={() => setTableNumber(tbl)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md whitespace-nowrap border cursor-pointer transition ${
                    tableNumber === tbl
                      ? "bg-indigo-600 font-extrabold text-white border-indigo-600"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {tbl}
                </button>
              ))}
            </div>
            
            {/* Custom inputs */}
            <input
              type="text"
              placeholder="Introduce mesa personalizada (Ej: Mesa 12)"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Payment Method Selector */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "efectivo", label: "Efectivo", icon: "💵" },
              { id: "tarjeta", label: "Tarjeta", icon: "💳" },
              { id: "bizum", label: "Bizum", icon: "📱" },
            ].map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethod(method.id as any)}
                className={`py-2 px-1 text-xs font-bold rounded-lg border flex flex-col items-center gap-1 transition cursor-pointer ${
                  paymentMethod === method.id
                    ? "bg-slate-900 border-slate-900 text-white shadow-xs scale-102"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                <span className="text-base leading-none">{method.icon}</span>
                {method.label}
              </button>
            ))}
          </div>

          {/* Observations and notes input */}
          <input
            type="text"
            placeholder="Observaciones de barra o intolerancias..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:border-indigo-500 placeholder-slate-400"
          />

          {/* Total & Charge action */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-600">Total a cobrar:</span>
              <span className="text-2xl font-black text-slate-950 tracking-tight">
                ${cartTotal.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting || cartItems.length === 0}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm tracking-wide rounded-xl shadow-md transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-200 animate-pulse" />
              {isSubmitting ? "REGISTRANDO VENTA..." : "REGISTRAR Y COBRAR VENTAS"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

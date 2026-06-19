import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Layers, 
  DollarSign, 
  Package, 
  Percent, 
  AlertTriangle, 
  BookOpen, 
  X,
  PlusCircle,
  HelpCircle,
  Check
} from "lucide-react";
import { StockItem, BarCategory, RecipeComponent } from "../types";
import { CustomDropdown } from "./CustomDropdown";
import { CategorySelect } from "./InventoryTab";

interface RecipesTabProps {
  stock: StockItem[];
  onAddStockItem: (item: Omit<StockItem, "id" | "last_updated">) => Promise<boolean>;
  onEditStockItem: (id: string, updatedFields: Partial<StockItem>) => Promise<boolean>;
  onDeleteStockItem: (id: string) => Promise<boolean>;
  categories: string[];
  onAddCategory: () => void;
  onEditCategory: (cat: string) => void;
  onDeleteCategory: (cat: string) => void;
}

export const RecipesTab: React.FC<RecipesTabProps> = ({
  stock,
  onAddStockItem,
  onEditStockItem,
  onDeleteStockItem,
  categories,
  onAddCategory,
  onEditCategory,
  onDeleteCategory
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<StockItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<StockItem | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formSubgroup, setFormSubgroup] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formSellingPrice, setFormSellingPrice] = useState("");
  const [formComponents, setFormComponents] = useState<RecipeComponent[]>([]);
  const [formImageUrl, setFormImageUrl] = useState("");

  // Temp selected component to add inside form
  const [tempCompId, setTempCompId] = useState("");
  const [tempCompQty, setTempCompQty] = useState("1");

  // Load unique categories for recipes
  const categoriesList = categories;

  // Filter simple items for selection as components (no recipes to avoid loop)
  const availableBaseIngredients = stock.filter(item => !item.is_recipe && item.is_active !== false);

  // Filter recipes from stock list
  const recipes = stock.filter(item => item.is_recipe === true);

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(search.toLowerCase()) || 
      (recipe.sku && recipe.sku.toLowerCase().includes(search.toLowerCase())) ||
      (recipe.subgroup && recipe.subgroup.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = selectedCategory === "ALL" || recipe.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Helper to get unit cost (purchase_price is now normalized to unit value at purchase time)
  const getUnitCost = (item: StockItem): number => {
    return item.purchase_price;
  };

  // Calculate live automatic recipe cost based on active stock costs
  const calculateRecipeCost = (componentsList: RecipeComponent[]): number => {
    return componentsList.reduce((sum, comp) => {
      const ingredientDoc = stock.find(item => item.id === comp.stock_item_id);
      if (!ingredientDoc) return sum;
      return sum + (getUnitCost(ingredientDoc) * comp.quantity);
    }, 0);
  };

  // Helper to get product info for display
  const getIngredientInfo = (id: string) => {
    return stock.find(item => item.id === id);
  };

  // Set up states when opening modals
  const openNewRecipe = () => {
    setFormName("");
    setFormSubgroup("");
    setFormCategory(categories[0] || "General");
    setFormSku("REC-" + Math.floor(100000 + Math.random() * 90000));
    setFormSellingPrice("");
    setFormComponents([]);
    setFormImageUrl("");
    setTempCompId("");
    setTempCompQty("1");
    setShowAddModal(true);
  };

  const openEditRecipe = (recipe: StockItem) => {
    setFormName(recipe.name);
    setFormSubgroup(recipe.subgroup || "");
    setFormCategory(recipe.category || categories[0] || "General");
    setFormSku(recipe.sku || "REC-" + Math.floor(100000 + Math.random() * 90000));
    setFormSellingPrice(String(recipe.selling_price));
    setFormComponents(recipe.components || []);
    setFormImageUrl(recipe.image_url || "");
    setTempCompId("");
    setTempCompQty("1");
    setShowEditModal(recipe);
  };

  // Add component to current recipe form
  const handleAddComponent = () => {
    if (!tempCompId) return;
    const qty = parseFloat(tempCompQty);
    if (isNaN(qty) || qty <= 0) {
      alert("Por favor ingresa una cantidad válida y mayor a cero.");
      return;
    }

    // Check if ingredient already in list
    const existsIndex = formComponents.findIndex(c => c.stock_item_id === tempCompId);
    if (existsIndex >= 0) {
      const updated = [...formComponents];
      updated[existsIndex].quantity = Number((updated[existsIndex].quantity + qty).toFixed(2));
      setFormComponents(updated);
    } else {
      setFormComponents([...formComponents, { 
        stock_item_id: tempCompId, 
        quantity: qty
      }]);
    }
    
    setTempCompId("");
    setTempCompQty("1");
  };

  const handleRemoveComponent = (idx: number) => {
    setFormComponents(formComponents.filter((_, i) => i !== idx));
  };

  // Handle saving new recipe
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("Introduce un nombre para la receta.");
      return;
    }
    if (formComponents.length === 0) {
      alert("Debes agregar al menos un componente/ingrediente a la composición.");
      return;
    }

    const calculatedCost = calculateRecipeCost(formComponents);

    const success = await onAddStockItem({
      name: formName.trim(),
      category: formCategory,
      quantity: 0, // Recipes do not have static physical stock, they depend on ingredients
      min_quantity: 0,
      purchase_price: Number(calculatedCost.toFixed(2)),
      selling_price: Number(parseFloat(formSellingPrice) || 0),
      image_url: formImageUrl.trim(),
      sku: formSku.trim(),
      subgroup: formSubgroup.trim(),
      is_active: true,
      is_recipe: true,
      components: formComponents
    });

    if (success) {
      setShowAddModal(false);
    } else {
      alert("Error al intentar guardar la receta.");
    }
  };

  // Handle saving edit recipe
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    if (!formName.trim()) {
      alert("Introduce un nombre para la receta.");
      return;
    }
    if (formComponents.length === 0) {
      alert("Debes agregar al menos un componente/ingrediente a la composición.");
      return;
    }

    const calculatedCost = calculateRecipeCost(formComponents);

    const success = await onEditStockItem(showEditModal.id, {
      name: formName.trim(),
      category: formCategory,
      purchase_price: Number(calculatedCost.toFixed(2)),
      selling_price: Number(parseFloat(formSellingPrice) || 0),
      image_url: formImageUrl.trim(),
      sku: formSku.trim(),
      subgroup: formSubgroup.trim(),
      components: formComponents
    });

    if (success) {
      setShowEditModal(null);
    } else {
      alert("Error al intentar editar la receta.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmItem) return;
    const success = await onDeleteStockItem(deleteConfirmItem.id);
    if (success) {
      setDeleteConfirmItem(null);
    } else {
      alert("Error al intentar eliminar el artículo.");
    }
  };

  // Live calculated metrics
  const liveCost = calculateRecipeCost(formComponents);
  const livePrice = parseFloat(formSellingPrice) || 0;
  const liveMargin = livePrice > 0 ? ((livePrice - liveCost) / livePrice) * 100 : 0;

  // Render Virtual Stock for recipe (maximum units that can currently be produced/sold based on active ingredients stock)
  const calculateVirtualStock = (recipeItem: StockItem): number => {
    if (!recipeItem.components || recipeItem.components.length === 0) return 0;
    
    let minStock = Infinity;
    for (const comp of recipeItem.components) {
      const baseItem = stock.find(item => item.id === comp.stock_item_id);
      if (!baseItem) return 0;
      const possibleProducts = baseItem.quantity / comp.quantity;
      if (possibleProducts < minStock) {
        minStock = possibleProducts;
      }
    }
    return minStock === Infinity ? 0 : Number(minStock.toFixed(2));
  };

  return (
    <div className="space-y-6 select-none animate-fade-in" id="recipes_panel">
      
      {/* HEADER SECTION */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-[#eff4ff] dark:border-slate-800 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-500" />
            Recetas / Productos Compuestos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Crea combos, tragos con medidas fraccionadas o platos compuestos. El stock de ingredientes se descontará de forma proporcional y automática en las ventas.
          </p>
        </div>
        <button
          onClick={openNewRecipe}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition border border-emerald-500 hover:border-emerald-600 leading-none"
        >
          <Plus className="w-4 h-4 text-white" />
          NUEVA RECETA / COMBO
        </button>
      </div>

      {/* FILTER SHELF */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-3xs">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar recetas por nombre, SKU, copa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-205 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-xs focus:outline-hidden text-slate-800 dark:text-slate-200"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
        </div>

        <div className="w-full sm:w-56">
          <CustomDropdown
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val)}
            options={[
              { id: "ALL", label: "Todas las categorías" },
              ...categoriesList.map(cat => ({ id: cat, label: cat }))
            ]}
          />
        </div>
      </div>

      {/* RECIPES GRAPHIC Bento Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 text-center py-20 px-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-3xs flex flex-col items-center justify-center gap-4">
          <Layers className="w-12 h-12 text-slate-300 dark:text-slate-750" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-400">No se encontraron recetas ni combos</h3>
          <p className="text-xs text-slate-400 max-w-md">
            Usa el botón superior para crear una receta especificando ingredientes simples y sus consumos decimales de stock.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecipes.map((recipe) => {
            const recipeCost = calculateRecipeCost(recipe.components || []);
            const recipePrice = recipe.selling_price;
            const recipeMargin = recipePrice > 0 ? ((recipePrice - recipeCost) / recipePrice) * 100 : 0;
            const virtualStock = calculateVirtualStock(recipe);

            return (
              <div 
                key={recipe.id} 
                className="bg-white dark:bg-slate-900 border border-slate-105 dark:border-slate-800/80 rounded-2xl p-5 shadow-3xs hover:shadow-2xs transition duration-200 flex flex-col justify-between gap-4"
              >
                {/* Header */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-extrabold uppercase px-2 py-0.5 rounded-sm">
                      {recipe.category}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {recipe.sku}
                    </span>
                  </div>
                  
                  <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {recipe.name}
                  </h3>
                  
                  {recipe.subgroup && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                      {recipe.subgroup}
                    </p>
                  )}
                </div>

                {/* Composition Ingredient List Area */}
                <div className="bg-slate-50/50 dark:bg-slate-800/45 p-3 rounded-xl border border-slate-100/70 dark:border-slate-800 space-y-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Composición (Receta)</span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {recipe.components?.map((comp, idx) => {
                      const ing = getIngredientInfo(comp.stock_item_id);
                      const unitCost = ing ? getUnitCost(ing) : 0;
                      const portionCost = unitCost * comp.quantity;
                      return (
                        <div key={idx} className="flex flex-col border-b border-slate-100/50 dark:border-slate-800/50 pb-1 last:border-0">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-600 dark:text-slate-300 font-bold truncate max-w-[65%]">
                              {ing ? ing.name : "Artículo Desconocido"}
                            </span>
                            <span className="text-slate-400 font-mono font-bold">
                              x{comp.quantity.toFixed(2)} {ing?.subgroup || "un"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-400">
                            <span>Cost Unit: ${unitCost.toFixed(2)}</span>
                            <span className="text-indigo-500 font-bold">Subtotal: ${portionCost.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total Cost Highlight */}
                <div className="px-3 py-2 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30 flex justify-between items-center">
                  <span className="text-[9px] font-black text-indigo-400 uppercase">Costo Total Receta</span>
                  <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">${recipeCost.toFixed(2)}</span>
                </div>

                {/* Stock available & Pricing metrics */}
                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  {/* Virtual Stock display */}
                  <div className="bg-[#eff6ff] dark:bg-indigo-950/20 border border-blue-150/45 dark:border-indigo-900 p-2.5 rounded-xl text-center space-y-0.5">
                    <span className="text-[10px] text-blue-650 dark:text-blue-400 font-extrabold uppercase block tracking-wider">Stock Virtual</span>
                    <strong className="text-base text-blue-800 dark:text-blue-300 font-black font-mono">
                      {virtualStock}
                    </strong>
                    <span className="text-[8.5px] text-blue-500 block leading-tight">unidades vendibles</span>
                  </div>

                  {/* Margins display */}
                  <div className={`p-2.5 rounded-xl text-center space-y-0.5 border ${
                    recipeMargin >= 50 
                      ? "bg-emerald-50 dark:bg-emerald-950/25 border-emerald-150 text-emerald-800 dark:text-emerald-300"
                      : "bg-amber-50 dark:bg-amber-950/25 border-amber-150 text-amber-800 dark:text-amber-300"
                  }`}>
                    <span className="text-[10px] font-extrabold uppercase block tracking-wider">Margen</span>
                    <strong className="text-base font-black font-mono flex items-center justify-center">
                      {recipeMargin.toFixed(0)}%
                    </strong>
                    <span className="text-[8.5px] block leading-tight">rentabilidad</span>
                  </div>
                </div>

                {/* Financial overview row */}
                <div className="flex justify-between text-xs font-mono font-bold border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Costo Sugerido</span>
                    <span className="text-slate-550 dark:text-slate-300">${recipeCost.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider mb-0.5">Venta al Público</span>
                    <span className="text-emerald-600 font-black">${recipePrice.toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions shelf */}
                <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <button
                    onClick={() => openEditRecipe(recipe)}
                    className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 hover:text-slate-800 dark:hover:text-white border border-slate-205 dark:border-slate-700 rounded-lg text-[11px] font-black cursor-pointer transition flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar Receta
                  </button>
                  <button
                    onClick={() => setDeleteConfirmItem(recipe)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-150 rounded-lg cursor-pointer transition flex items-center justify-center"
                    title="Eliminar receta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD RECIPE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-205 dark:border-slate-800 max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="border-b border-[#eff4ff] dark:border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/10">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <PlusCircle className="w-4.5 h-4.5 text-emerald-500" />
                Crear Receta / Producto Compuesto
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-slate-500 font-extrabold uppercase mb-1 text-[11px] tracking-wide">Nombre del Combo / Receta *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej: Fernet con Coca Vaso Grande o Combo Fernet Familiar"
                    className="w-full p-2 border border-slate-205 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl focus:outline-hidden text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1 text-[11px]">Categoría *</label>
                  <CategorySelect
                    value={formCategory}
                    onChange={(val) => setFormCategory(val)}
                    categories={categories}
                    onAdd={onAddCategory}
                    onEdit={onEditCategory}
                    onDelete={onDeleteCategory}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1 text-[11px]">Código SKU (Auto-borrador)</label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full p-2 border border-slate-205 dark:border-slate-750 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs rounded-xl focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1 text-[11px]">Subtexto / Variante (Copa, Vaso, etc.)</label>
                  <input
                    type="text"
                    value={formSubgroup}
                    onChange={(e) => setFormSubgroup(e.target.value)}
                    placeholder="Ej: Medida Copa, Pinta, Botella"
                    className="w-full p-2 border border-slate-205 dark:border-slate-755 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-xl focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-550 dark:text-slate-450 font-black uppercase mb-1 text-[11px] text-emerald-600 dark:text-emerald-500">Precio Venta al Público ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    placeholder="Ej: 35.00"
                    className="w-full p-2 border border-slate-205 dark:border-slate-700 dark:bg-slate-800 text-slate-850 dark:text-slate-200 font-mono text-xs rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* INGREDIENT ADDITION PANEL */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <h4 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">Añadir Ingredientes de Stock</h4>
                
                <div className="flex flex-col sm:flex-row gap-2.5 items-end bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                  <div className="flex-1 w-full">
                    <label className="block text-[9px] text-slate-400 font-bold uppercase mb-0.5">Seleccionar Ingrediente Base</label>
                    <CustomDropdown
                      value={tempCompId}
                      onChange={(val) => setTempCompId(val)}
                      placeholder="Elegir producto de inventario..."
                      options={availableBaseIngredients.map(item => {
                        const uCost = getUnitCost(item);
                        const pCost = item.purchase_price;
                        const hasPack = (Number(item.presentationUnits) || 1) > 1;
                        return {
                          id: item.id,
                          label: `${item.name} (${item.subgroup || "un"}) - ${hasPack ? `Bulto: $${pCost.toFixed(2)} (u: $${uCost.toFixed(2)})` : `Costo: $${uCost.toFixed(2)}`}`
                        };
                      })}
                    />
                  </div>

                  <div className="w-full sm:w-24">
                    <label className="block text-[9px] text-slate-400 font-bold uppercase mb-0.5">Consumo</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={tempCompQty}
                      onChange={(e) => setTempCompQty(e.target.value)}
                      className="w-full p-2 border border-slate-205 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs rounded-xl focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddComponent}
                    disabled={!tempCompId}
                    className={`py-2 px-4 rounded-xl font-bold text-xs uppercase cursor-pointer leading-none h-9 flex items-center gap-1.5 transition ${
                      tempCompId 
                        ? "bg-[#091426] hover:bg-[#1e293b] text-white" 
                        : "bg-slate-150 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Añadir
                  </button>
                </div>
              </div>

              {/* LIST OF CHOSEN RECIPE INGREDIENTS */}
              <div className="space-y-2">
                <label className="block text-slate-500 font-extrabold uppercase text-[11px]">Ingredientes agregados a la receta:</label>
                
                {formComponents.length === 0 ? (
                  <p className="text-[11px] text-rose-500 font-bold bg-rose-50/50 p-3 rounded-xl border border-rose-100 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Completa la composición añadiendo al menos un ingrediente arriba.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 dark:border-slate-800 p-3 rounded-xl bg-slate-50/20">
                    {formComponents.map((comp, idx) => {
                      const ing = getIngredientInfo(comp.stock_item_id);
                      const unitCost = ing ? getUnitCost(ing) : 0;
                      return (
                        <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-800/55 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-xs shadow-4xs">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-850 dark:text-slate-250 truncate max-w-[150px]">
                              {ing?.name || "Artículo"}
                            </span>
                            <div className="flex items-center gap-2 text-[9px]">
                              <span className="text-slate-400">c.u: ${unitCost.toFixed(2)}</span>
                              <span className="text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/20 px-1 rounded-xs">Sub: ${(unitCost * comp.quantity).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-350 bg-slate-50 dark:bg-slate-850/80 py-1 px-2 rounded border border-slate-100 dark:border-slate-800">
                              x{comp.quantity.toFixed(2)} {ing?.subgroup || "un"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(idx)}
                              className="text-rose-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* LIVE FINANCIAL INDICATOR HUD */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 rounded-3xl grid grid-cols-3 gap-3 text-center">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-extrabold block">Costo Auto</span>
                  <strong className="text-sm font-black font-mono text-slate-800 dark:text-slate-200">${liveCost.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-extrabold block">PVP</span>
                  <strong className="text-sm font-black font-mono text-emerald-600">${livePrice.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-extrabold block">Rentabilidad</span>
                  <strong className={`text-sm font-black font-mono ${liveMargin >= 50 ? "text-emerald-500" : "text-amber-500"}`}>
                    {liveMargin > 0 ? liveMargin.toFixed(0) : "0"}%
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-[#eff4ff] dark:border-slate-800 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2.5 px-4 bg-slate-100 text-slate-655 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formComponents.length === 0}
                  className={`py-2.5 px-5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 uppercase ${
                    formComponents.length > 0 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs" 
                      : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  }`}
                >
                  <Check className="w-4 h-4" />
                  GUARDAR RECETA
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* EDIT RECIPE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-205 dark:border-slate-800 max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="border-b border-[#eff4ff] dark:border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/10">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Edit3 className="w-4.5 h-4.5 text-indigo-500" />
                Modificar Receta / Producto Compuesto
              </h3>
              <button 
                onClick={() => setShowEditModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-slate-500 font-extrabold uppercase mb-1 text-[11px] tracking-wide">Nombre del Combo / Receta *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full p-2 border border-slate-205 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl focus:outline-hidden text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1 text-[11px]">Categoría *</label>
                  <CategorySelect
                    value={formCategory}
                    onChange={(val) => setFormCategory(val)}
                    categories={categories}
                    onAdd={onAddCategory}
                    onEdit={onEditCategory}
                    onDelete={onDeleteCategory}
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1 text-[11px]">Código SKU</label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full p-2 border border-slate-205 dark:border-slate-755 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs rounded-xl focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase mb-1 text-[11px]">Subtexto / Variante</label>
                  <input
                    type="text"
                    value={formSubgroup}
                    onChange={(e) => setFormSubgroup(e.target.value)}
                    className="w-full p-2 border border-slate-205 dark:border-slate-755 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-xl focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-550 dark:text-slate-450 font-black uppercase mb-1 text-[11px] text-indigo-600 dark:text-indigo-400">Precio Venta al Público ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    className="w-full p-2 border border-slate-205 dark:border-slate-700 dark:bg-slate-800 text-slate-850 dark:text-slate-200 font-mono text-xs rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* INGREDIENT ADDITION PANEL */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <h4 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">Añadir Ingredientes de Stock</h4>
                
                <div className="flex flex-col sm:flex-row gap-2.5 items-end bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                  <div className="flex-1 w-full">
                    <label className="block text-[9px] text-slate-400 font-bold uppercase mb-0.5">Seleccionar Ingrediente Base</label>
                    <CustomDropdown
                      value={tempCompId}
                      onChange={(val) => setTempCompId(val)}
                      placeholder="Elegir producto de inventario..."
                      options={availableBaseIngredients.map(item => {
                        const uCost = getUnitCost(item);
                        const pCost = item.purchase_price;
                        const hasPack = (Number(item.presentationUnits) || 1) > 1;
                        return {
                          id: item.id,
                          label: `${item.name} (${item.subgroup || "un"}) - ${hasPack ? `Bulto: $${pCost.toFixed(2)} (u: $${uCost.toFixed(2)})` : `Costo: $${uCost.toFixed(2)}`}`
                        };
                      })}
                    />
                  </div>

                  <div className="w-full sm:w-24">
                    <label className="block text-[9px] text-slate-400 font-bold uppercase mb-0.5">Consumo</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={tempCompQty}
                      onChange={(e) => setTempCompQty(e.target.value)}
                      className="w-full p-2 border border-slate-205 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs rounded-xl focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddComponent}
                    disabled={!tempCompId}
                    className={`py-2 px-4 rounded-xl font-bold text-xs uppercase cursor-pointer leading-none h-9 flex items-center gap-1.5 transition ${
                      tempCompId 
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs border border-indigo-600" 
                        : "bg-slate-150 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Añadir
                  </button>
                </div>
              </div>

              {/* LIST OF CHOSEN RECIPE INGREDIENTS */}
              <div className="space-y-2">
                <label className="block text-slate-500 font-extrabold uppercase text-[11px]">Ingredientes agregados a la receta:</label>
                
                {formComponents.length === 0 ? (
                  <p className="text-[11px] text-rose-500 font-bold bg-rose-50/50 p-3 rounded-xl border border-rose-100 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Completa la composición añadiendo al menos un ingrediente arriba.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 dark:border-slate-800 p-3 rounded-xl bg-slate-50/20">
                    {formComponents.map((comp, idx) => {
                      const ing = getIngredientInfo(comp.stock_item_id);
                      const unitCost = ing ? getUnitCost(ing) : 0;
                      return (
                        <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-800/55 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-xs shadow-4xs">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-850 dark:text-slate-250 truncate max-w-[150px]">
                              {ing?.name || "Artículo"}
                            </span>
                            <div className="flex items-center gap-2 text-[9px]">
                              <span className="text-slate-400">c.u: ${unitCost.toFixed(2)}</span>
                              <span className="text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/20 px-1 rounded-xs">Sub: ${(unitCost * comp.quantity).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-355 bg-slate-50 dark:bg-slate-850/80 py-1 px-2 rounded border border-slate-100 dark:border-slate-800">
                              x{comp.quantity.toFixed(2)} {ing?.subgroup || "un"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(idx)}
                              className="text-rose-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* LIVE FINANCIAL INDICATOR HUD */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 rounded-3xl grid grid-cols-3 gap-3 text-center">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-extrabold block">Costo Auto</span>
                  <strong className="text-sm font-black font-mono text-slate-800 dark:text-slate-200">${liveCost.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-extrabold block">PVP</span>
                  <strong className="text-sm font-black font-mono text-indigo-600">${livePrice.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-extrabold block">Rentabilidad</span>
                  <strong className={`text-sm font-black font-mono ${liveMargin >= 50 ? "text-emerald-500" : "text-amber-500"}`}>
                    {liveMargin > 0 ? liveMargin.toFixed(0) : "0"}%
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-[#eff4ff] dark:border-slate-800 justify-end">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="py-2.5 px-4 bg-slate-100 text-slate-655 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formComponents.length === 0}
                  className={`py-2.5 px-5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 uppercase ${
                    formComponents.length > 0 
                      ? "bg-indigo-650 hover:bg-indigo-700 text-white shadow-xs border border-indigo-600" 
                      : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  }`}
                >
                  <Check className="w-4 h-4" />
                  GUARDAR CAMBIOS
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-205 dark:border-slate-800 max-w-sm w-full p-6 space-y-4 shadow-2xl animate-scale-up">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">¿Eliminar Receta?</h3>
            <p className="text-xs text-slate-500 leading-normal">
              ¿Estás seguro de que quieres eliminar la receta <strong>"{deleteConfirmItem.name}"</strong>? Los ingredientes de stock y productos individuales permanecerán inalterados.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="py-2 px-4 bg-slate-100 text-slate-655 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Eliminar definitvamente
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

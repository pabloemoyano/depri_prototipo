import React, { useState } from "react";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Truck, 
  TrendingUp, 
  ShoppingCart, 
  CheckSquare, 
  CreditCard, 
  Users,
  Menu,
  Calendar,
  Power,
  ChevronLeft,
  ChevronRight,
  Layers,
  BarChart3,
  Clock,
  PiggyBank,
  Briefcase,
  Scale,
  Coins,
  Settings,
  FolderTree,
  Tag,
  Network
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  lowStockCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  lowStockCount 
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("sidebar_expanded_menus");
      return saved ? JSON.parse(saved) : { reports: true, financial: true, stock_mgmt: true, sales_mgmt: true, config: true };
    } catch {
      return { reports: true, financial: true, stock_mgmt: true, sales_mgmt: true, config: true };
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem("sidebar_collapsed", String(newVal));
      return newVal;
    });
  };

  const toggleMenuExpanded = (menuId: string) => {
    setExpandedMenus(prev => {
      const newVal = !prev[menuId];
      const updated = { ...prev, [menuId]: newVal };
      localStorage.setItem("sidebar_expanded_menus", JSON.stringify(updated));
      return updated;
    });
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      id: "financial",
      label: "Gestión Financiera",
      icon: Coins,
      subItems: [
        { id: "fin_caja", label: "Caja Diaria", icon: Clock },
        { id: "fin_consolidada", label: "Caja Consolidada", icon: Calendar },
        { id: "fin_libro", label: "Libro de Gestión", icon: Layers },
        { id: "fin_presupuesto", label: "Presupuesto", icon: PiggyBank },
        { id: "fin_clasificacion", label: "Clasificación Histórica", icon: Tag },
        { id: "fin_resultado", label: "Resultado Económico", icon: Briefcase },
        { id: "fin_punto", label: "Punto de Equilibrio", icon: Scale }
      ]
    },
    {
      id: "stock_mgmt",
      label: "Gestión de Stock",
      icon: ClipboardList,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      subItems: [
        { id: "inventory", label: "Inventario", icon: ClipboardList, badge: lowStockCount > 0 ? lowStockCount : undefined },
        { id: "purchases", label: "Compras", icon: TrendingUp },
        { id: "providers", label: "Proveedores", icon: Truck },
        { id: "audit", label: "Auditoría de Stock", icon: CheckSquare }
      ]
    },
    {
      id: "sales_mgmt",
      label: "Gestión de Ventas",
      icon: ShoppingCart,
      subItems: [
        { id: "sales", label: "TPV", icon: ShoppingCart },
        { id: "sales_future", label: "Turnos y Servicios (Futuro)", icon: Clock },
        { id: "customers", label: "Clientes", icon: Users }
      ]
    },
    {
      id: "reports",
      label: "Informes",
      icon: BarChart3,
      subItems: [
        { id: "reports_buffet", label: "Rentabilidad Buffet", icon: TrendingUp },
        { id: "reports_turnos", label: "Análisis de Turnos", icon: Calendar }
      ]
    },
    { 
      id: "config", 
      label: "Configuración", 
      icon: Settings, 
      subItems: [
        { id: "plan_cuentas", label: "Plan de Cuentas Maestro", icon: FolderTree },
        { id: "deactivated", label: "Desactivados", icon: Power },
        { id: "events", label: "Eventos / Canchas", icon: Calendar },
        { id: "mapa_arquitectura", label: "Mapa de Arquitectura", icon: Network }
      ]
    },
  ];

  return (
    <aside 
      className={`${
        isCollapsed ? "w-16" : "w-64"
      } bg-[#091426] text-[#bcc7de] flex flex-col justify-between border-r border-[#1e293b] select-none h-screen sticky top-0 transition-all duration-300 ease-in-out`} 
      id="sidebar_nav"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Toggle & Branding Header */}
        <div 
          onClick={toggleCollapse}
          className={`p-4 border-b border-[#1e293b] flex ${isCollapsed ? "flex-col justify-center gap-3" : "justify-between"} items-center cursor-pointer hover:bg-[#112038]/40 transition`}
          title={isCollapsed ? "Expandir menú" : "Contraer menú"}
        >
          {!isCollapsed ? (
            <div className="transition-opacity duration-300">
              <h1 className="text-white font-display text-base font-black tracking-tight uppercase leading-none">De Primera</h1>
              <p className="text-[#10b981] text-[9px] font-black tracking-widest uppercase mt-0.5">fútbol & eventos</p>
            </div>
          ) : (
            <span className="text-white font-black text-sm tracking-tighter uppercase leading-none bg-[#1e293b] p-1.5 rounded-lg border border-[#16a34a]/30">DP</span>
          )}
          <div 
            className="p-1.5 rounded-xl hover:bg-[#112038] hover:text-white text-[#8590a6] transition duration-200"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </div>
        </div>

        {/* Navigation Tabs List Wrapper (Scrollable) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          <nav className="p-2 space-y-1.5 mt-3">
            {!isCollapsed && (
              <span className="text-[10px] font-bold text-[#8590a6] uppercase tracking-wider px-3.5 block mb-2 transition-all">
                Módulos de Sistema
              </span>
            )}
            {menuItems.map((item: any) => {
              const Icon = item.icon;
              const hasSubItems = !!item.subItems;
              const isSubActive = hasSubItems && item.subItems.some((sub: any) => activeTab === sub.id);
              const isActive = activeTab === item.id || isSubActive;
              
              const handleBtnClick = () => {
                if (hasSubItems) {
                  if (isCollapsed) {
                    setIsCollapsed(false);
                    localStorage.setItem("sidebar_collapsed", "false");
                  }
                  toggleMenuExpanded(item.id);
                  // Auto switch to first sub-item if not already on a sub-item
                  if (!isSubActive) {
                    setActiveTab(item.subItems[0].id);
                  }
                } else {
                  setActiveTab(item.id);
                }
              };

              const buttonHtml = (
                <button
                  key={item.id}
                  onClick={handleBtnClick}
                  className={`w-full flex items-center transition-all cursor-pointer ${
                    isCollapsed ? "justify-center px-1 py-3 rounded-lg" : "justify-between px-3.5 py-2.5 rounded-xl"
                  } text-xs font-semibold tracking-wide ${
                    isActive 
                      ? "bg-[#1e293b] text-white shadow-xs border-l-4 border-[#16a34a] pl-2.5" 
                      : "hover:bg-[#112038] hover:text-[#e2e8f5] text-[#bcc7de]"
                  }`}
                  title={item.label}
                  id={`sidebar_tab_${item.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#10b981]" : "text-[#8590a6]"}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {hasSubItems && !isCollapsed && (
                    <ChevronRight className={`w-3.5 h-3.5 transform transition-transform duration-200 ${expandedMenus[item.id] ? "rotate-90 text-[#10b981]" : "text-[#8590a6]"}`} />
                  )}
                  {item.badge !== undefined && (
                    isCollapsed ? (
                      <span className="absolute ml-5 -mt-3.5 bg-[#ba1a1a] text-white font-mono text-[8px] font-extrabold h-3.5 w-3.5 rounded-full flex items-center justify-center border border-[#091426]">
                         !
                      </span>
                    ) : (
                      <span className="bg-[#ba1a1a] text-white font-mono text-[9px] font-extrabold h-4 px-1.5 rounded-full flex items-center justify-center border border-[#ba1a1a]">
                        {item.badge}
                      </span>
                    )
                  )}
                </button>
              );

              if (hasSubItems) {
                return (
                  <div key={item.id} className="space-y-1">
                    {buttonHtml}
                    {!isCollapsed && expandedMenus[item.id] && (
                      <div className="pl-6 space-y-1 my-1">
                        {item.subItems.map((sub: any) => {
                          const subActive = activeTab === sub.id;
                          const SubIcon = sub.icon;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => setActiveTab(sub.id)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-bold tracking-wide transition leading-none select-none ${
                                subActive
                                  ? "bg-[#16a34a]/15 text-[#10b981] font-black border-l-2 border-[#16a34a] pl-2"
                                  : "hover:bg-[#112038] hover:text-[#e2e8f5] text-[#bcc7de]"
                              }`}
                              id={`sidebar_subtab_${sub.id}`}
                            >
                              <div className="flex items-center gap-2">
                                <SubIcon className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
                                <span className="truncate">{sub.label}</span>
                              </div>
                              {sub.badge !== undefined && (
                                <span className="bg-[#ba1a1a] text-white font-mono text-[8px] font-extrabold h-3.5 px-1.5 rounded-full flex items-center justify-center border border-[#ba1a1a]">
                                  {sub.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return buttonHtml;
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
};

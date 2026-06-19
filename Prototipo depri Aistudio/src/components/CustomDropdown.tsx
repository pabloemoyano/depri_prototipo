import React, { useState, useRef, useEffect, useMemo } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";

export interface CustomDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
  onAdd?: (label: string) => void;
  onEdit?: (id: string, label: string) => void;
  onDelete?: (id: string, label: string) => void;
  addLabel?: string;
  searchable?: boolean;
  onSearchChange?: (val: string) => void;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  onAdd,
  onEdit,
  onDelete,
  addLabel = "Crear Nuevo",
  searchable = false,
  onSearchChange,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => options.find((o) => o.id === value) || null, [options, value]);

  // Sync searchQuery when value or selectedOption changes
  useEffect(() => {
    if (selectedOption) {
      setSearchQuery(selectedOption.label);
      if (onSearchChange) onSearchChange(selectedOption.label);
    } else {
      // Don't clear if it's open and searchable (user might be typing)
      if (!open) {
        setSearchQuery("");
        if (onSearchChange) onSearchChange("");
      }
    }
  }, [value, selectedOption, open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        // Reset search query to correct value on click-away
        if (selectedOption) {
          setSearchQuery(selectedOption.label);
          if (onSearchChange) onSearchChange(selectedOption.label);
        } else {
          setSearchQuery("");
          if (onSearchChange) onSearchChange("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectedOption]);

  const filteredOptions = useMemo(() => {
    if (!searchable) return options;
    if (!searchQuery) return options;
    // Show all if exact match with selected option
    if (selectedOption && searchQuery === selectedOption.label) {
      return options;
    }
    return options.filter((o) =>
      o.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchable, searchQuery, options, selectedOption]);

  const handleSelect = (id: string) => {
    console.log(
      "[DD-1 handleSelect]",
      {
        id,
        option: options.find(o => o.id === id)
      }
    );
    const optObj = options.find(o => o.id === id);
    console.log("AUDIT-SUB-CustomDropdown handleSelect triggered with ID:", id, "found matching option object:", optObj, "current full options list:", JSON.stringify(options));
    onChange(id);
    if (optObj && onSearchChange) {
      onSearchChange(optObj.label);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {!searchable ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setOpen(!open);
          }}
          className="w-full flex items-center justify-between px-3 py-2 border border-slate-205 dark:border-slate-700 rounded-xl text-[13px] sm:text-xs bg-white dark:bg-slate-800 text-left focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
        >
          <span className="truncate text-slate-800 dark:text-slate-200">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : (
        <div className="relative">
          <input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onFocus={() => {
              setOpen(true);
            }}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpen(true);
              if (onSearchChange) onSearchChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // Instead of auto-selecting, just close the dropdown
                setOpen(false);
              } else if (e.key === "Escape") {
                setOpen(false);
                if (selectedOption) {
                  setSearchQuery(selectedOption.label);
                  if (onSearchChange) onSearchChange(selectedOption.label);
                } else {
                  setSearchQuery("");
                  if (onSearchChange) onSearchChange("");
                }
              }
            }}
            className="w-full px-3 py-2 border border-slate-205 dark:border-slate-700 rounded-xl text-[13px] sm:text-xs bg-white dark:bg-slate-800 text-slate-804 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 pr-16 text-left outline-hidden"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
            {value && (
              <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); onChange(""); setSearchQuery(""); if (onSearchChange) onSearchChange(""); }}
                className="text-slate-400 hover:text-red-500 p-1"
              >
                ✕
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setOpen(!open);
              }}
              className="text-slate-400 hover:text-slate-650 focus:outline-hidden cursor-pointer p-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-xl shadow-xl py-1 max-h-60 overflow-auto">
          {filteredOptions.length === 0 && !onAdd ? (
             <div className="px-3 py-2 text-xs text-slate-500 italic">No hay opciones disponibles.</div>
          ) : (
            filteredOptions.map((opt) => (
              <div
                key={opt.id}
                className={`group flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer ${
                  value === opt.id
                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold"
                    : "text-slate-700 dark:text-slate-300"
                }`}
                onClick={() => handleSelect(opt.id)}
              >
                <span className="text-xs truncate flex-1">{opt.label}</span>
                {(onEdit || onDelete) && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(opt.id, opt.label);
                          setOpen(false);
                        }}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-indigo-600 dark:text-indigo-400"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(opt.id, opt.label);
                        }}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md text-red-600 dark:text-red-400"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          
          {onAdd && (
            <>
              {filteredOptions.length > 0 && <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onAdd) onAdd(searchQuery);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {addLabel}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

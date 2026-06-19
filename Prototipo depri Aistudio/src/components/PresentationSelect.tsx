import React, { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { Presentation } from "../types";

interface PresentationSelectProps {
  presentations: Presentation[];
  value: string;
  onChange: (presentation: Presentation) => void;
  onAdd: () => void;
  onEdit: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export const PresentationSelect: React.FC<PresentationSelectProps> = ({ presentations, value, onChange, onAdd, onEdit, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        className="w-full px-3 py-2 border rounded-lg text-xs cursor-pointer bg-white flex justify-between items-center text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{value || "Seleccionar presentación..."}</span>
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full bg-white border rounded-lg shadow-xl mt-1 py-1 max-h-60 overflow-y-auto">
          {presentations.map(p => (
            <div key={p.id} className="group flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer text-xs">
              <span className="truncate flex-1" onClick={() => { onChange(p); setIsOpen(false); }}>{p.name} ({p.units} unid)</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 size={14} className="text-indigo-600 hover:text-indigo-700" onClick={(e) => { e.stopPropagation(); onEdit(p.id, p.name); }} />
                <Trash2 size={14} className="text-red-600 hover:text-red-700" onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors border-t mt-1"
            onClick={(e) => { e.stopPropagation(); onAdd(); setIsOpen(false); }}
          >
            <Plus size={14}/> Nueva Presentación
          </button>
        </div>
      )}
    </div>
  );
};

import React from "react";
import { Plus } from "lucide-react";

interface AddAccountButtonProps {
    onClick: () => void;
}

export const AddAccountButton: React.FC<AddAccountButtonProps> = ({ onClick }) => {
    return (
        <button 
            type="button"
            onClick={onClick}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-all cursor-pointer border border-emerald-200 active:scale-[0.98]"
        >
            <Plus className="w-4 h-4" /> Añadir cuenta nueva
        </button>
    );
};

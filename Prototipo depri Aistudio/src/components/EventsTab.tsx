/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Calendar, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  MapPin, 
  Clock, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  X,
  PlusCircle,
  HelpCircle
} from "lucide-react";
import { EventModel, CustomerProfile } from "../types";
import { CustomDropdown } from "./CustomDropdown";

interface EventsTabProps {
  events: EventModel[];
  onAddEvent: (evt: Omit<EventModel, "id">) => Promise<void>;
  onEditEvent: (evt: EventModel) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  customers?: CustomerProfile[];
}

export const EventsTab: React.FC<EventsTabProps> = ({
  events = [],
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  customers = []
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventModel | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("18:00 - 19:00");
  const [formFieldNumber, setFormFieldNumber] = useState<EventModel["fieldNumber"]>("Cancha Principal & Barra F7");
  const [formPrice, setFormPrice] = useState("120.00");
  const [formStatus, setFormStatus] = useState<EventModel["status"]>("Pendiente");
  const [formCatering, setFormCatering] = useState(false);
  const [formNotes, setFormNotes] = useState("");

  const handleOpenAdd = () => {
    setEditingEvent(null);
    setFormTitle("");
    setFormCustomerName(customers[0]?.fullName || "");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormTime("18:00 - 19:00");
    setFormFieldNumber("Cancha Principal & Barra F7");
    setFormPrice("120.00");
    setFormStatus("Pendiente");
    setFormCatering(false);
    setFormNotes("");
    setShowModal(true);
  };

  const handleOpenEdit = (evt: EventModel) => {
    setEditingEvent(evt);
    setFormTitle(evt.title);
    setFormCustomerName(evt.customerName);
    setFormDate(evt.date);
    setFormTime(evt.time);
    setFormFieldNumber(evt.fieldNumber);
    setFormPrice(evt.price.toFixed(2));
    setFormStatus(evt.status);
    setFormCatering(evt.cateringNeeded);
    setFormNotes(evt.notes || "");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert("Por favor ingresa un título de evento.");
      return;
    }
    const priceNum = Number(formPrice);
    if (isNaN(priceNum)) {
      alert("Precio inválido.");
      return;
    }

    const payload = {
      title: formTitle,
      customerName: formCustomerName || "Consumidor Final",
      date: formDate,
      time: formTime,
      fieldNumber: formFieldNumber,
      price: priceNum,
      status: formStatus,
      cateringNeeded: formCatering,
      notes: formNotes
    };

    try {
      if (editingEvent) {
        await onEditEvent({ ...editingEvent, ...payload });
      } else {
        await onAddEvent(payload);
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert("Error procesando la solicitud.");
    }
  };

  // Metrics
  const totalEventsCount = events.length;
  const confirmedEventsCount = events.filter(e => e.status === "Confirmado").length;
  const totalExpectedRevenue = events
    .filter(e => e.status !== "Cancelado")
    .reduce((sum, e) => sum + e.price, 0);

  // Filters
  const filteredEvents = events.filter((evt) => {
    const matchesSearch = 
      evt.title.toLowerCase().includes(search.toLowerCase()) ||
      evt.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (evt.notes && evt.notes.toLowerCase().includes(search.toLowerCase()));
    
    if (statusFilter === "todos") return matchesSearch;
    return matchesSearch && evt.status.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      
      {/* Upper Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-[#eff4ff] shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 bg-[#eefaf4] text-[#10b981] rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Reservas Totales</span>
            <span className="text-xl font-black text-slate-900 font-mono leading-none mt-1 block">{totalEventsCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#eff4ff] shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 bg-[#e8f5ff] text-[#0061a4] rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Eventos Confirmados</span>
            <span className="text-xl font-black text-slate-900 font-mono leading-none mt-1 block">{confirmedEventsCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#eff4ff] shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 bg-[#fffbeb] text-amber-500 rounded-xl flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Ingreso Estimado Activo</span>
            <span className="text-xl font-black text-[#16a34a] font-mono leading-none mt-1 block">${totalExpectedRevenue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="bg-white p-5 rounded-2xl border border-[#eff4ff] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          {/* Search box */}
          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar reservas o notas..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          </div>

          {/* Filter dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto py-2 px-3 border border-slate-220 rounded-xl text-xs cursor-pointer focus:outline-hidden"
          >
            <option value="todos">Todos los Estados</option>
            <option value="Confirmado">Confirmado</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-[#091426] hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer leading-none w-full md:w-auto justify-center select-none"
        >
          <Plus className="w-4 h-4 text-white" />
          AGENDAR NUEVO EVENTO
        </button>
      </div>

      {/* Events Table Container */}
      <div className="bg-white rounded-2xl border border-[#eff4ff] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-slate-900 font-bold text-xs tracking-wide">Agenda de Partidos y Eventos Sociales</h3>
          <span className="bg-slate-50 text-slate-500 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-150">
            {filteredEvents.length} reservas encontradas
          </span>
        </div>

        <div className="overflow-x-auto">
          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
              <Calendar className="w-8 h-8 text-slate-350" />
              <p className="text-xs font-bold text-slate-400">No hay reservas agendadas en este filtro.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] text-slate-450 uppercase font-extrabold select-none">
                  <th className="py-3 px-4">Evento / Concepto</th>
                  <th className="py-3 px-4">Cliente solicitante</th>
                  <th className="py-3 px-4">Fecha y Horario</th>
                  <th className="py-3 px-4">Cancha / Espacio</th>
                  <th className="py-3 px-4 text-right">Precio de Alquiler</th>
                  <th className="py-3 px-4 text-center">Catering</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.map((evt) => {
                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-500 font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-full border border-amber-100">
                      <AlertCircle className="w-3 h-3" />
                      Pendiente
                    </span>
                  );
                  if (evt.status === "Confirmado") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-[#10b981] font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-full border border-emerald-100">
                        <CheckCircle className="w-3 h-3" />
                        Confirmado
                      </span>
                    );
                  } else if (evt.status === "Cancelado") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-500 font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-full border border-rose-100">
                        <XCircle className="w-3 h-3" />
                        Cancelado
                      </span>
                    );
                  }

                  return (
                    <tr key={evt.id} className="hover:bg-slate-50/50 transition-colors">
                      
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <div>
                          <p>{evt.title}</p>
                          {evt.notes && (
                            <p className="text-[10px] text-slate-450 font-normal mt-0.5 italic max-w-xs truncate">{evt.notes}</p>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-705 font-medium">{evt.customerName}</td>
                      
                      <td className="py-3 px-4 text-slate-705">
                        <div className="flex flex-col gap-0.5 font-medium">
                          <span className="flex items-center gap-1 font-semibold text-slate-800">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {evt.date}
                          </span>
                          <span className="text-[11px] text-slate-450 ml-4">{evt.time}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-705 font-medium">
                        <span className="flex items-center gap-1 text-slate-805">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {evt.fieldNumber}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-slate-805">
                        ${evt.price.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${evt.cateringNeeded ? "bg-[#10b981] shadow-[0_0_8px_#34d399]" : "bg-slate-200"}`} title={evt.cateringNeeded ? "Requiere servicio de bar/catering" : "Solo cancha"} />
                      </td>

                      <td className="py-3 px-4 text-center select-none">{statusBadge}</td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(evt)}
                            className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer transition-colors"
                            title="Editar evento"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={async () => {
                              if (confirm(`¿Seguro que deseas eliminar la reserva "${evt.title}" de forma definitiva?`)) {
                                await onDeleteEvent(evt.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-[#ba1a1a] cursor-pointer transition-colors"
                            title="Eliminar evento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Dialog Form */}
      {showModal && (
        <div className="fixed inset-0 bg-[#060e1d]/85 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#eff4ff] shadow-xl w-full max-w-md overflow-hidden animate-scale-up" id="event_modal">
            
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                {editingEvent ? "✏️ Editar Reserva" : "📅 Programar Nueva Reserva"}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-extrabold uppercase tracking-wide mb-1">Título del Evento *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Por ej: Torneo F7 de Veteranos o Cumpleaños Carlos F5"
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase tracking-wide mb-1">Cliente Solicitante *</label>
                  {customers.length > 0 ? (
                    <select
                      value={formCustomerName}
                      onChange={(e) => setFormCustomerName(e.target.value)}
                      className="w-full p-2 border border-slate-205 rounded-xl cursor-pointer focus:outline-hidden bg-white"
                    >
                      {customers.map((c) => (
                        <option key={c.id} value={c.fullName}>{c.fullName}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={formCustomerName}
                      onChange={(e) => setFormCustomerName(e.target.value)}
                      placeholder="Nombre del cliente..."
                      className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase tracking-wide mb-1">Cancha / Espacio *</label>
                  <CustomDropdown
                    value={formFieldNumber}
                    onChange={(val) => setFormFieldNumber(val as any)}
                    options={[
                      { id: "Cancha Principal & Barra F7", label: "Cancha Principal & Barra F7" },
                      { id: "Cancha F5 Techada", label: "Cancha F5 Techada" },
                      { id: "Cancha F5 Infantil", label: "Cancha F5 Infantil" },
                      { id: "Salón de Eventos VIP", label: "Salón de Eventos VIP" }
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase tracking-wide mb-1">Fecha reserva *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase tracking-wide mb-1">Franja Horaria *</label>
                  <input
                    type="text"
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    placeholder="18:00 - 19:30"
                    className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-slate-500 font-extrabold uppercase tracking-wide mb-1">Precio Alquiler ($) *</label>
                  <input
                    type="text"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full p-2 border border-slate-205 rounded-xl font-mono focus:outline-hidden focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-extrabold uppercase tracking-wide mb-1">Estado Reserva *</label>
                  <CustomDropdown
                    value={formStatus}
                    onChange={(val) => setFormStatus(val as any)}
                    options={[
                      { id: "Confirmado", label: "🟢 Confirmado" },
                      { id: "Pendiente", label: "🟡 Pendiente" },
                      { id: "Cancelado", label: "🔴 Cancelado" }
                    ]}
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="inline-flex items-center gap-2 text-slate-600 font-extrabold uppercase cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formCatering}
                    onChange={(e) => setFormCatering(e.target.checked)}
                    className="rounded-md border-slate-205 w-4 h-4 cursor-pointer text-[#16a34a] focus:ring-0"
                  />
                  <span>¿Requiere o Incluye Servicio de Catering/Bar?</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-500 font-extrabold uppercase tracking-wide mb-1">Notas / Observaciones</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Por ej: Trae refrescos adicionales. Se abona en mano..."
                  rows={2}
                  className="w-full p-2 border border-slate-205 rounded-xl focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-205 rounded-xl hover:bg-slate-20 text-[#091426] cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl cursor-pointer"
                >
                  {editingEvent ? "GUARDAR CAMBIOS" : "AGENDAR reserva"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { 
  Upload, 
  Sparkles, 
  Loader2, 
  Check, 
  AlertTriangle, 
  Image as ImageIcon,
  ArrowRight,
  RefreshCw,
  Clock,
  Coins,
  CheckCircle,
  FileSpreadsheet
} from "lucide-react";
import { StockItem, BarCategory, ScannerResponse, ScannerItemResult } from "../types";

// Standard raw mock receipts base64 or placeholder assets we can use to let users try
import { SAMPLE_TICKET_1, SAMPLE_TICKET_2 } from "../data_samples";

import { parseCustomDateToIso } from "./CajaDiariaV2";

interface ScannerAIProps {
  stock: StockItem[];
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onConfirmSale: (saleData: {
    items: { stock_item_id: string; name: string; quantity: number; price: number; total: number }[];
    method: "efectivo" | "tarjeta" | "bizum";
    origin: "ticket_ai";
    table_number: string;
    notes?: string;
    date?: string;
    caja_session_id?: string;
  }) => Promise<boolean>;
}

export const ScannerAI: React.FC<ScannerAIProps> = ({ stock, apiFetch, onConfirmSale }) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  
  // OCR Scan variables
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [scanResult, setScanResult] = useState<ScannerResponse | null>(null);
  
  // Editor / Approval state
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "tarjeta" | "bizum">("efectivo");
  const [tableTarget, setTableTarget] = useState<string>("Barra (Tique Scanned)");
  const [finalItems, setFinalItems] = useState<ScannerItemResult[]>([]);
  const [scannedTotal, setScannedTotal] = useState<number>(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // File drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Convert uploaded image file to Base64 coordinates for the server JSON
  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setOcrError("Por favor, selecciona una imagen válida (formatos PNG, JPG, JPEG).");
      return;
    }

    setOcrError(null);
    setScanResult(null);
    setScanSuccess(false);

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      setPreviewUrl(resultStr);
      
      // Extract base64 part
      const base64Parts = resultStr.split(",");
      const rawBase64 = base64Parts[1];
      setBase64Image(rawBase64);
      setMimeType(file.type);
    };
    reader.readAsDataURL(file);
  };

  // Quick Simulation using preset ticket templates to show immediately
  const handleSimulateTicket = (ticketType: 1 | 2) => {
    setOcrError(null);
    setScanResult(null);
    setScanSuccess(false);

    const preset = ticketType === 1 ? SAMPLE_TICKET_1 : SAMPLE_TICKET_2;
    setPreviewUrl(preset.preview_url);
    setBase64Image(preset.base64);
    setMimeType(preset.mime);
  };

  // Submit base64 to server to run Gemini 3.5-flash scanning
  const startAIScan = async () => {
    if (!base64Image || !mimeType) {
      setOcrError("No hay imagen cargada para escanear.");
      return;
    }

    setLoading(true);
    setOcrError(null);
    setScanResult(null);

    // Dynamic loading text sequencer helper
    const steps = [
      "Iniciando Conexión con Servidor...",
      "Enviando imagen codificada en base64 a la pasarela...",
      "Invocando API de Gemini 3.5-flash...",
      "Gemini analizando la foto del tique...",
      "Extrayendo líneas de texto, unidades y costos...",
      "Mapeando de forma inteligente con tu base de datos de stock...",
      "Compilando reporte JSON estructurado..."
    ];
    
    let currentStepIndex = 0;
    setLoadingStep(steps[0]);

    const intervalId = setInterval(() => {
      currentStepIndex = (currentStepIndex + 1) % steps.length;
      setLoadingStep(steps[currentStepIndex]);
    }, 2800);

    try {
      const response = await apiFetch("/api/sales/scan-ticket", {
        method: "POST",
        body: JSON.stringify({ image: base64Image, mimeType: mimeType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Fallo en el escáner del servidor.");
      }

      const report: ScannerResponse = await response.json();
      
      setScanResult(report);
      setFinalItems(report.scannedItems);
      setScannedTotal(report.extractedTotal);
    } catch (err: any) {
      console.error("AI Reader error:", err);
      setOcrError("No se pudo escanear el tique: " + (err.message || "Error del servidor. Comprueba tu GEMINI_API_KEY en ajustes."));
    } finally {
      clearInterval(intervalId);
      setLoading(false);
      setLoadingStep("");
    }
  };

  // Allow manual override for matching
  const handleItemMatchChange = (index: number, newStockId: string) => {
    setFinalItems((prev) => {
      const updated = [...prev];
      if (newStockId === "null") {
        updated[index].matchedItemId = null;
        updated[index].matchedItemName = null;
      } else {
        const selectedPrd = stock.find(p => p.id === newStockId);
        updated[index].matchedItemId = newStockId;
        updated[index].matchedItemName = selectedPrd ? selectedPrd.name : "";
      }
      return updated;
    });
  };

  const handleQuantityPriceChange = (index: number, field: "quantity" | "price", val: number) => {
    setFinalItems((prev) => {
      const updated = [...prev];
      if (field === "quantity") {
        updated[index].quantity = val;
      } else {
        updated[index].price = val;
      }
      updated[index].total = Number((updated[index].quantity * updated[index].price).toFixed(2));
      
      // Re-sum total
      const newTotal = updated.reduce((sum, item) => sum + item.total, 0);
      setScannedTotal(Number(newTotal.toFixed(2)));

      return updated;
    });
  };

  // Handle final save sale subtraction
  const handleSaveScannedSales = async () => {
    if (finalItems.length === 0) return;

    // Filter only those items that have valid stock mapping, or treat them as custom sales if preferred
    // For general bar usability, we will process matched items. Unmatched are logged dynamically.
    const salePostDataList = finalItems.map((item) => ({
      stock_item_id: item.matchedItemId || "custom_ai",
      name: item.matchedItemId ? (item.matchedItemName || item.rawName) : `[AI Extracted] ${item.rawName}`,
      quantity: item.quantity,
      price: item.price,
      total: item.total
    }));

    setLoading(true);
    setLoadingStep("Grabando ventas en la base de datos y deduciendo stock...");

    const savedSession = localStorage.getItem("caja_v2_active_session");
    let sessionId = "";
    let sessionDate: string | undefined = undefined;

    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        sessionId = parsed.id;
        sessionDate = parseCustomDateToIso(parsed.dateStr);
      } catch (e) {}
    }

    try {
      const success = await onConfirmSale({
        items: salePostDataList,
        method: paymentMethod,
        origin: "ticket_ai",
        table_number: tableTarget,
        date: sessionDate,
        caja_session_id: sessionId,
        notes: `Importación IA de tique físico escaneado. Detalle: ${scanResult?.scannedTextSummary || ""}`,
      });

      if (success) {
        setScanSuccess(true);
        setScanResult(null);
        setFinalItems([]);
        setPreviewUrl(null);
        setBase64Image(null);
      } else {
        setOcrError("No se pudieron registrar las ventas escaneadas en el inventario.");
      }
    } catch {
      setOcrError("Hubo un fallo de red al almacenar esta comanda.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  // Reset/Clear scanner view
  const handleResetScanner = () => {
    setPreviewUrl(null);
    setBase64Image(null);
    setMimeType(null);
    setScanResult(null);
    setFinalItems([]);
    setScannedTotal(0);
    setOcrError(null);
    setScanSuccess(false);
  };

  return (
    <div className="space-y-6" id="ai_receipt_center">
      
      {/* Introduction */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
            Carga Automática de Ventas mediante Inteligencia Artificial
          </h2>
          <p className="text-xs text-slate-550 max-w-xl">
            Sube la foto de un tique de caja o cuenta de mesa. Nuestra IA integrada analiza el contenido con 
            <strong> Gemini 3.5-flash</strong>, extrae los productos, los asocia automáticamente con tu inventario, resta las cantidades del stock y añade la venta al registro.
          </p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5 text-xs text-indigo-700 font-bold flex items-center gap-1 leading-none select-none">
          <span>Pasarela Activa:</span>
          <span className="font-mono bg-indigo-100 px-1.5 py-0.5 rounded-md">Gemini-3.5-flash</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Input upload and Preview (Cols = 5) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wide">Paso 1: Sube la Imagen del Tique</h3>
            
            {/* Drag and drop panel */}
            {!previewUrl ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl py-12 px-4 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition ${
                  dragActive 
                    ? "border-indigo-500 bg-indigo-50/20" 
                    : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50"
                }`}
              >
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 animate-gently">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Selecciona o suelta la foto del tique</p>
                  <p className="text-xs text-slate-400">Archivos JPG, JPEG, PNG en alta resolución</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Embedded preview */}
                <div className="relative rounded-xl border border-slate-150 overflow-hidden bg-slate-900 flex justify-center max-h-[300px]">
                  <img
                    src={previewUrl}
                    alt="Tique subido"
                    referrerPolicy="no-referrer"
                    className="object-contain max-h-[300px] w-full"
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-1 bg-slate-900/80 rounded-md text-[10px] font-black tracking-wider text-indigo-400 flex items-center gap-1 border border-indigo-900/30">
                    <ImageIcon className="w-3.5 h-3.5" />
                    LISTA PARA PROCESAR
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={startAIScan}
                    disabled={loading}
                    className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-white" />
                    {loading ? "ESCANEANDO..." : "ESCANEAR CON INTELIGENCIA ARTIFICIAL"}
                  </button>
                  
                  <button
                    onClick={handleResetScanner}
                    disabled={loading}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-705 text-xs font-bold rounded-xl transition cursor-pointer"
                    title="Cerrar imagen"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Simulated preset tickets panel (INCREDIBLE UX) */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block">¿No tienes tiques a mano? Prueba una simulación:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSimulateTicket(1)}
                  disabled={loading}
                  className="py-2 px-3 text-left border rounded-lg hover:border-indigo-400 hover:bg-slate-50/50 transition cursor-pointer flex flex-col justify-between"
                >
                  <span className="text-xs font-bold text-slate-900 block truncate">Tique Barra Cafe</span>
                  <span className="text-[10px] text-indigo-500 font-medium">Estrella + Bravas (2 items)</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => handleSimulateTicket(2)}
                  disabled={loading}
                  className="py-2 px-3 text-left border rounded-lg hover:border-indigo-400 hover:bg-slate-50/50 transition cursor-pointer flex flex-col justify-between"
                >
                  <span className="text-xs font-bold text-slate-900 block truncate">Tique Cena Terraza</span>
                  <span className="text-[10px] text-indigo-500 font-medium">Jamón + Croquetas + Vino (3 items)</span>
                </button>
              </div>
            </div>

          </div>

          {ocrError && (
            <div className="p-4 bg-rose-50 text-rose-800 rounded-2xl border border-rose-200 text-xs font-semibold flex items-start gap-2.5 animate-shake">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{ocrError}</span>
            </div>
          )}

          {scanSuccess && (
            <div className="p-5 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs font-bold flex flex-col gap-2 shadow-xs animate-scale-up">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>¡Tique procesado con éxito!</span>
              </div>
              <p className="text-slate-650 font-medium">
                Ventas registradas y cantidades absorbidas de la pasarela de stock de manera real. Puedes ver la transacción en la pestaña de Historial de Ventas.
              </p>
              <button
                onClick={handleResetScanner}
                className="mt-2 text-left text-xs text-indigo-600 font-bold hover:underline"
              >
                Cargar otro tique físico
              </button>
            </div>
          )}

        </div>

        {/* Right: Results editor & Mapping center (Cols = 7) */}
        <div className="lg:col-span-7">
          
          {/* Loading status panel */}
          {loading && (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-md text-center flex flex-col items-center justify-center gap-4 min-h-[400px]">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">Procesando imagen con IA de Google...</p>
                <p className="text-xs font-mono text-indigo-500 max-w-sm mx-auto">{loadingStep}</p>
              </div>
            </div>
          )}

          {/* Prompt empty / initial state */}
          {!loading && !scanResult && !scanSuccess && (
            <div className="bg-slate-50/50 p-8 rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-3 min-h-[400px] text-slate-500">
              <FileSpreadsheet className="w-12 h-12 text-slate-350" />
              <p className="text-sm font-bold">Sin análisis activo</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Arrastra o selecciona la fotografía del tique comercial en formato JPG o PNG a la izquierda y pulsa el botón para procesar.
              </p>
            </div>
          )}

          {/* AI Scanned results editor */}
          {!loading && scanResult && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-md space-y-6 animate-scale-up" id="ai_results">
              
              {/* Scan Meta summary */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b pb-4 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold py-0.5 px-2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-md">
                    REPORTE DE GEMINI PARSER
                  </span>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                    Información Extraída del Tique
                  </h3>
                  {scanResult.scannedTextSummary && (
                    <p className="text-xs text-slate-550 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {scanResult.scannedTextSummary}
                    </p>
                  )}
                </div>
              </div>

              {/* Items mapping list table */}
              <div className="space-y-2">
                <span className="text-xs font-extrabold text-slate-550 tracking-wider uppercase block">Paso 2: Verifica y Mapea tus Productos</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Revisa si la IA mapeó correctamente los artículos a los productos reales de tu inventario. Si no hay coincidencia, selecciónalo manualmente utilizando el menú desplegable.
                </p>

                <div className="border border-slate-150 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                          <th className="py-2.5 px-3">Artículo en Tique</th>
                          <th className="py-2.5 px-3">Mapeo de Inventario (Real)</th>
                          <th className="py-2.5 px-3 text-center w-[80px]">Cant.</th>
                          <th className="py-2.5 px-3 text-right w-[100px]">PVP Unit.</th>
                          <th className="py-2.5 px-3 text-right w-[90px]">Total Línea</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 font-medium">
                        {finalItems.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/50 transition">
                            {/* Raw name */}
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block truncate max-w-[150px]" title={item.rawName}>
                                {item.rawName}
                              </span>
                            </td>

                            {/* Dropdown inventory map */}
                            <td className="py-2 px-2">
                              <select
                                value={item.matchedItemId || "null"}
                                onChange={(e) => handleItemMatchChange(index, e.target.value)}
                                className={`w-full py-1.5 px-2 bg-slate-50 border text-xs rounded-lg focus:outline-hidden ${
                                  item.matchedItemId 
                                    ? "border-emerald-250 text-emerald-800 font-semibold" 
                                    : "border-rose-250 text-rose-800 font-semibold"
                                }`}
                              >
                                <option value="null">⚠️ Sin mapear (Venta Genérica)</option>
                                {stock.filter(p => p.is_active !== false).map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} (${p.selling_price.toFixed(2)})
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* editable qty */}
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleQuantityPriceChange(index, "quantity", Number(e.target.value) || 1)}
                                className="w-full py-1 text-center bg-slate-50 border border-slate-200 text-slate-800 rounded-md font-mono"
                              />
                            </td>

                            {/* editable unit price */}
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.price}
                                onChange={(e) => handleQuantityPriceChange(index, "price", Number(e.target.value) || 0)}
                                className="w-full py-1 px-1 text-right bg-slate-50 border border-slate-200 text-slate-850 rounded-md font-mono"
                              />
                            </td>

                            {/* Total calculated pricing */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              ${item.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Destination table, payment and final save commands */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 space-y-4">
                <span className="text-xs font-extrabold text-slate-550 uppercase tracking-wider block">Paso 3: Destinación de Venta y Cobro</span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  
                  {/* Table assign target */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">ASIGNAR A COBRO :</label>
                    <input
                      type="text"
                      value={tableTarget}
                      onChange={(e) => setTableTarget(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                    />
                  </div>

                  {/* Payment method */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">MÉTODO DE PAGO :</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                    >
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="tarjeta">💳 Tarjeta / POS</option>
                      <option value="bizum">📱 Bizum Móvil</option>
                    </select>
                  </div>

                  {/* Pricing recap */}
                  <div className="space-y-1 flex flex-col items-end justify-center pr-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase leading-none">TOTAL A REGISTRAR :</span>
                    <span className="text-xl font-bold text-slate-950 font-mono tracking-tight">${scannedTotal.toFixed(2)}</span>
                  </div>

                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-250/50">
                  <button
                    type="button"
                    onClick={handleResetScanner}
                    className="py-2 px-4 bg-white hover:bg-slate-100 text-slate-705 text-xs font-bold rounded-lg border transition cursor-pointer"
                  >
                    Borrar Análisis
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveScannedSales}
                    className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4 text-white" />
                    CONFIRMAR E INCORPORAR VENTA
                  </button>
                </div>

              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

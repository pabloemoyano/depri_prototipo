import React, { useState, useRef } from "react";
import { Lock, LogIn, ExternalLink, Loader2, Mail, UserPlus, Eye, EyeOff, UploadCloud, Trash2, Image as ImageIcon } from "lucide-react";
import { auth, googleProvider } from "../lib/firebase";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { motion, AnimatePresence } from "motion/react";
// @ts-ignore
import deprimeraLogo from "../assets/images/deprimera_logo_1780923105846.png";

interface LoginScreenProps {
  onLogin: (username: string) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Storage and upload capabilities for custom app logo
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    return localStorage.getItem("barstock_app_custom_logo") || null;
  });
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load latest logo on mount and listen to changes
  React.useEffect(() => {
    const fetchLogo = async () => {
      try {
        const resp = await fetch("/api/settings/logo");
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.hasOwnProperty("customLogo")) {
            if (data.customLogo) {
              setCustomLogo(data.customLogo);
              localStorage.setItem("barstock_app_custom_logo", data.customLogo);
            } else {
              // If server has no logo, check if local storage has one, if so, upload it
              const localLogo = localStorage.getItem("barstock_app_custom_logo");
              if (localLogo) {
                await fetch("/api/settings/logo", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ customLogo: localLogo })
                });
                window.dispatchEvent(new Event("custom_logo_updated"));
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fetching settings logo in LoginScreen:", err);
      }
    };
    fetchLogo();
    
    const handleUpdate = () => {
      setCustomLogo(localStorage.getItem("barstock_app_custom_logo") || null);
    };
    window.addEventListener("custom_logo_updated", handleUpdate);
    return () => {
      window.removeEventListener("custom_logo_updated", handleUpdate);
    };
  }, []);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona un formato de imagen válido (PNG, JPG, JPEG, SVG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // We downscale to maximum 350px width/height to make sure it's crisp but tiny in size (typically ~15-30KB)
        const maxDim = 350;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          
          // Export as optimized transperant png or compressed jpeg depending on file type
          const isTransparent = file.type === "image/png" || file.type === "image/svg+xml" || file.type.includes("icon");
          const compressedBase64 = canvas.toDataURL(isTransparent ? "image/png" : "image/jpeg", 0.75);
          
          localStorage.setItem("barstock_app_custom_logo", compressedBase64);
          setCustomLogo(compressedBase64);
          
          // Force central server update
          fetch("/api/settings/logo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customLogo: compressedBase64 })
          })
          .then(async (resp) => {
            if (!resp.ok) {
              const errText = await resp.text();
              console.error("Server rejected logo set:", errText);
            } else {
              window.dispatchEvent(new Event("custom_logo_updated"));
            }
          })
          .catch((err) => {
            console.error("Error sending compressed logo to server:", err);
          });
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemoveLogo = async () => {
    if (window.confirm("¿Seguro que deseas restablecer el logotipo? Se usará el predeterminado.")) {
      localStorage.removeItem("barstock_app_custom_logo");
      setCustomLogo(null);
      
      // Clear logo on central server database
      try {
        await fetch("/api/settings/logo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customLogo: null })
        });
        window.dispatchEvent(new Event("custom_logo_updated"));
      } catch (err) {
        console.error("Error clearing custom logo on server:", err);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorText("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        onLogin(result.user.displayName || result.user.email || "Usuario");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.message?.includes("missing initial state") || err.message?.includes("inaccessible")) {
        setErrorText("El navegador bloqueó el inicio de sesión cruzado (típico en Brave Shields o modo Incógnito). Por favor, abre la app en una nueva pestaña usando el botón de abajo, o desactiva la protección de rastreo.");
      } else if (err.code === "auth/popup-closed-by-user") {
        setErrorText("La ventana emergente de inicio de sesión fue cerrada.");
      } else {
        setErrorText("Error al iniciar sesión con Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    
    try {
      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName });
        onLogin(displayName || email);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        onLogin(result.user.displayName || result.user.email || "Usuario");
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setErrorText("Email o contraseña incorrectos.");
      } else if (err.code === "auth/email-already-in-use") {
        setErrorText("Este email ya está registrado.");
      } else if (err.code === "auth/weak-password") {
        setErrorText("La contraseña es muy débil.");
      } else {
        setErrorText("Ocurrió un error en la autenticación.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans select-none">
      
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-12 space-y-6">
        
        <div className="text-center space-y-3 flex flex-col items-center">
          <div className="relative w-32 h-32 transform hover:scale-105 transition duration-350 cursor-pointer group" onClick={() => setShowCustomizer(!showCustomizer)}>
            {customLogo ? (
              <img
                src={customLogo}
                alt="Logotipo Principal"
                className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(16,185,129,0.3)] bg-slate-950/20 p-2 rounded-2xl border border-slate-800/30"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-slate-950/40 hover:bg-slate-950/60 rounded-2xl border-2 border-dashed border-slate-700/60 hover:border-emerald-500/50 flex flex-col items-center justify-center p-4 transition duration-300">
                <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-emerald-400 mb-1.5 transition duration-300" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 group-hover:text-slate-300 transition duration-300 text-center">
                  Cargar Logo
                </span>
              </div>
            )}
            {customLogo ? (
              <div 
                className="absolute -bottom-1 -right-1 bg-slate-950/80 hover:bg-slate-900 border border-slate-700/50 text-slate-400 hover:text-emerald-400 p-2 rounded-full shadow-lg transition opacity-50 group-hover:opacity-100 animate-fade-in"
                title="Cambiar logotipo"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </div>
            ) : (
              <div className="absolute -bottom-2 -right-2 bg-emerald-600/90 text-[8px] font-black uppercase text-white tracking-widest px-2 py-1 rounded-md shadow-md animate-pulse">
                Click Aquí
              </div>
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black uppercase text-white tracking-widest font-sans">
              BarStock <span className="text-emerald-400">Pro</span>
            </h1>
            <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">
              De Primera Fútbol & Eventos - Sistema Administrativo
            </p>
          </div>
        </div>

        {/* Dynamic Logo customizer drawer/drawer section inside authentication container */}
        <div className="transition-all duration-300">
          {(showCustomizer || !customLogo) && (
            <div 
              className={`bg-slate-850 border rounded-2xl p-5 space-y-4 mb-4 transition-all duration-200 ${
                isDragging ? "border-emerald-500 bg-slate-800/80 ring-2 ring-emerald-500/20" : "border-slate-800"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Cargar Imagen de Logotipo Real
                </span>
                {customLogo && (
                  <button
                    onClick={handleRemoveLogo}
                    className="p-1 px-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg border-0 text-[9px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    Quitar Mi Logo
                  </button>
                )}
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700/80 hover:border-emerald-500/60 rounded-xl p-6 text-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/70 transition flex flex-col items-center justify-center gap-2"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                <UploadCloud className="w-8 h-8 text-slate-400 hover:text-emerald-400 transition" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white">
                    Arrastra tu imagen de 'De Primera' o haz clic para cargar
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Soporta PNG, JPG, JPEG, SVG (Se guarda en tu navegador)
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold bg-slate-900/20 p-2.5 rounded-lg border border-slate-800/40">
                <span>¿Ya cargaste el logotipo original?</span>
                <button 
                  onClick={() => setShowCustomizer(false)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[9px] uppercase px-3 py-1 rounded-md border-0 cursor-pointer shadow-sm ml-2"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-850/90 border border-slate-700/50 rounded-2xl shadow-2xl p-6 md:p-8 backdrop-blur-md space-y-6">
          
          <div className="flex bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/40">
            <button
              onClick={() => setIsRegistering(false)}
              className={`flex-1 py-2 text-center text-[10px] font-black tracking-wider uppercase rounded-lg transition cursor-pointer ${
                !isRegistering ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setIsRegistering(true)}
              className={`flex-1 py-2 text-center text-[10px] font-black tracking-wider uppercase rounded-lg transition cursor-pointer ${
                isRegistering ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              Crear Acceso
            </button>
          </div>

          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-white text-lg font-bold">
                {isRegistering ? "Unirse al Equipo" : "Acceso Compartido"}
              </h2>
              <p className="text-slate-400 text-[11px] font-medium leading-relaxed">
                {isRegistering 
                  ? "Crea una cuenta para colaborar con tu equipo en tiempo real."
                  : "Inicia sesión para acceder a la base de datos compartida del bar."}
              </p>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isRegistering && (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">Nombre:</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full text-xs text-white font-semibold bg-slate-800/60 pl-10 pr-4 py-3 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">Email:</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full text-xs text-white font-semibold bg-slate-800/60 pl-10 pr-4 py-3 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">Contraseña:</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs text-white font-semibold bg-slate-800/60 pl-10 pr-10 py-3 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorText && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-[11px] font-bold text-center">
                {errorText}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isRegistering ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Crear Registro</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Acceder</span>
                </>
              )}
            </button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700/50"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black text-slate-500"><span className="bg-slate-850 px-3 tracking-widest">o bien</span></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-xl bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs uppercase tracking-widest transition shadow-lg flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
            <span>Usar Google Account</span>
          </button>

          <div className="pt-2">
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-indigo-400 hover:text-indigo-300 font-bold text-[10px] uppercase tracking-wider transition border border-slate-700/65 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Abrir en Nueva Tab</span>
            </a>
          </div>
        </div>

        <p className="text-[10.5px] text-slate-500 font-semibold text-center mt-6">
          🔐 Sincronización colaborativa vía Google Firebase Cloud.
        </p>

      </div>
    </div>
  );
}


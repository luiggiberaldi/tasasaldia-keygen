import React, { useState, useEffect } from 'react';
import { Shield, Fingerprint, Lock } from 'lucide-react';

export default function LoginView({ onLogin, onBioLogin, onEnableBio, lockoutTime, failedAttempts }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [bioError, setBioError] = useState(false);

  const isLocked = lockoutTime && lockoutTime > Date.now();

  useEffect(() => {
    if (!isLocked) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTime, isLocked]);

  useEffect(() => {
    // Attempt auto-login if they have bio enabled
    if (localStorage.getItem('em_bio_enabled') && window.PublicKeyCredential && !isLocked) {
       handleBioAuth();
    }
  }, [isLocked]);

  const handleBioAuth = async () => {
     setBioError(false);
     const ok = await onBioLogin();
     if (!ok) {
       setBioError(true);
       setTimeout(() => setBioError(false), 2000);
     }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return;

    if (onLogin(pin)) {
      setError(false);
      // Ask to enroll if not enrolled yet
      if (window.PublicKeyCredential && !localStorage.getItem('em_bio_enabled')) {
         const wantsBio = window.confirm('¿Deseas activar el inicio con huella/FaceID para la próxima vez?');
         if (wantsBio) {
             await onEnableBio();
         }
      }
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
      <div className="w-full max-w-sm glass rounded-[2.5rem] p-8 animate-slide-up">
        <div className="flex flex-col items-center mb-8">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border transition-colors ${isLocked ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400'}`}>
            {isLocked ? <Lock size={32} /> : <Shield size={32} />}
          </div>
          <h1 className="text-xl font-black text-white italic tracking-tight">
            ACCESO <span className={isLocked ? "text-rose-500" : "text-yellow-400"}>{isLocked ? "BLOQUEADO" : "RESTRINGIDO"}</span>
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mt-1">
            Estación Maestra v2.0
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••"
              disabled={isLocked}
              className={`
                w-full bg-slate-900/50 border-2 rounded-2xl px-4 py-4 text-center text-2xl tracking-[0.5em] text-white focus:outline-none transition-all
                ${error || isLocked ? 'border-rose-500/50' : 'border-white/5 focus:border-yellow-400/50'}
                ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
                ${error ? 'shake' : ''}
              `}
              autoFocus
            />
          </div>
          
          {isLocked ? (
             <div className="btn-secondary w-full flex items-center justify-center gap-2 cursor-not-allowed opacity-80 border-rose-500/20 text-rose-400 h-14">
               <Lock size={16} /> Reintentar en {timeLeft}s
             </div>
          ) : (
             <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">
                Desbloquear
              </button>
              {window.PublicKeyCredential && (
                <button 
                  type="button"
                  onClick={handleBioAuth}
                  className={`w-14 h-14 bg-slate-900/50 border rounded-2xl flex items-center justify-center transition-all ${bioError ? 'border-rose-500/50 text-rose-500 shake' : 'border-white/5 text-slate-400 hover:text-emerald-400 hover:border-emerald-400/30 shadow-lg shadow-emerald-500/5'}`}
                  title="Usar Huella / FaceID"
                >
                  <Fingerprint className="size-6" />
                </button>
              )}
            </div>
          )}
        </form>
        
        {failedAttempts > 0 && !isLocked && (
          <p className="text-center text-[10px] text-rose-400/70 font-bold uppercase tracking-widest mt-6">
            Intentos fallidos: {failedAttempts}/3
          </p>
        )}

        <p className="text-center text-[10px] text-slate-600 font-medium uppercase tracking-widest mt-8">
          Authorized Personnel Only
        </p>
      </div>
    </div>
  );
}

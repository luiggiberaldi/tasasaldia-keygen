import React, { useState, useEffect } from 'react';
import { Key, Smartphone, Copy, Check, Send } from 'lucide-react';
import { PRODUCTS, hashDeviceId } from '../utils/license';
import { supabase } from '../services/supabase';

export default function GeneratorView() {
  const [currentProduct, setCurrentProduct] = useState('tasas');
  const [deviceId, setDeviceId] = useState('');
  const [licenseType, setLicenseType] = useState('demo7'); // demo7 or permanent
  const [result, setResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-detect product from prefix
  useEffect(() => {
    const v = deviceId.trim().toUpperCase();
    if (v.startsWith('TAS') && currentProduct !== 'tasas') setCurrentProduct('tasas');
    if (v.startsWith('PDA') && currentProduct !== 'bodega') setCurrentProduct('bodega');
    if (v.startsWith('CRP') && currentProduct !== 'comida_rapida') setCurrentProduct('comida_rapida');
  }, [deviceId]);

  const handleGenerate = async () => {
    if (!deviceId.trim()) return;
    setIsGenerating(true);
    
    try {
      const product = PRODUCTS[currentProduct];
      const code = await hashDeviceId(deviceId.trim().toUpperCase(), product.salt);
      
      let expiresAt = null;
      if (licenseType === 'demo7') {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
      }

      const { data, error } = await supabase.from('licenses').insert([
        {
          device_id: deviceId.trim().toUpperCase(),
          code: code,
          product_id: currentProduct,
          type: licenseType,
          expires_at: expiresAt?.toISOString() || null,
          active: true
        }
      ]);

      if (error) throw error;
      
      setResult(code);
    } catch (err) {
      console.error(err);
      alert('Error al generar licencia');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Product Selection */}
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(PRODUCTS).map(([id, p]) => (
          <button
            key={id}
            onClick={() => setCurrentProduct(id)}
            className={`
              flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all
              ${currentProduct === id 
                ? 'bg-slate-900 border-yellow-400/50 text-white shadow-lg' 
                : 'bg-slate-900/40 border-white/5 text-slate-500 hover:border-white/10'}
            `}
          >
            <span className="text-[10px] font-black uppercase tracking-tighter opacity-80">{p.shortName}</span>
          </button>
        ))}
      </div>

      {/* Generator Card */}
      <div className="glass-card space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-400/10 flex items-center justify-center border border-yellow-400/20">
            <Smartphone size={18} className="text-yellow-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-tight">ID del Dispositivo</h2>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Introducir serial ID del cliente</p>
          </div>
        </div>

        <input
          type="text"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          placeholder="TASAS-XXXX"
          className="w-full bg-slate-950 border-2 border-white/5 rounded-xl px-4 py-4 text-xl font-mono font-bold text-white focus:outline-none focus:border-yellow-400/50 transition-all placeholder:text-slate-800"
        />

        <div className="flex gap-2">
          {[
            { id: 'demo7', label: 'Demo (7 días)' },
            { id: 'permanent', label: 'Permanente' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setLicenseType(t.id)}
              className={`
                flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all
                ${licenseType === t.id 
                  ? 'bg-slate-800 border-white/10 text-white shadow-md' 
                  : 'bg-slate-950/50 border-white/5 text-slate-500'}
              `}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button 
          onClick={handleGenerate}
          disabled={!deviceId.trim() || isGenerating}
          className="btn-primary w-full disabled:opacity-20 flex items-center justify-center gap-2 group"
        >
          {isGenerating ? (
             <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Key size={14} strokeWidth={3} className="group-hover:rotate-12 transition-transform" />
          )}
          {isGenerating ? 'Generando...' : 'Generar Licencia'}
        </button>
      </div>

      {/* Result Card */}
      {result && (
        <div className="glass rounded-3xl p-6 border-2 border-emerald-500/30 animate-fade-in text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-2 border border-emerald-500/20">
            <Check size={24} className="text-emerald-500" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Código Generado</h3>
          <div className="bg-slate-950/80 rounded-2xl px-6 py-4 border border-white/5">
            <span className="text-3xl font-mono font-black text-white tracking-[0.1em]">{result}</span>
          </div>
          <div className="flex gap-2">
             <button 
              onClick={copyToClipboard}
              className="flex-1 btn-secondary flex items-center justify-center gap-2 h-12"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button className="flex-1 bg-sky-500 text-slate-950 font-black uppercase text-[10px] tracking-widest rounded-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all h-12">
              <Send size={14} strokeWidth={3} /> WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

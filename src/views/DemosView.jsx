import React, { useState, useEffect } from 'react';
import { Search, Clock, Trash2, Smartphone, RefreshCw, AlertTriangle, ShieldAlert, Crown } from 'lucide-react';
import { supabase } from '../services/supabase';
import { PRODUCTS } from '../utils/license';

export default function DemosView() {
  const [demos, setDemos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [aliasConfirm, setAliasConfirm] = useState(null);
  const [aliasInput, setAliasInput] = useState('');

  const fetchDemos = async () => {
    setIsLoading(true);
    try {
      // Auto-desactivar demos vencidos antes de cargar la lista
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deactivate-expired-demos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });
      } catch (e) { /* silencioso */ }


      const { data, error } = await supabase
        .from('demos')
        .select('*')
        .order('expires_at', { ascending: true });

      if (error) throw error;

      // Enriquecer demos con ip_address de la tabla licenses
      // NOTA: last_seen_at solo se usa del demo si existe (proviene de heartbeat real)
      // La tabla licenses tiene last_seen_at contaminado por triggers del sistema
      const { data: licenses } = await supabase
        .from('licenses')
        .select('device_id, product_id, type, last_seen_at, ip_address, created_at, client_name');

      const licenseMap = {};
      (licenses || []).forEach(l => {
        licenseMap[`${l.device_id}__${l.product_id}`] = l;
      });

      const enriched = (data || []).map(demo => {
        const lic = licenseMap[`${demo.device_id}__${demo.product_id}`];
        // Solo usar last_seen_at de licenses si es diferente a created_at 
        // (indica que un heartbeat real lo actualizo, no un trigger del sistema)
        let licLastSeen = null;
        if (lic?.last_seen_at && lic?.created_at) {
          const seenTime = new Date(lic.last_seen_at).getTime();
          const createdTime = new Date(lic.created_at).getTime();
          // Si hay mas de 60 segundos de diferencia, es un heartbeat real
          if (Math.abs(seenTime - createdTime) > 60000) {
            licLastSeen = lic.last_seen_at;
          }
        }
        return {
          ...demo,
          last_seen_at: demo.last_seen_at || licLastSeen || null,
          ip_address: demo.ip_address || lic?.ip_address || null,
          client_name: demo.client_name || lic?.client_name || null,
          _licenseType: lic?.type || null,
        };
      })
      // Excluir demos cuya licencia ya fue promovida a permanente
      .filter(demo => demo._licenseType !== 'permanent');

      setDemos(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDemos();
  }, []);

  const handleRevoke = async (deviceId, productId) => {
    if (!confirm(`¿Anular permanentemente el demo de ${deviceId}?\n\nEsto lo enviará a vencidos y bloqueará nuevas pruebas de este dispositivo.`)) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('revoke_demo_secure', {
        p_device_id: deviceId,
        p_product_id: productId
      });

      if (error) throw error;
      fetchDemos();
    } catch (err) {
      console.error(err);
      alert('Error al anular demo');
      setIsLoading(false);
    }
  };

  const handleActivatePermanent = async (deviceId, productId) => {
    if (!confirm(`Activar licencia PERMANENTE para ${deviceId}?\n\nEsto reactivara el dispositivo con acceso ilimitado.`)) return;
    setIsLoading(true);
    try {
      // 1. Usar el RPC existente para hacer permanente
      const { error } = await supabase.rpc('admin_make_permanent_secure', {
        p_device_id: deviceId,
        p_product_id: productId
      });
      if (error) throw error;

      // 2. Asegurar que la licencia este activa
      await supabase
        .from('licenses')
        .update({ active: true, type: 'permanent', expires_at: null })
        .eq('device_id', deviceId)
        .eq('product_id', productId);

      fetchDemos();
    } catch (err) {
      console.error(err);
      alert('Error al activar licencia permanente: ' + (err.message || err));
      setIsLoading(false);
    }
  };

  const handleEditAlias = (demo) => {
    setAliasInput(demo.alias || '');
    setAliasConfirm(demo);
  };

  const executeSaveAlias = async () => {
    if (!aliasConfirm) return;
    setIsLoading(true);
    try {
      const trimmedAlias = aliasInput.trim() || null;
      const { error } = await supabase
        .from('demos')
        .update({ alias: trimmedAlias })
        .eq('device_id', aliasConfirm.device_id)
        .eq('product_id', aliasConfirm.product_id);
      
      if (error) throw error;
      setAliasConfirm(null);
      fetchDemos();
    } catch (err) {
      console.error(err);
      alert('Error al guardar el nombre/alias');
      setIsLoading(false);
    }
  };

  const filtered = demos.filter(d => 
    d.device_id.toLowerCase().includes(search.toLowerCase()) ||
    (d.alias && d.alias.toLowerCase().includes(search.toLowerCase())) ||
    (d.client_name && d.client_name.toLowerCase().includes(search.toLowerCase()))
  );

  const now = new Date();
  const activeDemos = filtered.filter(d => new Date(d.expires_at) >= now);
  const expiredDemos = filtered.filter(d => new Date(d.expires_at) < now);

  return (
    <div className="space-y-4 animate-slide-up">
       <div className="glass rounded-2xl p-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Buscar demo..."
            className="w-full bg-slate-950/50 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-yellow-400/30 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={fetchDemos} className="p-3 glass rounded-xl text-yellow-400 active:scale-95 transition-all">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="text-center py-20 animate-pulse">
             <Clock className="mx-auto mb-2 text-slate-700" size={40} />
             <p className="text-[10px] uppercase font-black text-slate-700">Calculando tiempos...</p>
          </div>
        ) : (
          <>
            {/* Activos */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Demos Activos ({activeDemos.length})
              </h3>
              {activeDemos.length === 0 ? (
                <div className="glass rounded-2xl p-6 text-center text-slate-500 text-xs font-bold border border-emerald-500/10">No hay demos en curso</div>
              ) : (
                <div className="grid gap-2">
                  {activeDemos.map(d => (
                    <DemoCard key={`${d.device_id}-${d.product_id}`} demo={d} onRevoke={handleRevoke} onEditAlias={() => handleEditAlias(d)} onActivatePermanent={handleActivatePermanent} />
                  ))}
                </div>
              )}
            </div>

            {/* Vencidos */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                Demos Vencidos ({expiredDemos.length})
              </h3>
              {expiredDemos.length === 0 ? (
                <div className="glass rounded-2xl p-6 text-center text-slate-600 text-[10px] font-bold border border-rose-500/5">Sin historiales de vencimiento</div>
              ) : (
                <div className="grid gap-2 opacity-80">
                  {expiredDemos.map(d => (
                    <DemoCard key={`${d.device_id}-${d.product_id}`} demo={d} onRevoke={handleRevoke} onEditAlias={() => handleEditAlias(d)} onActivatePermanent={handleActivatePermanent} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Alias Modal */}
      {aliasConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl shadow-emerald-500/10">
            <h3 className="font-black text-white tracking-widest uppercase mb-2">Asignar Nombre a Demo</h3>
            <p className="text-slate-400 text-xs mb-4">
              Identifica el equipo <strong className="text-white font-mono">{aliasConfirm.device_id}</strong>
            </p>
            <input 
              type="text"
              autoFocus
              className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-all mb-6"
              placeholder="Ej. Laptop Producción"
              value={aliasInput}
              onChange={e => setAliasInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && executeSaveAlias()}
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setAliasConfirm(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={executeSaveAlias}
                className="flex-1 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase text-[10px] tracking-widest hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getActivityStatus(lastActiveStr) {
  if (!lastActiveStr) return { color: 'bg-slate-500', text: 'Desconectado', label: 'bg-slate-500/10 text-slate-400 border-slate-500/20'};
  const diffMins = Math.floor((new Date() - new Date(lastActiveStr)) / 60000);
  if (diffMins < 15) return { color: 'bg-emerald-500', text: 'En línea', label: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return { color: 'bg-yellow-400', text: diffHours === 0 ? `Hace ${diffMins}m` : `Hace ${diffHours}h`, label: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' };
  return { color: 'bg-rose-500', text: `Hace ${Math.floor(diffHours / 24)}d`, label: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
}

function DemoCard({ demo, onRevoke, onEditAlias, onActivatePermanent }) {
  const p = PRODUCTS[demo.product_id] || { color: '#94a3b8', shortName: demo.product_id };
  const expiresAt = new Date(demo.expires_at);
  const now = new Date();
  const isExpired = expiresAt < now;
  const activity = getActivityStatus(demo.last_seen_at || demo.last_active_at);
  
  const diffMs = Math.abs(expiresAt - now);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return (
    <div className="glass-card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center relative">
            <Smartphone size={18} className="text-slate-500" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950" style={{ backgroundColor: p.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-black text-white font-mono tracking-tight flex items-center gap-2">
              <span>{demo.client_name || demo.alias || demo.device_id}</span>
              {(demo.client_name || demo.alias) && (
                <span className="text-[10px] font-normal text-slate-500">
                  ({demo.device_id})
                </span>
              )}
              <button 
                onClick={onEditAlias}
                className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer" 
                title="Renombrar demo"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: p.color }}>{p.shortName}</p>
              <span className="text-white/20 text-[10px]">&bull;</span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border flex items-center gap-1.5 ${activity.label}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${activity.color} ${activity.color === 'bg-emerald-500' ? 'animate-pulse' : ''}`} />
                {activity.text}
              </span>
              {(demo.ip_address || demo.last_ip) && (
                <>
                  <span className="text-white/20 text-[10px] hidden sm:inline-block">&bull;</span>
                  <span className="text-[9px] font-mono text-slate-500">
                    IP: <span className="text-slate-300">{demo.ip_address || demo.last_ip}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <span className={`
          px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border
          ${isExpired 
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}
        `}>
          {isExpired ? 'Vencido' : 'Activo'}
        </span>
      </div>

      <div className="flex items-center justify-between bg-slate-950/50 rounded-xl px-4 py-3 border border-white/5 mt-1">
        <div className="flex items-center gap-2">
          <Clock size={14} className={isExpired ? 'text-rose-400' : 'text-slate-500'} />
          <span className={`text-[11px] font-black uppercase tracking-widest ${isExpired ? 'text-rose-400' : 'text-slate-300'}`}>
            {isExpired ? `Hace ${days} Días` : `En ${days} Días`}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {isExpired && onActivatePermanent && (
            <button 
              onClick={() => onActivatePermanent(demo.device_id, demo.product_id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500 hover:text-white rounded-lg transition-all text-[9.5px] font-black uppercase tracking-wider"
              title="Activar licencia permanente"
            >
              <Crown size={12} /> Permanente
            </button>
          )}
          {!isExpired && (
            <button 
              onClick={() => onRevoke(demo.device_id, demo.product_id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-lg transition-all text-[9.5px] font-black uppercase tracking-wider"
              title="Cancelar y vencer demo inmediatamente"
            >
              <ShieldAlert size={12} /> Anular Demo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

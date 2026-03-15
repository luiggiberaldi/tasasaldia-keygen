import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Smartphone, Trash2, Play, Crown, Users } from 'lucide-react';
import { supabase } from '../services/supabase';
import { PRODUCTS, hashDeviceId } from '../utils/license';

export default function InstallationsView() {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [aliasConfirm, setAliasConfirm] = useState(null);
  const [aliasInput, setAliasInput] = useState('');

  const fetchDevices = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('licenses')
        .select('*')
        .eq('type', 'registered')
        .order('last_seen_at', { ascending: false, nullsFirst: false });

      if (productFilter !== 'all') query = query.eq('product_id', productFilter);
      if (search) query = query.or(`device_id.ilike.%${search}%,alias.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      setDevices(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, [search, productFilter]);

  const handleActivateDemo = async (device) => {
    setActionLoading(device.id);
    try {
      const product = PRODUCTS[device.product_id];
      if (!product) throw new Error('Producto no encontrado');
      const code = await hashDeviceId(device.device_id, product.salt);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase.rpc('admin_activate_demo_secure', {
        p_device_id: device.device_id,
        p_product_id: device.product_id,
        p_code: code,
        p_expires_at: expiresAt.toISOString()
      });

      if (error) throw error;
      fetchDevices();
    } catch (err) {
      console.error(err);
      alert('Error al activar demo');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMakePermanent = async (device) => {
    setActionLoading(device.id);
    try {
      const product = PRODUCTS[device.product_id];
      if (!product) throw new Error('Producto no encontrado');
      const code = await hashDeviceId(device.device_id, product.salt);

      const { error } = await supabase.rpc('admin_make_permanent_secure', {
        p_device_id: device.device_id,
        p_product_id: device.product_id,
        p_code: code
      });

      if (error) throw error;
      fetchDevices();
    } catch (err) {
      console.error(err);
      alert('Error al activar licencia');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (device) => {
    if (!confirm(`¿Eliminar registro de ${device.device_id}?\nEl equipo podrá volver a registrarse al abrir la app.`)) return;
    try {
      const { error } = await supabase.rpc('admin_delete_record_secure', {
        p_device_id: device.device_id,
        p_product_id: device.product_id
      });
      if (error) throw error;
      fetchDevices();
    } catch (err) {
      alert('Error al eliminar');
    }
  };

  const handleEditAlias = (device) => {
    setAliasInput(device.alias || '');
    setAliasConfirm(device);
  };

  const executeSaveAlias = async () => {
    if (!aliasConfirm) return;
    try {
      await supabase.from('licenses')
        .update({ alias: aliasInput.trim() || null })
        .eq('id', aliasConfirm.id);
      setAliasConfirm(null);
      fetchDevices();
    } catch (err) {
      alert('Error al guardar alias');
    }
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Search & Filters */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Buscar dispositivo..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-400/50 transition-all shadow-inner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchDevices}
            className="flex items-center justify-center bg-slate-950 border border-white/10 rounded-xl px-4 text-yellow-400 hover:bg-yellow-400/10 hover:border-yellow-400/30 transition-all"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="relative">
          <Smartphone size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <select 
            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-2 py-2.5 text-[10px] font-black uppercase text-white focus:outline-none focus:border-yellow-400/50 transition-all appearance-none"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
          >
            <option value="all" className="bg-slate-900">Todos los productos</option>
            {Object.entries(PRODUCTS).map(([id, p]) => (
              <option key={id} value={id} className="bg-slate-900">{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Count */}
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
        <span className="text-violet-400">{devices.length}</span> dispositivos sin licencia
      </p>

      {/* List */}
      <div className="space-y-2 min-h-[300px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <RefreshCw className="animate-spin mb-3" size={32} />
            <p className="text-[10px] uppercase font-black tracking-widest">Cargando...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-20 text-slate-600 glass rounded-3xl">
            <Users className="mx-auto mb-3 opacity-20" size={48} />
            <p className="text-xs font-bold">No hay dispositivos registrados sin licencia</p>
            <p className="text-[10px] text-slate-700 mt-1">Apareceran aqui al abrir la app por primera vez</p>
          </div>
        ) : (
          devices.map((d) => {
            const p = PRODUCTS[d.product_id] || { color: '#94a3b8', shortName: d.product_id };
            const activity = getActivityStatus(d.last_seen_at);
            const isLoading = actionLoading === d.id;

            return (
              <div key={d.id} className="glass-card group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5 relative shrink-0">
                    <Smartphone size={20} className="text-slate-400" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950" style={{ backgroundColor: p.color }} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <h3 className="font-mono text-[13px] font-black text-white leading-none tracking-tight flex items-center gap-2">
                        <span>{d.alias || d.device_id}</span>
                        {d.alias && <span className="text-[10px] font-normal text-slate-500 hidden sm:inline-block">({d.device_id})</span>}
                        <button onClick={() => handleEditAlias(d)} className="text-slate-500 hover:text-emerald-400 transition-colors" title="Renombrar">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                      </h3>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase border bg-violet-500/10 text-violet-400 border-violet-500/20">
                        Sin Licencia
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: p.color }}>{p.shortName}</p>
                      <span className="text-white/20 text-[10px]">&bull;</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border flex items-center gap-1.5 ${activity.label}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${activity.color} ${activity.color === 'bg-emerald-500' ? 'animate-pulse' : ''}`} />
                        {activity.text}
                      </span>
                      {d.ip_address && (
                        <>
                          <span className="text-white/20 text-[10px] hidden sm:inline-block">&bull;</span>
                          <span className="text-[9px] font-mono text-slate-500">IP: <span className="text-slate-300">{d.ip_address}</span></span>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest italic shrink-0">
                    {d.created_at ? new Date(d.created_at).toLocaleDateString() : ''}
                  </p>
                </div>

                {/* Admin Actions */}
                <div className="flex gap-1.5 mt-2 pt-2 border-t border-white/5">
                  <button 
                    onClick={() => handleActivateDemo(d)}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider hover:bg-amber-500/20 transition-all disabled:opacity-50"
                  >
                    <Play size={10} /> Activar Demo (7d)
                  </button>
                  <button 
                    onClick={() => handleMakePermanent(d)}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] font-black uppercase tracking-wider hover:bg-sky-500/20 transition-all disabled:opacity-50"
                  >
                    <Crown size={10} /> Permanente
                  </button>
                  <button 
                    onClick={() => handleDelete(d)}
                    className="p-2 text-rose-400/50 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                    title="Eliminar registro"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Alias Modal */}
      {aliasConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl shadow-emerald-500/10">
            <h3 className="font-black text-white tracking-widest uppercase mb-2">Asignar Nombre</h3>
            <p className="text-slate-400 text-xs mb-4">
              Identifica el equipo <strong className="text-white font-mono">{aliasConfirm.device_id}</strong>
            </p>
            <input 
              type="text"
              autoFocus
              className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-all mb-6"
              placeholder="Ej. Celular Cliente Pedro"
              value={aliasInput}
              onChange={e => setAliasInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && executeSaveAlias()}
            />
            <div className="flex gap-3">
              <button onClick={() => setAliasConfirm(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all">Cancelar</button>
              <button onClick={executeSaveAlias} className="flex-1 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase text-[10px] tracking-widest hover:bg-emerald-500 hover:text-white transition-all">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getActivityStatus(lastActiveStr) {
  if (!lastActiveStr) return { color: 'bg-slate-500', text: 'Desconectado', label: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  const diffMins = Math.floor((new Date() - new Date(lastActiveStr)) / 60000);
  if (diffMins < 15) return { color: 'bg-emerald-500', text: 'En linea', label: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return { color: 'bg-yellow-400', text: diffHours === 0 ? `Hace ${diffMins}m` : `Hace ${diffHours}h`, label: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' };
  return { color: 'bg-rose-500', text: `Hace ${Math.floor(diffHours / 24)}d`, label: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
}

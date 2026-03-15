import React, { useState, useEffect } from 'react';
import { Search, Filter, ShieldCheck, ShieldAlert, FileText, ChevronLeft, ChevronRight, RefreshCw, Smartphone, Trash2, Play, Crown, Clock } from 'lucide-react';
import { supabase } from '../services/supabase';
import { PRODUCTS, hashDeviceId } from '../utils/license';

export default function DashboardView() {
  const [licenses, setLicenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState({ search: '', product: 'all', status: 'all' });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [revokeConfirm, setRevokeConfirm] = useState(null);
  const [aliasConfirm, setAliasConfirm] = useState(null);
  const [aliasInput, setAliasInput] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const pageSize = 100;

  const fetchLicenses = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('licenses')
        .select('*', { count: 'exact' })
        .eq('type', 'permanent');
      if (filter.product !== 'all') query = query.eq('product_id', filter.product);
      if (filter.status === 'active') query = query.eq('active', true);
      if (filter.status === 'revoked') query = query.eq('active', false);
      if (filter.search) {
        query = query.or(`device_id.ilike.%${filter.search}%,alias.ilike.%${filter.search}%`);
      }

      const { data, count, error } = await query
        .order('last_seen_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) throw error;
      setLicenses(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
      if (err.code === 'PGRST103' || err.code === '416') {
        setLicenses([]);
        setTotalCount(0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, [filter, page]);

  const executeRevoke = async () => {
    if (!revokeConfirm) return;
    setIsLoading(true);
    try {
      // Usar RPC seguro: borra tanto la licencia como el registro del demo
      const { error } = await supabase.rpc('admin_delete_record_secure', {
        p_device_id: revokeConfirm.device_id,
        p_product_id: revokeConfirm.product_id
      });
      if (error) throw error;
      setRevokeConfirm(null);
      fetchLicenses();
    } catch (err) {
      console.error(err);
      alert('Error al revocar la licencia');
      setIsLoading(false);
    }
  };

  const handleEditAlias = (license) => {
    setAliasInput(license.alias || '');
    setAliasConfirm(license);
  };

  const executeSaveAlias = async () => {
    if (!aliasConfirm) return;
    setIsLoading(true);
    try {
      const trimmedAlias = aliasInput.trim() || null;
      const { error } = await supabase
        .from('licenses')
        .update({ alias: trimmedAlias })
        .eq('id', aliasConfirm.id);
      
      if (error) throw error;
      setAliasConfirm(null);
      fetchLicenses();
    } catch (err) {
      console.error(err);
      alert('Error al guardar el nombre/alias');
      setIsLoading(false);
    }
  };

  // Admin actions
  const handleActivateDemo = async (license) => {
    setActionLoading(license.id);
    try {
      const product = PRODUCTS[license.product_id];
      if (!product) throw new Error('Producto no encontrado');
      const code = await hashDeviceId(license.device_id, product.salt);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase.from('licenses')
        .update({ 
          type: 'demo7', 
          active: true, 
          code,
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', license.id);
      
      if (error) throw error;

      // Also register in demos table
      await supabase.from('demos').upsert({
        device_id: license.device_id,
        product_id: license.product_id,
        expires_at: expiresAt.toISOString(),
        app_version: 'admin',
      }, { onConflict: 'device_id,product_id' });

      fetchLicenses();
    } catch (err) {
      console.error(err);
      alert('Error al activar demo');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMakePermanent = async (license) => {
    setActionLoading(license.id);
    try {
      const product = PRODUCTS[license.product_id];
      if (!product) throw new Error('Producto no encontrado');
      const code = await hashDeviceId(license.device_id, product.salt);

      const { error } = await supabase.from('licenses')
        .update({ 
          type: 'permanent', 
          active: true, 
          code,
          expires_at: null, 
        })
        .eq('id', license.id);
      
      if (error) throw error;
      fetchLicenses();
    } catch (err) {
      console.error(err);
      alert('Error al convertir a permanente');
    } finally {
      setActionLoading(null);
    }
  };

  const hasNextPage = page * pageSize < totalCount;


  return (
    <div className="space-y-4 animate-slide-up">
      {/* Filters */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Buscar dispositivo o alias..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-400/50 transition-all shadow-inner"
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            />
          </div>
          <button 
            onClick={() => fetchLicenses()}
            className="flex items-center justify-center gap-2 bg-slate-950 border border-white/10 rounded-xl px-4 text-[10px] font-black uppercase text-yellow-400 hover:bg-yellow-400/10 hover:border-yellow-400/30 transition-all"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="relative group">
            <Smartphone size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select 
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-2 py-2.5 text-[10px] font-black uppercase text-white focus:outline-none focus:border-yellow-400/50 transition-all appearance-none"
              value={filter.product}
              onChange={(e) => setFilter({ ...filter, product: e.target.value })}
            >
              <option value="all" className="bg-slate-900">Todos los productos</option>
              {Object.entries(PRODUCTS).map(([id, p]) => (
                <option key={id} value={id} className="bg-slate-900">{p.name}</option>
              ))}
            </select>
          </div>
          <div className="relative group">
            <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select 
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-2 py-2.5 text-[10px] font-black uppercase text-white focus:outline-none focus:border-yellow-400/50 transition-all appearance-none"
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="all" className="bg-slate-900">Todos</option>
              <option value="active" className="bg-slate-900">Activas</option>
              <option value="revoked" className="bg-slate-900">Revocadas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Count */}
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
        <span className="text-sky-400">{totalCount}</span> licencias permanentes
      </p>

      {/* List */}
      <div className="space-y-2 min-h-[300px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <RefreshCw className="animate-spin mb-3" size={32} />
            <p className="text-[10px] uppercase font-black tracking-widest">Sincronizando...</p>
          </div>
        ) : licenses.length === 0 ? (
          <div className="text-center py-20 text-slate-600 glass rounded-3xl">
            <FileText className="mx-auto mb-3 opacity-20" size={48} />
            <p className="text-xs font-bold">No se encontraron dispositivos</p>
          </div>
        ) : (
          licenses.map((l) => (
            <LicenseCard 
              key={l.id} 
              license={l} 
              onRevoke={() => setRevokeConfirm({ id: l.id, device_id: l.device_id, product_id: l.product_id })} 
              onEditAlias={() => handleEditAlias(l)}
              onActivateDemo={() => handleActivateDemo(l)}
              onMakePermanent={() => handleMakePermanent(l)}
              isActionLoading={actionLoading === l.id}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-4 pb-8">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
          {totalCount > 0 ? `Pagina ${page} - Total: ${totalCount}` : `Pagina ${page}`}
        </p>
        <div className="flex gap-1">
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="p-2 glass rounded-lg text-slate-400 hover:text-white disabled:opacity-20 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
             disabled={!hasNextPage}
             onClick={() => setPage(p => p + 1)}
             className="p-2 glass rounded-lg text-slate-400 hover:text-white disabled:opacity-20 transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Revoke Modal */}
      {revokeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl shadow-rose-500/10">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <ShieldAlert size={24} />
              <h3 className="font-black tracking-widest uppercase">Eliminar Registro</h3>
            </div>
            <p className="text-slate-300 text-sm mb-6">
              Eliminar el registro de <strong className="text-white font-mono">{revokeConfirm.deviceId}</strong>? El dispositivo se volvera a registrar automaticamente al abrir la app.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setRevokeConfirm(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={executeRevoke}
                className="flex-1 py-3 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold uppercase text-[10px] tracking-widest hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={12} />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
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
              placeholder="Ej. Laptop Produccion"
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
  if (diffMins < 15) return { color: 'bg-emerald-500', text: 'En linea', label: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return { color: 'bg-yellow-400', text: diffHours === 0 ? `Hace ${diffMins}m` : `Hace ${diffHours}h`, label: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' };
  return { color: 'bg-rose-500', text: `Hace ${Math.floor(diffHours / 24)}d`, label: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
}

function getTypeInfo(license) {
  if (license.type === 'permanent' && license.active) return { label: 'Permanente', style: 'bg-sky-500/10 text-sky-400 border-sky-500/20', icon: '⚡' };
  if (license.type === 'demo7' && license.active) {
    const expired = license.expires_at && new Date(license.expires_at) < new Date();
    if (expired) return { label: 'Demo Vencida', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: '⏱' };
    return { label: 'Demo', style: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: '⏳' };
  }
  if (license.type === 'registered') return { label: 'Sin Licencia', style: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: '📱' };
  if (!license.active) return { label: 'Revocada', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: '🚫' };
  return { label: license.type, style: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: '❓' };
}

function LicenseCard({ license, onRevoke, onEditAlias, onActivateDemo, onMakePermanent, isActionLoading }) {
  const p = PRODUCTS[license.product_id] || { color: '#94a3b8', shortName: license.product_id };
  const activity = getActivityStatus(license.last_seen_at);
  const typeInfo = getTypeInfo(license);
  const isRegistered = license.type === 'registered';
  const isDemo = license.type === 'demo7' && license.active;
  const isPermanent = license.type === 'permanent' && license.active;

  return (
    <div className="glass-card group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5 relative shrink-0">
          <Smartphone size={20} className="text-slate-400" />
          <div 
            className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950"
            style={{ backgroundColor: p.color }}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
             <h3 className="font-mono text-[13px] font-black text-white leading-none tracking-tight flex items-center gap-2">
              <span>{license.alias || license.client_name || license.device_id}</span>
              {license.alias && (
                <span className="text-[10px] font-normal text-slate-500 hidden sm:inline-block">
                  ({license.device_id})
                </span>
              )}
              <button 
                onClick={onEditAlias}
                className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer" 
                title="Renombrar equipo"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
            </h3>
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border flex items-center gap-1 ${typeInfo.style}`}>
              {typeInfo.label}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: p.color }}>
              {p.shortName}
            </p>
            <span className="text-white/20 text-[10px]">&bull;</span>
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border flex items-center gap-1.5 ${activity.label}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${activity.color} ${activity.color === 'bg-emerald-500' ? 'animate-pulse' : ''}`} />
              {activity.text}
            </span>
            {license.ip_address && (
              <>
                <span className="text-white/20 text-[10px] hidden sm:inline-block">&bull;</span>
                <span className="text-[9px] font-mono text-slate-500">
                  IP: <span className="text-slate-300">{license.ip_address}</span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-1.5">
          {license.code && license.code !== 'AUTO-REGISTRO' && (
            <p className="text-[10px] font-mono text-slate-400 font-bold">{license.code}</p>
          )}
          <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest italic">
            {new Date(license.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Revoke */}
      <div className="flex justify-end mt-2 pt-2 border-t border-white/5">
        <button 
          onClick={onRevoke}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all flex items-center gap-1.5 text-[9px] font-black uppercase"
          title="Revocar Licencia"
        >
          <Trash2 size={12} /> Revocar
        </button>
      </div>
    </div>
  );
}

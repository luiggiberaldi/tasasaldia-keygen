import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, RefreshCw, Smartphone, Trash2, Play, Crown, Clock, ShieldAlert, Users, Filter, Download } from 'lucide-react';
import { supabase } from '../services/supabase';
import { supabaseCloud } from '../services/supabaseCloud';
import { PRODUCTS, hashDeviceId } from '../utils/license';
import { DEMO_DAYS, RPC_TIMEOUT_MS } from '../utils/constants';
import { handleError, withTimeout } from '../utils/errors';

const TABS = [
  { id: 'permanent', label: 'Permanentes', icon: Crown, color: 'sky' },
  { id: 'demo', label: 'Demos', icon: Clock, color: 'amber' },
  { id: 'revoked', label: 'Revocadas', icon: ShieldAlert, color: 'rose' },
  { id: 'registered', label: 'Sin Licencia', icon: Users, color: 'violet' },
];

const TAB_COLORS = {
  sky: '#38bdf8',
  amber: '#f59e0b',
  rose: '#f43f5e',
  violet: '#8b5cf6',
};

export default function DashboardView() {
  const [licenses, setLicenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('permanent');
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [aliasModal, setAliasModal] = useState(null);
  const [aliasInput, setAliasInput] = useState('');
  const [counts, setCounts] = useState({ permanent: 0, demo: 0, revoked: 0, registered: 0 });

  const fetchLicenses = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('licenses').select('*');

      if (activeTab === 'permanent') {
        query = query.eq('type', 'permanent').eq('active', true);
      } else if (activeTab === 'demo') {
        query = query.eq('type', 'demo7');
      } else if (activeTab === 'revoked') {
        query = query.eq('type', 'revoked');
      } else if (activeTab === 'registered') {
        query = query.eq('type', 'registered');
      }

      if (productFilter !== 'all') query = query.eq('product_id', productFilter);
      if (search) {
        // Sanitizar: limitar longitud para evitar DoS
        const safeSearch = search.slice(0, 100);
        query = query.or(`device_id.ilike.%${safeSearch}%,alias.ilike.%${safeSearch}%,client_name.ilike.%${safeSearch}%`);
      }

      query = query
        .order('last_seen_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setLicenses(data || []);
    } catch (err) {
      handleError(err, 'DashboardView.fetchLicenses');
      setLicenses([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, productFilter, search]);

  const fetchCounts = useCallback(async () => {
    try {
      const [perm, demo, rev, reg] = await Promise.all([
        supabase.from('licenses').select('id', { count: 'exact', head: true }).eq('type', 'permanent').eq('active', true),
        supabase.from('licenses').select('id', { count: 'exact', head: true }).eq('type', 'demo7'),
        supabase.from('licenses').select('id', { count: 'exact', head: true }).eq('type', 'revoked'),
        supabase.from('licenses').select('id', { count: 'exact', head: true }).eq('type', 'registered'),
      ]);
      setCounts({
        permanent: perm.count || 0,
        demo: demo.count || 0,
        revoked: rev.count || 0,
        registered: reg.count || 0,
      });
    } catch (err) {
      handleError(err, 'DashboardView.fetchCounts');
    }
  }, []);

  useEffect(() => {
    fetchLicenses();
    fetchCounts();
  }, [fetchLicenses, fetchCounts]);

  // Refs para acceder a la versión más reciente de las funciones sin re-suscribir
  const fetchLicensesRef = useRef(fetchLicenses);
  const fetchCountsRef = useRef(fetchCounts);
  useEffect(() => { fetchLicensesRef.current = fetchLicenses; }, [fetchLicenses]);
  useEffect(() => { fetchCountsRef.current = fetchCounts; }, [fetchCounts]);

  // Suscripción realtime — solo se monta/desmonta una vez
  useEffect(() => {
    const channel = supabase
      .channel('licenses_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licenses' }, () => {
        fetchLicensesRef.current();
        fetchCountsRef.current();
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          handleError(new Error('Error en suscripción realtime'), 'DashboardView');
        }
      });

    return () => { channel.unsubscribe(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ========================
  // ACTIONS
  // ========================
  const handleAction = async (action, license) => {
    setActionLoading(license.id);
    try {
      const product = PRODUCTS[license.product_id];

      if (action === 'revoke') {
        const { error } = await withTimeout(
          supabase.rpc('admin_revoke_license_secure', {
            p_device_id: license.device_id,
            p_product_id: license.product_id,
          }),
          RPC_TIMEOUT_MS, 'Revocar licencia'
        );
        if (error) throw error;

      } else if (action === 'demo') {
        if (!product?.salt) throw new Error('Producto no encontrado');
        const code = await hashDeviceId(license.device_id, product.salt);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + DEMO_DAYS);
        const { error } = await withTimeout(
          supabase.rpc('admin_activate_demo_secure', {
            p_device_id: license.device_id,
            p_product_id: license.product_id,
            p_code: code,
            p_expires_at: expiresAt.toISOString(),
          }),
          RPC_TIMEOUT_MS, 'Activar demo'
        );
        if (error) throw error;

      } else if (action === 'permanent') {
        if (!product?.salt) throw new Error('Producto no encontrado');
        const code = await hashDeviceId(license.device_id, product.salt);
        const { error } = await withTimeout(
          supabase.rpc('admin_make_permanent_secure', {
            p_device_id: license.device_id,
            p_product_id: license.product_id,
            p_code: code,
          }),
          RPC_TIMEOUT_MS, 'Hacer permanente'
        );
        if (error) throw error;

      } else if (action === 'reset') {
        const { error } = await withTimeout(
          supabase.rpc('admin_reset_to_registered_secure', {
            p_device_id: license.device_id,
            p_product_id: license.product_id,
          }),
          RPC_TIMEOUT_MS, 'Resetear licencia'
        );
        if (error) throw error;

      } else if (action === 'download_backup') {
        if (!supabaseCloud) throw new Error('Supabase Cloud no configurado.');

        // 1. Verificar si ya existe un backup guardado
        const { data: existingBackup } = await supabaseCloud
          .from('cloud_backups')
          .select('backup_data, updated_at')
          .eq('device_id', license.device_id)
          .maybeSingle();

        let backupData = existingBackup?.backup_data || null;

        // 2. Si no hay backup previo, solicitar al dispositivo y esperar 30s
        if (!backupData) {
          const { error: reqError } = await supabaseCloud.from('backup_requests').upsert({
            device_id: license.device_id,
            status: 'pending',
            requested_at: new Date().toISOString(),
            completed_at: null,
          }, { onConflict: 'device_id' });
          if (reqError) throw new Error(`No se pudo crear la solicitud: ${reqError.message}`);

          const result = await new Promise((resolve) => {
            const timeout = setTimeout(() => { sub.unsubscribe(); resolve('timeout'); }, 30000);
            const sub = supabaseCloud
              .channel(`admin_backup_wait_${license.device_id}`)
              .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'backup_requests',
                filter: `device_id=eq.${license.device_id}`,
              }, (payload) => {
                if (payload.new?.status === 'completed') {
                  clearTimeout(timeout); sub.unsubscribe(); resolve('completed');
                }
              })
              .subscribe();
          });

          if (result === 'timeout') throw new Error('El equipo no respondió en 30 segundos. Asegúrate de que esté encendido con la app abierta y actualizada.');

          // Leer el backup recién subido
          const { data: freshBackup, error: fetchErr } = await supabaseCloud
            .from('cloud_backups').select('backup_data').eq('device_id', license.device_id).single();
          if (fetchErr) throw new Error('El equipo respondió pero no se pudo obtener el backup.');
          backupData = freshBackup.backup_data;
        }

        const raw = backupData;
        const exportData = (raw && typeof raw === 'object' && 'data' in raw)
          ? raw
          : {
              timestamp: new Date().toISOString(),
              version: '2.0',
              appName: PRODUCTS[license.product_id]?.appName || 'TasasAlDia',
              data: raw,
            };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (license.alias || license.client_name || license.device_id)
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase();
        a.download = `backup_${safeName}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setActionLoading(null);
        return;
      }

      setConfirmModal(null);
      fetchLicenses();
      fetchCounts();
    } catch (err) {
      alert(`Error: ${handleError(err, `DashboardView.${action}`)}`);
    } finally {
      setActionLoading(null);
    }
  };

  const executeSaveAlias = async () => {
    if (!aliasModal) return;
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ alias: aliasInput.trim() || null })
        .eq('id', aliasModal.id);
      if (error) throw error;
      setAliasModal(null);
      fetchLicenses();
    } catch (err) {
      alert(`Error: ${handleError(err, 'DashboardView.saveAlias')}`);
    }
  };

  // ========================
  // RENDER
  // ========================
  const now = new Date();

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 glass rounded-2xl p-1.5">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = counts[tab.id];
          const color = TAB_COLORS[tab.color];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                isActive
                  ? 'border'
                  : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
              style={isActive ? {
                backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                color,
                borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
              } : {}}
            >
              <Icon size={16} strokeWidth={2.5} />
              <span>{tab.label}</span>
              <span className={`text-[10px] ${isActive ? '' : 'text-slate-600'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="glass rounded-2xl p-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Buscar dispositivo o alias..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-400/50 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => { fetchLicenses(); fetchCounts(); }}
            className="flex items-center justify-center bg-slate-950 border border-white/10 rounded-xl px-3 text-yellow-400 hover:bg-yellow-400/10 hover:border-yellow-400/30 transition-all"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="relative">
          <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <select
            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-2 py-2 text-[10px] font-black uppercase text-white focus:outline-none focus:border-yellow-400/50 transition-all appearance-none"
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

      {/* Demo sub-sections */}
      {activeTab === 'demo' && !isLoading && licenses.length > 0 && (
        <DemoSections
          licenses={licenses}
          now={now}
          onAction={handleAction}
          onEditAlias={(l) => { setAliasInput(l.alias || ''); setAliasModal(l); }}
          actionLoading={actionLoading}
          setConfirmModal={setConfirmModal}
        />
      )}

      {/* Regular list for non-demo tabs */}
      {activeTab !== 'demo' && (
        <div className="space-y-2 min-h-[200px]">
          {isLoading ? (
            <LoadingSpinner />
          ) : licenses.length === 0 ? (
            <EmptyState tab={activeTab} />
          ) : (
            licenses.map((l) => (
              <LicenseCard
                key={l.id}
                license={l}
                tab={activeTab}
                now={now}
                onAction={(action) => {
                  if (action === 'revoke' || action === 'reset') {
                    setConfirmModal({ license: l, action });
                  } else {
                    handleAction(action, l);
                  }
                }}
                onEditAlias={() => { setAliasInput(l.alias || ''); setAliasModal(l); }}
                isActionLoading={actionLoading === l.id}
              />
            ))
          )}
        </div>
      )}

      {/* Demo loading/empty when demo tab */}
      {activeTab === 'demo' && isLoading && <LoadingSpinner />}
      {activeTab === 'demo' && !isLoading && licenses.length === 0 && <EmptyState tab="demo" />}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className={`bg-slate-900 border ${confirmModal.action === 'revoke' ? 'border-rose-500/30' : 'border-amber-500/30'} rounded-3xl p-6 max-w-sm w-full shadow-2xl`}>
            <div className={`flex items-center gap-3 ${confirmModal.action === 'revoke' ? 'text-rose-400' : 'text-amber-400'} mb-4`}>
              {confirmModal.action === 'revoke' ? <ShieldAlert size={24} /> : <Trash2 size={24} />}
              <h3 className="font-black tracking-widest uppercase">
                {confirmModal.action === 'revoke' ? 'Revocar Licencia' : 'Resetear a Sin Licencia'}
              </h3>
            </div>
            <p className="text-slate-300 text-sm mb-6">
              {confirmModal.action === 'revoke'
                ? <>Revocar la licencia de <strong className="text-white font-mono">{confirmModal.license.alias || confirmModal.license.device_id}</strong>? El dispositivo perderá el acceso premium.</>
                : <>Resetear <strong className="text-white font-mono">{confirmModal.license.alias || confirmModal.license.device_id}</strong> a estado sin licencia?</>
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                disabled={actionLoading === confirmModal?.license?.id}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleAction(confirmModal.action, confirmModal.license)}
                disabled={actionLoading === confirmModal?.license?.id}
                className={`flex-1 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  confirmModal.action === 'revoke'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500 hover:text-white'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-white'
                }`}
              >
                {actionLoading === confirmModal?.license?.id ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alias Modal */}
      {aliasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl shadow-emerald-500/10">
            <h3 className="font-black text-white tracking-widest uppercase mb-2">Asignar Nombre</h3>
            <p className="text-slate-400 text-xs mb-4">
              Identifica el equipo <strong className="text-white font-mono">{aliasModal.device_id}</strong>
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
                onClick={() => setAliasModal(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={executeSaveAlias}
                className="flex-1 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase text-[10px] tracking-widest hover:bg-emerald-500 hover:text-white transition-all"
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

// ========================
// DEMO SECTIONS (active + expired)
// ========================
function DemoSections({ licenses, now, onAction, onEditAlias, actionLoading, setConfirmModal }) {
  const activeDemos = licenses.filter(l => !l.expires_at || new Date(l.expires_at) >= now);
  const expiredDemos = licenses.filter(l => l.expires_at && new Date(l.expires_at) < now);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Demos Activos ({activeDemos.length})
        </h3>
        {activeDemos.length === 0 ? (
          <div className="glass rounded-2xl p-4 text-center text-slate-500 text-xs font-bold border border-emerald-500/10">No hay demos activos</div>
        ) : (
          activeDemos.map(l => (
            <LicenseCard
              key={l.id}
              license={l}
              tab="demo"
              now={now}
              onAction={(action) => {
                if (action === 'revoke') setConfirmModal({ license: l, action });
                else onAction(action, l);
              }}
              onEditAlias={() => onEditAlias(l)}
              isActionLoading={actionLoading === l.id}
            />
          ))
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-white/5">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          Demos Vencidos ({expiredDemos.length})
        </h3>
        {expiredDemos.length === 0 ? (
          <div className="glass rounded-2xl p-4 text-center text-slate-600 text-[10px] font-bold">Sin demos vencidos</div>
        ) : (
          <div className="opacity-80 space-y-2">
            {expiredDemos.map(l => (
              <LicenseCard
                key={l.id}
                license={l}
                tab="demo"
                now={now}
                onAction={(action) => {
                  if (action === 'revoke') setConfirmModal({ license: l, action });
                  else onAction(action, l);
                }}
                onEditAlias={() => onEditAlias(l)}
                isActionLoading={actionLoading === l.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ========================
// LICENSE CARD
// ========================
function LicenseCard({ license, tab, now, onAction, onEditAlias, isActionLoading }) {
  const p = PRODUCTS[license.product_id] || { color: '#94a3b8', shortName: license.product_id };
  const activity = getActivityStatus(license.last_seen_at);
  const typeInfo = getTypeInfo(license, now);
  const isExpiredDemo = license.type === 'demo7' && license.expires_at && new Date(license.expires_at) < now;

  let demoTimeText = null;
  if (license.type === 'demo7' && license.expires_at) {
    const expiresAt = new Date(license.expires_at);
    const diffMs = Math.abs(expiresAt - now);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    demoTimeText = isExpiredDemo
      ? `Vencida hace ${days}d ${hours}h`
      : `${days}d ${hours}h restantes`;
  }

  const actions = getAvailableActions(license, isExpiredDemo);

  return (
    <div className="glass-card group">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5 relative shrink-0">
          <Smartphone size={18} className="text-slate-400" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-952" style={{ backgroundColor: p.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <h3 className="font-mono text-[13px] font-black text-white leading-none tracking-tight flex items-center gap-2">
              <span>{license.alias || license.client_name || license.device_id}</span>
              {(license.alias || license.client_name) && (
                <span className="text-[10px] font-normal text-slate-500 hidden sm:inline-block">({license.device_id})</span>
              )}
              <button onClick={onEditAlias} className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer" title="Renombrar">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
            </h3>
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${typeInfo.style}`}>
              {typeInfo.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: p.color }}>{p.shortName}</p>
            <span className="text-white/20 text-[10px]">&bull;</span>
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border flex items-center gap-1.5 ${activity.label}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${activity.color} ${activity.color === 'bg-emerald-500' ? 'animate-pulse' : ''}`} />
              {activity.text}
            </span>
            {license.ip_address && (
              <>
                <span className="text-white/20 text-[10px] hidden sm:inline-block">&bull;</span>
                <span className="text-[9px] font-mono text-slate-500">IP: <span className="text-slate-300">{license.ip_address}</span></span>
              </>
            )}
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-1 shrink-0">
          {license.code && license.code !== 'AUTO-REGISTRO' && (
            <p className="text-[10px] font-mono text-slate-400 font-bold">{license.code}</p>
          )}
          <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest italic">
            {new Date(license.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {demoTimeText && (
        <div className="flex items-center gap-2 mt-2 bg-slate-950/50 rounded-lg px-3 py-2 border border-white/5">
          <Clock size={12} className={isExpiredDemo ? 'text-rose-400' : 'text-emerald-400'} />
          <span className={`text-[10px] font-black uppercase tracking-widest ${isExpiredDemo ? 'text-rose-400' : 'text-emerald-400'}`}>
            {demoTimeText}
          </span>
        </div>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-white/5">
          {actions.map(action => (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              disabled={isActionLoading}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-50 border ${action.className}`}
            >
              <action.icon size={10} />
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ========================
// HELPERS
// ========================
function getAvailableActions(license, isExpiredDemo) {
  const actions = [];

  if (license.type === 'registered') {
    actions.push({ id: 'demo', label: 'Demo (7d)', icon: Play, className: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' });
    actions.push({ id: 'permanent', label: 'Permanente', icon: Crown, className: 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20' });
  }

  if (license.type === 'demo7' && !isExpiredDemo) {
    actions.push({ id: 'permanent', label: 'Permanente', icon: Crown, className: 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20' });
    actions.push({ id: 'revoke', label: 'Revocar', icon: ShieldAlert, className: 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' });
  }

  if (license.type === 'demo7' && isExpiredDemo) {
    actions.push({ id: 'demo', label: 'Renovar Demo', icon: Play, className: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' });
    actions.push({ id: 'permanent', label: 'Permanente', icon: Crown, className: 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20' });
    actions.push({ id: 'revoke', label: 'Revocar', icon: ShieldAlert, className: 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' });
  }

  if (license.type === 'permanent') {
    actions.push({ id: 'download_backup', label: 'Backup', icon: Download, className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' });
    actions.push({ id: 'revoke', label: 'Revocar', icon: ShieldAlert, className: 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' });
  }

  if (license.type === 'revoked') {
    actions.push({ id: 'demo', label: 'Demo (7d)', icon: Play, className: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' });
    actions.push({ id: 'permanent', label: 'Permanente', icon: Crown, className: 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20' });
  }

  return actions;
}

function getTypeInfo(license, now) {
  if (license.type === 'permanent' && license.active) return { label: 'Permanente', style: 'bg-sky-500/10 text-sky-400 border-sky-500/20' };
  if (license.type === 'demo7') {
    const expired = license.expires_at && new Date(license.expires_at) < now;
    if (expired) return { label: 'Demo Vencida', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    return { label: 'Demo Activa', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  }
  if (license.type === 'revoked') return { label: 'Revocada', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
  if (license.type === 'registered') return { label: 'Sin Licencia', style: 'bg-violet-500/10 text-violet-400 border-violet-500/20' };
  return { label: license.type, style: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
}

function getActivityStatus(lastActiveStr) {
  if (!lastActiveStr) return { color: 'bg-slate-500', text: 'Desconectado', label: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  const diffMins = Math.floor((new Date() - new Date(lastActiveStr)) / 60000);
  if (diffMins < 15) return { color: 'bg-emerald-500', text: 'En linea', label: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return { color: 'bg-yellow-400', text: diffHours === 0 ? `Hace ${diffMins}m` : `Hace ${diffHours}h`, label: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' };
  return { color: 'bg-rose-500', text: `Hace ${Math.floor(diffHours / 24)}d`, label: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
      <RefreshCw className="animate-spin mb-3" size={32} />
      <p className="text-[10px] uppercase font-black tracking-widest">Sincronizando...</p>
    </div>
  );
}

function EmptyState({ tab }) {
  const messages = {
    permanent: 'No hay licencias permanentes',
    demo: 'No hay demos activos ni vencidos',
    revoked: 'No hay licencias revocadas',
    registered: 'No hay dispositivos sin licencia',
  };
  return (
    <div className="text-center py-16 text-slate-600 glass rounded-3xl">
      <Smartphone className="mx-auto mb-3 opacity-20" size={48} />
      <p className="text-xs font-bold">{messages[tab] || 'Sin resultados'}</p>
    </div>
  );
}

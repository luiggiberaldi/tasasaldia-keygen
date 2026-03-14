import React from 'react';
import { LogOut, LayoutDashboard, Key, Clock } from 'lucide-react';

export default function Navbar({ activeTab, onTabChange, onLogout }) {
  const tabs = [
    { id: 'generator', label: 'Generar', icon: Key },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'demos', label: 'Demos', icon: Clock },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 glass rounded-full px-2 py-2 flex items-center gap-1 z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all
              ${isActive 
                ? 'bg-yellow-400 text-slate-950 shadow-lg shadow-yellow-400/20' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'}
            `}
          >
            <Icon size={14} strokeWidth={3} />
            <span className={isActive ? 'block' : 'hidden md:block'}>{tab.label}</span>
          </button>
        );
      })}
      <div className="w-px h-6 bg-white/10 mx-1" />
      <button
        onClick={onLogout}
        className="p-2.5 text-rose-400 hover:bg-rose-500/10 rounded-full transition-all"
      >
        <LogOut size={16} strokeWidth={3} />
      </button>
    </nav>
  );
}

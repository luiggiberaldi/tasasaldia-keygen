import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import GeneratorView from './views/GeneratorView';
import DashboardView from './views/DashboardView';
import DemosView from './views/DemosView';
import LoginView from './views/LoginView';

function App() {
  const { 
    isAuthenticated, 
    isLoading, 
    login, 
    logout,
    loginWithBiometrics,
    enableBiometrics,
    lockoutTime,
    failedAttempts
  } = useAuth();
  const [activeTab, setActiveTab] = useState('generator');

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <LoginView 
        onLogin={login} 
        onBioLogin={loginWithBiometrics}
        onEnableBio={enableBiometrics}
        lockoutTime={lockoutTime}
        failedAttempts={failedAttempts}
      />
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <header className="pt-8 pb-4 text-center">
        <h1 className="text-2xl font-black italic tracking-tighter text-white">
          ESTACIÓN<span className="text-yellow-400">MAESTRA</span>
          <span className="ml-2 text-[10px] not-italic font-medium text-slate-500 uppercase tracking-widest">v2.0</span>
        </h1>
      </header>

      <main className="max-w-xl mx-auto px-4 animate-fade-in">
        {activeTab === 'generator' && <GeneratorView />}
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'demos' && <DemosView />}
      </main>

      <Navbar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onLogout={logout} 
      />
    </div>
  );
}

export default App;

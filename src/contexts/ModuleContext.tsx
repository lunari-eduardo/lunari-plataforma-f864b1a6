import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';


export type AppModule = 'studio' | 'gallery';

interface ModuleContextData {
  activeModule: AppModule;
  setActiveModule: (module: AppModule) => void;
}

const ModuleContext = createContext<ModuleContextData | undefined>(undefined);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [activeModule, setActiveModuleState] = useState<AppModule>(() => {
    // 1. Prioridade para a URL se já carregar nela
    const path = window.location.pathname;
    if (path.startsWith('/app/gallery')) {
      return 'gallery';
    }
    // 2. Fallback para o localStorage
    const saved = localStorage.getItem('lunari_active_module') as AppModule;
    return saved === 'gallery' ? 'gallery' : 'studio';
  });

  const setActiveModule = (module: AppModule) => {
    setActiveModuleState(module);
    localStorage.setItem('lunari_active_module', module);
  };

  // Garante que se a URL mudar forçadamente para /app/gallery (ex: redirecionamento),
  // o estado do módulo acompanhe para não bugar a Sidebar.
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path.startsWith('/app/gallery') && activeModule !== 'gallery') {
        setActiveModule('gallery');
      } else if (!path.startsWith('/app/gallery') && path.startsWith('/app') && activeModule !== 'studio') {
        // Se estivermos no app, mas não no gallery, garantir que seja studio.
        // Opcional, mas recomendado para consistência se o usuário navegar "para fora".
        setActiveModule('studio');
      }
    };
    
    // Check initial mount
    handleLocationChange();
    
    // We can't easily listen to all router changes outside a Router context here if ModuleProvider is outside.
    // Wait, ModuleProvider is inside <Routes>? No, it's outside. But we can just use an inner component if we wanted useLocation.
    // However, window.addEventListener('popstate') handles browser navigation.
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [activeModule]);

  return (
    <ModuleContext.Provider value={{ activeModule, setActiveModule }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useActiveModule() {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useActiveModule must be used within a ModuleProvider');
  }
  return context;
}

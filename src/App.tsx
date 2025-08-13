
import * as React from "react";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Index from "./pages/Index";
import Agenda from "./pages/Agenda";
import Clientes from "./pages/Clientes";
import Orcamentos from "./pages/Orcamentos";
import NovaFinancas from "./pages/NovaFinancas";
import Precificacao from "./pages/Precificacao";
import Configuracoes from "./pages/Configuracoes";
import ClienteDetalhe from "./pages/ClienteDetalhe";
import Workflow from "./pages/Workflow";
import AnaliseVendas from "./pages/AnaliseVendas";
import MinhaConta from "./pages/MinhaConta";
import Preferencias from "./pages/Preferencias";
import Tarefas from "./pages/Tarefas";
import FeedTest from "./pages/FeedTest";
import NotFound from "./pages/NotFound";
import { AppProvider } from "./contexts/AppContext";
import { useIntegration } from "./hooks/useIntegration";
import ThemeProvider from "./components/theme/ThemeProvider";

// Create a stable QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Integration component that safely uses hooks within providers
function AppIntegration() {
  try {
    useIntegration();
  } catch (error) {
    console.error('Integration hook error:', error);
  }
  return null;
}

// Automation integration mounting point
function AutomationIntegration() {
  try {
    const { useAutomationEngine } = require('./hooks/useAutomationEngine');
    useAutomationEngine();
  } catch (error) {
    console.error('Automation engine error:', error);
  }
  return null;
}

// Define App as a proper function component
function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize app with defensive checks
    const initializeApp = async () => {
      try {
        // Ensure React is properly initialized before importing utils
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const { initializeAppWithFix } = await import('./utils/initializeAppFixed');
        initializeAppWithFix();
        
        setIsInitialized(true);
        console.log('✅ App successfully initialized');
      } catch (error) {
        console.error('❌ App initialization error:', error);
        // Continue with basic initialization even if fix fails
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []);

  // Show loading state until initialized
  if (!isInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        backgroundColor: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        fontSize: '14px'
      }}>
        Carregando...
      </div>
    );
  }
  
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AppProvider>
            <TooltipProvider>
              <AppIntegration />
              <AutomationIntegration />
              <Toaster />
              <Sonner />
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/agenda" element={<Agenda />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                  <Route path="/orcamentos" element={<Orcamentos />} />
                  <Route path="/financas" element={<NovaFinancas />} />
                  <Route path="/precificacao" element={<Precificacao />} />
                  <Route path="/workflow" element={<Workflow />} />
                  <Route path="/analise-vendas" element={<AnaliseVendas />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                  <Route path="/minha-conta" element={<MinhaConta />} />
                  <Route path="/preferencias" element={<Preferencias />} />
                  <Route path="/tarefas" element={<Tarefas />} />
                  <Route path="/feed-test" element={<FeedTest />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </TooltipProvider>
          </AppProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;

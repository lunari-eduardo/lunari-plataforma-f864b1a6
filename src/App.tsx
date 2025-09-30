import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Index from "./pages/Index";
import Agenda from "./pages/Agenda";
import Clientes from "./pages/Clientes";
import Leads from "./pages/Leads";
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
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { AppProvider } from "./contexts/AppContext";
import { AgendaProvider } from "./contexts/AgendaContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ConfigurationProvider } from "./contexts/ConfigurationContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import ThemeProvider from "./components/theme/ThemeProvider";
import { BuildMonitor } from "./components/shared/BuildMonitor";
import { usePricingBootstrap } from "./hooks/usePricingBootstrap";

// Create a stable QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Define App as a proper function component
function App() {
  // Bootstrap pricing system early
  const { isInitialized: pricingInitialized, error: pricingError } = usePricingBootstrap();

  // Log app version for debugging
  React.useEffect(() => {
    console.log(`🚀 Lunari 2.0 v${import.meta.env.VITE_APP_VERSION || '1.0.0'} - Ready`);
    if (pricingError) {
      console.warn('⚠️ Pricing system had initialization issues:', pricingError);
    }
  }, [pricingError]);
  
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ConfigurationProvider>
              <AppProvider>
                <AgendaProvider>
                  <TooltipProvider>
                    <BuildMonitor />
                    <Toaster />
                    <Sonner />
                    <Routes>
                      {/* Public routes */}
                      <Route path="/landing" element={<LandingPage />} />
                      <Route path="/auth" element={<Auth />} />
                      
                      {/* Protected routes with layout */}
                      <Route path="/" element={
                        <ProtectedRoute>
                          <Layout />
                        </ProtectedRoute>
                      }>
                        <Route path="/" element={<Index />} />
                        <Route path="/agenda" element={<Agenda />} />
                        <Route path="/clientes" element={<Clientes />} />
                        <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                        <Route path="/leads" element={<Leads />} />
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
                </AgendaProvider>
              </AppProvider>
            </ConfigurationProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;

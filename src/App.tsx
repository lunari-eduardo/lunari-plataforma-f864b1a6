
import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import EscolherPlano from "./pages/EscolherPlano";
import MinhaAssinatura from "./pages/MinhaAssinatura";
import AdminUsuarios from "./pages/AdminUsuarios";
import Conteudos from "./pages/Conteudos";
import ConteudoDetalhe from "./pages/ConteudoDetalhe";
import SitemapProxy from "./pages/SitemapProxy";
import AdminConteudos from "./pages/AdminConteudos";
import AdminConteudoNovo from "./pages/AdminConteudoNovo";
import AdminConteudoEditar from "./pages/AdminConteudoEditar";
import { AppProvider } from "./contexts/AppContext";
import { AgendaProvider } from "./contexts/AgendaContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ConfigurationProvider } from "./contexts/ConfigurationContext";
import { WorkflowCacheProvider } from "./contexts/WorkflowCacheContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AdminRoute } from "./components/auth/AdminRoute";
import { PlanRestrictionGuard } from "./components/auth/PlanRestrictionGuard";
import ThemeProvider from "./components/theme/ThemeProvider";
import { BuildMonitor } from "./components/shared/BuildMonitor";
import { usePricingBootstrap } from "./hooks/usePricingBootstrap";
import { useWorkflowCacheInit } from "./hooks/useWorkflowCacheInit";
import { useAppointmentWorkflowSync } from "./hooks/useAppointmentWorkflowSync";
import { useAppForceUpdate } from "./hooks/useAppForceUpdate";
import { useTrialWelcomeToast } from "./components/subscription/TrialWelcomeToast";
import { usePWAUpdate } from "./hooks/usePWAUpdate";

// Create a stable QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Componente interno que executa hooks DENTRO do WorkflowCacheProvider
// Isso garante que eventos customizados são disparados APÓS listeners estarem prontos
function AppContent() {
  // Initialize workflow cache manager (non-blocking)
  useWorkflowCacheInit();
  
  // Global appointment→workflow sync - DEVE estar DENTRO do WorkflowCacheProvider
  useAppointmentWorkflowSync();
  
  // Show trial welcome toast on first access
  useTrialWelcomeToast();
  
  return null;
}

// Define App as a proper function component
function App() {
  // Bootstrap pricing system early
  const { isInitialized: pricingInitialized, error: pricingError } = usePricingBootstrap();
  
  // PWA auto-update via vite-plugin-pwa (detecta novas versões automaticamente)
  usePWAUpdate();
  
  // Enable force update mechanism for all devices (botão manual via Supabase)
  useAppForceUpdate();

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
              <WorkflowCacheProvider>
                <AppContent />
                <AppProvider>
                  <AgendaProvider>
                  <TooltipProvider>
                    <BuildMonitor />
                    <Toaster />
                    <Sonner />
                  <Routes>
                    {/* ============ PUBLIC ROUTES (SEO) ============ */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/conteudos" element={<Conteudos />} />
                    <Route path="/conteudos/:slug" element={<ConteudoDetalhe />} />
                    <Route path="/sitemap.xml" element={<SitemapProxy />} />
                    
                    {/* Redirect antigo /landing para / */}
                    <Route path="/landing" element={<Navigate to="/" replace />} />
                    
                    {/* Protected subscription routes (outside main layout) */}
                    <Route path="/escolher-plano" element={
                      <ProtectedRoute>
                        <EscolherPlano />
                      </ProtectedRoute>
                    } />
                    <Route path="/minha-assinatura" element={
                      <ProtectedRoute>
                        <MinhaAssinatura />
                      </ProtectedRoute>
                    } />
                    
                    {/* Semi-protected: onboarding (requires auth but not complete profile) */}
                    <Route path="/onboarding" element={
                      <ProtectedRoute>
                        <Onboarding />
                      </ProtectedRoute>
                    } />
                    
                    {/* ============ PROTECTED ROUTES (/app) ============ */}
                    <Route path="/app" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Index />} />
                      <Route path="agenda" element={<Agenda />} />
                      <Route path="clientes" element={<Clientes />} />
                      <Route path="clientes/:id" element={<ClienteDetalhe />} />
                      <Route path="leads" element={
                        <PlanRestrictionGuard requiredPlan="pro">
                          <Leads />
                        </PlanRestrictionGuard>
                      } />
                      <Route path="financas" element={
                        <PlanRestrictionGuard requiredPlan="pro">
                          <NovaFinancas />
                        </PlanRestrictionGuard>
                      } />
                      <Route path="precificacao" element={
                        <PlanRestrictionGuard requiredPlan="pro">
                          <Precificacao />
                        </PlanRestrictionGuard>
                      } />
                      <Route path="workflow" element={<Workflow />} />
                      <Route path="analise-vendas" element={
                        <PlanRestrictionGuard requiredPlan="pro">
                          <AnaliseVendas />
                        </PlanRestrictionGuard>
                      } />
                      <Route path="configuracoes" element={<Configuracoes />} />
                      <Route path="minha-conta" element={<MinhaConta />} />
                      <Route path="preferencias" element={<Preferencias />} />
                      <Route path="tarefas" element={
                        <PlanRestrictionGuard requiredPlan="pro">
                          <Tarefas />
                        </PlanRestrictionGuard>
                      } />
                      <Route path="feed-test" element={
                        <PlanRestrictionGuard requiredPlan="pro">
                          <FeedTest />
                        </PlanRestrictionGuard>
                      } />
                      <Route path="integracoes" element={<Navigate to="/app/preferencias?tab=integracoes" replace />} />
                      <Route path="admin/usuarios" element={
                        <AdminRoute>
                          <AdminUsuarios />
                        </AdminRoute>
                      } />
                      <Route path="admin/conteudos" element={
                        <AdminRoute>
                          <AdminConteudos />
                        </AdminRoute>
                      } />
                      <Route path="admin/conteudos/novo" element={
                        <AdminRoute>
                          <AdminConteudoNovo />
                        </AdminRoute>
                      } />
                      <Route path="admin/conteudos/editar/:id" element={
                        <AdminRoute>
                          <AdminConteudoEditar />
                        </AdminRoute>
                      } />
                      <Route path="*" element={<NotFound />} />
                    </Route>
                    
                    {/* Catch-all para rotas não encontradas */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  </TooltipProvider>
                  </AgendaProvider>
                </AppProvider>
              </WorkflowCacheProvider>
            </ConfigurationProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;

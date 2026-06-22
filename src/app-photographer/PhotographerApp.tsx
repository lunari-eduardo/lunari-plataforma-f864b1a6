import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Index from "@/pages/Index";
import Agenda from "@/pages/Agenda";
import Clientes from "@/pages/Clientes";
import Leads from "@/pages/Leads";
import NovaFinancas from "@/pages/NovaFinancas";
import Precificacao from "@/pages/Precificacao";
import Configuracoes from "@/pages/Configuracoes";
import ClienteDetalhe from "@/pages/ClienteDetalhe";
import Workflow from "@/pages/Workflow";
import AnaliseVendas from "@/pages/AnaliseVendas";
import MinhaConta from "@/pages/MinhaConta";
import Integracoes from "@/pages/Integracoes";
import Tarefas from "@/pages/Tarefas";
import FeedTest from "@/pages/FeedTest";
import LandingPage from "@/pages/LandingPage";
import PublicCheckout from "@/pages/PublicCheckout";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/NotFound";
import EscolherPlano from "@/pages/EscolherPlano";
import MinhaAssinatura from "@/pages/MinhaAssinatura";
import EscolherPlanoPagamento from "@/pages/EscolherPlanoPagamento";
import ResetPassword from "@/pages/ResetPassword";
import Conteudos from "@/pages/Conteudos";
import ConteudoDetalhe from "@/pages/ConteudoDetalhe";
import SitemapProxy from "@/pages/SitemapProxy";
import CentroAjuda from "@/pages/CentroAjuda";
import ArtigoAjuda from "@/pages/ArtigoAjuda";
import FormularioPublico from "@/pages/FormularioPublico";

import { AppProvider } from "@/contexts/AppContext";

import { ConfigurationProvider } from "@/contexts/ConfigurationContext";
import { ProdutoEtiquetasProvider } from "@/contexts/ProdutoEtiquetasContext";
import { WorkflowCacheProvider } from "@/contexts/WorkflowCacheContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlanRestrictionGuard } from "@/components/auth/PlanRestrictionGuard";
import { BuildMonitor } from "@/components/shared/BuildMonitor";
import { useWorkflowCacheInit } from "@/hooks/useWorkflowCacheInit";
import { useAppointmentWorkflowSync } from "@/hooks/useAppointmentWorkflowSync";
import { useTrialWelcomeToast } from "@/components/subscription/TrialWelcomeToast";
import { useProvisionGalleryStatuses } from "@/hooks/useProvisionGalleryStatuses";
import { LunariSupportHostProvider } from "@/integrations/support-host";
import { SupportUserRoutes } from "@/modules/support";
import { ADMIN_URL } from "@/lib/appContext";

/**
 * Redireciona rotas legadas /app/admin/* para admin.lunarihub.com.
 * Mantido durante transição; remover em etapa futura.
 */
function RedirectToAdminHost({ to }: { to: string }) {
  React.useEffect(() => {
    window.location.replace(`${ADMIN_URL}${to}`);
  }, [to]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
      Redirecionando para o painel administrativo…
    </div>
  );
}

function PhotographerInit() {
  useWorkflowCacheInit();
  useAppointmentWorkflowSync();
  useTrialWelcomeToast();
  useProvisionGalleryStatuses();
  return null;
}

export default function PhotographerApp() {
  return (
    <ConfigurationProvider>
      <ProdutoEtiquetasProvider>
        <WorkflowCacheProvider>
          <PhotographerInit />
          <AppProvider>
            <BuildMonitor />
            <Routes>
              {/* ============ PUBLIC ROUTES (SEO) ============ */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/conteudos" element={<Conteudos />} />
              <Route path="/conteudos/:slug" element={<ConteudoDetalhe />} />
              <Route path="/sitemap.xml" element={<SitemapProxy />} />

              <Route path="/formulario/:token" element={<FormularioPublico />} />
              <Route path="/checkout/:cobrancaId" element={<PublicCheckout />} />

              <Route path="/landing" element={<Navigate to="/" replace />} />

              <Route path="/escolher-plano" element={
                <ProtectedRoute><EscolherPlano /></ProtectedRoute>
              } />
              <Route path="/minha-assinatura" element={
                <ProtectedRoute><MinhaAssinatura /></ProtectedRoute>
              } />
              <Route path="/escolher-plano/pagamento" element={
                <ProtectedRoute><EscolherPlanoPagamento /></ProtectedRoute>
              } />

              <Route path="/onboarding" element={
                <ProtectedRoute><Onboarding /></ProtectedRoute>
              } />

              {/* ============ PROTECTED ROUTES (/app) ============ */}
              <Route path="/app" element={
                <ProtectedRoute><Layout /></ProtectedRoute>
              }>
                <Route index element={<Index />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="clientes/:id" element={<ClienteDetalhe />} />
                <Route path="leads" element={
                  <PlanRestrictionGuard requiredPlan="pro"><Leads /></PlanRestrictionGuard>
                } />
                <Route path="financas" element={
                  <PlanRestrictionGuard requiredPlan="pro"><NovaFinancas /></PlanRestrictionGuard>
                } />
                <Route path="precificacao" element={
                  <PlanRestrictionGuard requiredPlan="pro"><Precificacao /></PlanRestrictionGuard>
                } />
                <Route path="workflow" element={<Workflow />} />
                <Route path="analise-vendas" element={
                  <PlanRestrictionGuard requiredPlan="pro"><AnaliseVendas /></PlanRestrictionGuard>
                } />
                <Route path="configuracoes" element={<Configuracoes />} />
                <Route path="minha-conta" element={<MinhaConta />} />
                <Route path="integracoes" element={<Integracoes />} />
                <Route path="tarefas" element={
                  <PlanRestrictionGuard requiredPlan="pro"><Tarefas /></PlanRestrictionGuard>
                } />
                <Route path="feed-test" element={
                  <PlanRestrictionGuard requiredPlan="pro"><FeedTest /></PlanRestrictionGuard>
                } />
                <Route path="preferencias" element={<Navigate to="/app/integracoes" replace />} />

                {/* Compat: rotas admin antigas redirecionam para admin.lunarihub.com */}
                <Route path="admin/usuarios" element={<RedirectToAdminHost to="/usuarios" />} />
                <Route path="admin/planos" element={<RedirectToAdminHost to="/planos" />} />
                <Route path="admin/conteudos" element={<RedirectToAdminHost to="/conteudos" />} />
                <Route path="admin/conteudos/novo" element={<RedirectToAdminHost to="/conteudos/novo" />} />
                <Route path="admin/conteudos/editar/:id" element={<RedirectToAdminHost to="/conteudos" />} />
                <Route path="admin/suporte/*" element={<RedirectToAdminHost to="/suporte" />} />

                <Route path="ajuda" element={<CentroAjuda />} />
                <Route path="ajuda/:slug" element={<ArtigoAjuda />} />
                <Route
                  path="suporte/*"
                  element={
                    <LunariSupportHostProvider>
                      <SupportUserRoutes />
                    </LunariSupportHostProvider>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppProvider>

        </WorkflowCacheProvider>
      </ProdutoEtiquetasProvider>
    </ConfigurationProvider>
  );
}

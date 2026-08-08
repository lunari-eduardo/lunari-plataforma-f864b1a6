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
import AssistenteMcpTokens from "@/pages/AssistenteMcpTokens";
import { RequireAssistantAccess } from "@/modules/assistant/runtime/RequireAssistantAccess";
import { RequireAdmin } from "@/components/auth/RequireAdmin";
import AssistenteAprovacoes from "@/pages/AssistenteAprovacoes";
import Hub from "@/pages/Hub";
import ClienteDetalhe from "@/pages/ClienteDetalhe";
import Workflow from "@/pages/Workflow";
import AnaliseVendas from "@/pages/AnaliseVendas";
import MinhaConta from "@/pages/MinhaConta";
import Integracoes from "@/pages/Integracoes";
import Tarefas from "@/pages/Tarefas";
import ComercialOverviewPage from "@/pages/comercial/ComercialOverviewPage";
import BibliotecaComercialPage from "@/pages/comercial/BibliotecaComercialPage";
import ConstrutorComercialPage from "@/pages/comercial/ConstrutorComercialPage";
import EditorPropostaPage from "@/pages/comercial/EditorPropostaPage";
import EstrategiaComercialPage from "@/pages/comercial/EstrategiaComercialPage";
import CompartilhamentosComercialPage from "@/pages/comercial/CompartilhamentosComercialPage";
import RelatoriosComercialPage from "@/pages/comercial/RelatoriosComercialPage";

import HomePage from "@/pages/site/HomePage";
import StudioPage from "@/pages/site/StudioPage";
import GalleryOverviewPage from "@/pages/site/GalleryOverviewPage";
import GallerySelectPage from "@/pages/site/GallerySelectPage";
import GalleryTransferPage from "@/pages/site/GalleryTransferPage";
import PrecosPage from "@/pages/site/PrecosPage";
import SobrePage from "@/pages/site/SobrePage";
import ContatoPage from "@/pages/site/ContatoPage";
import { SiteLayout } from "@/components/site/SiteLayout";
import PublicCheckout from "@/pages/PublicCheckout";
import InfinitePayCheckout from "@/pages/pay/InfinitePayCheckout";
import ShareLinkFallback from "@/pages/pay/ShareLinkFallback";

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
import OAuthConsent from "@/pages/OAuthConsent";
import FormularioPublico from "@/pages/FormularioPublico";
import PrivacidadePage from "@/pages/legal/PrivacidadePage";
import TermosPage from "@/pages/legal/TermosPage";
import ExclusaoDadosPage from "@/pages/legal/ExclusaoDadosPage";
import CookiesPage from "@/pages/legal/CookiesPage";
import SegurancaPage from "@/pages/legal/SegurancaPage";


import { AppProvider } from "@/contexts/AppContext";

import { ConfigurationProvider } from "@/contexts/ConfigurationContext";
import { ProdutoEtiquetasProvider } from "@/contexts/ProdutoEtiquetasContext";
import { WorkflowCacheProvider } from "@/contexts/WorkflowCacheContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlanRestrictionGuard } from "@/components/auth/PlanRestrictionGuard";
import { BuildMonitor } from "@/components/shared/BuildMonitor";
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

function AuthRouteWrapper() {
  const isApp = React.useMemo(() => {
    const hostname = window.location.hostname;
    return hostname === 'app.lunarihub.com' || 
           hostname.includes('lovable.app') || 
           hostname.includes('localhost');
  }, []);

  React.useEffect(() => {
    // Se NÃO estiver no domínio do app nem em dev, redireciona para a URL canônica do Auth
    if (!isApp) {
      console.log("🔄 Redirecionando para host de autenticação oficial...");
      window.location.replace("https://app.lunarihub.com/auth" + window.location.search);
    }
  }, [isApp]);

  // Se já estiver no host correto, renderiza o componente de Auth real
  if (isApp) {
    return <Auth />;
  }

  // Enquanto redireciona
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
      Redirecionando para o ambiente seguro…
    </div>
  );
}

function PhotographerInit() {
  // Workflow cache/realtime agora é gerido por <WorkflowRealtimeBridge> + workflowStore.
  // Sync de appointments→sessões é feito pelo trigger DB; capability `workflow.syncFromAgenda` cobre re-sync manual.
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
              {/* ============ PUBLIC INSTITUTIONAL SITE (SiteLayout) ============ */}
              <Route element={<SiteLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/studio" element={<StudioPage />} />
                <Route path="/gallery" element={<GalleryOverviewPage />} />
                <Route path="/gallery/select" element={<GallerySelectPage />} />
                <Route path="/gallery/transfer" element={<GalleryTransferPage />} />
                <Route path="/precos" element={<PrecosPage />} />
                <Route path="/sobre" element={<SobrePage />} />
                <Route path="/contato" element={<ContatoPage />} />
                <Route path="/legal/privacidade" element={<PrivacidadePage />} />
                <Route path="/legal/termos" element={<TermosPage />} />
                <Route path="/legal/exclusao-dados" element={<ExclusaoDadosPage />} />
                <Route path="/legal/cookies" element={<CookiesPage />} />
                <Route path="/legal/seguranca" element={<SegurancaPage />} />
                <Route path="/legal/lgpd" element={<PrivacidadePage />} />

              </Route>

              <Route path="/auth" element={<AuthRouteWrapper />} />
              <Route path="/auth/google/callback" element={<Navigate to="/app/integracoes" replace />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/oauth/consent" element={<OAuthConsent />} />
              <Route path="/conteudos" element={<Conteudos />} />
              <Route path="/conteudos/:slug" element={<ConteudoDetalhe />} />
              <Route path="/sitemap.xml" element={<SitemapProxy />} />

              <Route path="/formulario/:token" element={<FormularioPublico />} />
              <Route path="/checkout/:cobrancaId" element={<PublicCheckout />} />
              <Route path="/pay/ip/:cobrancaId" element={<InfinitePayCheckout />} />
              <Route path="/l/:cobrancaId" element={<ShareLinkFallback />} />


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
                  <RequireAdmin>
                    <PlanRestrictionGuard requiredPlan="pro"><Leads /></PlanRestrictionGuard>
                  </RequireAdmin>
                } />
                <Route path="comercial">
                  <Route index element={<RequireAdmin><ComercialOverviewPage /></RequireAdmin>} />
                  <Route path="biblioteca" element={<RequireAdmin><BibliotecaComercialPage /></RequireAdmin>} />
                  <Route path="construtor" element={<RequireAdmin><ConstrutorComercialPage /></RequireAdmin>} />
                  <Route path="construtor/:id" element={<RequireAdmin><EditorPropostaPage /></RequireAdmin>} />
                  <Route path="estrategia" element={<RequireAdmin><EstrategiaComercialPage /></RequireAdmin>} />
                  <Route path="compartilhamentos" element={<RequireAdmin><CompartilhamentosComercialPage /></RequireAdmin>} />
                  <Route path="relatorios" element={<RequireAdmin><RelatoriosComercialPage /></RequireAdmin>} />
                </Route>

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
                <Route path="configuracoes/assistente-mcp" element={<RequireAdmin><RequireAssistantAccess><AssistenteMcpTokens /></RequireAssistantAccess></RequireAdmin>} />
                <Route path="assistente/mcp" element={<RequireAdmin><RequireAssistantAccess><AssistenteMcpTokens /></RequireAssistantAccess></RequireAdmin>} />
                <Route path="assistente/aprovacoes" element={<RequireAdmin><RequireAssistantAccess><AssistenteAprovacoes /></RequireAssistantAccess></RequireAdmin>} />
                <Route path="hub" element={<RequireAdmin><Hub /></RequireAdmin>} />

                <Route path="inteligencia" element={<Navigate to="/app/hub" replace />} />
                <Route path="minha-conta" element={<MinhaConta />} />
                <Route path="integracoes" element={<Integracoes />} />
                <Route path="tarefas" element={
                  <PlanRestrictionGuard requiredPlan="pro"><Tarefas /></PlanRestrictionGuard>
                } />
                <Route path="feed-test" element={<Navigate to="/app/workflow" replace />} />
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

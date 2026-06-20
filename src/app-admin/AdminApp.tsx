import { Routes, Route, Navigate } from "react-router-dom";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

import AdminUsuarios from "@/pages/AdminUsuarios";
import AdminPlanos from "@/pages/AdminPlanos";
import AdminConteudos from "@/pages/AdminConteudos";
import AdminConteudoNovo from "@/pages/AdminConteudoNovo";
import AdminConteudoEditar from "@/pages/AdminConteudoEditar";

import { LunariSupportHostProvider } from "@/integrations/support-host";
import { SupportAdminRoutes } from "@/modules/support";

import { AdminShell } from "./AdminShell";
import { AdminAuthGate } from "./components/AdminAuthGate";

import DashboardPage from "./modules/dashboard/DashboardPage";
import AssinaturasPage from "./modules/assinaturas/AssinaturasPage";
import StoragePage from "./modules/storage/StoragePage";
import SistemaPage from "./modules/sistema/SistemaPage";
import LogsPage from "./modules/audit-logs/LogsPage";
import ConfiguracoesPage from "./modules/configuracoes/ConfiguracoesPage";

/**
 * AdminApp — entry do subdomínio admin.lunarihub.com
 *
 * Rotas públicas (sem gate): /auth, /reset-password
 * Tudo o mais passa pelo AdminAuthGate (exige sessão + role admin).
 */
export default function AdminApp() {
  return (
    <Routes>
      {/* Rotas públicas do subdomínio admin */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Shell protegido */}
      <Route
        path="/"
        element={
          <AdminAuthGate>
            <AdminShell />
          </AdminAuthGate>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="usuarios" element={<AdminUsuarios />} />
        <Route path="assinaturas" element={<AssinaturasPage />} />
        <Route path="planos" element={<AdminPlanos />} />
        <Route path="conteudos" element={<AdminConteudos />} />
        <Route path="conteudos/novo" element={<AdminConteudoNovo />} />
        <Route path="conteudos/editar/:id" element={<AdminConteudoEditar />} />
        <Route
          path="suporte/*"
          element={
            <LunariSupportHostProvider>
              <SupportAdminRoutes />
            </LunariSupportHostProvider>
          }
        />
        <Route path="storage" element={<StoragePage />} />
        <Route path="sistema" element={<SistemaPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="configuracoes" element={<ConfiguracoesPage />} />

        {/* Compat: alguém colando link antigo /app/admin/... no host admin */}
        <Route path="app/admin/usuarios" element={<Navigate to="/usuarios" replace />} />
        <Route path="app/admin/planos" element={<Navigate to="/planos" replace />} />
        <Route path="app/admin/conteudos" element={<Navigate to="/conteudos" replace />} />
        <Route path="app/admin/suporte/*" element={<Navigate to="/suporte" replace />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

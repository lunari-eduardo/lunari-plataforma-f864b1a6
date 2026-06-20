import { Route, Routes, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import SupportPage from "../components/user/SupportPage";
import TicketDetailPage from "../components/user/TicketDetailPage";
import AdminDashboardPage from "../components/admin/AdminDashboardPage";
import AdminTicketsListPage from "../components/admin/AdminTicketsListPage";
import AdminTicketDetailPage from "../components/admin/AdminTicketDetailPage";
import AdminSupportShell from "../components/admin/AdminSupportShell";
import FAQManagerPage from "../components/admin/FAQManagerPage";
import FAQEditorPage from "../components/admin/FAQEditorPage";
import { useSupportHost } from "../SupportHostProvider";
import { isAdminContext } from "@/lib/appContext";
import { useAccessControl } from "@/hooks/useAccessControl";

export function SupportUserRoutes() {
  return (
    <Routes>
      <Route index element={<SupportPage />} />
      <Route path="chamado/:id" element={<TicketDetailPage />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const host = useSupportHost();
  const { loading } = useAccessControl();

  // Enquanto o estado de acesso ainda está carregando, NÃO redirecione:
  // o host.isAdmin começa false até o fetch terminar e isso causa loop
  // de volta para o Dashboard ao clicar em "Suporte".
  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!host.isAdmin) {
    // No subdomínio admin redireciona para "/"; no app fotógrafo, para /app/suporte
    return <Navigate to={isAdminContext() ? "/" : "/app/suporte"} replace />;
  }
  return <>{children}</>;
}

export function SupportAdminRoutes() {
  return (
    <Routes>
      {/* Detail pages permanecem soltas — ocupam tela inteira */}
      <Route path="chamados/:id" element={<RequireAdmin><AdminTicketDetailPage /></RequireAdmin>} />
      <Route path="faq/novo" element={<RequireAdmin><FAQEditorPage /></RequireAdmin>} />
      <Route path="faq/:id" element={<RequireAdmin><FAQEditorPage /></RequireAdmin>} />

      {/* Demais rotas usam o shell com sub-abas */}
      <Route element={<RequireAdmin><AdminSupportShell /></RequireAdmin>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="chamados" element={<AdminTicketsListPage />} />
        <Route path="faq" element={<FAQManagerPage />} />
      </Route>
    </Routes>
  );
}

import { Route, Routes, Navigate } from "react-router-dom";
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

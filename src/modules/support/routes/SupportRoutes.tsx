import { Route, Routes, Navigate } from "react-router-dom";
import SupportPage from "../components/user/SupportPage";
import TicketDetailPage from "../components/user/TicketDetailPage";
import AdminDashboardPage from "../components/admin/AdminDashboardPage";
import AdminTicketsListPage from "../components/admin/AdminTicketsListPage";
import AdminTicketDetailPage from "../components/admin/AdminTicketDetailPage";
import FAQManagerPage from "../components/admin/FAQManagerPage";
import FAQEditorPage from "../components/admin/FAQEditorPage";
import { useSupportHost } from "../SupportHostProvider";

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
  if (!host.isAdmin) return <Navigate to="/app/suporte" replace />;
  return <>{children}</>;
}

export function SupportAdminRoutes() {
  return (
    <Routes>
      <Route index element={<RequireAdmin><AdminDashboardPage /></RequireAdmin>} />
      <Route path="chamados" element={<RequireAdmin><AdminTicketsListPage /></RequireAdmin>} />
      <Route path="chamados/:id" element={<RequireAdmin><AdminTicketDetailPage /></RequireAdmin>} />
      <Route path="faq" element={<RequireAdmin><FAQManagerPage /></RequireAdmin>} />
      <Route path="faq/novo" element={<RequireAdmin><FAQEditorPage /></RequireAdmin>} />
      <Route path="faq/:id" element={<RequireAdmin><FAQEditorPage /></RequireAdmin>} />
    </Routes>
  );
}

/**
 * DashboardView — wrapper da aba Dashboard. Sem props.
 */
import { memo } from "react";
import DashboardFinanceiro from "@/components/financas/DashboardFinanceiro";

export const DashboardView = memo(function DashboardView() {
  return <DashboardFinanceiro />;
});

export default DashboardView;

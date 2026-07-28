/**
 * DashboardView — wrapper da aba "Visão Geral" do Financeiro.
 * Agora renderiza a nova página reconstruída (Silent Luxury, 4 seções).
 * O componente legado `DashboardFinanceiro` foi aposentado.
 */
import { memo } from "react";
import VisaoGeralPage from "@/modules/finance/presentation/visao-geral/VisaoGeralPage";

export const DashboardView = memo(function DashboardView() {
  return <VisaoGeralPage />;
});

export default DashboardView;

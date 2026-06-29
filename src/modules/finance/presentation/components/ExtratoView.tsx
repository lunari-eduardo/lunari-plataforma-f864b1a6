/**
 * ExtratoView — wrapper da aba Extrato. Sem props.
 */
import { memo } from "react";
import ExtratoTab from "@/components/financas/ExtratoTab";

export const ExtratoView = memo(function ExtratoView() {
  return <ExtratoTab />;
});

export default ExtratoView;

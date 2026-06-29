/**
 * MetasView — wrapper da aba Metas. Sem props.
 */
import { memo } from "react";
import MetasConfigTab from "@/components/financas/MetasConfigTab";

export const MetasView = memo(function MetasView() {
  return <MetasConfigTab />;
});

export default MetasView;

/**
 * ConfiguracoesView — wrapper da aba Configurações financeiras.
 * Encapsula o data-fetching de itens financeiros.
 */
import { memo } from "react";
import { useNovoFinancas } from "@/hooks/useNovoFinancas";
import ConfiguracoesFinanceirasTab from "@/components/financas/ConfiguracoesFinanceirasTab";

export const ConfiguracoesView = memo(function ConfiguracoesView() {
  const {
    itensFinanceiros,
    adicionarItemFinanceiro,
    removerItemFinanceiro,
    atualizarItemFinanceiro,
  } = useNovoFinancas();

  return (
    <ConfiguracoesFinanceirasTab
      itensFinanceiros={itensFinanceiros}
      adicionarItemFinanceiro={adicionarItemFinanceiro}
      removerItemFinanceiro={removerItemFinanceiro}
      atualizarItemFinanceiro={atualizarItemFinanceiro}
    />
  );
});

export default ConfiguracoesView;

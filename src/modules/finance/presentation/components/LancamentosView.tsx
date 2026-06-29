/**
 * LancamentosView — wrapper canônico da aba Lançamentos.
 * Encapsula o data-fetching (useNovoFinancas) que antes vivia em NovaFinancas.tsx.
 */
import { memo } from "react";
import { useNovoFinancas } from "@/hooks/useNovoFinancas";
import LancamentosTab from "@/components/financas/LancamentosTab";

export const LancamentosView = memo(function LancamentosView() {
  const {
    filtroMesAno,
    setFiltroMesAno,
    transacoesPorGrupo,
    resumoFinanceiro,
    calcularMetricasPorGrupo,
    obterItensPorGrupo,
    adicionarTransacao,
    atualizarTransacaoCompativel,
    removerTransacao,
    marcarComoPago,
    createTransactionEngine,
  } = useNovoFinancas();

  return (
    <LancamentosTab
      filtroMesAno={filtroMesAno}
      setFiltroMesAno={setFiltroMesAno}
      transacoesPorGrupo={transacoesPorGrupo}
      resumoFinanceiro={resumoFinanceiro}
      calcularMetricasPorGrupo={calcularMetricasPorGrupo}
      obterItensPorGrupo={obterItensPorGrupo}
      adicionarTransacao={adicionarTransacao}
      atualizarTransacao={atualizarTransacaoCompativel}
      removerTransacao={removerTransacao}
      marcarComoPago={marcarComoPago}
      createTransactionEngine={createTransactionEngine}
    />
  );
});

export default LancamentosView;

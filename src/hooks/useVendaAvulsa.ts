import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VendaAvulsaProduto {
  nome: string;
  quantidade: number;
  valorUnitario: number;
}

export interface VendaAvulsaInput {
  clienteId: string;
  data: string; // YYYY-MM-DD
  categoria?: string;
  pacote?: string;
  valorBasePacote?: number;
  desconto?: number;
  descricao?: string;
  observacoes?: string;
  valorTotal: number;
  registrarPagamento: boolean;
  produtos?: VendaAvulsaProduto[];
}

export function useVendaAvulsa() {
  const [loading, setLoading] = useState(false);

  const criarVendaAvulsa = useCallback(async (input: VendaAvulsaInput) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const sessionId = `VA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const categoria = input.categoria || 'Venda Avulsa';

      // Convert products to produtos_incluidos JSONB format
      const produtosIncluidos = (input.produtos || []).map(p => ({
        nome: p.nome,
        quantidade: p.quantidade,
        valorUnitario: p.valorUnitario,
        tipo: 'manual' as const,
      }));

      // Calculate component totals
      const valorBase = input.valorBasePacote || 0;
      const totalProdutos = produtosIncluidos.reduce(
        (sum, p) => sum + p.quantidade * p.valorUnitario, 0
      );
      const descontoVal = input.desconto || 0;

      // The DB trigger calculates: valor_base_pacote + produtos_manuais + valor_adicional - desconto
      // We need valor_adicional as adjustment so the trigger arrives at the user's desired total
      const componentSum = valorBase + totalProdutos;
      const valorAdicional = input.valorTotal - componentSum + descontoVal;

      // 1. Insert clientes_sessoes
      const { data: sessao, error: errSessao } = await supabase
        .from('clientes_sessoes')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          cliente_id: input.clienteId,
          data_sessao: input.data,
          hora_sessao: '00:00',
          categoria,
          pacote: input.pacote || null,
          valor_base_pacote: valorBase,
          desconto: descontoVal,
          valor_adicional: Math.max(0, valorAdicional),
          descricao: input.descricao || 'Venda avulsa',
          observacoes: input.observacoes || null,
          produtos_incluidos: produtosIncluidos,
          valor_pago: input.registrarPagamento ? input.valorTotal : 0,
          status: input.registrarPagamento ? 'concluido' : 'agendado',
          tipo_registro: 'venda_avulsa',
        })
        .select()
        .single();

      if (errSessao) throw errSessao;

      // 2. If payment, create transaction
      if (input.registrarPagamento) {
        const { error: errTransacao } = await supabase
          .from('clientes_transacoes')
          .insert({
            user_id: user.id,
            cliente_id: input.clienteId,
            session_id: sessionId,
            tipo: 'pagamento',
            valor: input.valorTotal,
            valor_liquido: input.valorTotal,
            descricao: `Venda avulsa - ${input.descricao || categoria}`,
            data_transacao: input.data,
            taxa_gateway: 0,
            taxa_antecipacao: 0,
          });

        if (errTransacao) {
          console.error('Erro ao criar transação:', errTransacao);
          toast.warning('Venda registrada, mas houve um erro ao registrar o pagamento');
          return sessao;
        }
      }

      toast.success('Venda avulsa registrada com sucesso!');
      return sessao;
    } catch (err) {
      console.error('Erro ao criar venda avulsa:', err);
      toast.error('Erro ao registrar venda avulsa');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { criarVendaAvulsa, loading };
}

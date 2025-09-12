/**
 * Serviço para congelamento de regras de precificação
 * Garante que mudanças nos preços não afetam sessões passadas
 */

import { obterConfiguracaoPrecificacao, obterTabelaGlobal, obterTabelaCategoria } from '@/utils/precificacaoUtils';

export interface RegrasCongeladas extends Record<string, any> {
  modelo: 'fixo' | 'global' | 'categoria';
  valorFixo?: number;
  tabelaGlobal?: any;
  tabelaCategoria?: any;
  dataCongelamento: string;
}

class PricingFreezingService {
  /**
   * Congela as regras atuais de precificação para uma sessão
   */
  congelarRegrasAtuais(categoria?: string): RegrasCongeladas {
    const config = obterConfiguracaoPrecificacao();
    
    const regras: RegrasCongeladas = {
      modelo: config.modelo,
      dataCongelamento: new Date().toISOString()
    };

    switch (config.modelo) {
      case 'fixo':
        regras.valorFixo = 35; // Valor padrão caso não exista na config
        break;
      
      case 'global':
        const tabelaGlobal = obterTabelaGlobal();
        regras.tabelaGlobal = tabelaGlobal;
        break;
      
      case 'categoria':
        if (categoria) {
          const tabelaCategoria = obterTabelaCategoria(categoria);
          regras.tabelaCategoria = tabelaCategoria;
        }
        break;
    }

    console.log('📦 Regras de precificação congeladas:', regras);
    return regras;
  }

  /**
   * Calcula o valor da foto extra usando regras congeladas
   */
  calcularValorFotoExtraComRegrasCongeladas(
    quantidade: number, 
    regrasCongeladas: RegrasCongeladas
  ): { valorUnitario: number; valorTotal: number } {
    let valorUnitario = 0;

    switch (regrasCongeladas.modelo) {
      case 'fixo':
        valorUnitario = regrasCongeladas.valorFixo || 0;
        break;
      
      case 'global':
      case 'categoria':
        const tabela = regrasCongeladas.modelo === 'global' 
          ? regrasCongeladas.tabelaGlobal 
          : regrasCongeladas.tabelaCategoria;
          
        if (tabela?.faixas?.length > 0) {
          const faixasOrdenadas = [...tabela.faixas].sort((a, b) => a.min - b.min);
          
          // Encontra a faixa correta para a quantidade
          for (const faixa of faixasOrdenadas) {
            if (quantidade >= faixa.min && (faixa.max === null || quantidade <= faixa.max)) {
              valorUnitario = faixa.valor;
              break;
            }
          }
          
          // Se não encontrou, usa a última faixa
          if (valorUnitario === 0 && faixasOrdenadas.length > 0) {
            valorUnitario = faixasOrdenadas[faixasOrdenadas.length - 1].valor;
          }
        }
        break;
    }

    return {
      valorUnitario,
      valorTotal: valorUnitario * quantidade
    };
  }

  /**
   * Migra sessões existentes para incluir regras congeladas
   */
  async migrarSessoesExistentes() {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: user } = await supabase.auth.getUser();
      
      if (!user?.user) {
        throw new Error('User not authenticated');
      }

      // Busca sessões sem regras congeladas
      const { data: sessions, error } = await supabase
        .from('clientes_sessoes')
        .select('id, categoria, regras_congeladas')
        .eq('user_id', user.user.id)
        .is('regras_congeladas', null);

      if (error) throw error;

      console.log(`📦 Migrando ${sessions?.length || 0} sessões sem regras congeladas...`);

      // Para cada sessão, congela as regras atuais
      const updates = sessions?.map(session => {
        const regrasCongeladas = this.congelarRegrasAtuais(session.categoria);
        
        return supabase
          .from('clientes_sessoes')
          .update({ regras_congeladas: regrasCongeladas as any })
          .eq('id', session.id)
          .eq('user_id', user.user.id);
      }) || [];

      await Promise.all(updates);
      
      console.log('✅ Migração de regras congeladas concluída com sucesso');
      
    } catch (error) {
      console.error('❌ Erro na migração de regras congeladas:', error);
      throw error;
    }
  }
}

export const pricingFreezingService = new PricingFreezingService();
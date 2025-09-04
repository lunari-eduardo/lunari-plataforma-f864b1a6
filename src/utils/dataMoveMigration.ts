/**
 * Sistema de Migração de Dados - Orçamentos para Nova Arquitetura
 * 
 * Converte dados do sistema antigo para a nova estrutura com valores congelados
 */

import { Orcamento } from '@/types/orcamento';

// Compatibility types for migration
interface PacotePrincipal {
  pacoteId: string;
  nome: string;
  valorCongelado: number;
  produtosIncluidos: any[];
}

interface ProdutoAdicional {
  produtoId: string;
  nome: string;
  quantidade: number;
  valorUnitarioCongelado: number;
  tipo: 'manual';
}

interface OrcamentoAntigo {
  id: string;
  cliente: any;
  data: string;
  hora: string;
  categoria: string;
  descricao?: string;
  detalhes: string;
  pacotes: {
    id: string;
    nome: string;
    preco: number;
    quantidade: number;
  }[];
  valorTotal: number;
  desconto?: number;
  status: string;
  origemCliente: string;
  criadoEm: string;
}

/**
 * Converte um orçamento do formato antigo para a nova arquitetura
 */
export function migrateOrcamentoToNewStructure(
  orcamentoAntigo: OrcamentoAntigo,
  pacotesConfig: any[],
  produtosConfig: any[]
): Orcamento {
  let pacotePrincipal: PacotePrincipal | undefined;
  let produtosAdicionais: ProdutoAdicional[] = [];

  // Processar pacotes do orçamento antigo
  if (orcamentoAntigo.pacotes && orcamentoAntigo.pacotes.length > 0) {
    const primeiroPacote = orcamentoAntigo.pacotes[0];
    
    // Buscar dados completos do pacote na configuração
    const pacoteConfig = pacotesConfig.find(p => 
      p.id === primeiroPacote.id || 
      p.nome === primeiroPacote.nome
    );

    if (pacoteConfig) {
      // Criar estrutura do pacote principal com valores congelados
      pacotePrincipal = {
        pacoteId: pacoteConfig.id,
        nome: pacoteConfig.nome,
        valorCongelado: primeiroPacote.preco, // Usar preço do orçamento (congelado)
        produtosIncluidos: (pacoteConfig.produtosIncluidos || []).map((produtoIncluido: any) => {
          const produtoConfig = produtosConfig.find(p => p.id === produtoIncluido.produtoId);
          return {
            produtoId: produtoIncluido.produtoId,
            nome: produtoConfig?.nome || 'Produto não encontrado',
            quantidade: produtoIncluido.quantidade || 1,
            valorUnitarioCongelado: produtoConfig?.preco_venda || produtoConfig?.valorVenda || 0,
            tipo: 'incluso' as const
          };
        })
      };
    }

    // Processar produtos adicionais (se houver mais pacotes, são produtos manuais)
    produtosAdicionais = orcamentoAntigo.pacotes.slice(1).map(item => ({
      produtoId: item.id,
      nome: item.nome,
      quantidade: item.quantidade || 1,
      valorUnitarioCongelado: item.preco || 0,
      tipo: 'manual' as const
    }));
  }

  // Retornar orçamento na nova estrutura (compatibility mode)
  return {
    id: orcamentoAntigo.id,
    cliente: orcamentoAntigo.cliente,
    data: orcamentoAntigo.data,
    hora: orcamentoAntigo.hora,
    categoria: orcamentoAntigo.categoria,
    descricao: orcamentoAntigo.descricao,
    detalhes: orcamentoAntigo.detalhes,
    valorFinal: orcamentoAntigo.valorTotal || 0,
    desconto: orcamentoAntigo.desconto || 0,
    status: orcamentoAntigo.status as any,
    origemCliente: orcamentoAntigo.origemCliente,
    criadoEm: orcamentoAntigo.criadoEm,
    valorTotal: orcamentoAntigo.valorTotal,
  };
}

/**
 * Migra todos os orçamentos de uma lista para a nova estrutura
 */
export function migrateAllOrcamentos(
  orcamentosAntigos: OrcamentoAntigo[],
  pacotesConfig: any[],
  produtosConfig: any[]
): Orcamento[] {
  return orcamentosAntigos.map(orcamento => 
    migrateOrcamentoToNewStructure(orcamento, pacotesConfig, produtosConfig)
  );
}

/**
 * Verifica se um orçamento já está na nova estrutura (compatibility check)
 */
export function isNewStructure(orcamento: any): boolean {
  return orcamento.valorFinal !== undefined;
}

/**
 * Executa migração automática se necessário
 */
export function autoMigrateIfNeeded(
  orcamentos: any[],
  pacotesConfig: any[],
  produtosConfig: any[]
): Orcamento[] {
  const needsMigration = orcamentos.some(orc => !isNewStructure(orc));
  
  if (needsMigration) {
    console.log('🔄 Executando migração automática para nova estrutura de dados...');
    return migrateAllOrcamentos(orcamentos, pacotesConfig, produtosConfig);
  }
  
  return orcamentos as Orcamento[];
}
/**
 * Utilitários para Sistema de Precificação Flexível de Fotos Extras
 * 
 * Este arquivo contém a lógica centralizada para cálculo de preços de fotos extras
 * baseado no modelo de precificação configurado pelo usuário.
 */

// Tipos para o sistema de precificação
export interface FaixaPreco {
  min: number;
  max: number | null; // null significa "ou mais"
  valor: number;
}

export interface TabelaPrecos {
  id: string;
  nome: string;
  faixas: FaixaPreco[];
}

export interface ConfiguracaoPrecificacao {
  modelo: 'fixo' | 'global' | 'categoria';
  tabelaGlobal?: TabelaPrecos;
  // tabelasPorCategoria será armazenada nas próprias categorias
}

// Chaves do localStorage
export const STORAGE_KEYS = {
  PRECIFICACAO_CONFIG: 'precificacao_configuracao',
  PRECIFICACAO_TABELA_GLOBAL: 'precificacao_tabela_global'
};

/**
 * Obter configuração de precificação atual
 */
export function obterConfiguracaoPrecificacao(): ConfiguracaoPrecificacao {
  try {
    const config = localStorage.getItem(STORAGE_KEYS.PRECIFICACAO_CONFIG);
    if (config) {
      return JSON.parse(config);
    }
  } catch (error) {
    console.error('Erro ao carregar configuração de precificação:', error);
  }
  
  // Configuração padrão (modelo atual)
  return {
    modelo: 'fixo'
  };
}

/**
 * Salvar configuração de precificação
 */
export function salvarConfiguracaoPrecificacao(config: ConfiguracaoPrecificacao): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRECIFICACAO_CONFIG, JSON.stringify(config));
  } catch (error) {
    console.error('Erro ao salvar configuração de precificação:', error);
  }
}

/**
 * Obter tabela de preços global
 */
export function obterTabelaGlobal(): TabelaPrecos | null {
  try {
    const tabela = localStorage.getItem(STORAGE_KEYS.PRECIFICACAO_TABELA_GLOBAL);
    return tabela ? JSON.parse(tabela) : null;
  } catch (error) {
    console.error('Erro ao carregar tabela global de preços:', error);
    return null;
  }
}

/**
 * Salvar tabela de preços global
 */
export function salvarTabelaGlobal(tabela: TabelaPrecos): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRECIFICACAO_TABELA_GLOBAL, JSON.stringify(tabela));
  } catch (error) {
    console.error('Erro ao salvar tabela global de preços:', error);
  }
}

/**
 * Obter tabela de preços de uma categoria específica
 */
export function obterTabelaCategoria(categoriaId: string): TabelaPrecos | null {
  try {
    const categorias = localStorage.getItem('configuracoes_categorias');
    if (!categorias) return null;
    
    const categoriasArray = JSON.parse(categorias);
    const categoria = categoriasArray.find((cat: any) => cat.id === categoriaId);
    
    return categoria?.tabelaPrecosFotos || null;
  } catch (error) {
    console.error('Erro ao carregar tabela de categoria:', error);
    return null;
  }
}

/**
 * Salvar tabela de preços para uma categoria específica
 */
export function salvarTabelaCategoria(categoriaId: string, tabela: TabelaPrecos): void {
  try {
    const categorias = localStorage.getItem('configuracoes_categorias');
    if (!categorias) return;
    
    const categoriasArray = JSON.parse(categorias);
    const categoriaIndex = categoriasArray.findIndex((cat: any) => cat.id === categoriaId);
    
    if (categoriaIndex !== -1) {
      categoriasArray[categoriaIndex] = {
        ...categoriasArray[categoriaIndex],
        tabelaPrecosFotos: tabela
      };
      
      localStorage.setItem('configuracoes_categorias', JSON.stringify(categoriasArray));
    }
  } catch (error) {
    console.error('Erro ao salvar tabela de categoria:', error);
  }
}

/**
 * Calcular valor por foto baseado na faixa de quantidade
 */
export function calcularValorPorFoto(quantidade: number, tabela: TabelaPrecos): number {
  if (!tabela || !tabela.faixas || quantidade <= 0) {
    return 0;
  }

  // Ordenar faixas por min crescente para garantir ordem correta
  const faixasOrdenadas = [...tabela.faixas].sort((a, b) => a.min - b.min);

  for (const faixa of faixasOrdenadas) {
    if (quantidade >= faixa.min && (faixa.max === null || quantidade <= faixa.max)) {
      return faixa.valor;
    }
  }

  // Se não encontrou faixa específica, usar a última faixa (maior valor)
  return faixasOrdenadas[faixasOrdenadas.length - 1]?.valor || 0;
}

/**
 * MOTOR DE CÁLCULO PRINCIPAL - Calcular total de fotos extras
 * 
 * Esta é a função principal que deve ser usada em todo o sistema
 * para calcular o valor total de fotos extras.
 */
export function calcularTotalFotosExtras(
  quantidade: number,
  pacoteInfo?: {
    valorFotoExtra?: number;
    categoria?: string;
    categoriaId?: string;
  }
): number {
  if (quantidade <= 0) {
    return 0;
  }

  const config = obterConfiguracaoPrecificacao();

  switch (config.modelo) {
    case 'fixo':
      // Modelo atual - usar valor fixo do pacote
      const valorFixo = pacoteInfo?.valorFotoExtra || 0;
      return quantidade * valorFixo;

    case 'global':
      // Usar tabela global de preços
      const tabelaGlobal = obterTabelaGlobal();
      if (!tabelaGlobal) {
        console.warn('Tabela global não configurada, usando valor 0');
        return 0;
      }
      const valorPorFotoGlobal = calcularValorPorFoto(quantidade, tabelaGlobal);
      return quantidade * valorPorFotoGlobal;

    case 'categoria':
      // Usar tabela da categoria específica
      const categoriaId = pacoteInfo?.categoriaId;
      if (!categoriaId) {
        console.warn('ID da categoria não fornecido para cálculo por categoria');
        return 0;
      }
      
      const tabelaCategoria = obterTabelaCategoria(categoriaId);
      if (!tabelaCategoria) {
        console.warn(`Tabela de preços não configurada para categoria ${categoriaId}`);
        return 0;
      }
      
      const valorPorFotoCategoria = calcularValorPorFoto(quantidade, tabelaCategoria);
      return quantidade * valorPorFotoCategoria;

    default:
      console.error('Modelo de precificação desconhecido:', config.modelo);
      return 0;
  }
}

/**
 * Função auxiliar para formatar valor monetário
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

/**
 * Função auxiliar para validar tabela de preços
 */
export function validarTabelaPrecos(tabela: TabelaPrecos): string[] {
  const erros = [];

  if (!tabela.nome || tabela.nome.trim() === '') {
    erros.push('Nome da tabela é obrigatório');
  }

  if (!tabela.faixas || tabela.faixas.length === 0) {
    erros.push('Pelo menos uma faixa de preços deve ser configurada');
  }

  if (tabela.faixas) {
    // Verificar se há sobreposições ou lacunas
    const faixasOrdenadas = [...tabela.faixas].sort((a, b) => a.min - b.min);
    
    for (let i = 0; i < faixasOrdenadas.length; i++) {
      const faixa = faixasOrdenadas[i];
      
      if (faixa.min < 0) {
        erros.push(`Faixa ${i + 1}: Valor mínimo não pode ser negativo`);
      }
      
      if (faixa.max !== null && faixa.max < faixa.min) {
        erros.push(`Faixa ${i + 1}: Valor máximo deve ser maior que o mínimo`);
      }
      
      if (faixa.valor < 0) {
        erros.push(`Faixa ${i + 1}: Valor por foto não pode ser negativo`);
      }
      
      // Verificar sobreposição com próxima faixa
      if (i < faixasOrdenadas.length - 1) {
        const proximaFaixa = faixasOrdenadas[i + 1];
        if (faixa.max !== null && faixa.max >= proximaFaixa.min) {
          erros.push(`Faixas ${i + 1} e ${i + 2}: Há sobreposição entre as faixas`);
        }
      }
    }
  }

  return erros;
}

/**
 * Criar tabela de exemplo para demonstração
 */
export function criarTabelaExemplo(): TabelaPrecos {
  return {
    id: `tabela_${Date.now()}`,
    nome: 'Tabela Progressiva Padrão',
    faixas: [
      { min: 1, max: 5, valor: 35 },
      { min: 6, max: 10, valor: 30 },
      { min: 11, max: 20, valor: 25 },
      { min: 21, max: null, valor: 20 }
    ]
  };
}

// ============= SISTEMA DE CONGELAMENTO DE REGRAS =============

export interface RegrasPrecoFotoExtraCongeladas {
  modelo: 'fixo' | 'global' | 'categoria';
  valorFixo?: number;
  tabelaGlobal?: TabelaPrecos;
  tabelaCategoria?: TabelaPrecos;
  categoriaId?: string;
  timestampCongelamento: string;
}

/**
 * FUNÇÃO PRINCIPAL - Congelar regras de preço ativas no momento da criação
 * 
 * Esta função captura um "snapshot" das regras de precificação ativas
 * e as armazena para uso futuro, garantindo que mudanças nas configurações
 * não afetem cálculos já realizados.
 */
export function congelarRegrasPrecoFotoExtra(
  pacoteInfo?: {
    valorFotoExtra?: number;
    categoria?: string;
    categoriaId?: string;
  }
): RegrasPrecoFotoExtraCongeladas {
  const config = obterConfiguracaoPrecificacao();
  const timestamp = new Date().toISOString();

  console.log('🧊 Congelando regras de preço:', { config, pacoteInfo });

  switch (config.modelo) {
    case 'fixo':
      return {
        modelo: 'fixo',
        valorFixo: pacoteInfo?.valorFotoExtra || 35, // Valor padrão
        timestampCongelamento: timestamp
      };

    case 'global':
      const tabelaGlobal = obterTabelaGlobal();
      if (!tabelaGlobal) {
        console.warn('⚠️ Tabela global não configurada, usando modelo fixo como fallback');
        return {
          modelo: 'fixo',
          valorFixo: 35,
          timestampCongelamento: timestamp
        };
      }
      return {
        modelo: 'global',
        tabelaGlobal: JSON.parse(JSON.stringify(tabelaGlobal)), // Deep copy
        timestampCongelamento: timestamp
      };

    case 'categoria':
      const categoriaId = pacoteInfo?.categoriaId;
      if (!categoriaId) {
        console.warn('⚠️ ID da categoria não fornecido, usando modelo fixo como fallback');
        return {
          modelo: 'fixo',
          valorFixo: pacoteInfo?.valorFotoExtra || 35,
          timestampCongelamento: timestamp
        };
      }

      const tabelaCategoria = obterTabelaCategoria(categoriaId);
      if (!tabelaCategoria) {
        console.warn(`⚠️ Tabela não configurada para categoria ${categoriaId}, usando modelo fixo como fallback`);
        return {
          modelo: 'fixo',
          valorFixo: pacoteInfo?.valorFotoExtra || 35,
          timestampCongelamento: timestamp
        };
      }

      return {
        modelo: 'categoria',
        tabelaCategoria: JSON.parse(JSON.stringify(tabelaCategoria)), // Deep copy
        categoriaId,
        timestampCongelamento: timestamp
      };

    default:
      console.error('❌ Modelo de precificação desconhecido:', config.modelo);
      return {
        modelo: 'fixo',
        valorFixo: 35,
        timestampCongelamento: timestamp
      };
  }
}

/**
 * FUNÇÃO DE CÁLCULO COM REGRAS CONGELADAS - VERSÃO CORRIGIDA
 * 
 * Esta função calcula o total usando as regras específicas armazenadas
 * no item, em vez das configurações globais atuais.
 */
export function calcularComRegrasProprias(
  quantidade: number,
  regrasCongeladas: RegrasPrecoFotoExtraCongeladas
): number {
  console.log('🧮 [INICIO] Calculando com regras próprias:', { 
    quantidade, 
    modelo: regrasCongeladas.modelo,
    timestamp: regrasCongeladas.timestampCongelamento 
  });

  // VALIDAÇÃO INICIAL
  if (quantidade <= 0) {
    console.log('✅ Quantidade zero, retornando 0');
    return 0;
  }

  if (!regrasCongeladas) {
    console.error('❌ Regras congeladas não fornecidas');
    return 0;
  }

  let resultado = 0;

  try {
    switch (regrasCongeladas.modelo) {
      case 'fixo':
        const valorFixo = regrasCongeladas.valorFixo || 0;
        resultado = quantidade * valorFixo;
        console.log('💰 [FIXO] Calculado:', { quantidade, valorFixo, resultado });
        break;

      case 'global':
        if (!regrasCongeladas.tabelaGlobal) {
          console.error('❌ [GLOBAL] Tabela global não encontrada nas regras congeladas');
          return 0;
        }
        
        console.log('📊 [GLOBAL] Usando tabela:', regrasCongeladas.tabelaGlobal);
        const valorPorFotoGlobal = calcularValorPorFoto(quantidade, regrasCongeladas.tabelaGlobal);
        resultado = quantidade * valorPorFotoGlobal;
        console.log('💰 [GLOBAL] Calculado:', { quantidade, valorPorFoto: valorPorFotoGlobal, resultado });
        break;

      case 'categoria':
        if (!regrasCongeladas.tabelaCategoria) {
          console.error('❌ [CATEGORIA] Tabela de categoria não encontrada nas regras congeladas');
          return 0;
        }
        
        console.log('📊 [CATEGORIA] Usando tabela:', regrasCongeladas.tabelaCategoria);
        const valorPorFotoCategoria = calcularValorPorFoto(quantidade, regrasCongeladas.tabelaCategoria);
        resultado = quantidade * valorPorFotoCategoria;
        console.log('💰 [CATEGORIA] Calculado:', { quantidade, valorPorFoto: valorPorFotoCategoria, resultado });
        break;

      default:
        console.error('❌ Modelo de regras congeladas desconhecido:', regrasCongeladas.modelo);
        return 0;
    }

    console.log('✅ [FINAL] Cálculo concluído:', resultado);
    return resultado;

  } catch (error) {
    console.error('❌ [ERRO] Falha no cálculo com regras próprias:', error);
    return 0;
  }
}

/**
 * FUNÇÃO DE MIGRAÇÃO - VERSÃO CORRIGIDA
 * 
 * Para itens antigos que não possuem regras congeladas,
 * aplica regras padrão baseadas nos dados existentes.
 * 
 * IMPORTANTE: Esta função deve preservar o valor original que estava
 * no item quando foi criado, não o valor atual das configurações.
 */
export function migrarRegrasParaItemAntigo(
  valorFotoExtraOriginal?: number,
  categoriaId?: string
): RegrasPrecoFotoExtraCongeladas {
  console.log('🔄 [MIGRAÇÃO] Iniciando migração para item antigo:', {
    valorOriginal: valorFotoExtraOriginal,
    categoriaId
  });
  
  // Usar o valor que estava no item quando foi criado
  // Se não tiver valor, usar padrão histórico (35)
  const valorFixoPreservado = valorFotoExtraOriginal && valorFotoExtraOriginal > 0 
    ? valorFotoExtraOriginal 
    : 35;

  const regrasCongeladas = {
    modelo: 'fixo' as const,
    valorFixo: valorFixoPreservado,
    timestampCongelamento: new Date().toISOString()
  };

  console.log('✅ [MIGRAÇÃO] Regras criadas:', regrasCongeladas);
  
  return regrasCongeladas;
}

/**
 * FUNÇÃO DE DEBUG - Para inspecionar dados no localStorage
 */
export function debugWorkflowItems(): void {
  try {
    const items = localStorage.getItem('workflow_sessions');
    if (items) {
      const parsedItems = JSON.parse(items);
      console.log('🔍 [DEBUG] Workflow Items:', parsedItems);
      
      parsedItems.forEach((item: any, index: number) => {
        console.log(`📋 [DEBUG] Item ${index + 1}:`, {
          id: item.id,
          pacote: item.pacote,
          valorFotoExtra: item.valorFotoExtra,
          qtdFotoExtra: item.qtdFotoExtra,
          valorTotalFotoExtra: item.valorTotalFotoExtra,
          temRegrasCongeladas: !!item.regrasDePrecoFotoExtraCongeladas,
          regrasCongeladas: item.regrasDePrecoFotoExtraCongeladas
        });
      });
    }
  } catch (error) {
    console.error('❌ [DEBUG] Erro ao inspecionar items:', error);
  }
}

/**
 * FUNÇÃO DE VALIDAÇÃO - Verifica integridade das regras congeladas
 */
export function validarRegrasCongeladas(regras: RegrasPrecoFotoExtraCongeladas): boolean {
  if (!regras) return false;
  
  if (!regras.modelo || !regras.timestampCongelamento) return false;
  
  switch (regras.modelo) {
    case 'fixo':
      return typeof regras.valorFixo === 'number' && regras.valorFixo >= 0;
    case 'global':
      return !!regras.tabelaGlobal && Array.isArray(regras.tabelaGlobal.faixas);
    case 'categoria':
      return !!regras.tabelaCategoria && Array.isArray(regras.tabelaCategoria.faixas);
    default:
      return false;
  }
}
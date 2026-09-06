/**
 * Núcleo de cálculo de fotos extras e recuperação de dados congelados
 */

import { obterTabelaCategoria } from '@/utils/precificacaoUtils';
import { RegrasCongeladas, PacoteCongelado, ProdutoCongelado } from './types';

/**
 * Calcula valor por tabela de preços progressivos
 */
export function calcularValorPorTabela(quantidade: number, tabela: any): number {
  if (!tabela?.faixas?.length) return 0;
  
  const faixasOrdenadas = [...tabela.faixas].sort((a, b) => a.min - b.min);
  
  for (const faixa of faixasOrdenadas) {
    if (quantidade >= faixa.min && (faixa.max === null || quantidade <= faixa.max)) {
      return faixa.valor;
    }
  }
  
  return faixasOrdenadas[faixasOrdenadas.length - 1].valor;
}

/**
 * Calcula o valor da foto extra usando regras congeladas
 */
export function calcularValorFotoExtraComRegrasCongeladas(
  quantidade: number, 
  regrasCongeladas: RegrasCongeladas
): { valorUnitario: number; valorTotal: number } {
  let valorUnitario = 0;

  const regrasPrecoFoto = regrasCongeladas.precificacaoFotoExtra || regrasCongeladas;

  console.log('💰 Calculando valor foto extra:', {
    quantidade,
    modelo: regrasPrecoFoto.modelo,
    valorPacote: regrasCongeladas.pacote?.valorFotoExtra,
    valorFixo: regrasPrecoFoto.valorFixo
  });

  switch (regrasPrecoFoto.modelo) {
    case 'fixo':
      if (regrasCongeladas.pacote?.valorFotoExtra !== undefined) {
        valorUnitario = regrasCongeladas.pacote.valorFotoExtra;
        console.log('✅ Modelo fixo: usando valor do pacote congelado:', valorUnitario);
      } else {
        valorUnitario = regrasPrecoFoto.valorFixo || 0;
        console.log('⚠️ Modelo fixo: usando valorFixo configurado:', valorUnitario);
      }
      break;
    
    case 'global': {
      const tabelaGlobal = regrasPrecoFoto.tabelaGlobal;
      if (tabelaGlobal?.faixas?.length > 0) {
        valorUnitario = calcularValorPorTabela(quantidade, tabelaGlobal);
        console.log('📊 Modelo global: valor calculado por tabela:', valorUnitario, 'para quantidade:', quantidade);
      } else {
        console.warn('⚠️ Modelo global: tabela global não encontrada ou vazia');
        valorUnitario = 0;
      }
      break;
    }
      
    case 'categoria': {
      let tabelaCategoria = regrasPrecoFoto.tabelaCategoria;
      
      if (!tabelaCategoria?.faixas?.length && regrasCongeladas.pacote?.categoriaId) {
        console.warn('⚠️ Tabela categoria null nas regras, tentando recarregar do cache...');
        tabelaCategoria = obterTabelaCategoria(regrasCongeladas.pacote.categoriaId);
        
        if (tabelaCategoria) {
          console.log('✅ Tabela categoria recuperada do cache:', tabelaCategoria.nome);
        }
      }
      
      if (tabelaCategoria?.faixas?.length > 0) {
        valorUnitario = calcularValorPorTabela(quantidade, tabelaCategoria);
        console.log('📊 Modelo categoria: valor calculado por tabela:', valorUnitario, 'para quantidade:', quantidade, 'tabela:', tabelaCategoria.nome);
      } else {
        console.error('❌ ERRO: Tabela categoria não disponível. CategoriaId:', regrasCongeladas.pacote?.categoriaId);
        valorUnitario = 0;
      }
      break;
    }
    
    default:
      console.warn('⚠️ Modelo de preço desconhecido:', regrasPrecoFoto.modelo);
      valorUnitario = 0;
  }

  const resultado = {
    valorUnitario,
    valorTotal: valorUnitario * quantidade
  };

  console.log('✅ Resultado final foto extra:', resultado);
  return resultado;
}

/**
 * Obtém dados de pacote congelados ou resolve dinamicamente
 */
export function obterDadosPacoteCongelados(regrasCongeladas?: RegrasCongeladas, pacoteId?: string): PacoteCongelado | null {
  if (regrasCongeladas?.pacote) {
    return regrasCongeladas.pacote;
  }
  return null;
}

/**
 * Obtém dados de produtos congelados
 */
export function obterDadosProdutosCongelados(regrasCongeladas?: RegrasCongeladas): ProdutoCongelado[] {
  if (regrasCongeladas?.produtos) {
    return regrasCongeladas.produtos;
  }
  return [];
}

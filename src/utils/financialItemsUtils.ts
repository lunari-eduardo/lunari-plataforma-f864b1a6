/**
 * UTILITÁRIOS PARA ITENS FINANCEIROS
 * 
 * Funções auxiliares para manipulação e formatação de dados dos itens financeiros
 */

import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { GRUPOS_PRINCIPAIS } from '@/constants/financialConstants';

// ============= AGRUPAMENTO DE ITENS =============

/**
 * Agrupa itens financeiros por grupo principal
 */
export function agruparItensPorGrupo(itens: ItemFinanceiro[]): Record<GrupoPrincipal, ItemFinanceiro[]> {
  return GRUPOS_PRINCIPAIS.reduce((acc, grupo) => {
    acc[grupo] = itens.filter(item => item.grupo_principal === grupo && item.ativo);
    return acc;
  }, {} as Record<GrupoPrincipal, ItemFinanceiro[]>);
}

// ============= VALIDAÇÕES =============

/**
 * Valida se um nome de item já existe
 */
export function validarNomeExistente(
  nome: string, 
  itens: ItemFinanceiro[], 
  excludeId?: string
): boolean {
  return itens.some(item => 
    item.id !== excludeId && 
    item.nome.toLowerCase() === nome.trim().toLowerCase()
  );
}

/**
 * Valida se um nome é válido (não vazio após trim)
 */
export function validarNomeValido(nome: string): boolean {
  return nome.trim().length > 0;
}

/**
 * Valida dias do mês (1-31)
 */
export function validarDiaMes(dia: number): boolean {
  return dia >= 1 && dia <= 31;
}

// ============= FORMATAÇÃO =============

/**
 * Formata nome do item (capitaliza primeira letra)
 */
export function formatarNomeItem(nome: string): string {
  return nome.trim().charAt(0).toUpperCase() + nome.trim().slice(1).toLowerCase();
}

// ============= ESTATÍSTICAS =============

/**
 * Calcula estatísticas dos itens por grupo
 */
export function calcularEstatisticasPorGrupo(itens: ItemFinanceiro[]) {
  const itensPorGrupo = agruparItensPorGrupo(itens);
  
  return GRUPOS_PRINCIPAIS.map(grupo => ({
    grupo,
    quantidade: itensPorGrupo[grupo].length,
    itens: itensPorGrupo[grupo]
  }));
}

/**
 * Conta total de itens ativos
 */
export function contarItensAtivos(itens: ItemFinanceiro[]): number {
  return itens.filter(item => item.ativo).length;
}
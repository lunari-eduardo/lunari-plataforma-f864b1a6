/**
 * Serviço de Precificação - Camada de Abstração para Dados
 * Preparado para migração Supabase multi-usuário
 *
 * Refatorado: Fachada modular re-exportando os serviços desacoplados (< 500 linhas).
 */

export { VERSAO_ATUAL, USUARIO_LOCAL } from './pricing-service/constants';
export { EstruturaCustosService } from './pricing-service/EstruturaCustosService';
export { PadraoHorasService } from './pricing-service/PadraoHorasService';
export { MetasService } from './pricing-service/MetasService';
export { CalculadoraService } from './pricing-service/CalculadoraService';
export { ValidacaoService } from './pricing-service/ValidacaoService';
export { BackupService } from './pricing-service/BackupService';
export { IndicadoresService } from './pricing-service/IndicadoresService';
export { MigracaoService } from './pricing-service/MigracaoService';

/**
 * Snapshot da página Precificação para o Assistente Lu (Bloco B2).
 *
 * Reflete o que o fotógrafo vê na calculadora/configuração de preços.
 * Não é fonte de verdade: números reais vêm das capabilities `precificacao.*`.
 */
import type { AuthUser } from "@/shared/ports";
import type { PricingModelo } from "../domain/types";
import { listPrecificacaoCapabilityIds } from "./permissions";

export interface PrecificacaoPageSnapshot {
  version: 1;
  route: "/configuracoes/precificacao";
  modelo: PricingModelo | null;
  estrutura: {
    custoPorHora: number | null;
    margemLucroDesejada: number | null;
    horasDisponiveis: number | null;
    diasTrabalhados: number | null;
  };
  tabelas: {
    temGlobal: boolean;
    categoriasComTabela: number;
  };
  permissions: {
    canRead: boolean;
    canSimulate: boolean;
    canWritePrice: boolean;
    isAuthenticated: boolean;
  };
  capabilities: string[];
  userTz: string;
  notes: string[];
}

export interface BuildPrecificacaoSnapshotInput {
  user: AuthUser | null;
  modelo?: PricingModelo | null;
  custoPorHora?: number | null;
  margemLucroDesejada?: number | null;
  horasDisponiveis?: number | null;
  diasTrabalhados?: number | null;
  temGlobal?: boolean;
  categoriasComTabela?: number;
}

export function buildPrecificacaoPageSnapshot(
  input: BuildPrecificacaoSnapshotInput,
): PrecificacaoPageSnapshot {
  const { user } = input;
  return {
    version: 1,
    route: "/configuracoes/precificacao",
    modelo: input.modelo ?? null,
    estrutura: {
      custoPorHora: input.custoPorHora ?? null,
      margemLucroDesejada: input.margemLucroDesejada ?? null,
      horasDisponiveis: input.horasDisponiveis ?? null,
      diasTrabalhados: input.diasTrabalhados ?? null,
    },
    tabelas: {
      temGlobal: input.temGlobal ?? false,
      categoriasComTabela: input.categoriasComTabela ?? 0,
    },
    permissions: {
      canRead: !!user,
      canSimulate: !!user,
      canWritePrice: !!user,
      isAuthenticated: !!user,
    },
    capabilities: listPrecificacaoCapabilityIds(),
    userTz: "America/Sao_Paulo",
    notes: [
      "Simular nunca grava: use precificacao.simular* antes de propor qualquer alteração de preço.",
      "Toda escrita de preço exige aprovação humana explícita.",
      "Alterações de preço valem só para sessões novas — sessões existentes têm regras congeladas.",
      "O modelo ativo define como fotos extras são cobradas: fixo (valor do pacote), global ou por categoria.",
      "Custo por hora depende de custos fixos, horas produtivas e pró-labore: se estiver zerado, a simulação não é confiável.",
    ],
  };
}

export function snapshotForPrecificacao(user: AuthUser | null): PrecificacaoPageSnapshot {
  return buildPrecificacaoPageSnapshot({ user });
}

export function debugPrecificacaoSnapshot(
  s: PrecificacaoPageSnapshot,
): Record<string, unknown> {
  return {
    route: s.route,
    modelo: s.modelo,
    temGlobal: s.tabelas.temGlobal,
    capabilities: s.capabilities.length,
  };
}

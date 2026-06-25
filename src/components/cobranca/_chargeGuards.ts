/**
 * Guards client-side espelhando o helper das edges
 * (`supabase/functions/_shared/cobrancaBinding.ts`).
 *
 * Usados antes dos dois INSERTs em `cobrancas` que ainda acontecem no cliente:
 *   - `ChargeModal.handleAsaasGenerateLink`
 *   - `useCobranca.createPixManualCharge`
 *
 * O `tg_protect_no_overcharge` no banco é a defesa final; aqui evitamos
 * mostrar erro genérico ao usuário e bloqueamos ambiguidade (que o trigger
 * não detecta).
 */
import { supabase } from '@/integrations/supabase/client';

export interface ExtraPaymentSnapshot {
  success?: boolean;
  valor_a_cobrar?: number;
  valor_pago?: number;
  valor_unitario?: number;
  rules_source?: string;
  extras_necessarias?: number;
  extras_pagas?: number;
  selected_count?: number;
  included_count?: number;
  error?: string;
}

export type ChargeGuardError =
  | { code: 'EXTRA_PAYMENT_RPC_FAILED'; message: string }
  | { code: 'EXTRA_PAYMENT_EXCEEDS_IDEAL'; message: string; snapshot: ExtraPaymentSnapshot }
  | {
      code: 'AMBIGUOUS_PURPOSE_USE_FOTOS_EXTRAS';
      message: string;
      details: { galeriaId: string; valorSaldoExtras: number; qtdSugerida: number; nomeGaleria?: string };
    };

export async function assertExtraPaymentWithinIdealClient(
  galeriaId: string,
  valor: number,
): Promise<{ error?: ChargeGuardError; snapshot?: ExtraPaymentSnapshot }> {
  const { data, error } = await supabase.rpc('calculate_gallery_extra_payment', {
    p_gallery_id: galeriaId,
  });
  const snap = (data ?? {}) as ExtraPaymentSnapshot;
  if (error || !data || snap.success === false) {
    return {
      error: {
        code: 'EXTRA_PAYMENT_RPC_FAILED',
        message:
          snap.error ||
          error?.message ||
          'Não foi possível calcular o saldo de fotos extras desta galeria.',
      },
    };
  }
  const idealRemaining = Number(snap.valor_a_cobrar ?? 0);
  if (valor > idealRemaining + 0.01) {
    return {
      error: {
        code: 'EXTRA_PAYMENT_EXCEEDS_IDEAL',
        message: `Regra congelada: máximo R$ ${idealRemaining.toFixed(2)} (já pago R$ ${Number(
          snap.valor_pago ?? 0,
        ).toFixed(2)}).`,
        snapshot: snap,
      },
      snapshot: snap,
    };
  }
  return { snapshot: snap };
}

export async function assertNotAmbiguousSessionChargeClient(
  sessionId: string,
  valor: number,
  allowAmbiguous = false,
): Promise<{ error?: ChargeGuardError }> {
  if (allowAmbiguous) return {};
  const { data: galerias } = await supabase
    .from('galerias')
    .select('id, nome_sessao, fotos_selecionadas, fotos_incluidas, status_pagamento')
    .eq('session_id', sessionId);
  if (!galerias || galerias.length === 0) return {};
  for (const g of galerias) {
    const selecionadas = Number(g.fotos_selecionadas ?? 0);
    const incluidas = Number(g.fotos_incluidas ?? 0);
    if (selecionadas <= incluidas) continue;
    if (g.status_pagamento === 'pago') continue;
    const { data: rpc } = await supabase.rpc('calculate_gallery_extra_payment', {
      p_gallery_id: g.id,
    });
    const snap = (rpc ?? {}) as ExtraPaymentSnapshot;
    if (!rpc || snap.success === false) continue;
    const saldo = Number(snap.valor_a_cobrar ?? 0);
    if (saldo <= 0) continue;
    const tolerancia = Math.max(saldo * 0.01, 0.01);
    if (Math.abs(valor - saldo) <= tolerancia) {
      return {
        error: {
          code: 'AMBIGUOUS_PURPOSE_USE_FOTOS_EXTRAS',
          message: `Esta sessão tem R$ ${saldo.toFixed(2)} pendentes em fotos extras na galeria "${
            g.nome_sessao ?? '—'
          }". Cobre como "fotos extras" para evitar duplicar receita.`,
          details: {
            galeriaId: g.id,
            valorSaldoExtras: saldo,
            qtdSugerida:
              Number(snap.extras_necessarias ?? 0) - Number(snap.extras_pagas ?? 0),
            nomeGaleria: g.nome_sessao ?? undefined,
          },
        },
      };
    }
  }
  return {};
}

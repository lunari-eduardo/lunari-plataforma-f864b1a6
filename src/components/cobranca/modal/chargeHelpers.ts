import { supabase } from '@/integrations/supabase/client';
import { assertNotAmbiguousSessionChargeClient } from '../_chargeGuards';
import { type PayerFieldsValue, type PayerFieldsValidity } from '../PayerFieldsBlock';
import { unmaskDigits } from '@/lib/validateCpfCnpj';
import { normalizeAsaasFees, type NormalizedAsaasFees } from '@/lib/anticipationUtils';

export interface BindingPayloadInput {
  finalidade?: 'sessao' | 'fotos_extras' | 'sessao_e_extras';
  galeriaId?: string | null;
  qtdFotos?: number | null;
  snapshotFotosIncluidas?: number | null;
  valorSessaoComponente?: number | null;
  valorExtrasComponente?: number | null;
  sessionId?: string;
  valor: number;
}

export interface BindingPayloadResult {
  finalidade: 'sessao' | 'fotos_extras' | 'sessao_e_extras';
  galeriaId?: string | null;
  qtdFotos?: number | null;
  snapshotFotosIncluidas?: number | null;
  valorSessaoComponente?: number | null;
  valorExtrasComponente?: number | null;
}

export async function buildBindingPayload(
  input: BindingPayloadInput
): Promise<BindingPayloadResult | null> {
  const { toast } = await import('sonner');
  if (input.finalidade === 'fotos_extras') {
    const qtd = Number(input.qtdFotos ?? 0);
    return {
      finalidade: 'fotos_extras',
      galeriaId: input.galeriaId || null,
      qtdFotos: qtd > 0 ? Math.trunc(qtd) : 1,
      snapshotFotosIncluidas: input.snapshotFotosIncluidas || null,
    };
  }
  if (input.finalidade === 'sessao_e_extras') {
    return {
      finalidade: 'sessao_e_extras',
      galeriaId: input.galeriaId || null,
      qtdFotos: input.qtdFotos || null,
      snapshotFotosIncluidas: input.snapshotFotosIncluidas || null,
      valorSessaoComponente: input.valorSessaoComponente ?? 0,
      valorExtrasComponente: input.valorExtrasComponente ?? input.valor,
    };
  }
  if (input.sessionId) {
    const guard = await assertNotAmbiguousSessionChargeClient(input.sessionId, input.valor);
    if (guard.error) {
      toast.error(guard.error.message);
      return null;
    }
  }
  return { finalidade: 'sessao' };
}

export async function persistPayerToCrm(
  clienteId: string,
  payer: PayerFieldsValue,
  payerValidity: PayerFieldsValidity | null
) {
  try {
    const { data: current } = await supabase
      .from('clientes')
      .select('nome, email, telefone, cpf_cnpj')
      .eq('id', clienteId)
      .maybeSingle();
    if (!current) return;
    const patch: Record<string, string> = {};
    const isEmpty = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');
    if (payer.nome.trim() && isEmpty(current.nome)) patch.nome = payer.nome.trim();
    if (payer.email.trim() && isEmpty(current.email) && payerValidity?.email) {
      patch.email = payer.email.trim();
    }
    if (payer.telefone && isEmpty(current.telefone) && payerValidity?.telefone) {
      patch.telefone = unmaskDigits(payer.telefone);
    }
    if (payer.cpfCnpj && isEmpty((current as any).cpf_cnpj) && payerValidity?.cpfCnpj) {
      (patch as any).cpf_cnpj = unmaskDigits(payer.cpfCnpj);
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from('clientes').update(patch).eq('id', clienteId);
    }
  } catch (err) {
    console.warn('[persistPayerToCrm] failed:', err);
  }
}

export function calcularLiquidoEstimado({
  valor,
  overrideRepassarTaxas,
  overrideAntecipar,
  overrideRepassarAntecipacao,
  accountFees,
}: {
  valor: number;
  overrideRepassarTaxas: boolean;
  overrideAntecipar: boolean;
  overrideRepassarAntecipacao: boolean;
  accountFees: NormalizedAsaasFees | null;
}) {
  if (!valor || valor <= 0) return { liquido: 0, detalhe: '' };

  if (overrideRepassarTaxas && (!overrideAntecipar || overrideRepassarAntecipacao)) {
    return {
      liquido: valor,
      detalhe: 'Cliente arca com as taxas de processamento.',
    };
  }

  const fees = accountFees || normalizeAsaasFees(null);
  const tier1 = fees.creditCard?.tiers?.[0] || { percentageFee: 2.99 };
  const opVal = fees.creditCard?.operationValue ?? 0.49;

  let descontoProcessamento = 0;
  if (!overrideRepassarTaxas) {
    descontoProcessamento = (valor * tier1.percentageFee / 100) + opVal;
  }

  let descontoAntecipacao = 0;
  if (overrideAntecipar && !overrideRepassarAntecipacao) {
    const taxaMensal = fees.creditCard?.detachedMonthlyFeeValue ?? 1.25;
    descontoAntecipacao = valor * (taxaMensal / 100);
  }

  const totalDesconto = descontoProcessamento + descontoAntecipacao;
  const liquido = Math.max(0, valor - totalDesconto);

  const desc = [];
  if (!overrideRepassarTaxas) desc.push(`processamento (~R$ ${descontoProcessamento.toFixed(2).replace('.', ',')})`);
  if (overrideAntecipar && !overrideRepassarAntecipacao) desc.push(`antecipação (~R$ ${descontoAntecipacao.toFixed(2).replace('.', ',')})`);

  const detalhe = desc.length > 0
    ? `Você absorve ${desc.join(' e ')}.`
    : 'Você absorve as taxas no cartão.';

  return { liquido, detalhe };
}

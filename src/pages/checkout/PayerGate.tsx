/**
 * PayerGate — bloco único de coleta dos dados do pagador no checkout público.
 *
 * Mostra apenas os campos faltantes (Nome, E-mail, Telefone, CPF/CNPJ),
 * valida com os helpers oficiais e grava no CRM via `checkout-save-payer`
 * (nunca sobrescreve dado existente).
 */
import { useState } from 'react';
import { User, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  isAsciiEmail,
  isValidPhoneBR,
  maskCpfCnpj,
  maskPhoneBR,
  unmaskDigits,
  validateCpfCnpj,
} from '@/lib/validateCpfCnpj';

const SUPABASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'tlnjspsywycbudhewsfv'}.supabase.co`;

export interface PayerValue {
  nome: string;
  email: string;
  telefone: string;
  cpfCnpj: string;
}

export interface PayerGateProps {
  cobrancaId: string;
  value: PayerValue;
  onChange: (v: PayerValue) => void;
  /** Campos exigidos pelo provedor. */
  required: Array<keyof PayerValue>;
  onDone: () => void;
  ctaLabel?: string;
  loading?: boolean;
}

export function isPayerFieldValid(field: keyof PayerValue, v: PayerValue): boolean {
  switch (field) {
    case 'nome':
      return v.nome.trim().length >= 2;
    case 'email':
      return isAsciiEmail(v.email);
    case 'telefone':
      return isValidPhoneBR(v.telefone);
    case 'cpfCnpj':
      return validateCpfCnpj(v.cpfCnpj);
  }
}

export function payerMissingFields(
  required: Array<keyof PayerValue>,
  v: PayerValue,
): Array<keyof PayerValue> {
  return required.filter((f) => !isPayerFieldValid(f, v));
}

export async function savePayerToCrm(cobrancaId: string, v: PayerValue): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/checkout-save-payer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cobrancaId,
        payer: {
          nome: v.nome.trim() || undefined,
          email: isAsciiEmail(v.email) ? v.email.trim() : undefined,
          telefone: unmaskDigits(v.telefone) || undefined,
          cpfCnpj: unmaskDigits(v.cpfCnpj) || undefined,
        },
      }),
    });
  } catch {
    /* nunca bloqueia o pagamento */
  }
}

const LABELS: Record<keyof PayerValue, string> = {
  nome: 'Nome completo',
  email: 'E-mail',
  telefone: 'Telefone',
  cpfCnpj: 'CPF ou CNPJ',
};

export default function PayerGate({
  cobrancaId,
  value,
  onChange,
  required,
  onDone,
  ctaLabel = 'Continuar',
  loading = false,
}: PayerGateProps) {
  const [saving, setSaving] = useState(false);
  const missing = payerMissingFields(required, value);
  const set = (patch: Partial<PayerValue>) => onChange({ ...value, ...patch });

  const handleContinue = async () => {
    if (missing.length > 0) return;
    setSaving(true);
    await savePayerToCrm(cobrancaId, value);
    setSaving(false);
    onDone();
  };

  const showField = (f: keyof PayerValue) => required.includes(f);

  return (
    <div className="space-y-4">
      {required.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
            <User className="h-4 w-4 text-primary" />
            Seus dados
          </div>
          <p className="text-xs text-neutral-600">
            Precisamos destes dados para emitir a cobrança e enviar o comprovante.
          </p>

          {showField('nome') && (
            <div className="space-y-1">
              <Label className="text-xs text-neutral-700">{LABELS.nome}</Label>
              <Input
                value={value.nome}
                onChange={(e) => set({ nome: e.target.value })}
                placeholder="Seu nome"
                autoComplete="name"
                className="bg-white border-neutral-200"
              />
            </div>
          )}
          {showField('cpfCnpj') && (
            <div className="space-y-1">
              <Label className="text-xs text-neutral-700">{LABELS.cpfCnpj}</Label>
              <Input
                value={value.cpfCnpj}
                onChange={(e) => set({ cpfCnpj: maskCpfCnpj(e.target.value) })}
                placeholder="000.000.000-00"
                inputMode="numeric"
                className="bg-white border-neutral-200"
              />
            </div>
          )}
          {showField('email') && (
            <div className="space-y-1">
              <Label className="text-xs text-neutral-700">{LABELS.email}</Label>
              <Input
                type="email"
                value={value.email}
                onChange={(e) => set({ email: e.target.value })}
                placeholder="voce@email.com"
                autoComplete="email"
                className="bg-white border-neutral-200"
              />
            </div>
          )}
          {showField('telefone') && (
            <div className="space-y-1">
              <Label className="text-xs text-neutral-700">{LABELS.telefone}</Label>
              <Input
                value={value.telefone}
                onChange={(e) => set({ telefone: maskPhoneBR(e.target.value) })}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                className="bg-white border-neutral-200"
              />
            </div>
          )}
        </div>
      )}

      <Button
        className="w-full h-12 text-base font-medium gap-2"
        onClick={handleContinue}
        disabled={missing.length > 0 || saving || loading}
      >
        {(saving || loading) && <Loader2 className="h-4 w-4 animate-spin" />}
        {ctaLabel}
      </Button>
    </div>
  );
}

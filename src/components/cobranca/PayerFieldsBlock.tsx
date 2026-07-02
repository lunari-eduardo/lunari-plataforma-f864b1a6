import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isAsciiEmail,
  isValidPhoneBR,
  maskCpfCnpj,
  maskPhoneBR,
  unmaskDigits,
  validateCpfCnpj,
} from "@/lib/validateCpfCnpj";

export interface PayerFieldsValue {
  nome: string;
  email: string;
  telefone: string;
  cpfCnpj: string;
}

export interface PayerFieldsValidity {
  nome: boolean;
  email: boolean; // true quando vazio OU ASCII válido
  telefone: boolean;
  cpfCnpj: boolean;
  /** Todos os campos requeridos preenchidos e válidos. */
  allValidFor: (billingType: "pix_asaas" | "link_asaas" | "link_mp" | "pix_manual") => boolean;
}

interface Props {
  value: PayerFieldsValue;
  onChange: (v: PayerFieldsValue) => void;
  onValidityChange?: (v: PayerFieldsValidity) => void;
  /**
   * Se true, exibe alerta explicando que faltam dados para gerar cobrança
   * no provedor selecionado.
   */
  provider?: "pix_asaas" | "link_asaas" | "link_mp" | "pix_manual" | null;
  /**
   * Restringe a renderização apenas aos campos listados. Quando omitido,
   * mostra todos. Útil para pedir apenas o que falta.
   */
  onlyShow?: Array<"nome" | "email" | "telefone" | "cpfCnpj">;
  /** Suprime o label "Dados do pagador" (para uso em contextos já titulados). */
  hideTitle?: boolean;
}


/**
 * Bloco reutilizável de coleta de dados do pagador — inline no ChargeModal.
 * Nome/email/telefone/CPF pré-preenchidos a partir do cliente e editáveis.
 * Validação client-side (ASCII no email, DV no CPF/CNPJ, dígitos no telefone).
 */
export function PayerFieldsBlock({ value, onChange, onValidityChange, provider, onlyShow, hideTitle }: Props) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);

  const nomeOk = value.nome.trim().length >= 2;
  const emailOk = value.email.trim() === "" ? true : isAsciiEmail(value.email);
  const emailPresent = value.email.trim() !== "" && emailOk;
  const telefoneOk = isValidPhoneBR(value.telefone);
  const cpfOk = validateCpfCnpj(value.cpfCnpj);

  const validity: PayerFieldsValidity = {
    nome: nomeOk,
    email: emailOk,
    telefone: telefoneOk,
    cpfCnpj: cpfOk,
    allValidFor: (billingType) => {
      if (!nomeOk) return false;
      if (billingType === "pix_asaas") return telefoneOk && cpfOk && emailOk;
      if (billingType === "link_asaas") return telefoneOk && cpfOk && emailOk;
      if (billingType === "link_mp") return emailPresent && telefoneOk;
      if (billingType === "pix_manual") return true; // não precisa dados do pagador
      return false;
    },
  };

  useEffect(() => {
    onValidityChange?.(validity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomeOk, emailOk, telefoneOk, cpfOk, value.email]);

  const set = (patch: Partial<PayerFieldsValue>) => onChange({ ...value, ...patch });

  const showEmailError = touched.email && !emailOk;
  const showTelefoneError = touched.telefone && value.telefone && !telefoneOk;
  const showCpfError = touched.cpfCnpj && value.cpfCnpj && !cpfOk;

  const missingForProvider = provider ? !validity.allValidFor(provider) : false;

  const show = (field: "nome" | "email" | "telefone" | "cpfCnpj") =>
    !onlyShow || onlyShow.includes(field);

  return (
    <div className="space-y-3">
      {!hideTitle && (
        <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <User className="h-3 w-3" />
          Dados do pagador
        </Label>
      )}



      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {show("nome") && (
          <div className="space-y-1 md:col-span-2">
            <Input
              placeholder="Nome completo"
              value={value.nome}
              onChange={(e) => set({ nome: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, nome: true }))}
              enterKeyHint="next"
              autoComplete="name"
              className="h-9"
            />
          </div>
        )}

        {show("email") && (
          <div className="space-y-1 md:col-span-2">
            <Input
              ref={emailRef}
              type="email"
              placeholder="Email (opcional para PIX Asaas)"
              value={value.email}
              onChange={(e) => set({ email: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              enterKeyHint="next"
              autoComplete="email"
              inputMode="email"
              className={`h-9 ${showEmailError ? "border-destructive" : ""}`}
            />
            {showEmailError && (
              <p className="text-[11px] text-destructive flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                Este email não é aceito pelo Asaas. Use um email sem acentos ou caracteres especiais.
              </p>
            )}
          </div>
        )}

        {show("telefone") && (
          <div className="space-y-1">
            <Input
              ref={phoneRef}
              placeholder="Telefone (com DDD)"
              value={value.telefone}
              onChange={(e) => {
                const masked = maskPhoneBR(e.target.value);
                set({ telefone: masked });
                if (unmaskDigits(masked).length === 11) cpfRef.current?.focus();
              }}
              onBlur={() => setTouched((t) => ({ ...t, telefone: true }))}
              enterKeyHint="next"
              autoComplete="tel"
              inputMode="tel"
              className={`h-9 ${showTelefoneError ? "border-destructive" : ""}`}
            />
          </div>
        )}

        {show("cpfCnpj") && (
          <div className="space-y-1">
            <Input
              ref={cpfRef}
              placeholder="CPF ou CNPJ"
              value={value.cpfCnpj}
              onChange={(e) => set({ cpfCnpj: maskCpfCnpj(e.target.value) })}
              onBlur={() => setTouched((t) => ({ ...t, cpfCnpj: true }))}
              enterKeyHint="done"
              inputMode="numeric"
              className={`h-9 ${showCpfError ? "border-destructive" : cpfOk ? "border-emerald-500/50" : ""}`}
            />
            {showCpfError && (
              <p className="text-[11px] text-destructive flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                CPF/CNPJ inválido.
              </p>
            )}
            {cpfOk && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Documento válido
              </p>
            )}
          </div>
        )}
      </div>


      {missingForProvider && (
        <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-md p-2 flex items-start gap-1.5">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
          <span>
            {provider === "pix_asaas" || provider === "link_asaas"
              ? "Nome, telefone e CPF/CNPJ válidos são obrigatórios para cobranças Asaas (exigência para PIX/Boleto/antecipação)."
              : provider === "link_mp"
                ? "Nome, email válido e telefone são recomendados para checkout Mercado Pago."
                : "Preencha os dados obrigatórios."}
          </span>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import {
  isAsciiEmail,
  isValidPhoneBR,
  maskCpfCnpj,
  maskPhoneBR,
  unmaskDigits,
  validateCpfCnpj,
  maskCep,
  isValidCep,
} from "@/lib/validateCpfCnpj";
import { lookupCep } from "@/lib/viaCep";
import { PublicThemeWrapper } from "@/components/shared/PublicThemeWrapper";

interface GetPayload {
  cobranca: { id: string; valor: number; descricao?: string; status: string; ip_checkout_url?: string };
  photographer: { display_name: string };
  payer_snapshot: {
    nome: string;
    email: string;
    telefone: string;
    cpfCnpj: string;
    cep: string;
    endereco: string;
    endereco_numero: string;
    endereco_complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  missingFields: string[];
  theme?: { primaryColor: string | null };
}

type Phase = "loading" | "form" | "redirecting" | "paid" | "error" | "polling";

export default function InfinitePayCheckout() {
  const { cobrancaId } = useParams<{ cobrancaId: string }>();
  const [searchParams] = useSearchParams();
  const done = searchParams.get("done") === "1";

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [data, setData] = useState<GetPayload | null>(null);

  // Formulário
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const pollRef = useRef<number | null>(null);
  const autoSubmittedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!cobrancaId) return;
    try {
      const res = await supabase.functions.invoke("pay-infinitepay-get", {
        body: null,
        method: "GET" as any,
      } as any);
      // Fallback: chamar direto via URL para passar query string
      const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/pay-infinitepay-get?cobrancaId=${cobrancaId}`;
      const raw = await fetch(url, {
        headers: {
          apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${(import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      const json = await raw.json();
      void res;
      if (!raw.ok || !json.success) {
        setErrorMsg(json.error || "Cobrança não encontrada");
        setPhase("error");
        return;
      }
      const payload: GetPayload = json;
      setData(payload);
      // Hidratar form
      setNome(payload.payer_snapshot.nome || "");
      setTelefone(maskPhoneBR(payload.payer_snapshot.telefone || ""));
      setCpfCnpj(maskCpfCnpj(payload.payer_snapshot.cpfCnpj || ""));
      setEmail(payload.payer_snapshot.email || "");
      setCep(maskCep(payload.payer_snapshot.cep || ""));
      setEndereco(payload.payer_snapshot.endereco || "");
      setNumero(payload.payer_snapshot.endereco_numero || "");
      setComplemento(payload.payer_snapshot.endereco_complemento || "");
      setBairro(payload.payer_snapshot.bairro || "");
      setCidade(payload.payer_snapshot.cidade || "");
      setUf(payload.payer_snapshot.uf || "");

      if (payload.cobranca.status === "pago") {
        setPhase("paid");
        return;
      }
      if (done) {
        setPhase("polling");
        return;
      }

      // Skip form apenas quando o CRM já tem TUDO (inclusive CPF/CNPJ e e-mail).
      const snap = payload.payer_snapshot;
      const missing = Array.isArray(payload.missingFields) ? payload.missingFields : [];
      const hasName = (snap.nome || "").trim().length >= 2;
      const hasPhone = isValidPhoneBR(snap.telefone || "");
      const hasDoc = validateCpfCnpj(snap.cpfCnpj || "");
      const hasEmail = isAsciiEmail(snap.email || "");
      const canAutoSubmit =
        !autoSubmittedRef.current && missing.length === 0 && hasName && hasPhone && hasDoc && hasEmail;

      if (canAutoSubmit) {
        autoSubmittedRef.current = true;
        setPhase("redirecting");
        void submitFinalize({
          nome: snap.nome,
          email: snap.email,
          telefone: snap.telefone,
          cpfCnpj: snap.cpfCnpj,
          cep: snap.cep,
          endereco: snap.endereco,
          enderecoNumero: snap.endereco_numero,
          enderecoComplemento: snap.endereco_complemento,
          bairro: snap.bairro,
          cidade: snap.cidade,
          uf: snap.uf,
        });
        return;
      }

      setPhase("form");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao carregar");
      setPhase("error");
    }
  }, [cobrancaId, done]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobrancaId]);

  // SEO noindex + title
  useEffect(() => {
    document.title = "Finalizar pagamento";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  // Polling quando cliente volta do checkout
  useEffect(() => {
    if (phase !== "polling" || !cobrancaId) return;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/pay-infinitepay-get?cobrancaId=${cobrancaId}`;
        const raw = await fetch(url, {
          headers: {
            apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${(import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        });
        const json = await raw.json();
        if (json?.cobranca?.status === "pago") {
          setPhase("paid");
          return;
        }
      } catch {
        /* ignore */
      }
      if (attempts >= 20) {
        setPhase("form");
        setErrorMsg("Ainda não recebemos a confirmação do pagamento. Você receberá por outro canal quando finalizar.");
        return;
      }
      pollRef.current = window.setTimeout(tick, 3000);
    };
    pollRef.current = window.setTimeout(tick, 3000);
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [phase, cobrancaId]);

  const handleCepBlur = async () => {
    if (!isValidCep(cep)) return;
    const r = await lookupCep(cep);
    if (!r) return;
    if (!endereco) setEndereco(r.logradouro);
    if (!bairro) setBairro(r.bairro);
    if (!cidade) setCidade(r.localidade);
    if (!uf) setUf(r.uf);
  };

  const nomeOk = nome.trim().length >= 2;
  const telefoneOk = isValidPhoneBR(telefone);
  const cpfOk = cpfCnpj.trim() === "" || validateCpfCnpj(cpfCnpj);
  const emailOk = email.trim() === "" || isAsciiEmail(email);
  const canSubmit = nomeOk && telefoneOk && cpfOk && emailOk && !submitting;

  const submitFinalize = useCallback(async (raw: {
    nome?: string; email?: string; telefone?: string; cpfCnpj?: string;
    cep?: string; endereco?: string; enderecoNumero?: string; enderecoComplemento?: string;
    bairro?: string; cidade?: string; uf?: string;
  }) => {
    if (!cobrancaId) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/pay-infinitepay-finalize`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${(import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          cobrancaId,
          payerPatch: {
            nome: raw.nome?.trim() || undefined,
            email: raw.email?.trim() || undefined,
            telefone: unmaskDigits(raw.telefone || "") || undefined,
            cpfCnpj: unmaskDigits(raw.cpfCnpj || "") || undefined,
            cep: unmaskDigits(raw.cep || "") || undefined,
            endereco: raw.endereco?.trim() || undefined,
            enderecoNumero: raw.enderecoNumero?.trim() || undefined,
            enderecoComplemento: raw.enderecoComplemento?.trim() || undefined,
            bairro: raw.bairro?.trim() || undefined,
            cidade: raw.cidade?.trim() || undefined,
            uf: raw.uf?.trim() || undefined,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error || "Não foi possível gerar o pagamento. Tente novamente.");
        setSubmitting(false);
        setPhase("form");
        return;
      }
      setPhase("redirecting");
      setTimeout(() => { window.location.href = json.checkoutUrl; }, 400);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao processar");
      setSubmitting(false);
      setPhase("form");
    }
  }, [cobrancaId]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await submitFinalize({
      nome, email, telefone, cpfCnpj,
      cep, endereco, enderecoNumero: numero, enderecoComplemento: complemento,
      bairro, cidade, uf,
    });
  };

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <PublicThemeWrapper primaryColor={data?.theme?.primaryColor || undefined} className="flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header comercial */}
        {data && (
          <div className="text-center mb-4">
            <p className="text-xs uppercase tracking-widest text-neutral-500">Pagamento para</p>
            <h1 className="text-base font-medium text-neutral-700 mt-1">{data.photographer.display_name}</h1>
          </div>
        )}

        <Card className="p-6 shadow-sm border border-neutral-200 bg-white rounded-2xl">
          {phase === "loading" && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-neutral-600">Carregando pagamento…</p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <h2 className="font-semibold text-neutral-900">Não foi possível abrir esta cobrança</h2>
              <p className="text-sm text-neutral-600">{errorMsg}</p>
            </div>
          )}

          {phase === "paid" && (
            <div className="flex flex-col items-center py-10 gap-4 text-center animate-in fade-in zoom-in duration-500">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </div>
              <h2 className="font-semibold text-xl text-neutral-900">Pagamento confirmado</h2>
              <p className="text-sm text-neutral-600">Obrigado! Você já pode fechar esta janela.</p>
            </div>
          )}

          {phase === "redirecting" && (
            <div className="flex flex-col items-center py-12 gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-neutral-800 font-medium">Redirecionando ao checkout seguro…</p>
              <p className="text-xs text-neutral-500">Se não abrir automaticamente, verifique bloqueadores.</p>
            </div>
          )}

          {phase === "polling" && (
            <div className="flex flex-col items-center py-10 gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <h2 className="font-semibold text-neutral-900">Pagamento em processamento</h2>
              <p className="text-sm text-neutral-600">
                Aguardando confirmação da InfinitePay… isso pode levar alguns segundos.
              </p>
            </div>
          )}

          {phase === "form" && data && (
            <div className="space-y-4">
              {/* Valor destaque */}
              <div className="text-center pb-4 border-b border-neutral-100">
                <p className="text-[11px] uppercase tracking-widest text-neutral-500">Valor a pagar</p>
                <p className="text-3xl font-bold tracking-tight text-primary mt-1">{brl(data.cobranca.valor)}</p>
                {data.cobranca.descricao && (
                  <p className="text-xs text-neutral-600 mt-1">{data.cobranca.descricao}</p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="nome" className="text-xs">Nome completo *</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Como aparece no seu documento"
                    className="h-10"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <Label htmlFor="tel" className="text-xs">Celular / WhatsApp *</Label>
                  <Input
                    id="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(maskPhoneBR(e.target.value))}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                    className="h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="cpf" className="text-xs">CPF ou CNPJ (recomendado)</Label>
                  <Input
                    id="cpf"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    className={`h-10 ${cpfCnpj && !cpfOk ? "border-destructive" : ""}`}
                  />
                  {cpfCnpj && !cpfOk && (
                    <p className="text-[11px] text-destructive mt-1">Documento inválido</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email" className="text-xs">E-mail (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    inputMode="email"
                    className={`h-10 ${email && !emailOk ? "border-destructive" : ""}`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowOptional((s) => !s)}
                  className="text-xs text-primary hover:underline"
                >
                  {showOptional ? "Ocultar endereço" : "Adicionar endereço (opcional)"}
                </button>

                {showOptional && (
                  <div className="space-y-3 rounded-md border border-dashed p-3">
                    <div>
                      <Label htmlFor="cep" className="text-xs">CEP</Label>
                      <Input
                        id="cep"
                        value={cep}
                        onChange={(e) => setCep(maskCep(e.target.value))}
                        onBlur={handleCepBlur}
                        placeholder="00000-000"
                        inputMode="numeric"
                        className="h-10"
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_100px] gap-2">
                      <div>
                        <Label className="text-xs">Endereço</Label>
                        <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} className="h-10" />
                      </div>
                      <div>
                        <Label className="text-xs">Número</Label>
                        <Input value={numero} onChange={(e) => setNumero(e.target.value)} className="h-10" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Complemento</Label>
                      <Input
                        value={complemento}
                        onChange={(e) => setComplemento(e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Bairro</Label>
                      <Input value={bairro} onChange={(e) => setBairro(e.target.value)} className="h-10" />
                    </div>
                    <div className="grid grid-cols-[1fr_80px] gap-2">
                      <div>
                        <Label className="text-xs">Cidade</Label>
                        <Input value={cidade} onChange={(e) => setCidade(e.target.value)} className="h-10" />
                      </div>
                      <div>
                        <Label className="text-xs">UF</Label>
                        <Input
                          value={uf}
                          onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                          className="h-10"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="text-xs text-destructive flex items-start gap-1.5 bg-destructive/10 rounded-md p-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full h-11 text-base font-semibold"
                size="lg"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                Continuar para o pagamento
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                <Lock className="h-3 w-3" />
                <span>Pagamento seguro</span>
                <span>•</span>
                <ShieldCheck className="h-3 w-3" />
                <span>Processado pela InfinitePay</span>
              </div>
            </div>
          )}
        </Card>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          Powered by Lunari · Seus dados são criptografados e usados apenas neste pagamento.
        </p>
      </div>
    </PublicThemeWrapper>
  );
}

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAsaasSubscription } from "@/hooks/useAsaasSubscription";
import { useAccessControl } from "@/hooks/useAccessControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Lock, CreditCard, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/planConfig";

/* ─── State types ─── */

interface SubscriptionPayment {
  type: "subscription";
  planType: string;
  planName: string;
  billingCycle: "MONTHLY" | "YEARLY";
  priceCents: number;
  isUpgrade?: boolean;
  prorataValueCents?: number;
  currentSubscriptionId?: string;
  subscriptionIdsToCancel?: string[];
  currentPlanName?: string;
}

type PaymentState = SubscriptionPayment;

/* ─── Page ─── */

export default function EscolherPlanoPagamento() {
  const navigate = useNavigate();
  const location = useLocation();
  const pkg = location.state as PaymentState | null;

  if (!pkg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Nenhum plano selecionado.</p>
          <Button variant="outline" onClick={() => navigate("/escolher-plano")}>
            Voltar para planos
          </Button>
        </div>
      </div>
    );
  }

  const formattedPrice = formatPrice(pkg.priceCents);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container max-w-5xl py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/escolher-plano")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm text-muted-foreground">Pagamento</span>
        </div>
      </header>

      <main className="container max-w-5xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
          {/* Left: Form */}
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Finalizar Assinatura</h1>
              <p className="text-sm text-muted-foreground">Pagamento via Cartão de Crédito</p>
            </div>
            <SubscriptionForm pkg={pkg} formattedPrice={formattedPrice} />
          </div>

          {/* Right: Order summary */}
          <div className="order-first lg:order-last">
            <OrderSummary pkg={pkg} formattedPrice={formattedPrice} />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ═══ ORDER SUMMARY ═══ */

function OrderSummary({ pkg, formattedPrice }: { pkg: PaymentState; formattedPrice: string }) {
  const isUpgrade = pkg.isUpgrade;
  const prorataFormatted = isUpgrade && pkg.prorataValueCents != null
    ? formatPrice(pkg.prorataValueCents)
    : null;

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4 lg:sticky lg:top-20">
      <h2 className="font-semibold text-foreground">Resumo do Pedido</h2>
      <div className="border-t pt-4 space-y-2">
        <p className="font-medium text-foreground">{pkg.planName}</p>
        <p className="text-sm text-muted-foreground">
          {isUpgrade
            ? `Upgrade de ${pkg.currentPlanName || "plano atual"}`
            : `Assinatura ${pkg.billingCycle === "MONTHLY" ? "mensal" : "anual"}`}
        </p>
      </div>
      <div className="border-t pt-4 space-y-2">
        {isUpgrade && prorataFormatted ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor do novo plano</span>
              <span className="text-foreground">{formattedPrice}/{pkg.billingCycle === "MONTHLY" ? "mês" : "ano"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Diferença proporcional</span>
              <span className="text-foreground">{prorataFormatted}</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span className="text-foreground">Pagar agora</span>
              <span className="text-primary">{prorataFormatted}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              A partir do próximo ciclo, o valor será {formattedPrice}/{pkg.billingCycle === "MONTHLY" ? "mês" : "ano"}.
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{formattedPrice}</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span className="text-foreground">Total</span>
              <span className="text-primary">{formattedPrice}</span>
            </div>
          </>
        )}
      </div>

      {pkg.billingCycle === "YEARLY" && !isUpgrade && (
        <div className="border-t pt-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <span>Renovação manual após 12 meses. Você será notificado antes do vencimento.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ SUBSCRIPTION FORM ═══ */

function SubscriptionForm({ pkg, formattedPrice }: { pkg: SubscriptionPayment; formattedPrice: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetchAccess } = useAccessControl();
  const {
    createCustomer, isCreatingCustomer,
    createSubscription, isCreatingSubscription,
    createPayment, isCreatingPayment,
    upgradeSubscription, isUpgrading,
  } = useAsaasSubscription();
  const { toast } = useToast();

  const isYearly = pkg.billingCycle === "YEARLY";
  const isUpgrade = !!pkg.isUpgrade;
  const [installments, setInstallments] = useState(1);

  const installmentOptions = isYearly && !isUpgrade
    ? Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const value = pkg.priceCents / 100 / n;
        return {
          value: n,
          label: `${n}x de ${value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} sem juros`,
        };
      })
    : [];

  return (
    <div className="space-y-5">
      {isYearly && !isUpgrade && installmentOptions.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <Label className="text-sm font-medium">Parcelas</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
          >
            {installmentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      <CardCheckoutForm
        onSubmit={async (cardData) => {
          await createCustomer({
            name: cardData.name,
            cpfCnpj: cardData.cpfCnpj,
            email: user?.email,
          });

          let remoteIp = "";
          try {
            const ipRes = await fetch("https://api.ipify.org?format=json");
            const ipData = await ipRes.json();
            remoteIp = ipData.ip || "";
          } catch { remoteIp = ""; }

          const cardPayload = {
            holderName: cardData.cardHolderName.toUpperCase(),
            number: cardData.cardNumber.replace(/\s/g, ""),
            expiryMonth: cardData.expiryMonth.padStart(2, "0"),
            expiryYear: cardData.expiryYear,
            ccv: cardData.ccv,
          };
          const holderPayload = {
            name: cardData.name,
            email: user?.email || "",
            cpfCnpj: cardData.cpfCnpj.replace(/\D/g, ""),
            postalCode: "00000000",
            addressNumber: "S/N",
            phone: cardData.phone.replace(/\D/g, ""),
          };

          if (isUpgrade && (pkg.currentSubscriptionId || pkg.subscriptionIdsToCancel?.length)) {
            await upgradeSubscription({
              currentSubscriptionId: pkg.currentSubscriptionId || pkg.subscriptionIdsToCancel?.[0] || "",
              newPlanType: pkg.planType,
              billingCycle: pkg.billingCycle,
              subscriptionIdsToCancel: pkg.subscriptionIdsToCancel,
              creditCard: cardPayload,
              creditCardHolderInfo: holderPayload,
              remoteIp,
            });
            toast({ title: "Upgrade realizado com sucesso!" });
            await refetchAccess();
            setTimeout(() => navigate("/app"), 2000);
            return { success: true };
          } else if (isYearly) {
            await createPayment({
              productType: "subscription_yearly",
              planType: pkg.planType,
              installmentCount: installments,
              creditCard: cardPayload,
              creditCardHolderInfo: holderPayload,
              remoteIp,
            });
            toast({ title: "Plano ativado com sucesso!" });
            await refetchAccess();
            setTimeout(() => navigate("/app"), 2000);
            return { success: true };
          } else {
            await createSubscription({
              planType: pkg.planType,
              billingCycle: "MONTHLY",
              creditCard: cardPayload,
              creditCardHolderInfo: holderPayload,
              remoteIp,
            });
            toast({ title: "Assinatura ativada com sucesso!" });
            await refetchAccess();
            setTimeout(() => navigate("/app"), 2000);
            return { success: true };
          }
        }}
        submitLabel={
          isUpgrade
            ? `Fazer upgrade ${pkg.prorataValueCents != null ? formatPrice(pkg.prorataValueCents) : formattedPrice}`
            : isYearly && installments > 1
              ? `Assinar ${installments}x de ${((pkg.priceCents / 100) / installments).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
              : `Assinar ${formattedPrice}`
        }
        isProcessing={isCreatingCustomer || isCreatingSubscription || isCreatingPayment || isUpgrading}
      />
    </div>
  );
}

/* ═══ CARD CHECKOUT FORM ═══ */

interface CardData {
  name: string;
  cpfCnpj: string;
  phone: string;
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface CardCheckoutFormProps {
  onSubmit: (data: CardData) => Promise<{ success: boolean }>;
  submitLabel: string;
  isProcessing: boolean;
}

function CardCheckoutForm({ onSubmit, submitLabel, isProcessing }: CardCheckoutFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<"personal" | "card" | "processing" | "success" | "error">("personal");
  const [errorMessage, setErrorMessage] = useState("");

  const [name, setName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");

  const [cardNumber, setCardNumber] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [ccv, setCcv] = useState("");

  const formatCardNumber = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 16);
    return clean.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const validatePersonalData = (): boolean => {
    if (!name.trim()) { toast({ title: "Informe seu nome completo.", variant: "destructive" }); return false; }
    const cleanCpf = cpfCnpj.replace(/\D/g, "");
    if (cleanCpf.length !== 11 && cleanCpf.length !== 14) { toast({ title: "CPF ou CNPJ inválido.", variant: "destructive" }); return false; }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) { toast({ title: "Telefone inválido.", variant: "destructive" }); return false; }
    return true;
  };

  const validateCardData = (): boolean => {
    const cleanCard = cardNumber.replace(/\s/g, "");
    if (cleanCard.length < 13 || cleanCard.length > 19) { toast({ title: "Número do cartão inválido.", variant: "destructive" }); return false; }
    if (!cardHolderName.trim()) { toast({ title: "Informe o nome no cartão.", variant: "destructive" }); return false; }
    const month = parseInt(expiryMonth);
    if (isNaN(month) || month < 1 || month > 12) { toast({ title: "Mês de validade inválido.", variant: "destructive" }); return false; }
    const year = parseInt(expiryYear);
    if (isNaN(year) || expiryYear.length !== 4 || year < new Date().getFullYear()) { toast({ title: "Ano de validade inválido.", variant: "destructive" }); return false; }
    if (ccv.length < 3 || ccv.length > 4) { toast({ title: "CVV inválido.", variant: "destructive" }); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateCardData()) return;
    setStep("processing");
    setErrorMessage("");
    try {
      await onSubmit({ name, cpfCnpj, phone, cardNumber, cardHolderName, expiryMonth, expiryYear, ccv });
      setStep("success");
    } catch (error) {
      setStep("error");
      setErrorMessage(error instanceof Error ? error.message : "Erro ao processar pagamento.");
    }
  };

  if (step === "processing") {
    return (
      <div className="rounded-lg border p-12 text-center bg-card space-y-4">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
        <p className="font-medium text-foreground">Processando pagamento...</p>
        <p className="text-sm text-muted-foreground">Não feche esta página.</p>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="rounded-lg border p-8 text-center bg-card space-y-3">
        <div className="text-4xl">🎉</div>
        <h3 className="text-lg font-semibold text-primary">Pagamento Confirmado!</h3>
        <p className="text-xs text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="rounded-lg border p-8 text-center bg-card space-y-4">
        <div className="text-5xl">❌</div>
        <h3 className="text-lg font-semibold text-destructive">Erro no pagamento</h3>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => setStep("card")}>Tentar novamente</Button>
          <Button variant="outline" onClick={() => navigate("/escolher-plano")}>Voltar</Button>
        </div>
      </div>
    );
  }

  if (step === "card") {
    return (
      <div className="rounded-lg border p-6 bg-card space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CreditCard className="h-4 w-4 text-primary" />
          Dados do Cartão
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cardNumber">Número do cartão</Label>
          <Input id="cardNumber" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} maxLength={19} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cardHolderName">Nome no cartão</Label>
          <Input id="cardHolderName" placeholder="NOME COMO NO CARTÃO" value={cardHolderName} onChange={(e) => setCardHolderName(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="expiryMonth">Mês</Label>
            <Input id="expiryMonth" placeholder="MM" maxLength={2} value={expiryMonth} onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expiryYear">Ano</Label>
            <Input id="expiryYear" placeholder="AAAA" maxLength={4} value={expiryYear} onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ccv">CVV</Label>
            <Input id="ccv" placeholder="000" maxLength={4} type="password" value={ccv} onChange={(e) => setCcv(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => setStep("personal")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <Button className="flex-1" size="lg" onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</> : submitLabel}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <Lock className="h-3 w-3" />
          Pagamento seguro via Asaas (PCI DSS)
        </p>
      </div>
    );
  }

  // step === "personal"
  return (
    <div className="rounded-lg border p-6 bg-card space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome completo</Label>
        <Input id="name" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
        <Input id="cpfCnpj" placeholder="000.000.000-00" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>E-mail</Label>
        <Input value={user?.email || ""} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefone</Label>
        <Input id="phone" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <Button className="w-full" size="lg" onClick={() => { if (validatePersonalData()) setStep("card"); }}>
        Próximo: Dados do cartão
      </Button>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Star, Loader2, CreditCard, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAccessControl } from "@/hooks/useAccessControl";

const plans = [
  {
    name: "Starter",
    code: "studio_starter",
    monthlyPrice: "14,90",
    yearlyPrice: "151,98",
    monthlyCents: 1490,
    yearlyCents: 15198,
    description: "Ideal para começar",
    features: [
      "Agenda completa",
      "CRM de clientes",
      "Workflow de produção",
      "Tutoriais",
      "Suporte por WhatsApp",
    ],
    popular: false,
  },
  {
    name: "Pro",
    code: "studio_pro",
    monthlyPrice: "35,90",
    yearlyPrice: "366,18",
    monthlyCents: 3590,
    yearlyCents: 36618,
    description: "Funcionalidades completas",
    features: [
      "Tudo do Starter",
      "Gestão de Leads",
      "Gestão de tarefas",
      "Financeiro completo",
      "Precificação e metas",
      "Análise de vendas detalhada",
      "Feed Preview",
      "Exportação de relatórios",
      "Notificações avançadas",
    ],
    popular: true,
  },
];

interface CardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface HolderInfo {
  name: string;
  cpfCnpj: string;
  postalCode: string;
  phone: string;
  email: string;
}

export default function EscolherPlano() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showCcv, setShowCcv] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { accessState, refetchAccess } = useAccessControl();

  const [cardData, setCardData] = useState<CardData>({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
  });

  const [holderInfo, setHolderInfo] = useState<HolderInfo>({
    name: "",
    cpfCnpj: "",
    postalCode: "",
    phone: "",
    email: "",
  });

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 16);
    return cleaned.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatCpfCnpj = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  const formatCep = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 8);
    return cleaned.replace(/(\d{5})(\d{3})/, "$1-$2");
  };

  const handleSelectPlan = (planCode: string) => {
    setSelectedPlan(planCode === selectedPlan ? null : planCode);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;

    // Validate card
    if (!cardData.holderName || !cardData.number || !cardData.expiryMonth || !cardData.expiryYear || !cardData.ccv) {
      toast({ title: "Preencha todos os dados do cartão", variant: "destructive" });
      return;
    }
    if (!holderInfo.name || !holderInfo.cpfCnpj || !holderInfo.postalCode || !holderInfo.phone) {
      toast({ title: "Preencha todos os dados do titular", variant: "destructive" });
      return;
    }

    setLoadingPlan(selectedPlan);

    try {
      // Step 1: Ensure customer exists
      const { data: customerData, error: customerError } = await supabase.functions.invoke("asaas-create-customer", {
        body: {
          name: holderInfo.name,
          cpfCnpj: holderInfo.cpfCnpj.replace(/\D/g, ""),
          email: holderInfo.email,
        },
      });

      if (customerError) throw customerError;
      if (customerData?.error) throw new Error(customerData.error);

      // Step 2: Create subscription (monthly) or payment (yearly)
      const billingCycle = isAnnual ? "YEARLY" : "MONTHLY";
      const functionName = isAnnual ? "asaas-create-payment" : "asaas-create-subscription";

      const payload: Record<string, unknown> = {
        planType: selectedPlan,
        billingCycle,
        creditCard: {
          holderName: cardData.holderName,
          number: cardData.number.replace(/\s/g, ""),
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          ccv: cardData.ccv,
        },
        creditCardHolderInfo: {
          name: holderInfo.name,
          cpfCnpj: holderInfo.cpfCnpj,
          postalCode: holderInfo.postalCode,
          phone: holderInfo.phone,
          email: holderInfo.email,
        },
      };

      if (isAnnual) {
        payload.installmentCount = 1;
      }

      const { data, error } = await supabase.functions.invoke(functionName, { body: payload });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Assinatura criada com sucesso!",
        description: "Sua assinatura já está ativa.",
      });

      await refetchAccess();
      navigate("/app");
    } catch (error: any) {
      console.error("Subscription error:", error);
      toast({
        title: "Erro ao processar pagamento",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Escolha seu plano
          </h1>

          {accessState.isTrial && accessState.daysRemaining !== undefined && (
            <p className="text-muted-foreground mb-6">
              {accessState.daysRemaining > 0
                ? `Seu teste grátis termina em ${accessState.daysRemaining} dias`
                : "Seu teste grátis expirou"}
            </p>
          )}

          <div className="inline-flex bg-muted rounded-full p-1 mb-6">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                !isAnnual
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                isAnnual
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anual
              <span className="ml-1 text-xs opacity-75">(~15% off)</span>
            </button>
          </div>

          <p className="text-muted-foreground text-sm">
            Sem compromisso • Cancele quando quiser
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.code}
              onClick={() => handleSelectPlan(plan.code)}
              className={`relative bg-card rounded-2xl p-8 shadow-lg border transition-all hover:shadow-xl flex flex-col cursor-pointer ${
                selectedPlan === plan.code
                  ? "border-primary ring-2 ring-primary/30"
                  : plan.popular
                    ? "border-primary/30 ring-2 ring-primary/20"
                    : "border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    Mais Popular
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                <p className="text-muted-foreground mb-6">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-foreground">
                    R$ {isAnnual ? plan.yearlyPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    {isAnnual ? "/ano" : "/mês"}
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-8 flex-grow">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              <div className={`text-center py-2 rounded-xl font-medium ${
                selectedPlan === plan.code
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}>
                {selectedPlan === plan.code ? "✓ Selecionado" : "Selecionar"}
              </div>
            </div>
          ))}
        </div>

        {/* Payment Form */}
        {selectedPlan && (
          <div className="max-w-lg mx-auto bg-card rounded-2xl p-8 shadow-lg border border-border">
            <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Dados do Pagamento
            </h3>

            {/* Card Info */}
            <div className="space-y-4 mb-6">
              <div>
                <Label>Nome no cartão</Label>
                <Input
                  value={cardData.holderName}
                  onChange={(e) => setCardData({ ...cardData, holderName: e.target.value.toUpperCase() })}
                  placeholder="NOME COMPLETO"
                />
              </div>
              <div>
                <Label>Número do cartão</Label>
                <Input
                  value={cardData.number}
                  onChange={(e) => setCardData({ ...cardData, number: formatCardNumber(e.target.value) })}
                  placeholder="0000 0000 0000 0000"
                  maxLength={19}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Mês</Label>
                  <Input
                    value={cardData.expiryMonth}
                    onChange={(e) => setCardData({ ...cardData, expiryMonth: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                    placeholder="MM"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label>Ano</Label>
                  <Input
                    value={cardData.expiryYear}
                    onChange={(e) => setCardData({ ...cardData, expiryYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    placeholder="AAAA"
                    maxLength={4}
                  />
                </div>
                <div>
                  <Label>CVV</Label>
                  <div className="relative">
                    <Input
                      type={showCcv ? "text" : "password"}
                      value={cardData.ccv}
                      onChange={(e) => setCardData({ ...cardData, ccv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                      placeholder="•••"
                      maxLength={4}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCcv(!showCcv)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showCcv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Holder Info */}
            <div className="space-y-4 mb-6">
              <h4 className="font-medium text-foreground">Dados do titular</h4>
              <div>
                <Label>Nome completo</Label>
                <Input
                  value={holderInfo.name}
                  onChange={(e) => setHolderInfo({ ...holderInfo, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label>CPF / CNPJ</Label>
                <Input
                  value={holderInfo.cpfCnpj}
                  onChange={(e) => setHolderInfo({ ...holderInfo, cpfCnpj: formatCpfCnpj(e.target.value) })}
                  placeholder="000.000.000-00"
                  maxLength={18}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CEP</Label>
                  <Input
                    value={holderInfo.postalCode}
                    onChange={(e) => setHolderInfo({ ...holderInfo, postalCode: formatCep(e.target.value) })}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={holderInfo.phone}
                    onChange={(e) => setHolderInfo({ ...holderInfo, phone: formatPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={holderInfo.email}
                  onChange={(e) => setHolderInfo({ ...holderInfo, email: e.target.value })}
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <Button
              onClick={handleSubscribe}
              disabled={loadingPlan !== null}
              className="w-full py-3 rounded-xl text-base font-medium"
            >
              {loadingPlan ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                `Assinar ${plans.find(p => p.code === selectedPlan)?.name} - R$ ${
                  isAnnual
                    ? plans.find(p => p.code === selectedPlan)?.yearlyPrice + "/ano"
                    : plans.find(p => p.code === selectedPlan)?.monthlyPrice + "/mês"
                }`
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Pagamento processado com segurança via Asaas. Seus dados são criptografados.
            </p>
          </div>
        )}

        <div className="text-center mt-8">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
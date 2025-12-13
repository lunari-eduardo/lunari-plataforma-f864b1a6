import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAccessControl } from "@/hooks/useAccessControl";

// Mapeamento de planos para Price IDs do Stripe
const PRICE_IDS = {
  starter_monthly: "price_1SduZf2XeR5ffZtlimzh64Ox",
  starter_yearly: "price_1SduaS2XeR5ffZtlfvzxTbwn",
  pro_monthly: "price_1Sduh42XeR5ffZtlOQIQSp24",
  pro_yearly: "price_1Sduhh2XeR5ffZtlr8BGG7Wj",
};

const plans = [
  {
    name: "Starter",
    code: "starter",
    monthlyPrice: "19,90",
    yearlyPrice: "209,90",
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
    code: "pro",
    monthlyPrice: "37,90",
    yearlyPrice: "389,90",
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

export default function EscolherPlano() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { accessState } = useAccessControl();

  const handleSelectPlan = async (planCode: string) => {
    const interval = isAnnual ? "yearly" : "monthly";
    const priceKey = `${planCode}_${interval}` as keyof typeof PRICE_IDS;
    const priceId = PRICE_IDS[priceKey];

    if (!priceId) {
      toast({
        title: "Erro",
        description: "Plano não encontrado",
        variant: "destructive",
      });
      return;
    }

    setLoadingPlan(planCode);

    try {
      const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
        body: {
          priceId,
          planCode: `${planCode}_${interval}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("URL de checkout não retornada");
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast({
        title: "Erro ao criar checkout",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
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

          {/* Toggle Mensal/Anual */}
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
              <span className="ml-1 text-xs opacity-75">(~8% off)</span>
            </button>
          </div>

          <p className="text-muted-foreground text-sm">
            Sem compromisso • Cancele quando quiser
          </p>
        </div>

        {/* Cards de Planos */}
        <div className="grid md:grid-cols-2 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.code}
              className={`relative bg-card rounded-2xl p-8 shadow-lg border transition-all hover:shadow-xl flex flex-col ${
                plan.popular
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
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  {plan.name}
                </h3>
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

              <Button
                onClick={() => handleSelectPlan(plan.code)}
                disabled={loadingPlan !== null}
                className={`w-full py-3 rounded-xl text-base font-medium transition-all mt-auto ${
                  plan.popular
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {loadingPlan === plan.code ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Redirecionando...
                  </>
                ) : (
                  "Assinar Agora"
                )}
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { PAGE_TABS_LIST, PAGE_TABS_TRIGGER, PAGE_TABS_CONTENT } from '@/components/layout/PageTabs';
import { inicializarSistemaPrecificacao } from '@/utils/pricingMigration';
import { PricingServiceFactory } from '@/services/pricing';
import { MetasService } from '@/services/PricingService';
import { ResumoFinanceiroSticky } from '@/components/precificacao/ResumoFinanceiroSticky';
import { EtapaCustosFixos } from '@/components/precificacao/EtapaCustosFixos';
import { EtapaEquipamentos } from '@/components/precificacao/EtapaEquipamentos';
import { EtapaMetas } from '@/components/precificacao/EtapaMetas';
import { EtapaCalculadora } from '@/components/precificacao/EtapaCalculadora';
import { PricingProvider, usePricing } from '@/contexts/PricingContext';

const ETAPAS = [
  { value: 'custos', label: 'Custos' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'calculadora', label: 'Calculadora' },
] as const;

type EtapaValue = (typeof ETAPAS)[number]['value'];

export default function Precificacao() {
  const [custosFixosTotal, setCustosFixosTotal] = useState(0);
  const [precoFinalServico, setPrecoFinalServico] = useState(0);
  const [margemLucroDesejada, setMargemLucroDesejada] = useState(30);
  const [sistemaInicializado, setSistemaInicializado] = useState(false);
  const [etapa, setEtapa] = useState<EtapaValue>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('etapa');
    return (ETAPAS.some((e) => e.value === fromUrl) ? fromUrl : 'custos') as EtapaValue;
  });

  // Cálculos derivados
  const horasMensais = 8 * 5 * 4; // Padrão: 8h/dia * 5 dias * 4 semanas
  const custoHora = horasMensais > 0 ? custosFixosTotal / horasMensais : 0;
  const faturamentoMinimoAnual = custosFixosTotal * 12;
  const metaFaturamentoAnual = faturamentoMinimoAnual / (1 - margemLucroDesejada / 100);
  const metaFaturamentoMensal = metaFaturamentoAnual / 12;

  const handleCustosFixosChange = useCallback((total: number) => {
    setCustosFixosTotal(total);
  }, []);

  const handleEtapaChange = (value: string) => {
    setEtapa(value as EtapaValue);
    const url = new URL(window.location.href);
    url.searchParams.set('etapa', value);
    window.history.replaceState(null, '', url.toString());
  };

  // Inicializar sistema
  useEffect(() => {
    try {
      inicializarSistemaPrecificacao();
      setSistemaInicializado(true);

      const metas = MetasService.carregar();
      setMargemLucroDesejada(metas.margemLucroDesejada);
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      setSistemaInicializado(false);
    }
  }, []);

  // Validar sistema periodicamente
  useEffect(() => {
    if (sistemaInicializado) {
      const services = PricingServiceFactory.createLocalServices();
      const intervalId = setInterval(async () => {
        await services.validation.validarTodosSistemas();
      }, 30000);
      return () => clearInterval(intervalId);
    }
  }, [sistemaInicializado]);

  return (
    <PricingProvider>
      <PageContainer className="pb-28 lg:pb-10">
        <PageHeader
          title="Precificação"
          description="Custos, equipamentos e metas para definir preços rentáveis"
        />

        <ResumoFinanceiroSticky
          custoFixoMensal={custosFixosTotal}
          custoHora={custoHora}
          metaFaturamentoMensal={metaFaturamentoMensal}
          precoFinalServico={precoFinalServico}
        />

        <Tabs value={etapa} onValueChange={handleEtapaChange} className="mt-4">
          <TabsList className={PAGE_TABS_LIST}>
            {ETAPAS.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className={PAGE_TABS_TRIGGER}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="custos" className={PAGE_TABS_CONTENT}>
            <EtapaCustosFixos onTotalChange={handleCustosFixosChange} />
          </TabsContent>

          <TabsContent value="equipamentos" className={PAGE_TABS_CONTENT}>
            <EtapaEquipamentos />
          </TabsContent>

          <TabsContent value="calculadora" className={PAGE_TABS_CONTENT}>
            <EtapaCalculadora
              custosFixosTotal={custosFixosTotal}
              metaFaturamentoMensal={metaFaturamentoMensal}
              onPrecoFinalChange={setPrecoFinalServico}
            />
          </TabsContent>
        </Tabs>

        {/* Mantém o total de custos fixos sincronizado mesmo fora da aba "Custos". */}
        <TotalCustosBridge onTotalChange={handleCustosFixosChange} />
      </PageContainer>
    </PricingProvider>
  );
}

/** Ponte leve: espelha `totalCustosFixos` do contexto para o estado da página. */
function TotalCustosBridge({ onTotalChange }: { onTotalChange: (total: number) => void }) {
  const { totalCustosFixos } = usePricing();

  useEffect(() => {
    onTotalChange(totalCustosFixos);
  }, [totalCustosFixos, onTotalChange]);

  return null;
}

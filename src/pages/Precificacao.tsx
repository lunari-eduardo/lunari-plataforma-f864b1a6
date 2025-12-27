import { useState, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { inicializarSistemaPrecificacao } from '@/utils/pricingMigration';
import { PricingServiceFactory } from '@/services/pricing';
import { MetasService } from '@/services/PricingService';
import { PricingHeader } from '@/components/precificacao/PricingHeader';
import { ResumoFinanceiroSticky } from '@/components/precificacao/ResumoFinanceiroSticky';
import { EtapaCustosFixos } from '@/components/precificacao/EtapaCustosFixos';
import { EtapaMetas } from '@/components/precificacao/EtapaMetas';
import { EtapaCalculadora } from '@/components/precificacao/EtapaCalculadora';
import { PricingProvider } from '@/contexts/PricingContext';

export default function Precificacao() {
  const [custosFixosTotal, setCustosFixosTotal] = useState(0);
  const [precoFinalServico, setPrecoFinalServico] = useState(0);
  const [margemLucroDesejada, setMargemLucroDesejada] = useState(30);
  const [sistemaInicializado, setSistemaInicializado] = useState(false);

  // Cálculos derivados
  const horasMensais = 8 * 5 * 4; // Padrão: 8h/dia * 5 dias * 4 semanas
  const custoHora = horasMensais > 0 ? custosFixosTotal / horasMensais : 0;
  const faturamentoMinimoAnual = custosFixosTotal * 12;
  const metaFaturamentoAnual = faturamentoMinimoAnual / (1 - margemLucroDesejada / 100);
  const metaFaturamentoMensal = metaFaturamentoAnual / 12;

  const handleCustosFixosChange = (total: number) => {
    setCustosFixosTotal(total);
  };

  // Inicializar sistema
  useEffect(() => {
    console.log('🚀 Inicializando página de precificação...');
    try {
      inicializarSistemaPrecificacao();
      setSistemaInicializado(true);
      
      // Carregar margem de lucro salva
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
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-40 lg:pb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Sticky (Desktop) */}
            <ResumoFinanceiroSticky
              custoFixoMensal={custosFixosTotal}
              custoHora={custoHora}
              metaFaturamentoMensal={metaFaturamentoMensal}
              precoFinalServico={precoFinalServico}
            />
            
            {/* Conteúdo Principal */}
            <main className="flex-1 space-y-6">
              <PricingHeader />
              
              {/* Etapa 1: Custos Fixos */}
              <EtapaCustosFixos onTotalChange={handleCustosFixosChange} />
              
              {/* Etapa 2: Calculadora */}
              <EtapaCalculadora 
                custosFixosTotal={custosFixosTotal} 
                metaFaturamentoMensal={metaFaturamentoMensal}
                onPrecoFinalChange={setPrecoFinalServico}
              />
              
              {/* Etapa 3: Metas */}
              <EtapaMetas custosFixosTotal={custosFixosTotal} />
            </main>
          </div>
        </div>
      </ScrollArea>
    </PricingProvider>
  );
}

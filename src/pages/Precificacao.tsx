import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Database, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CalculadoraServicos } from '@/components/precificacao/CalculadoraServicos';
import { EstruturaCustosFixos } from '@/components/precificacao/EstruturaCustosFixos';
import { MetasIndicadores } from '@/components/precificacao/MetasIndicadores';
import { ScrollArea } from "@/components/ui/scroll-area";
import { inicializarSistemaPrecificacao } from '@/utils/pricingMigration';
import { PricingServiceFactory } from '@/services/pricing';
export default function Precificacao() {
  const [calculadoraAberta, setCalculadoraAberta] = useState(false);
  const [custosFixosTotal, setCustosFixosTotal] = useState(0);
  const [sistemaInicializado, setSistemaInicializado] = useState(false);
  
  const handleCustosFixosChange = (total: number) => {
    setCustosFixosTotal(total);
  };

  // Inicializar sistema de precificação ao carregar a página
  useEffect(() => {
    console.log('🚀 Inicializando página de precificação...');
    
    try {
      inicializarSistemaPrecificacao();
      setSistemaInicializado(true);
      console.log('✅ Sistema de precificação inicializado');
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
        const validacao = await services.validation.validarTodosSistemas();
        console.log('🔍 Validação periódica:', validacao);
      }, 30000); // A cada 30 segundos

      return () => clearInterval(intervalId);
    }
  }, [sistemaInicializado]);
  return <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 p-3 md:p-6 space-y-4 md:space-y-6 bg-lunar-bg min-h-screen">
      {/* Header da Página */}
      <div className="px-1 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-foreground mb-1">Precificação e Metas</h1>
            <p className="text-sm text-muted-foreground">
              Sistema aprimorado com salvamento automático e compatibilidade multi-usuário
            </p>
          </div>
        </div>
      </div>

      {/* 1. Calculadora de Serviços */}
      <CalculadoraServicos custosFixosTotal={custosFixosTotal} />

      {/* 2. Estrutura de Custos Fixos */}
      <EstruturaCustosFixos onTotalChange={handleCustosFixosChange} />

      {/* 3. Metas e Indicadores de Lucro */}
      <MetasIndicadores custosFixosTotal={custosFixosTotal} />
      </div>
    </ScrollArea>;
}
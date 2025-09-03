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
  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-8 bg-background min-h-screen">
        {/* Header da Página */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Precificação e Metas</h1>
              <p className="text-base text-muted-foreground max-w-2xl">
                Sistema completo para cálculo de preços, gestão de custos fixos e definição de metas financeiras
              </p>
            </div>
            
            {/* Status global do sistema */}
            <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
              {sistemaInicializado ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Sistema Ativo</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-orange-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Inicializando...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Grid responsivo para os componentes principais */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Coluna Principal - Calculadora (2/3 da largura em telas grandes) */}
          <div className="xl:col-span-2 space-y-8">
            <CalculadoraServicos custosFixosTotal={custosFixosTotal} />
          </div>

          {/* Coluna Lateral - Metas (1/3 da largura em telas grandes) */}
          <div className="xl:col-span-1">
            <MetasIndicadores custosFixosTotal={custosFixosTotal} />
          </div>
        </div>

        {/* Estrutura de Custos em largura total */}
        <div className="space-y-8">
          <EstruturaCustosFixos onTotalChange={handleCustosFixosChange} />
        </div>
      </div>
    </ScrollArea>
  );
}
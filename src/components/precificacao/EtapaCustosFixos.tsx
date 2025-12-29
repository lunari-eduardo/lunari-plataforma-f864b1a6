import { Card, CardContent } from '@/components/ui/card';
import { usePricing } from '@/contexts/PricingContext';
import { CollapsibleCustoSection } from './custos/CollapsibleCustoSection';
import { CardGastosPessoaisContent } from './custos/CardGastosPessoaisContent';
import { CardProLaboreContent } from './custos/CardProLaboreContent';
import { CardCustosEstudioContent } from './custos/CardCustosEstudioContent';
import { EtapaColapsavel } from './EtapaColapsavel';
import { useEffect } from 'react';
import { User, Briefcase, Building2 } from 'lucide-react';

interface EtapaCustosFixosProps {
  onTotalChange: (total: number) => void;
}

export function EtapaCustosFixos({ onTotalChange }: EtapaCustosFixosProps) {
  const {
    estruturaCustos,
    loading,
    statusSalvamento,
    adicionarGastoPessoal,
    removerGastoPessoal,
    atualizarGastoPessoal,
    adicionarCustoEstudio,
    removerCustoEstudio,
    atualizarCustoEstudio,
    atualizarPercentualProLabore,
    totalCustosFixos
  } = usePricing();

  // Dados derivados
  const gastosPessoais = estruturaCustos?.gastosPessoais || [];
  const custosEstudio = estruturaCustos?.custosEstudio || [];
  const percentualProLabore = estruturaCustos?.percentualProLabore || 30;

  // Cálculos
  const totalGastosPessoais = gastosPessoais.reduce((total, item) => total + item.valor, 0);
  const proLaboreCalculado = totalGastosPessoais * (1 + percentualProLabore / 100);
  const totalCustosEstudio = custosEstudio.reduce((total, item) => total + item.valor, 0);

  // Notificar mudança no total
  useEffect(() => {
    onTotalChange(totalCustosFixos);
  }, [totalCustosFixos, onTotalChange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loading) {
    return (
      <EtapaColapsavel
        numero={1}
        titulo="Custos Fixos Mensais"
        descricao="Quanto custa manter seu negócio funcionando"
        defaultOpen={false}
        statusSalvamento="salvando"
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </EtapaColapsavel>
    );
  }

  return (
    <EtapaColapsavel
      numero={1}
      titulo="Custos Fixos Mensais"
      descricao="Quanto custa manter seu negócio funcionando"
      defaultOpen={false}
      statusSalvamento={statusSalvamento}
    >
      <div className="space-y-4">
        {/* Gastos Pessoais - Colapsável */}
        <CollapsibleCustoSection
          icon={User}
          title="Gastos Pessoais"
          total={totalGastosPessoais}
          colorClass="amber"
          defaultOpen={true}
        >
          <CardGastosPessoaisContent
            gastosPessoais={gastosPessoais}
            onAdicionar={adicionarGastoPessoal}
            onRemover={removerGastoPessoal}
            onAtualizar={atualizarGastoPessoal}
          />
        </CollapsibleCustoSection>

        {/* Pró-labore - Colapsável */}
        <CollapsibleCustoSection
          icon={Briefcase}
          title="Pró-labore"
          total={proLaboreCalculado}
          colorClass="blue"
          defaultOpen={false}
        >
          <CardProLaboreContent
            percentualProLabore={percentualProLabore}
            onPercentualChange={atualizarPercentualProLabore}
            totalGastosPessoais={totalGastosPessoais}
            proLaboreCalculado={proLaboreCalculado}
          />
        </CollapsibleCustoSection>

        {/* Custos do Estúdio - Colapsável */}
        <CollapsibleCustoSection
          icon={Building2}
          title="Custos do Estúdio"
          total={totalCustosEstudio}
          colorClass="emerald"
          defaultOpen={false}
        >
          <CardCustosEstudioContent
            custosEstudio={custosEstudio}
            onAdicionar={adicionarCustoEstudio}
            onRemover={removerCustoEstudio}
            onAtualizar={atualizarCustoEstudio}
          />
        </CollapsibleCustoSection>
        
        {/* Resumo da Etapa */}
        <Card className="bg-muted/50 border">
          <CardContent className="py-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total de Custos Fixos Mensais</span>
              <span className="text-2xl font-bold text-foreground">
                {formatCurrency(totalCustosFixos)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </EtapaColapsavel>
  );
}

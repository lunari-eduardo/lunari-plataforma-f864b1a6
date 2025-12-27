import { Card, CardContent } from '@/components/ui/card';
import { usePricing } from '@/contexts/PricingContext';
import { CardGastosPessoais } from './custos/CardGastosPessoais';
import { CardProLabore } from './custos/CardProLabore';
import { CardCustosEstudio } from './custos/CardCustosEstudio';
import { CardEquipamentos } from './custos/CardEquipamentos';
import { EtapaColapsavel } from './EtapaColapsavel';
import { useEffect } from 'react';

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
    adicionarEquipamento,
    removerEquipamento,
    atualizarEquipamento,
    atualizarPercentualProLabore,
    totalCustosFixos
  } = usePricing();

  // Dados derivados
  const gastosPessoais = estruturaCustos?.gastosPessoais || [];
  const custosEstudio = estruturaCustos?.custosEstudio || [];
  const equipamentos = estruturaCustos?.equipamentos || [];
  const percentualProLabore = estruturaCustos?.percentualProLabore || 30;

  // Cálculos
  const totalGastosPessoais = gastosPessoais.reduce((total, item) => total + item.valor, 0);
  const proLaboreCalculado = totalGastosPessoais * (1 + percentualProLabore / 100);
  const totalCustosEstudio = custosEstudio.reduce((total, item) => total + item.valor, 0);
  const totalDepreciacaoMensal = equipamentos.reduce((total, eq) => {
    const depreciacaoMensal = eq.valorPago / (eq.vidaUtil * 12);
    return total + depreciacaoMensal;
  }, 0);

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardGastosPessoais 
          gastosPessoais={gastosPessoais}
          totalGastosPessoais={totalGastosPessoais}
          onAdicionar={adicionarGastoPessoal}
          onRemover={removerGastoPessoal}
          onAtualizar={atualizarGastoPessoal}
        />
        <CardProLabore 
          percentualProLabore={percentualProLabore}
          onPercentualChange={atualizarPercentualProLabore}
          totalGastosPessoais={totalGastosPessoais}
          proLaboreCalculado={proLaboreCalculado}
        />
        <CardCustosEstudio 
          custosEstudio={custosEstudio}
          totalCustosEstudio={totalCustosEstudio}
          onAdicionar={adicionarCustoEstudio}
          onRemover={removerCustoEstudio}
          onAtualizar={atualizarCustoEstudio}
        />
        <CardEquipamentos 
          equipamentos={equipamentos}
          totalDepreciacaoMensal={totalDepreciacaoMensal}
          onAdicionar={adicionarEquipamento}
          onRemover={removerEquipamento}
          onAtualizar={atualizarEquipamento}
        />
      </div>
      
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
    </EtapaColapsavel>
  );
}

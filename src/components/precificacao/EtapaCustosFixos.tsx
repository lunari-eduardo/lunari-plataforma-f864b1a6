import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { EstruturaCustosService, IndicadoresService } from '@/services/PricingService';
import type { GastoItem, Equipamento, StatusSalvamento } from '@/types/precificacao';
import { CardGastosPessoais } from './custos/CardGastosPessoais';
import { CardProLabore } from './custos/CardProLabore';
import { CardCustosEstudio } from './custos/CardCustosEstudio';
import { CardEquipamentos } from './custos/CardEquipamentos';

interface EtapaCustosFixosProps {
  onTotalChange: (total: number) => void;
}

export function EtapaCustosFixos({ onTotalChange }: EtapaCustosFixosProps) {
  const [gastosPessoais, setGastosPessoais] = useState<GastoItem[]>([]);
  const [percentualProLabore, setPercentualProLabore] = useState(30);
  const [custosEstudio, setCustosEstudio] = useState<GastoItem[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [statusSalvamento, setStatusSalvamento] = useState<StatusSalvamento>('nao_salvo');

  // Carregar dados salvos
  useEffect(() => {
    try {
      setStatusSalvamento('salvando');
      const dados = EstruturaCustosService.carregar();
      setGastosPessoais(dados.gastosPessoais);
      setPercentualProLabore(dados.percentualProLabore);
      setCustosEstudio(dados.custosEstudio);
      setEquipamentos(dados.equipamentos);
      setStatusSalvamento('salvo');
      IndicadoresService.atualizarIndicador('estrutura_custos', 'salvo', 'Dados carregados');
    } catch (error) {
      console.error('Erro ao carregar estrutura de custos:', error);
      setStatusSalvamento('erro');
    }
  }, []);

  // Cálculos
  const totalGastosPessoais = (gastosPessoais || []).reduce((total, item) => total + item.valor, 0);
  const proLaboreCalculado = totalGastosPessoais * (1 + percentualProLabore / 100);
  const totalCustosEstudio = (custosEstudio || []).reduce((total, item) => total + item.valor, 0);
  const totalDepreciacaoMensal = (equipamentos || []).reduce((total, eq) => {
    const depreciacaoMensal = eq.valorPago / (eq.vidaUtil * 12);
    return total + depreciacaoMensal;
  }, 0);
  const totalPrincipal = proLaboreCalculado + totalCustosEstudio + totalDepreciacaoMensal;

  // Salvar automaticamente
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        setStatusSalvamento('salvando');
        const dadosParaSalvar = {
          gastosPessoais,
          percentualProLabore,
          custosEstudio,
          equipamentos,
          totalCalculado: totalPrincipal
        };
        const sucesso = EstruturaCustosService.salvar(dadosParaSalvar);
        if (sucesso) {
          setStatusSalvamento('salvo');
          IndicadoresService.atualizarIndicador('estrutura_custos', 'salvo', 'Salvo automaticamente');
        } else {
          setStatusSalvamento('erro');
        }
      } catch (error) {
        console.error('Erro no auto-save:', error);
        setStatusSalvamento('erro');
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [gastosPessoais, percentualProLabore, custosEstudio, equipamentos, totalPrincipal]);

  // Notificar mudança no total
  useEffect(() => {
    onTotalChange(totalPrincipal);
  }, [totalPrincipal, onTotalChange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
          1
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Custos Fixos Mensais</h2>
          <p className="text-sm text-muted-foreground">
            Quanto custa manter seu negócio funcionando
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {statusSalvamento === 'salvo' && <CheckCircle className="h-3 w-3 text-green-600" />}
          {statusSalvamento === 'erro' && <AlertCircle className="h-3 w-3 text-red-600" />}
          {statusSalvamento === 'salvando' && <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full" />}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardGastosPessoais 
          gastosPessoais={gastosPessoais}
          setGastosPessoais={setGastosPessoais}
          totalGastosPessoais={totalGastosPessoais}
        />
        <CardProLabore 
          percentualProLabore={percentualProLabore}
          setPercentualProLabore={setPercentualProLabore}
          totalGastosPessoais={totalGastosPessoais}
          proLaboreCalculado={proLaboreCalculado}
        />
        <CardCustosEstudio 
          custosEstudio={custosEstudio}
          setCustosEstudio={setCustosEstudio}
          totalCustosEstudio={totalCustosEstudio}
        />
        <CardEquipamentos 
          equipamentos={equipamentos}
          setEquipamentos={setEquipamentos}
          totalDepreciacaoMensal={totalDepreciacaoMensal}
        />
      </div>
      
      {/* Resumo da Etapa */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total de Custos Fixos Mensais</span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(totalPrincipal)}
            </span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

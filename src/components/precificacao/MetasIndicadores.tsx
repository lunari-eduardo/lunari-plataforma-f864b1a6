import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { storage } from '@/utils/localStorage';
interface MetasIndicadoresProps {
  custosFixosTotal: number;
}
export function MetasIndicadores({
  custosFixosTotal
}: MetasIndicadoresProps) {
  const [margemLucroDesejada, setMargemLucroDesejada] = useState(30);

  // Carregar dados salvos
  useEffect(() => {
    const dados = storage.load('precificacao_metas', {
      margemLucroDesejada: 30
    });
    setMargemLucroDesejada(dados.margemLucroDesejada);
  }, []);

  // Salvar dados automaticamente
  useEffect(() => {
    storage.save('precificacao_metas', {
      margemLucroDesejada
    });
  }, [margemLucroDesejada]);

  // Cálculos dos indicadores
  const faturamentoMinimoAnual = custosFixosTotal * 12;
  const metaFaturamentoAnual = faturamentoMinimoAnual / (1 - margemLucroDesejada / 100);
  const metaFaturamentoMensal = metaFaturamentoAnual / 12;
  const metaLucroAnual = metaFaturamentoAnual - faturamentoMinimoAnual;
  return <Card>
      <CardHeader className="bg-gray-50">
        <CardTitle className="text-lg text-lunar-success">Metas e Indicadores de Lucro</CardTitle>
        <p className="text-sm text-lunar-textSecondary">
          Defina suas metas financeiras e acompanhe os indicadores de lucro.
        </p>
      </CardHeader>
      <CardContent className="bg-gray-50">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna Esquerda - Definição de Metas */}
          <div>
            <h3 className="font-semibold mb-4">Definição de Metas</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="margem-lucro">Margem de Lucro Desejada (%)</Label>
                <Input id="margem-lucro" type="number" min="0" max="100" step="1" value={margemLucroDesejada} onChange={e => setMargemLucroDesejada(Number(e.target.value))} className="max-w-32" />
              </div>
            </div>
          </div>

          {/* Coluna Direita - Indicadores Financeiros */}
          <div className="bg-gray-50">
            <h3 className="font-semibold mb-4">Indicadores Financeiros</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm">Faturamento Mínimo Anual:</span>
                <span className="font-medium">R$ {faturamentoMinimoAnual.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-blue-600">Meta de Faturamento Anual:</span>
                <span className="font-medium text-blue-600">R$ {metaFaturamentoAnual.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-green-600">Meta de Faturamento Mensal:</span>
                <span className="font-medium text-green-600">R$ {metaFaturamentoMensal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-purple-600">Meta de Lucro Anual:</span>
                <span className="font-medium text-purple-600">R$ {metaLucroAnual.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>;
}
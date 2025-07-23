import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CalculadoraServicos } from '@/components/precificacao/CalculadoraServicos';
import { EstruturaCustosFixos } from '@/components/precificacao/EstruturaCustosFixos';
import { MetasIndicadores } from '@/components/precificacao/MetasIndicadores';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
export default function Precificacao() {
  const [calculadoraAberta, setCalculadoraAberta] = useState(false);
  const [custosFixosTotal, setCustosFixosTotal] = useState(0);
  const handleCustosFixosChange = (total: number) => {
    setCustosFixosTotal(total);
  };
  return <div className="p-4 md:p-6 space-y-6 bg-lunar-bg min-h-screen px-[2px] py-[5px]">
      {/* Header da Página */}
      <div>
        <h1 className="text-xl font-bold text-lunar-text mb-2 md:text-xl px-0">Precificação e Metas</h1>
        
      </div>

      {/* 1. Calculadora de Serviços */}
      <CalculadoraServicos custosFixosTotal={custosFixosTotal} />

      {/* 2. Estrutura de Custos Fixos */}
      <EstruturaCustosFixos onTotalChange={handleCustosFixosChange} />

      {/* 3. Metas e Indicadores de Lucro */}
      <MetasIndicadores custosFixosTotal={custosFixosTotal} />
    </div>;
}
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CalculadoraServicos } from '@/components/precificacao/CalculadoraServicos';
import { EstruturaCustosFixos } from '@/components/precificacao/EstruturaCustosFixos';
import { MetasIndicadores } from '@/components/precificacao/MetasIndicadores';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { ScrollArea } from "@/components/ui/scroll-area";
export default function Precificacao() {
  const [calculadoraAberta, setCalculadoraAberta] = useState(false);
  const [custosFixosTotal, setCustosFixosTotal] = useState(0);
  const handleCustosFixosChange = (total: number) => {
    setCustosFixosTotal(total);
  };
  return <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="p-3 md:p-6 space-y-4 md:space-y-6 bg-lunar-bg min-h-screen px-[2px]">
      {/* Header da Página */}
      <div className="px-1">
        <h1 className="text-lg md:text-xl font-bold text-lunar-text mb-2">Precificação e Metas</h1>
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
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface MonthYearNavigatorProps {
  filtroMesAno: {
    mes: number;
    ano: number;
  };
  setFiltroMesAno: (filtro: { mes: number; ano: number }) => void;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Componente reutilizável para navegação de mês/ano
 * Centraliza a lógica de navegação temporal
 */
const MonthYearNavigator = memo(function MonthYearNavigator({
  filtroMesAno,
  setFiltroMesAno,
  size = 'md',
  className = ''
}: MonthYearNavigatorProps) {
  const navegarMes = (direcao: 'anterior' | 'proximo') => {
    const novoMes = direcao === 'anterior' ? filtroMesAno.mes - 1 : filtroMesAno.mes + 1;
    
    if (novoMes < 1) {
      setFiltroMesAno({
        mes: 12,
        ano: filtroMesAno.ano - 1
      });
    } else if (novoMes > 12) {
      setFiltroMesAno({
        mes: 1,
        ano: filtroMesAno.ano + 1
      });
    } else {
      setFiltroMesAno({
        ...filtroMesAno,
        mes: novoMes
      });
    }
  };

  const isSmall = size === 'sm';
  const buttonSize = isSmall ? 'sm' : 'sm';
  const selectWidth = isSmall ? 'w-16' : 'w-20';
  const containerPadding = isSmall ? 'p-1' : 'p-2';
  const gapSize = isSmall ? 'gap-1' : 'gap-2';

  return (
    <div className={`flex items-center bg-card rounded-lg border border-border shadow-sm ${containerPadding} ${className}`}>
      <Button 
        variant="ghost" 
        size={buttonSize} 
        onClick={() => navegarMes('anterior')} 
        className="h-8 w-8 p-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className={`flex items-center ${gapSize} px-2`}>
        <Select 
          value={filtroMesAno.mes.toString()} 
          onValueChange={value => setFiltroMesAno({
            ...filtroMesAno,
            mes: parseInt(value)
          })}
        >
          <SelectTrigger className={`${selectWidth} h-8 text-sm border-0`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {meses.map((mes, index) => (
              <SelectItem key={index} value={(index + 1).toString()} className="text-sm">
                {mes}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select 
          value={filtroMesAno.ano.toString()} 
          onValueChange={value => setFiltroMesAno({
            ...filtroMesAno,
            ano: parseInt(value)
          })}
        >
          <SelectTrigger className={`${selectWidth} h-8 text-sm border-0`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2023, 2024, 2025, 2026].map(ano => (
              <SelectItem key={ano} value={ano.toString()} className="text-sm">
                {ano}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button 
        variant="ghost" 
        size={buttonSize} 
        onClick={() => navegarMes('proximo')} 
        className="h-8 w-8 p-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
});

export default MonthYearNavigator;
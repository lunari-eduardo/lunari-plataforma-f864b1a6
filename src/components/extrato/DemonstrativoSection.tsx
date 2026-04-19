/**
 * Seção do demonstrativo simplificado
 */

import { DemonstrativoSimplificado } from '@/types/extrato';
import DemonstrativoSimplificadoComponent from '@/components/financas/DemonstrativoSimplificado';

interface DemonstrativoSectionProps {
  demonstrativo: DemonstrativoSimplificado;
  periodo: {
    inicio: string;
    fim: string;
  };
  regime?: 'caixa' | 'competencia';
}

export default function DemonstrativoSection({ 
  demonstrativo, 
  periodo,
  regime = 'caixa'
}: DemonstrativoSectionProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground text-right">
        Visão por <strong>{regime === 'competencia' ? 'Competência' : 'Caixa'}</strong>
      </div>
      <DemonstrativoSimplificadoComponent 
        demonstrativo={demonstrativo} 
        periodo={periodo}
        transactions={[]}
      />
    </div>
  );
}
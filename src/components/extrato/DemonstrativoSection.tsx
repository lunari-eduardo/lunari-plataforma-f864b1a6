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
}

export default function DemonstrativoSection({ 
  demonstrativo, 
  periodo 
}: DemonstrativoSectionProps) {
  return (
    <DemonstrativoSimplificadoComponent 
      demonstrativo={demonstrativo} 
      periodo={periodo}
      transactions={[]} // TODO: [SUPABASE] Passar transações quando necessário
    />
  );
}
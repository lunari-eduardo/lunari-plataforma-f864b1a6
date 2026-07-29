import { History } from 'lucide-react';
import { WorkflowHistoryTable } from '@/components/crm/WorkflowHistoryTable';
import { ClientCreditPanel } from '@/components/finance/ClientCreditPanel';
import { ClienteCompleto } from '@/types/cliente-supabase';
import { SECTION_SURFACE, SECTION_TITLE } from '@/lib/dialogTokens';

interface HistoricoTabProps {
  cliente: ClienteCompleto;
}

export function HistoricoTab({ cliente }: HistoricoTabProps) {
  return (
    <div className="space-y-4">
      <ClientCreditPanel clienteId={cliente.id} />

      <section className={SECTION_SURFACE}>
        <div className="mb-3">
          <h3 className={SECTION_TITLE}>
            <History className="h-3.5 w-3.5 text-accent-gold" />
            Histórico completo
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Todos os orçamentos e trabalhos realizados para este cliente
          </p>
        </div>
        <WorkflowHistoryTable cliente={cliente} />
      </section>
    </div>
  );
}

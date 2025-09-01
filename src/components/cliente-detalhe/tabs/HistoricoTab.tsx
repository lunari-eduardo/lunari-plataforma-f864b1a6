import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowHistoryTable } from '@/components/crm/WorkflowHistoryTable';
import { Cliente } from '@/types/orcamentos';

interface HistoricoTabProps {
  cliente: Cliente;
}

export const HistoricoTab = memo(({ cliente }: HistoricoTabProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico Completo</CardTitle>
        <CardDescription>
          Todos os orçamentos e trabalhos realizados para este cliente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <WorkflowHistoryTable cliente={cliente} />
      </CardContent>
    </Card>
  );
});

HistoricoTab.displayName = 'HistoricoTab';
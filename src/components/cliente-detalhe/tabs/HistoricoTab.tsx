import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowHistoryTable } from '@/components/crm/WorkflowHistoryTable';
import { ClienteCompleto } from '@/types/cliente-supabase';

interface HistoricoTabProps {
  cliente: ClienteCompleto;
}

export function HistoricoTab({ cliente }: HistoricoTabProps) {
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
}
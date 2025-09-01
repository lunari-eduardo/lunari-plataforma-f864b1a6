import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowHistoryTable } from '@/components/crm/WorkflowHistoryTable';

interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
}

interface HistoricoTabProps {
  cliente: Cliente;
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
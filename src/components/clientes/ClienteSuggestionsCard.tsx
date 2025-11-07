import { Cliente } from '@/types/cliente';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Phone, Mail, Calendar, Edit2, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClienteSuggestionsCardProps {
  clientes: Cliente[];
  onEditClient: (cliente: Cliente) => void;
  onDismiss: () => void;
}

export const ClienteSuggestionsCard = ({
  clientes,
  onEditClient,
  onDismiss
}: ClienteSuggestionsCardProps) => {
  if (clientes.length === 0) return null;

  return (
    <Card className="border-warning bg-warning/5 mt-2">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h4 className="font-medium text-warning">
              Clientes similares encontrados
            </h4>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-3">
          Encontramos clientes com nomes parecidos. Deseja editar um deles?
        </p>

        <div className="space-y-2">
          {clientes.map((cliente) => (
            <div
              key={cliente.id}
              className="flex items-center justify-between p-3 rounded-md bg-background border hover:border-warning/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{cliente.nome}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                  {cliente.telefone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {cliente.telefone}
                    </span>
                  )}
                  {cliente.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {cliente.email}
                    </span>
                  )}
                  {cliente.origem && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Origem: {cliente.origem}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEditClient(cliente)}
                className="ml-2 flex items-center gap-1"
              >
                <Edit2 className="h-3 w-3" />
                Editar
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="w-full mt-3 text-muted-foreground hover:text-foreground"
        >
          Ignorar e criar novo cliente
        </Button>
      </CardContent>
    </Card>
  );
};

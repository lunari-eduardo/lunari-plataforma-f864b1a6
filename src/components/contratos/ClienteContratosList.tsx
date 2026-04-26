import { useState } from 'react';
import { useContratos } from '@/hooks/useContratos';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileSignature, Plus, FileText } from 'lucide-react';
import { ContratoStatusBadge } from './ContratoStatusBadge';
import { NovoContratoModal } from './NovoContratoModal';
import { ContratoViewerModal } from './ContratoViewerModal';
import type { Contrato } from '@/types/contrato';

interface ClienteContratosListProps {
  clienteId: string;
  clienteNome?: string;
}

export function ClienteContratosList({ clienteId, clienteNome }: ClienteContratosListProps) {
  const { contratos, isLoading } = useContratos({ clienteId });
  const [novoOpen, setNovoOpen] = useState(false);
  const [viewing, setViewing] = useState<Contrato | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Contratos</h3>
          <span className="text-xs text-muted-foreground">({contratos.length})</span>
        </div>
        <Button size="sm" onClick={() => setNovoOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Novo contrato
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Carregando...</div>
      ) : contratos.length === 0 ? (
        <Card className="p-6 text-center border-dashed">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum contrato gerado para este cliente.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {contratos.map((c) => (
            <Card
              key={c.id}
              className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => setViewing(c)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-medium truncate text-sm">{c.titulo}</h4>
                  <ContratoStatusBadge status={c.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Criado em {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  {c.session_id && ' · vinculado a sessão'}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NovoContratoModal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        clienteId={clienteId}
        clienteNome={clienteNome}
      />

      {viewing && (
        <ContratoViewerModal
          open={!!viewing}
          onClose={() => setViewing(null)}
          contrato={viewing}
        />
      )}
    </div>
  );
}

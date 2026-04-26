import { useState } from 'react';
import { useContratos } from '@/hooks/useContratos';
import { Button } from '@/components/ui/button';
import { FileSignature } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContratoViewerModal } from './ContratoViewerModal';
import { NovoContratoModal } from './NovoContratoModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ContratoStatusBadge } from './ContratoStatusBadge';
import { CONTRATO_STATUS_LABELS, type ContratoStatus } from '@/types/contrato';

interface SessaoContratoButtonProps {
  sessionId: string;
  clienteId: string;
  clienteNome?: string;
  className?: string;
}

const STATUS_PRIORITY: Record<ContratoStatus, number> = {
  assinado: 4,
  enviado: 3,
  rascunho: 2,
  cancelado: 1,
};

const dotColor: Record<ContratoStatus, string> = {
  rascunho: 'bg-muted-foreground',
  enviado: 'bg-blue-500',
  assinado: 'bg-emerald-500',
  cancelado: 'bg-red-500',
};

/**
 * Variante "com label" do SessaoContratoIcon — usada no card EXPANDIDO do Workflow.
 * Renderiza um botão largo (w-full) alinhado às demais ações da coluna lateral.
 */
export function SessaoContratoButton({
  sessionId,
  clienteId,
  clienteNome,
  className,
}: SessaoContratoButtonProps) {
  const { contratos } = useContratos({ sessionId });
  const [novoOpen, setNovoOpen] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [popOpen, setPopOpen] = useState(false);

  const statusPrincipal: ContratoStatus | null =
    contratos.length > 0
      ? contratos.reduce<ContratoStatus>(
          (acc, c) =>
            STATUS_PRIORITY[c.status] > STATUS_PRIORITY[acc] ? c.status : acc,
          contratos[0].status
        )
      : null;

  const hasContratos = contratos.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasContratos) {
      setNovoOpen(true);
    } else {
      setPopOpen(true);
    }
  };

  const label = hasContratos
    ? contratos.length > 1
      ? `Contratos (${contratos.length})`
      : 'Contrato'
    : 'Contrato';

  return (
    <>
      <Popover open={popOpen} onOpenChange={setPopOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClick}
            className={cn('gap-2 w-full justify-between', className)}
            aria-label="Contratos da sessão"
          >
            <span className="flex items-center gap-2">
              <FileSignature className="h-3.5 w-3.5" />
              {label}
            </span>
            {statusPrincipal && (
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    dotColor[statusPrincipal]
                  )}
                />
                <span className="text-[10px] text-muted-foreground">
                  {CONTRATO_STATUS_LABELS[statusPrincipal]}
                </span>
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-2"
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-semibold mb-1 px-2">
            Contratos da sessão
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {contratos.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setViewing(c);
                  setPopOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">
                    {c.titulo}
                  </span>
                  <ContratoStatusBadge status={c.status} showIcon={false} />
                </div>
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2"
            onClick={() => {
              setPopOpen(false);
              setNovoOpen(true);
            }}
          >
            + Novo contrato
          </Button>
        </PopoverContent>
      </Popover>

      <NovoContratoModal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        clienteId={clienteId}
        clienteNome={clienteNome}
        sessionId={sessionId}
      />

      {viewing && (
        <ContratoViewerModal
          open={!!viewing}
          onClose={() => setViewing(null)}
          contrato={viewing}
        />
      )}
    </>
  );
}

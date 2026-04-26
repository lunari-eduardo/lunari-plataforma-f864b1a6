import { useState } from 'react';
import { useContratos } from '@/hooks/useContratos';
import { Button } from '@/components/ui/button';
import { FileSignature } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContratoViewerModal } from './ContratoViewerModal';
import { NovoContratoModal } from './NovoContratoModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ContratoStatusBadge } from './ContratoStatusBadge';
import type { ContratoStatus } from '@/types/contrato';

interface SessaoContratoIconProps {
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

export function SessaoContratoIcon({ sessionId, clienteId, clienteNome, className }: SessaoContratoIconProps) {
  const { contratos } = useContratos({ sessionId });
  const [novoOpen, setNovoOpen] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [popOpen, setPopOpen] = useState(false);

  // Status mais "avançado" entre todos os contratos
  const statusPrincipal: ContratoStatus | null =
    contratos.length > 0
      ? contratos.reduce<ContratoStatus>((acc, c) =>
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

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Popover open={popOpen} onOpenChange={setPopOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClick}
                  className={cn(
                    'relative h-7 w-7 p-0',
                    !hasContratos && 'text-muted-foreground/60 hover:text-primary',
                    className
                  )}
                  aria-label="Contratos"
                >
                  <FileSignature className="h-4 w-4" />
                  {statusPrincipal && (
                    <span
                      className={cn(
                        'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-background',
                        dotColor[statusPrincipal]
                      )}
                    />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-72 p-2"
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs font-semibold mb-1 px-2">Contratos da sessão</div>
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
                        <span className="text-xs font-medium truncate">{c.titulo}</span>
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
          </TooltipTrigger>
          <TooltipContent side="top">
            {hasContratos ? `${contratos.length} contrato(s)` : 'Criar contrato'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

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

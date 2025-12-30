import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Images, 
  Plus, 
  ExternalLink,
  Loader2
} from "lucide-react";
import { useGalerias, Galeria, CreateGaleriaData } from "@/hooks/useGalerias";
import { GaleriaStatusBadge } from "./GaleriaStatusBadge";
import { useAccessControl } from "@/hooks/useAccessControl";

interface GaleriaActionsProps {
  sessionId: string;
  clienteId: string;
  fotosIncluidas: number;
  valorFotoExtra: number;
  orcamentoId?: string;
  compact?: boolean;
  onGaleriaCreated?: (galeria: Galeria) => void;
}

export function GaleriaActions({
  sessionId,
  clienteId,
  fotosIncluidas,
  valorFotoExtra,
  orcamentoId,
  compact = false,
  onGaleriaCreated
}: GaleriaActionsProps) {
  const { hasGaleryAccess } = useAccessControl();
  const { createGaleria, getGaleriaBySessionId, loading } = useGalerias();
  const [galeria, setGaleria] = useState<Galeria | null>(null);
  const [checkingGaleria, setCheckingGaleria] = useState(true);

  // Verificar se já existe galeria para esta sessão
  useEffect(() => {
    const checkExistingGaleria = async () => {
      if (!sessionId) {
        setCheckingGaleria(false);
        return;
      }

      try {
        const existingGaleria = await getGaleriaBySessionId(sessionId);
        setGaleria(existingGaleria);
      } catch (error) {
        console.error('Error checking galeria:', error);
      } finally {
        setCheckingGaleria(false);
      }
    };

    checkExistingGaleria();
  }, [sessionId, getGaleriaBySessionId]);

  // Não renderizar se usuário não tem acesso à galeria
  if (!hasGaleryAccess) {
    return null;
  }

  const handleCreateGaleria = async () => {
    if (!clienteId) {
      return;
    }

    const data: CreateGaleriaData = {
      cliente_id: clienteId,
      session_id: sessionId,
      orcamento_id: orcamentoId,
      fotos_incluidas: fotosIncluidas || 0,
      valor_foto_extra: valorFotoExtra || 0,
    };

    const newGaleria = await createGaleria(data);
    if (newGaleria) {
      setGaleria(newGaleria);
      onGaleriaCreated?.(newGaleria);
    }
  };

  const handleOpenGaleria = () => {
    if (!galeria) return;
    
    // Por enquanto, apenas log - futuramente navegar para o módulo Galeria
    console.log('Abrir galeria:', galeria.id);
    // TODO: Implementar navegação para módulo Galeria
    // navigate(`/app/galeria/${galeria.id}`);
  };

  if (checkingGaleria) {
    return (
      <div className="flex items-center justify-center p-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Se já existe galeria, mostrar botão de abrir + status
  if (galeria) {
    if (compact) {
      return (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenGaleria}
            className="h-7 px-2 text-xs"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Galeria
          </Button>
          <GaleriaStatusBadge 
            status={galeria.status} 
            statusPagamento={galeria.status_pagamento}
            compact 
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenGaleria}
            className="text-xs"
          >
            <Images className="h-3.5 w-3.5 mr-1.5" />
            Abrir Galeria
          </Button>
          <GaleriaStatusBadge 
            status={galeria.status} 
            statusPagamento={galeria.status_pagamento}
          />
        </div>
      </div>
    );
  }

  // Se não existe galeria, mostrar botão de criar
  if (compact) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCreateGaleria}
        disabled={loading || !clienteId}
        className="h-7 px-2 text-xs text-primary hover:text-primary"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Plus className="h-3 w-3 mr-1" />
            Galeria
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCreateGaleria}
      disabled={loading || !clienteId}
      className="text-xs"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <Plus className="h-3.5 w-3.5 mr-1.5" />
      )}
      Criar Galeria
    </Button>
  );
}

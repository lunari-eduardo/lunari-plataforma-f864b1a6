import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useAppForceUpdate } from "@/hooks/useAppForceUpdate";
import { toast } from "sonner";
import { useState } from "react";

/**
 * Botão para forçar atualização do app em todos os dispositivos do usuário
 * Dispara evento em app_reload_events que aciona reload em tempo real
 */
export function ForceUpdateButton() {
  const { triggerReloadForAllDevices } = useAppForceUpdate();
  const [isLoading, setIsLoading] = useState(false);

  async function handleForceUpdate() {
    setIsLoading(true);
    
    const success = await triggerReloadForAllDevices();
    
    if (success) {
      toast.success('Atualização disparada! Todos os dispositivos serão atualizados.', {
        duration: 3000,
      });
      
      // Aguardar um pouco antes de recarregar este dispositivo também
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      toast.error('Erro ao disparar atualização');
      setIsLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleForceUpdate}
      disabled={isLoading}
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Atualizando...' : 'Atualizar App (Todos os Dispositivos)'}
    </Button>
  );
}

import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi } from 'lucide-react';

interface FinancialConfigHeaderProps {
  isSupabaseConnected: boolean;
  isSyncing: boolean;
  onSyncSupabase: () => void;
}

export function FinancialConfigHeader({
  isSupabaseConnected,
  isSyncing,
  onSyncSupabase
}: FinancialConfigHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações Financeiras</h2>
        <p className="text-muted-foreground">
          Gerencie os itens financeiros do sistema
        </p>
      </div>
      
      {isSupabaseConnected && (
        <div className="flex items-center gap-3">
          {/* Connection status - only shown when connected */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-green-600">
              <Wifi className="h-4 w-4" />
              <span className="text-sm font-medium">Supabase Conectado</span>
            </div>
          </div>
          
          {/* Sync button */}
          <Button 
            onClick={onSyncSupabase}
            disabled={isSyncing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>
      )}
    </div>
  );
}
import { Calendar, Info, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGoogleCalendarIntegration } from '@/hooks/useGoogleCalendarIntegration';
import { cn } from '@/lib/utils';

// Google Calendar official logo
const GoogleCalendarIcon = () => (
  <svg viewBox="0 0 200 200" className="w-6 h-6">
    <path fill="#4285F4" d="M152.637 47.363H47.363v105.274h105.274z"/>
    <path fill="#34A853" d="M152.637 152.637L200 152.637 200 47.363 152.637 47.363z"/>
    <path fill="#FBBC04" d="M47.363 152.637H0V200h200v-47.363z"/>
    <path fill="#EA4335" d="M0 47.363V200h47.363V47.363z"/>
    <path fill="#C5221F" d="M0 47.363L47.363 0v47.363z"/>
    <path fill="#1967D2" d="M152.637 47.363V0L200 47.363z"/>
    <path fill="#188038" d="M200 200v-47.363h-47.363z"/>
    <path fill="#FBBC04" d="M152.637 0H47.363v47.363h105.274z"/>
    <path fill="#fff" d="M88.27 133.324c-4.035-2.735-6.834-6.7-8.396-11.895l9.392-3.87c.91 3.47 2.538 6.138 4.884 8.006 2.346 1.868 5.093 2.802 8.24 2.802 3.218 0 5.957-.986 8.218-2.957 2.262-1.972 3.393-4.465 3.393-7.48 0-3.085-1.184-5.626-3.55-7.621-2.366-1.996-5.316-2.994-8.85-2.994h-5.49v-9.305h4.93c3.043 0 5.656-.873 7.839-2.62 2.183-1.746 3.274-4.137 3.274-7.174 0-2.701-1.024-4.87-3.072-6.507-2.048-1.637-4.608-2.455-7.68-2.455-2.944 0-5.377.786-7.297 2.357-1.92 1.572-3.338 3.54-4.253 5.905l-9.283-3.87c1.469-3.926 4.085-7.26 7.848-10.001 3.763-2.74 8.315-4.111 13.656-4.111 4.106 0 7.782.807 11.028 2.422 3.246 1.615 5.781 3.846 7.604 6.694 1.822 2.848 2.734 6.062 2.734 9.64 0 3.649-.863 6.726-2.59 9.23-1.725 2.505-3.892 4.389-6.5 5.653v.566c3.43 1.264 6.184 3.356 8.262 6.277 2.078 2.92 3.117 6.423 3.117 10.508 0 4.086-.96 7.685-2.878 10.797-1.92 3.112-4.584 5.54-7.993 7.286-3.41 1.746-7.262 2.62-11.557 2.62-5.27 0-9.972-1.367-14.007-4.102z"/>
  </svg>
);

export function GoogleCalendarCard() {
  const {
    status,
    loading,
    connecting,
    syncing,
    syncEnabled,
    connectedAt,
    connect,
    disconnect,
    toggleSync,
    syncExisting,
  } = useGoogleCalendarIntegration();

  const handleSyncExisting = async () => {
    const result = await syncExisting();
    if (!result) return;

    if (result.total === 0) {
      toast.info('Nenhum agendamento pendente para sincronizar');
      return;
    }

    if (result.synced > 0) {
      toast.success(`${result.synced} agendamento(s) sincronizado(s) com sucesso!`);
    }

    if (result.failed > 0) {
      toast.error(`${result.failed} agendamento(s) falharam ao sincronizar`);
    }
  };

  const isConnected = status === 'conectado';

  const connectedInfo = connectedAt 
    ? `Conectado em ${new Date(connectedAt).toLocaleDateString('pt-BR')}`
    : undefined;

  if (loading) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              isConnected ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-muted"
            )}>
              <GoogleCalendarIcon />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Google Calendar
                {isConnected && (
                  <span className="text-xs font-normal px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                    Conectado
                  </span>
                )}
              </CardTitle>
              {connectedInfo && (
                <CardDescription className="text-xs mt-0.5">
                  {connectedInfo}
                </CardDescription>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isConnected ? (
          <>
            {/* Estado não conectado */}
            <p className="text-sm text-muted-foreground">
              Conecte seu Google Calendar para receber notificações dos seus compromissos confirmados.
            </p>
            <Button 
              onClick={connect} 
              disabled={connecting}
              className="w-full"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Conectar Google Calendar
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            {/* Switch de sincronização */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Label htmlFor="sync-switch" className="cursor-pointer">
                  Sincronizar eventos confirmados
                </Label>
              </div>
              <Switch
                id="sync-switch"
                checked={syncEnabled}
                onCheckedChange={toggleSync}
              />
            </div>

            {/* Seção explicativa - sempre visível */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">Como funciona a integração</h4>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px] text-center">
                      <p className="text-xs">
                        O Google Calendar não altera status, clientes, valores ou workflows do Lunari.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>O Lunari envia para o Google Calendar apenas eventos com status <strong className="text-foreground">Confirmado</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Alterações no Google Calendar <strong className="text-foreground">não modificam</strong> dados no Lunari</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Google Calendar serve para visualização e notificações</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Cancelamentos no Lunari são refletidos automaticamente</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>O controle da agenda permanece <strong className="text-foreground">100% no Lunari</strong></span>
                </li>
              </ul>
            </div>

            {/* Botão sincronizar agendamentos existentes */}
            {syncEnabled && (
              <div className="pt-2 border-t">
                <Button 
                  variant="outline"
                  onClick={handleSyncExisting}
                  disabled={syncing}
                  className="w-full"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sincronizar agendamentos futuros
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Sincroniza todos os agendamentos confirmados a partir de hoje
                </p>
              </div>
            )}

            {/* Botão desconectar */}
            <Button 
              variant="outline" 
              onClick={disconnect}
              disabled={connecting}
              className="w-full"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desconectando...
                </>
              ) : (
                'Desconectar'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

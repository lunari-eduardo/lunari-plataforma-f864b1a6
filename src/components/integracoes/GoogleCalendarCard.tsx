import { Calendar, Info, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGoogleCalendarIntegration } from '@/hooks/useGoogleCalendarIntegration';
import { cn } from '@/lib/utils';

const GoogleCalendarIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
    <rect x="2" y="4" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M2 9H22" stroke="currentColor" strokeWidth="2"/>
    <path d="M7 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M17 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12" cy="15" r="2" fill="currentColor"/>
  </svg>
);

export function GoogleCalendarCard() {
  const {
    status,
    loading,
    connecting,
    syncEnabled,
    connectedAt,
    connect,
    disconnect,
    toggleSync,
  } = useGoogleCalendarIntegration();

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

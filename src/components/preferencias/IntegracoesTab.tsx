import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plug, CreditCard, Calendar, Crown, FileSignature, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PaymentSettings } from '@/components/integracoes/PaymentSettings';
import { GoogleCalendarCard } from '@/components/integracoes/GoogleCalendarCard';
import { AutentiqueCard } from '@/components/integracoes/AutentiqueCard';
import { useGoogleCalendarIntegration } from '@/hooks/useGoogleCalendarIntegration';
import { useAccessControl } from '@/hooks/useAccessControl';
import { useAssistantAccess } from '@/modules/assistant/runtime/useAssistantAccess';
import { toast } from 'sonner';

export function IntegracoesTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refetch: refetchGoogleCalendar } = useGoogleCalendarIntegration();
  const { hasPro } = useAccessControl();
  const { allowed: assistantAllowed } = useAssistantAccess();

  // Handle Google Calendar OAuth callbacks
  useEffect(() => {
    const googleSuccess = searchParams.get('google_success');
    const googleError = searchParams.get('google_error');

    if (googleSuccess) {
      toast.success('Google Calendar conectado com sucesso');
      refetchGoogleCalendar();
      setSearchParams({ tab: 'integracoes' });
      return;
    }

    if (googleError) {
      const errorMessages: Record<string, string> = {
        'access_denied': 'Acesso negado pelo usuário',
        'missing_params': 'Parâmetros inválidos',
        'token_exchange_failed': 'Falha na autenticação',
        'database_error': 'Erro ao salvar integração',
      };
      toast.error(errorMessages[googleError] || 'Erro ao conectar Google Calendar');
      setSearchParams({ tab: 'integracoes' });
      return;
    }
  }, [searchParams, setSearchParams, refetchGoogleCalendar]);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Tabs defaultValue="pagamentos" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="pagamentos" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Pagamentos</span>
          </TabsTrigger>
          <TabsTrigger value="assinatura" className="gap-2">
            <FileSignature className="h-4 w-4" />
            <span className="hidden sm:inline">Assinatura</span>
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="gap-2"
            onClick={(e) => {
              if (!hasPro) {
                e.preventDefault();
                toast('Recurso exclusivo do plano Pro', {
                  description: 'Faça upgrade para integrar com o Google Calendar.',
                  action: {
                    label: 'Ver planos',
                    onClick: () => window.location.href = '/escolher-plano',
                  },
                });
              }
            }}
            disabled={!hasPro}
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
            {!hasPro && <Crown className="h-3.5 w-3.5 text-primary" />}
          </TabsTrigger>
          <TabsTrigger value="assistente" className="gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Assistente</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pagamentos" className="mt-6">
          <PaymentSettings />
        </TabsContent>

        <TabsContent value="assinatura" className="mt-6">
          <div className="max-w-xl">
            <AutentiqueCard />
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <div className="max-w-xl">
            <GoogleCalendarCard />
          </div>
        </TabsContent>

        <TabsContent value="assistente" className="mt-6">
          <div className="max-w-xl space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  Assistente Lu · MCP
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Conecte assistentes externos (ChatGPT, Claude Desktop, Cursor, n8n) às ferramentas
                  da Lu via Model Context Protocol. Cada token é individual, revogável e respeita
                  seu estágio de liberação da Lu.
                </p>
                {assistantAllowed ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link to="/app/assistente/mcp">Gerenciar tokens MCP</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/app/assistente/aprovacoes">Aprovações pendentes</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    A Lu ainda não está liberada para sua conta neste estágio. Assim que o rollout
                    avançar, esta aba mostrará os controles de conexão MCP.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

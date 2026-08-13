import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useShareAnalysis } from '@/hooks/useShareAnalysis';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { format, formatDuration, intervalToDuration } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, ArrowLeft, Clock, Eye, MousePointerClick, TrendingUp, MonitorSmartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_LEAD_STATUSES } from '@/utils/leadTransformers';

function formatSeconds(seconds: number) {
  if (!seconds) return '0s';
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
  return formatDuration(duration, { locale: ptBR, format: ['hours', 'minutes', 'seconds'] });
}

export default function ShareAnalysisPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const { data, isLoading, error } = useShareAnalysis(shareId);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>Carregando análise do compartilhamento...</p>
        </div>
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center h-64 text-destructive">
          <p>Erro ao carregar a análise deste compartilhamento.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/app/comercial/compartilhamentos">Voltar</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  const { share, metrics, sessions } = data;

  return (
    <PageContainer>
      <div className="mb-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/app/comercial">Comercial</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/app/comercial/compartilhamentos">Compartilhamentos</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Análise</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-start gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild className="-ml-2 shrink-0">
          <Link to="/app/comercial/compartilhamentos">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Análise de Compartilhamento
          </h1>
          <p className="text-muted-foreground mt-1">
            Proposta: <strong className="text-foreground">{share.material?.title} (v{share.version?.version_number})</strong>
            {' • '}
            Cliente: {share.lead ? (
              <span className="inline-flex items-center gap-2">
                <Link to={`/app/leads`} className="text-primary hover:underline">{share.lead.nome}</Link>
                {share.lead.status && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 border-transparent ${
                      DEFAULT_LEAD_STATUSES.find((s) => s.key === share.lead.status)?.color ||
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {DEFAULT_LEAD_STATUSES.find((s) => s.key === share.lead.status)?.name || share.lead.status}
                  </Badge>
                )}
              </span>
            ) : 'Sem lead vinculado'}
          </p>
          <div className="mt-2 text-sm text-muted-foreground">
            Enviado em {format(new Date(share.sent_at), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acessos</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">Sessões individuais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatSeconds(metrics.avgDuration)}</div>
            <p className="text-xs text-muted-foreground mt-1">Por sessão de acesso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Engajamento (Scroll)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.maxScroll}%</div>
            <p className="text-xs text-muted-foreground mt-1">Profundidade máxima</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversão (CTA)</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.ctaClicks} / {metrics.ctaViews}</div>
            <p className="text-xs text-muted-foreground mt-1">Cliques / Visualizações do botão</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <h2 className="text-lg font-semibold tracking-tight">Histórico de Sessões</h2>
        
        {sessions.length === 0 ? (
          <div className="p-8 text-center border border-dashed rounded-xl text-muted-foreground bg-muted/20">
            Este link ainda não foi acessado pelo cliente.
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session: any, index: number) => (
              <Card key={session.id} className="overflow-hidden">
                <div className="bg-muted/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-background">Sessão {sessions.length - index}</Badge>
                    <span className="font-medium text-sm">
                      {format(new Date(session.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5" title="Duração total">
                      <Clock className="h-3.5 w-3.5" />
                      {formatSeconds(session.duration_seconds)}
                    </div>
                    {session.user_agent && (
                      <div className="flex items-center gap-1.5 truncate max-w-[200px]" title={session.user_agent}>
                        <MonitorSmartphone className="h-3.5 w-3.5" />
                        <span className="truncate">{session.user_agent.split(' ')[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
                <CardContent className="p-0">
                  {session.events.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      Nenhum evento registrado nesta sessão.
                    </div>
                  ) : (
                    <div className="divide-y text-sm">
                      {session.events.filter((event: any) => event.event_type !== 'heartbeat').map((event: any) => (
                        <div key={event.id} className="p-3 flex items-start gap-4 hover:bg-muted/10">
                          <div className="w-16 shrink-0 text-xs text-muted-foreground pt-0.5">
                            {format(new Date(event.occurred_at), "HH:mm:ss")}
                          </div>
                          <div className="flex-1">
                            <EventDescription event={event} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function EventDescription({ event }: { event: any }) {
  switch (event.event_type) {
    case 'view_start':
      return <span className="text-primary font-medium">Abriu o orçamento</span>;
    case 'view_end':
      return <span>Fechou a página ou saiu</span>;
    case 'scroll_depth':
      return <span>Rolou a página até <strong>{event.payload?.percent}%</strong></span>;
    case 'section_view':
      return <span>Visualizou o bloco de conteúdo <Badge variant="secondary" className="ml-1 text-xs">{event.payload?.block_type || 'Desconhecido'}</Badge></span>;
    case 'cta_view':
      return <span className="text-amber-600">Chegou até o botão de contato (WhatsApp)</span>;
    case 'cta_click':
      return <span className="text-green-600 font-semibold">Clicou no botão de contato (WhatsApp)!</span>;
    case 'link_click':
      return <span>Clicou em um link: <a href={event.payload?.url} target="_blank" rel="noreferrer" className="text-primary underline">{event.payload?.label || event.payload?.url}</a></span>;
    default:
      return <span className="text-muted-foreground">Evento desconhecido ({event.event_type})</span>;
  }
}

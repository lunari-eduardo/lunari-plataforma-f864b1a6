import { useState } from 'react';
import { FileSignature, ExternalLink, CheckCircle2, AlertCircle, Loader2, Plug, Trash2, Copy, Webhook } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAutentiqueIntegration } from '@/hooks/useAutentiqueIntegration';
import { toast } from '@/hooks/use-toast';

const WEBHOOK_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/autentique-webhook`;

export function AutentiqueCard() {
  const { status, isLoading, connect, isConnecting, disconnect, isDisconnecting, test, isTesting, refetch } =
    useAutentiqueIntegration();
  const [apiKey, setApiKey] = useState('');

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      toast({ title: 'Informe sua API Key', variant: 'destructive' });
      return;
    }
    try {
      await connect(apiKey.trim());
      setApiKey('');
    } catch {
      /* já tratado no hook */
    }
  };

  const handleTest = async () => {
    const result = await test();
    if (result?.valid) {
      toast({ title: 'Conexão válida', description: 'Sua API Key está funcionando.' });
    } else {
      toast({
        title: 'Conexão inválida',
        description: result?.validationError || 'Reconecte sua conta.',
        variant: 'destructive',
      });
    }
    refetch();
  };

  const isConnected = !!status?.connected;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
              <FileSignature className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Autentique</CardTitle>
              <CardDescription className="text-xs">
                Envie contratos para assinatura digital com validade jurídica.
              </CardDescription>
            </div>
          </div>
          {isConnected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Conectado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <AlertCircle className="h-3 w-3" /> Não conectado
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : isConnected ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Conta Autentique</div>
              <div className="mt-1 font-medium">{status?.account?.name || '—'}</div>
              <div className="text-xs text-muted-foreground">{status?.account?.email || ''}</div>
              {status?.conectado_em && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Conectado em {new Date(status.conectado_em).toLocaleString('pt-BR')}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleTest} disabled={isTesting}>
                {isTesting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plug className="mr-1 h-4 w-4" />}
                Testar conexão
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => disconnect()}
                disabled={isDisconnecting}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Desconectar
              </Button>
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Sincronização automática ativa
              </div>
              <p className="text-xs text-muted-foreground">
                O Lunari verifica a Autentique a cada 5 minutos e atualiza o status
                e o PDF assinado dos seus contratos automaticamente — sem
                configuração manual de webhook. Você também pode forçar a
                atualização a qualquer momento usando o botão "Atualizar status"
                dentro do contrato.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="autentique-key" className="text-xs">
                API Key da Autentique
              </Label>
              <Input
                id="autentique-key"
                type="password"
                placeholder="Cole aqui sua API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Sua API Key é armazenada com segurança e usada apenas pelo backend.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <a
                href="https://painel.autentique.com.br/api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Onde encontrar minha API Key <ExternalLink className="h-3 w-3" />
              </a>
              <Button onClick={handleConnect} disabled={isConnecting || !apiKey.trim()}>
                {isConnecting ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="mr-1 h-4 w-4" />
                )}
                Conectar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

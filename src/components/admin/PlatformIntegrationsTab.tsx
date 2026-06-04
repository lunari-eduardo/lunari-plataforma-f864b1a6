import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShieldCheck, ShieldAlert, KeyRound, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PlatformIntegration {
  id: string;
  provider: string;
  scope: string;
  environment: 'sandbox' | 'production';
  last_test_at: string | null;
  last_test_status: 'ok' | 'error' | null;
  last_test_message: string | null;
  updated_at: string;
}

export function PlatformIntegrationsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [integration, setIntegration] = useState<PlatformIntegration | null>(null);
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('platform_integrations' as any)
      .select('id, provider, scope, environment, last_test_at, last_test_status, last_test_message, updated_at')
      .eq('provider', 'asaas')
      .eq('scope', 'subscriptions')
      .maybeSingle();
    if (error) {
      console.error(error);
    } else if (data) {
      const i = data as any as PlatformIntegration;
      setIntegration(i);
      setEnvironment(i.environment);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('Informe a API Key');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-platform-integration-upsert', {
      body: { provider: 'asaas', scope: 'subscriptions', environment, apiKey: apiKey.trim() },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Falha ao salvar');
      return;
    }
    toast.success('Integração salva');
    setApiKey('');
    await load();
  };

  const handleTest = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke('admin-platform-integration-test', {
      body: { provider: 'asaas', scope: 'subscriptions' },
    });
    setTesting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const ok = (data as any)?.ok;
    const message = (data as any)?.message || '';
    if (ok) toast.success(`Conexão OK · ${message}`);
    else toast.error(`Falhou: ${message}`);
    await load();
  };

  const statusBadge = () => {
    if (!integration) {
      return <Badge variant="outline" className="gap-1"><ShieldAlert className="h-3 w-3" />Não configurada</Badge>;
    }
    if (integration.last_test_status === 'ok') {
      return <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/30"><ShieldCheck className="h-3 w-3" />Conectada</Badge>;
    }
    if (integration.last_test_status === 'error') {
      return <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" />Erro</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><KeyRound className="h-3 w-3" />Não testada</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Integrações Financeiras</h2>
        <p className="text-sm text-muted-foreground">
          Credenciais utilizadas exclusivamente pela operação do Lunari. Não afeta as integrações individuais
          dos fotógrafos, que continuam usando suas próprias contas Asaas/MercadoPago/InfinitePay.
        </p>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Asaas — Assinaturas do Lunari</CardTitle>
            <CardDescription>
              Usada apenas pelos fluxos de assinatura dos planos Lunari. Nenhuma cobrança gerada
              pelos fotógrafos utiliza esta chave.
            </CardDescription>
          </div>
          {statusBadge()}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Ambiente</Label>
                  <Select value={environment} onValueChange={(v) => setEnvironment(v as 'sandbox' | 'production')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                      <SelectItem value="production">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Última atualização</Label>
                  <div className="text-sm text-muted-foreground h-10 flex items-center">
                    {integration
                      ? format(new Date(integration.updated_at), "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR })
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>API Key {integration && <span className="text-xs text-muted-foreground">(deixe em branco para manter a atual)</span>}</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      placeholder={integration ? '••••••••••••••••' : 'Cole aqui sua API Key do Asaas'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowKey(s => !s)}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {integration?.last_test_message && (
                <div className="text-xs text-muted-foreground">
                  Último teste:{' '}
                  {integration.last_test_at && format(new Date(integration.last_test_at), "dd/MM HH:mm", { locale: ptBR })}
                  {' · '}
                  {integration.last_test_message}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing || !integration}>
                  {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Testar conexão
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/30 border-border/30">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground/80">🔒 Isolamento garantido</p>
          <p>• Esta chave é usada SOMENTE pelas funções de assinatura Lunari (asaas-create-subscription, asaas-create-payment, asaas-webhook, etc.).</p>
          <p>• Funções de cobrança de fotógrafos (gestao-asaas-*, checkout-*, gallery-create-payment) leem a chave individual de cada empresa em <code>usuarios_integracoes</code> e nunca tocam nesta configuração.</p>
          <p>• Trocar a chave aqui não afeta nenhuma cobrança ou recebimento de fotógrafos.</p>
        </CardContent>
      </Card>
    </div>
  );
}

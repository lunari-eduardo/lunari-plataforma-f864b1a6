import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, CreditCard, ExternalLink, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface InfinitePayCardProps {
  status: 'conectado' | 'desconectado';
  handle?: string;
  loading: boolean;
  onSave: (handle: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
  otherProviderActive?: boolean;
}

export function InfinitePayCard({
  status,
  handle,
  loading,
  onSave,
  onDisconnect,
  otherProviderActive,
}: InfinitePayCardProps) {
  const [inputHandle, setInputHandle] = useState(handle || '');
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleSave = async () => {
    const cleanHandle = inputHandle.trim().replace(/^\$/, '');
    if (!cleanHandle) return;
    
    setSaving(true);
    try {
      await onSave(cleanHandle);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnect();
      setInputHandle('');
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = status === 'conectado';

  return (
    <Card className="border-lunar-accent/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">InfinitePay</CardTitle>
              <CardDescription>Checkout direto na sua conta</CardDescription>
            </div>
          </div>
          <Badge 
            variant={isConnected ? "default" : "secondary"}
            className={isConnected ? "bg-green-600" : ""}
          >
            {isConnected ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Conectado
              </>
            ) : (
              <>
                <X className="h-3 w-3 mr-1" />
                Desconectado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {otherProviderActive && !isConnected && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Você já tem outro provedor ativo. Ao conectar InfinitePay, o Mercado Pago será desativado.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="infinitepay-handle">Seu Handle InfinitePay</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lunar-textSecondary">$</span>
              <Input
                id="infinitepay-handle"
                value={inputHandle}
                onChange={(e) => setInputHandle(e.target.value.replace(/^\$/, ''))}
                placeholder="seuhandle"
                className="pl-7"
                disabled={loading || saving}
              />
            </div>
          </div>
          <p className="text-xs text-lunar-textSecondary">
            Encontre seu handle no app InfinitePay em Configurações → Meu Perfil
          </p>
        </div>

        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex-1"
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Desconectando...
                  </>
                ) : (
                  'Desconectar'
                )}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !inputHandle.trim()}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Atualizar Handle'
                )}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !inputHandle.trim() || loading}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                'Conectar InfinitePay'
              )}
            </Button>
          )}
        </div>

        <a
          href="https://www.infinitepay.io/checkout"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-lunar-accent hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Saiba mais sobre InfinitePay Checkout
        </a>

        {isConnected && handle && (
          <div className="pt-2 border-t border-lunar-accent/10">
            <p className="text-xs text-lunar-textSecondary">
              Handle ativo: <span className="font-mono text-lunar-text">${handle}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

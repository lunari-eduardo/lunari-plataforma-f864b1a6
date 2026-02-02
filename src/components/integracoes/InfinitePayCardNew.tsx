import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, Info, Check } from 'lucide-react';
import infinitepayLogo from '@/assets/infinitepay-logo.png';

interface InfinitePayCardNewProps {
  status: 'conectado' | 'desconectado';
  handle?: string | null;
  onSave: (handle: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
  loading?: boolean;
  editMode?: boolean;
}

export interface InfinitePayCardNewRef {
  scrollIntoView: () => void;
  setEditMode: (editing: boolean) => void;
}

export const InfinitePayCardNew = forwardRef<InfinitePayCardNewRef, InfinitePayCardNewProps>(({
  status,
  handle,
  onSave,
  onDisconnect,
  loading,
  editMode: initialEditMode = false,
}, ref) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(initialEditMode || status === 'desconectado');
  const [saving, setSaving] = useState(false);
  const [inputHandle, setInputHandle] = useState(handle || '');

  useEffect(() => {
    if (handle) {
      setInputHandle(handle);
    }
  }, [handle]);

  useImperativeHandle(ref, () => ({
    scrollIntoView: () => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    setEditMode: (editing: boolean) => {
      setIsEditing(editing);
    },
  }));

  const handleSave = async () => {
    const cleanHandle = inputHandle.trim().replace(/^\$/, '');
    if (!cleanHandle) return;
    
    setSaving(true);
    try {
      await onSave(cleanHandle);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      await onDisconnect();
      setInputHandle('');
    } finally {
      setSaving(false);
    }
  };

  const isConnected = status === 'conectado';

  return (
    <Card ref={cardRef} className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <img
            src={infinitepayLogo}
            alt="InfinitePay"
            className="w-10 h-10 object-contain"
          />
          <div className="flex-1">
            <CardTitle className="text-base">InfinitePay</CardTitle>
            <CardDescription className="text-xs">
              Receba pagamentos com confirmação automática
            </CardDescription>
          </div>
          {isConnected && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              Editar
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="infinitepay-handle" className="text-xs">Seu Handle InfinitePay</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="infinitepay-handle"
                  value={inputHandle}
                  onChange={(e) => setInputHandle(e.target.value.replace(/^\$/, ''))}
                  placeholder="seuhandle"
                  className="pl-7"
                  disabled={saving}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Encontre seu handle no app InfinitePay em Configurações → Meu Perfil
              </p>
            </div>

            <Alert className="bg-muted/50 border-border">
              <Info className="h-4 w-4 text-muted-foreground" />
              <AlertDescription className="text-xs text-muted-foreground">
                Ao usar InfinitePay, as taxas são cobradas diretamente pela InfinitePay na sua conta.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              {isConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              )}
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
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {isConnected ? 'Salvar' : 'Conectar InfinitePay'}
                  </>
                )}
              </Button>
            </div>
          </>
        ) : isConnected && handle ? (
          <>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium font-mono">${handle}</p>
              <p className="text-xs text-muted-foreground">Handle ativo</p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={loading || saving}
              className="w-full text-destructive hover:text-destructive"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Desconectar'
              )}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Configure seu handle InfinitePay para receber pagamentos.
          </p>
        )}

        <a
          href="https://www.infinitepay.io/checkout"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Saiba mais sobre InfinitePay Checkout
        </a>
      </CardContent>
    </Card>
  );
});

InfinitePayCardNew.displayName = 'InfinitePayCardNew';

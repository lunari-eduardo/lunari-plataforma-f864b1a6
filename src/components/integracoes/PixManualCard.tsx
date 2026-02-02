import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Check } from 'lucide-react';
import pixLogo from '@/assets/pix-logo.png';

export interface PixManualData {
  chavePix: string;
  tipoChave: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
  nomeTitular: string;
}

interface PixManualCardProps {
  status: 'conectado' | 'desconectado';
  data?: PixManualData | null;
  onSave: (data: PixManualData) => Promise<void>;
  onDisconnect: () => Promise<void>;
  loading?: boolean;
  editMode?: boolean;
}

export interface PixManualCardRef {
  scrollIntoView: () => void;
  setEditMode: (editing: boolean) => void;
}

const tipoChaveLabels: Record<PixManualData['tipoChave'], string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave Aleatória',
};

export const PixManualCard = forwardRef<PixManualCardRef, PixManualCardProps>(({
  status,
  data,
  onSave,
  onDisconnect,
  loading,
  editMode: initialEditMode = false,
}, ref) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(initialEditMode || status === 'desconectado');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PixManualData>({
    chavePix: data?.chavePix || '',
    tipoChave: data?.tipoChave || 'cpf',
    nomeTitular: data?.nomeTitular || '',
  });

  useEffect(() => {
    if (data) {
      setForm({
        chavePix: data.chavePix || '',
        tipoChave: data.tipoChave || 'cpf',
        nomeTitular: data.nomeTitular || '',
      });
    }
  }, [data]);

  useImperativeHandle(ref, () => ({
    scrollIntoView: () => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    setEditMode: (editing: boolean) => {
      setIsEditing(editing);
    },
  }));

  const handleSave = async () => {
    if (!form.chavePix.trim() || !form.nomeTitular.trim()) return;
    
    setSaving(true);
    try {
      await onSave(form);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      await onDisconnect();
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
            src={pixLogo}
            alt="PIX"
            className="w-10 h-10 object-contain"
          />
          <div className="flex-1">
            <CardTitle className="text-base">PIX Manual</CardTitle>
            <CardDescription className="text-xs">
              Receba pagamentos via PIX com confirmação manual
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
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="nomeTitular" className="text-xs">Nome do Titular</Label>
                <Input
                  id="nomeTitular"
                  value={form.nomeTitular}
                  onChange={(e) => setForm(prev => ({ ...prev, nomeTitular: e.target.value }))}
                  placeholder="Nome completo"
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tipoChave" className="text-xs">Tipo da Chave</Label>
                <Select
                  value={form.tipoChave}
                  onValueChange={(value) => setForm(prev => ({ ...prev, tipoChave: value as PixManualData['tipoChave'] }))}
                  disabled={saving}
                >
                  <SelectTrigger id="tipoChave">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoChaveLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="chavePix" className="text-xs">Chave PIX</Label>
                <Input
                  id="chavePix"
                  value={form.chavePix}
                  onChange={(e) => setForm(prev => ({ ...prev, chavePix: e.target.value }))}
                  placeholder="Digite sua chave PIX"
                  disabled={saving}
                />
              </div>
            </div>

            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Você precisará confirmar manualmente os pagamentos recebidos por PIX Manual.
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
                disabled={saving || !form.chavePix.trim() || !form.nomeTitular.trim()}
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
                    {isConnected ? 'Salvar' : 'Configurar PIX'}
                  </>
                )}
              </Button>
            </div>
          </>
        ) : isConnected && data ? (
          <>
            <div className="p-3 bg-muted/50 rounded-lg space-y-1">
              <p className="text-sm font-medium">{data.nomeTitular}</p>
              <p className="text-xs text-muted-foreground">
                {tipoChaveLabels[data.tipoChave]}: <span className="font-mono">{data.chavePix}</span>
              </p>
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
                'Remover PIX Manual'
              )}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Configure sua chave PIX para receber pagamentos manualmente.
          </p>
        )}
      </CardContent>
    </Card>
  );
});

PixManualCard.displayName = 'PixManualCard';

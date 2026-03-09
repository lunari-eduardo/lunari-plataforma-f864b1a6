import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Building2, CheckCircle, ExternalLink, Eye, EyeOff, HelpCircle, Loader2, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import asaasLogo from '@/assets/asaas-logo.png';

export interface AsaasSettings {
  environment: 'sandbox' | 'production';
  habilitarPix: boolean;
  habilitarCartao: boolean;
  habilitarBoleto: boolean;
  maxParcelas: number;
  absorverTaxa: boolean;
  incluirTaxaAntecipacao: boolean;
}

export interface AsaasCardRef {
  scrollIntoView: () => void;
  setEditMode: (editing: boolean) => void;
}

interface AsaasCardProps {
  status: 'conectado' | 'desconectado';
  settings?: AsaasSettings | null;
  onSave: (apiKey: string, settings: AsaasSettings) => Promise<void>;
  onUpdateSettings?: (settings: AsaasSettings) => Promise<void>;
  onDisconnect: () => Promise<void>;
  loading?: boolean;
}

export const AsaasCard = forwardRef<AsaasCardRef, AsaasCardProps>(({
  status,
  settings,
  onSave,
  onUpdateSettings,
  onDisconnect,
  loading,
}, ref) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [habilitarPix, setHabilitarPix] = useState(true);
  const [habilitarCartao, setHabilitarCartao] = useState(true);
  const [habilitarBoleto, setHabilitarBoleto] = useState(false);
  const [maxParcelas, setMaxParcelas] = useState('12');
  const [absorverTaxa, setAbsorverTaxa] = useState(false);
  const [incluirTaxaAntecipacao, setIncluirTaxaAntecipacao] = useState(true);

  useImperativeHandle(ref, () => ({
    scrollIntoView: () => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    setEditMode: (editing: boolean) => {
      if (status === 'conectado') {
        setShowSettings(editing);
      } else {
        setIsEditing(editing);
      }
    },
  }));

  // Load settings when available
  useEffect(() => {
    if (settings) {
      setEnvironment(settings.environment || 'sandbox');
      setHabilitarPix(settings.habilitarPix ?? true);
      setHabilitarCartao(settings.habilitarCartao ?? true);
      setHabilitarBoleto(settings.habilitarBoleto ?? false);
      setMaxParcelas(String(settings.maxParcelas ?? 12));
      setAbsorverTaxa(settings.absorverTaxa ?? false);
      setIncluirTaxaAntecipacao(settings.incluirTaxaAntecipacao ?? true);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    
    setSaving(true);
    try {
      await onSave(apiKey.trim(), {
        environment,
        habilitarPix,
        habilitarCartao,
        habilitarBoleto,
        maxParcelas: parseInt(maxParcelas),
        absorverTaxa,
        incluirTaxaAntecipacao,
      });
      setIsEditing(false);
      setApiKey('');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSettings = async () => {
    if (!onUpdateSettings) return;
    
    setSaving(true);
    try {
      await onUpdateSettings({
        environment,
        habilitarPix,
        habilitarCartao,
        habilitarBoleto,
        maxParcelas: parseInt(maxParcelas),
        absorverTaxa,
        incluirTaxaAntecipacao,
      });
      setShowSettings(false);
    } finally {
      setSaving(false);
    }
  };

  const isConnected = status === 'conectado';

  return (
    <div ref={cardRef} className="border rounded-lg p-4 space-y-4 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
            <img src={asaasLogo} alt="Asaas" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Asaas</h3>
              {isConnected && (
                <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="h-3 w-3" />
                  Conectado
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isConnected 
                ? `${settings?.environment === 'production' ? 'Produção' : 'Sandbox'} • PIX, Cartão e Boleto`
                : 'PIX, Cartão e Boleto com checkout transparente'}
            </p>
          </div>
        </div>

        {isConnected && (
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Setup Form (Not Connected) */}
      {!isConnected && (isEditing ? (
        <div className="space-y-4 pt-2 border-t">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="asaas-key">API Key do Asaas</Label>
              <div className="relative">
                <Input
                  id="asaas-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="$aact_..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                Encontre em Minha Conta → Integrações no painel Asaas
              </p>
            </div>

            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as 'sandbox' | 'production')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Métodos de Pagamento</Label>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="asaas-pix">PIX</Label>
                <Switch id="asaas-pix" checked={habilitarPix} onCheckedChange={setHabilitarPix} />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="asaas-cartao">Cartão de Crédito</Label>
                <Switch id="asaas-cartao" checked={habilitarCartao} onCheckedChange={setHabilitarCartao} />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="asaas-boleto">Boleto</Label>
                <Switch id="asaas-boleto" checked={habilitarBoleto} onCheckedChange={setHabilitarBoleto} />
              </div>
            </div>

            {habilitarCartao && (
              <div className="space-y-3 pt-2 border-t">
                <div className="space-y-2">
                  <Label>Máximo de parcelas</Label>
                  <Select value={maxParcelas} onValueChange={setMaxParcelas}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                        <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="asaas-absorver">Absorver taxas</Label>
                    <p className="text-xs text-muted-foreground">Você paga as taxas de processamento</p>
                  </div>
                  <Switch id="asaas-absorver" checked={absorverTaxa} onCheckedChange={setAbsorverTaxa} />
                </div>

                {!absorverTaxa && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="asaas-antecipacao">Incluir taxa de antecipação</Label>
                      <p className="text-xs text-muted-foreground">Cobra taxa de antecipação do cliente</p>
                    </div>
                    <Switch id="asaas-antecipacao" checked={incluirTaxaAntecipacao} onCheckedChange={setIncluirTaxaAntecipacao} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!apiKey.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full gap-2" onClick={() => setIsEditing(true)}>
          <Building2 className="h-4 w-4" />
          Configurar Asaas
        </Button>
      ))}

      {/* Settings Panel (Connected) */}
      {isConnected && showSettings && (
        <div className="space-y-4 pt-2 border-t">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as 'sandbox' | 'production')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Métodos de Pagamento</Label>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="asaas-pix-edit">PIX</Label>
                <Switch id="asaas-pix-edit" checked={habilitarPix} onCheckedChange={setHabilitarPix} />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="asaas-cartao-edit">Cartão de Crédito</Label>
                <Switch id="asaas-cartao-edit" checked={habilitarCartao} onCheckedChange={setHabilitarCartao} />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="asaas-boleto-edit">Boleto</Label>
                <Switch id="asaas-boleto-edit" checked={habilitarBoleto} onCheckedChange={setHabilitarBoleto} />
              </div>
            </div>

            {habilitarCartao && (
              <div className="space-y-3 pt-2 border-t">
                <div className="space-y-2">
                  <Label>Máximo de parcelas</Label>
                  <Select value={maxParcelas} onValueChange={setMaxParcelas}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                        <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="asaas-absorver-edit">Absorver taxas</Label>
                    <p className="text-xs text-muted-foreground">Você paga as taxas de processamento</p>
                  </div>
                  <Switch id="asaas-absorver-edit" checked={absorverTaxa} onCheckedChange={setAbsorverTaxa} />
                </div>

                {!absorverTaxa && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="asaas-antecipacao-edit">Incluir taxa de antecipação</Label>
                      <p className="text-xs text-muted-foreground">Cobra taxa de antecipação do cliente</p>
                    </div>
                    <Switch id="asaas-antecipacao-edit" checked={incluirTaxaAntecipacao} onCheckedChange={setIncluirTaxaAntecipacao} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleUpdateSettings} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar alterações
            </Button>
            <Button variant="ghost" onClick={() => setShowSettings(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
        <ExternalLink className="h-3 w-3" />
        <a 
          href="https://www.asaas.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Criar conta Asaas
        </a>
      </div>
    </div>
  );
});

AsaasCard.displayName = 'AsaasCard';

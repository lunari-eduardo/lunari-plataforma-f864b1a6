import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calculator, Lock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProviderSelector } from '../ProviderSelector';
import { SelectedProvider } from '../ProviderRow';
import { PixManualSection } from '../PixManualSection';
import { ChargeLinkSection } from '../ChargeLinkSection';
import { AsaasChargeOptions } from '../AsaasChargeOptions';
import { Cobranca } from '@/types/cobranca';
import { AsaasSettingsState } from './types';

interface ChargeModalFormProps {
  finalidade?: 'sessao' | 'fotos_extras' | 'sessao_e_extras';
  valorSessaoComponente?: number | null;
  valorExtrasComponente?: number | null;
  qtdFotos?: number | null;
  valor: number;
  setValor: (val: number) => void;
  valorType: 'total' | 'parcial';
  onSelectValorType: (type: 'total' | 'parcial') => void;
  valorSugerido: number;
  valorSinal?: number;
  allowChangeValor?: boolean;
  descricao: string;
  setDescricao: (desc: string) => void;
  selectedProvider: SelectedProvider | null;
  onProviderSelect: (provider: SelectedProvider) => void;
  currentCharge: {
    pixPayload?: string;
    paymentLink?: string;
    status?: Cobranca['status'];
  } | null;
  currentChargeId: string | null;
  creatingCharge: boolean;
  checkingStatus: boolean;
  clienteWhatsapp?: string;
  onGenerateCharge: () => Promise<void>;
  onConfirmPixManualPayment: (chargeId: string, observacoes?: string) => Promise<boolean>;
  onCheckStatus: () => Promise<void>;
  asaasMode: 'options' | 'pix' | 'link' | null;
  asaasSettings: AsaasSettingsState | null;
  asaasSelectedMethod: 'link' | 'pix';
  onSelectAsaasMethod: (method: 'link' | 'pix') => void;
  asaasPixLoading: boolean;
  asaasLinkLoading: boolean;
  onAsaasGeneratePix: () => Promise<void>;
  onAsaasGenerateLink: () => Promise<void>;
}

export function ChargeModalForm({
  finalidade,
  valorSessaoComponente,
  valorExtrasComponente,
  qtdFotos,
  valor,
  setValor,
  valorType,
  onSelectValorType,
  valorSugerido,
  valorSinal,
  allowChangeValor = true,
  descricao,
  setDescricao,
  selectedProvider,
  onProviderSelect,
  currentCharge,
  currentChargeId,
  creatingCharge,
  checkingStatus,
  clienteWhatsapp,
  onGenerateCharge,
  onConfirmPixManualPayment,
  onCheckStatus,
  asaasMode,
  asaasSettings,
  asaasSelectedMethod,
  onSelectAsaasMethod,
  asaasPixLoading,
  asaasLinkLoading,
  onAsaasGeneratePix,
  onAsaasGenerateLink,
}: ChargeModalFormProps) {
  const showLinkSection = selectedProvider === 'mercadopago_link' || selectedProvider === 'infinitepay';
  const showPixManualSection = selectedProvider === 'pix_manual';
  const showAsaasSection = selectedProvider === 'asaas';

  return (
    <>
      {/* Breakdown para cobrança combinada */}
      {finalidade === 'sessao_e_extras' && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 shadow-xs">
          <div className="text-xs text-muted-foreground">
            {(valorSessaoComponente ?? 0) > 0 && (
              <>
                Sessão <strong className="text-foreground">R$ {(valorSessaoComponente ?? 0).toFixed(2).replace('.', ',')}</strong>
                <span className="mx-1.5 opacity-60">+</span>
              </>
            )}
            Extras ({qtdFotos ?? 0}){' '}
            <strong className="text-foreground">R$ {(valorExtrasComponente ?? 0).toFixed(2).replace('.', ',')}</strong>
          </div>
          <div className="text-sm font-bold text-primary">
            Total R$ {(Number(valor) || 0).toFixed(2).replace('.', ',')}
          </div>
        </div>
      )}

      {/* Info badge para cobrança de fotos extras */}
      {finalidade === 'fotos_extras' && qtdFotos != null && qtdFotos > 0 && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 shadow-xs">
          <div className="text-xs text-muted-foreground">
            Fotos extras selecionadas: <strong className="text-foreground">{qtdFotos}</strong>
          </div>
          <div className="text-sm font-bold text-primary">
            Total R$ {(Number(valor) || 0).toFixed(2).replace('.', ',')}
          </div>
        </div>
      )}

      {/* VALOR E TIPO DA COBRANÇA COM DESTAQUE */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5 text-primary" />
            Valor a cobrar
          </Label>
          <span className="text-[11px] text-muted-foreground font-medium">
            {valorType === 'total' ? 'Cobrança integral' : 'Cobrança parcial / sinal'}
          </span>
        </div>

        {/* Seletor Segmentado com Destaque */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/60 rounded-lg border border-border/40">
          <button
            type="button"
            onClick={() => onSelectValorType('total')}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer",
              valorType === 'total'
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Valor Total</span>
            <span className="text-[11px] font-medium text-muted-foreground mt-0.5">
              R$ {Number(valorSugerido || 0).toFixed(2).replace('.', ',')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectValorType('parcial')}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer",
              valorType === 'parcial'
                ? "bg-background text-primary shadow-xs border border-primary/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{valorSinal && valorSinal > 0 ? "Sinal / Entrada" : "Valor Parcial"}</span>
            <span className="text-[11px] font-medium text-muted-foreground mt-0.5">
              {valorSinal && valorSinal > 0
                ? `R$ ${Number(valorSinal).toFixed(2).replace('.', ',')}`
                : "Personalizar"}
            </span>
          </button>
        </div>

        {/* Input de Valor em Destaque */}
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
            <span className="text-base font-bold text-muted-foreground">R$</span>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={valor || ''}
            onChange={(e) => {
              const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
              setValor(val);
              if (val !== valorSugerido && valorType === 'total') {
                onSelectValorType('parcial');
              }
            }}
            onFocus={(e) => { if (valor === 0) e.target.value = ''; }}
            className="pl-11 h-12 text-xl font-bold text-foreground bg-background border-border/70 rounded-lg focus-visible:ring-1 focus-visible:ring-primary/50 tracking-tight"
            disabled={!allowChangeValor}
            placeholder="0,00"
          />
        </div>
      </div>

      {/* DESCRIÇÃO (INPUT DE 1 LINHA COMPACTO) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Descrição (Opcional)
          </Label>
          <span className="text-[10px] text-muted-foreground font-medium">
            {descricao.length}/140
          </span>
        </div>
        <Input
          type="text"
          placeholder="Ex.: Sinal do ensaio de Natal, pacote completo, etc."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value.substring(0, 140))}
          className="h-10 text-xs bg-muted/30 border-border/60 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50"
        />
      </div>

      {/* MEIO DE COBRANÇA */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Meio de cobrança
        </Label>
        <ProviderSelector
          selectedProvider={selectedProvider}
          onSelect={onProviderSelect}
        />
        {showLinkSection && (
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>O cliente receberá um link de pagamento para pagar online.</span>
          </div>
        )}
      </div>

      {/* AÇÕES DE GERAÇÃO E TIPO DE COBRANÇA */}
      <div className="pt-3 space-y-3">
        {showPixManualSection && (
          <PixManualSection
            valor={valor}
            pixPayload={currentCharge?.pixPayload}
            status={currentCharge?.status}
            loading={creatingCharge}
            clienteWhatsapp={clienteWhatsapp}
            chargeId={currentChargeId || undefined}
            onGenerate={onGenerateCharge}
            onConfirmPayment={onConfirmPixManualPayment}
          />
        )}

        {showLinkSection && (
          <ChargeLinkSection
            valor={valor}
            paymentLink={currentCharge?.paymentLink}
            status={currentCharge?.status}
            loading={creatingCharge}
            checkingStatus={checkingStatus}
            onGenerate={onGenerateCharge}
            onCheckStatus={currentChargeId ? onCheckStatus : undefined}
            clienteWhatsapp={clienteWhatsapp}
          />
        )}

        {showAsaasSection && asaasMode === 'options' && asaasSettings && (
          <>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                Tipo de cobrança
              </Label>
              <AsaasChargeOptions
                valor={valor}
                selectedMethod={asaasSelectedMethod}
                onSelectMethod={onSelectAsaasMethod}
                hasPix={asaasSettings.habilitarPix}
              />
            </div>
            
            <div className="pt-1">
              {asaasSelectedMethod === 'pix' ? (
                <Button
                  onClick={onAsaasGeneratePix}
                  disabled={asaasPixLoading}
                  className="w-full h-12 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs"
                >
                  {asaasPixLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gerar PIX — R$ {valor.toFixed(2).replace('.', ',')}
                </Button>
              ) : (
                <Button
                  onClick={onAsaasGenerateLink}
                  disabled={asaasLinkLoading}
                  className="w-full h-12 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs"
                >
                  {asaasLinkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gerar Link — R$ {valor.toFixed(2).replace('.', ',')}
                </Button>
              )}
            </div>
          </>
        )}

        {showAsaasSection && asaasMode === 'link' && (
          <ChargeLinkSection
            valor={valor}
            paymentLink={currentCharge?.paymentLink}
            status={currentCharge?.status}
            loading={creatingCharge}
            checkingStatus={checkingStatus}
            onGenerate={onAsaasGenerateLink}
            onCheckStatus={currentChargeId ? onCheckStatus : undefined}
            clienteWhatsapp={clienteWhatsapp}
          />
        )}
      </div>
    </>
  );
}

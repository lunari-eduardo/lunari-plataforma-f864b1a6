import React, { useState, useMemo } from 'react';
import {
  Check,
  Heart,
  Eye,
  Clock,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PaymentStatusCard } from '@/components/PaymentStatusCard';
import { GalleryPhoto } from '@/types/gallery';
import { cn } from '@/lib/utils';
import {
  CodeFormat,
  codeFormatLabels,
  codeFormatDescriptions,
  codeFormatHints,
  generateSearchCode,
} from '../types';

interface SelectionTabProps {
  isPublicGallery: boolean;
  supabaseGallery: any;
  selectedPhotos: GalleryPhoto[];
  favoritePhotos: GalleryPhoto[];
  extrasNecessarias: number;
  extrasPagasTotal: number;
  extrasACobrar: number;
  calculatedExtraTotal: number;
  cobrancaData: any;
  isCodeCopied: boolean;
  onCopyCode: (code: string) => void;
  onViewPhotosClick: () => void;
  onDetailsTabClick: () => void;
  onStatusUpdated: () => void;
}

export function SelectionTab({
  isPublicGallery,
  supabaseGallery,
  selectedPhotos,
  favoritePhotos,
  extrasNecessarias,
  extrasPagasTotal,
  extrasACobrar,
  calculatedExtraTotal,
  cobrancaData,
  isCodeCopied,
  onCopyCode,
  onViewPhotosClick,
  onDetailsTabClick,
  onStatusUpdated,
}: SelectionTabProps) {
  const [isCodesCollapsed, setIsCodesCollapsed] = useState(false);
  const [codeFormat, setCodeFormat] = useState<CodeFormat>('windows');
  const [codeScopeFilter, setCodeScopeFilter] = useState<'all' | 'favorites'>('all');

  const photosForCode = useMemo(() => {
    if (codeScopeFilter === 'favorites') {
      return favoritePhotos;
    }
    return selectedPhotos;
  }, [selectedPhotos, favoritePhotos, codeScopeFilter]);

  const generatedCode = useMemo(() => {
    return generateSearchCode(photosForCode, codeFormat);
  }, [photosForCode, codeFormat]);

  if (isPublicGallery) {
    return (
      <div className="text-center py-16 lunari-card">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-2">
          Em galerias públicas, cada visitante possui sua própria seleção.
        </p>
        <p className="text-sm text-muted-foreground">
          Acesse a aba <strong>Visitantes</strong> para ver as seleções individuais.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      {/* COLUNA ESQUERDA: Seleção da sessão + Resumo da seleção */}
      <div className="space-y-4">
        {/* Card 1: Seleção da sessão */}
        <div className="lunari-card p-5 space-y-4">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Seleção da sessão
          </h3>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card/60 border border-border/50">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-full border border-border/80 flex items-center justify-center bg-muted/40 shrink-0">
                <Check className="h-5 w-5 text-foreground/80" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-base text-foreground">
                    {selectedPhotos.length} {selectedPhotos.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}
                  </p>
                  {favoritePhotos.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium">
                      <Heart className="h-3 w-3 fill-current" />
                      {favoritePhotos.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {supabaseGallery.fotosIncluidas} {supabaseGallery.fotosIncluidas === 1 ? 'foto incluída' : 'fotos incluídas'}
                  {extrasNecessarias > 0 ? ` + ${extrasNecessarias} ${extrasNecessarias === 1 ? 'foto extra paga' : 'fotos extras pagas'}` : ''}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 font-medium border-border/60 hover:bg-muted"
              onClick={onViewPhotosClick}
            >
              <Eye className="h-4 w-4" />
              Ver fotos
            </Button>
          </div>
        </div>

        {/* Card 2: Resumo da seleção */}
        <div className="lunari-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Resumo da seleção
            </h3>
            <div className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center border border-border/40">
              <Check className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>

          {/* Progresso da Seleção */}
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Progresso da seleção</span>
              <span className="text-foreground font-bold">
                {Math.round((selectedPhotos.length / Math.max(supabaseGallery.fotosIncluidas, 1)) * 100)}%
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-700 rounded-full',
                  extrasNecessarias > 0 ? 'bg-amber-500' : 'bg-primary'
                )}
                style={{
                  width: `${Math.min(100, (selectedPhotos.length / Math.max(supabaseGallery.fotosIncluidas, 1)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Métricas: Incluídas, Selecionadas, Extras */}
          <div className="grid grid-cols-3 gap-3 py-2 border-y border-border/40">
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Fotos Incluídas
              </span>
              <span className="text-lg font-bold text-foreground">
                {supabaseGallery.fotosIncluidas}
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Selecionadas
              </span>
              <span className={cn('text-lg font-bold', extrasNecessarias > 0 ? 'text-amber-500' : 'text-foreground')}>
                {selectedPhotos.length}
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Fotos Extras
              </span>
              <span className="text-lg font-bold text-amber-500">
                {extrasNecessarias > 0 ? `+${extrasNecessarias}` : '0'}
              </span>
              {extrasPagasTotal > 0 && (
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Já pagas em ciclos anteriores: {extrasPagasTotal}
                </p>
              )}
            </div>
          </div>

          {/* Faturamento */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Faturamento
              </span>
              {(() => {
                const totalVendido = supabaseGallery.valorTotalVendido || 0;
                const pendente = calculatedExtraTotal || 0;
                if (totalVendido > 0 && pendente <= 0) {
                  return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30">
                      <Check className="h-3 w-3" />
                      Pago
                    </span>
                  );
                }
                if (pendente > 0) {
                  return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      <Clock className="h-3 w-3" />
                      Pendente
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                    Sem cobrança
                  </span>
                );
              })()}
            </div>

            <div className="space-y-0.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Valor total</span>
                <span className="text-lg font-bold text-foreground">
                  R$ {((supabaseGallery.valorTotalVendido || 0) + (calculatedExtraTotal || 0)).toFixed(2)}
                </span>
              </div>
              {(supabaseGallery.totalFotosExtrasVendidas || extrasNecessarias) ? (
                <p className="text-xs text-muted-foreground">
                  {(supabaseGallery.totalFotosExtrasVendidas || extrasNecessarias)} {(supabaseGallery.totalFotosExtrasVendidas || extrasNecessarias) === 1 ? 'foto extra vendida' : 'fotos extras vendidas'}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onDetailsTabClick}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors group pt-1"
            >
              <span>Ver detalhes do pagamento</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </button>
          </div>

          {/* Alerta de Fotos Extras */}
          {extrasNecessarias > 0 && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>O cliente selecionou {extrasNecessarias} {extrasNecessarias === 1 ? 'foto extra' : 'fotos extras'}.</span>
            </div>
          )}

          {/* Confirmação do Cliente */}
          {supabaseGallery.statusSelecao === 'selecao_completa' && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 pt-1">
              <Check className="h-3.5 w-3.5" />
              <span>Seleção confirmada pelo cliente</span>
            </div>
          )}
        </div>

        {/* Card de Status de Pagamento (quando pendente / PIX aguardando) */}
        {(calculatedExtraTotal > 0 || supabaseGallery.statusPagamento === 'aguardando_confirmacao') && (
          <PaymentStatusCard
            status={cobrancaData?.status || (calculatedExtraTotal > 0 ? 'pendente' : supabaseGallery.statusPagamento)}
            provedor={cobrancaData?.provedor || (supabaseGallery.statusPagamento === 'aguardando_confirmacao' ? 'pix_manual' : undefined)}
            valor={calculatedExtraTotal}
            valorPago={0}
            dataPagamento={cobrancaData?.data_pagamento}
            receiptUrl={cobrancaData?.status === 'pago' || cobrancaData?.status === 'pago_manual' ? cobrancaData?.ip_receipt_url : undefined}
            checkoutUrl={cobrancaData?.ip_checkout_url}
            sessionId={supabaseGallery.sessionId || undefined}
            cobrancaId={cobrancaData?.id}
            galleryId={supabaseGallery.id}
            extraCount={extrasACobrar}
            saldoPendente={calculatedExtraTotal}
            variant="compact"
            onStatusUpdated={onStatusUpdated}
          />
        )}
      </div>

      {/* COLUNA DIREITA: Código das fotos selecionadas */}
      <div className="space-y-4">
        <div className="lunari-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Código das fotos selecionadas
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCodesCollapsed(!isCodesCollapsed)}
              className="h-7 text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground border-border/60"
            >
              <span>{isCodesCollapsed ? 'Expandir' : 'Recolher'}</span>
              {isCodesCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {!isCodesCollapsed && (
            selectedPhotos.length > 0 ? (
              <div className="space-y-4 animate-fade-in">
                {/* Seletor de Tipo/Formato de Código e Filtro de Favoritas */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground font-medium shrink-0">Formato:</span>
                    <Select value={codeFormat} onValueChange={(v) => setCodeFormat(v as CodeFormat)}>
                      <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/60 w-full sm:w-[190px]">
                        <SelectValue placeholder="Selecione o formato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="windows" className="text-xs">{codeFormatLabels.windows}</SelectItem>
                        <SelectItem value="lightroom" className="text-xs">{codeFormatLabels.lightroom}</SelectItem>
                        <SelectItem value="mac" className="text-xs">{codeFormatLabels.mac}</SelectItem>
                        <SelectItem value="txt" className="text-xs">{codeFormatLabels.txt}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Alternador Todas vs Favoritas */}
                  {favoritePhotos.length > 0 && (
                    <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCodeScopeFilter('all')}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                          codeScopeFilter === 'all'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Todas ({selectedPhotos.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCodeScopeFilter('favorites')}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1',
                          codeScopeFilter === 'favorites'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Heart className="h-3 w-3 text-red-500 fill-current" />
                        Favoritas ({favoritePhotos.length})
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {codeFormatDescriptions[codeFormat]}
                </p>

                {/* Bloco de Código Mono */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border/60 font-mono text-xs text-foreground/90 max-h-56 overflow-y-auto leading-relaxed select-all">
                  {generatedCode || 'Nenhuma foto encontrada para este filtro.'}
                </div>

                {/* Botão Copiar */}
                <Button
                  variant="terracotta"
                  className="w-auto px-5 font-medium gap-2 shadow-sm"
                  disabled={!generatedCode}
                  onClick={() => onCopyCode(generatedCode)}
                >
                  {isCodeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {isCodeCopied ? 'Código copiado!' : `Copiar código (${codeFormatLabels[codeFormat]})`}
                </Button>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {codeFormatHints[codeFormat]}
                </p>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-xs">
                Nenhuma foto selecionada ainda. Os códigos de pesquisa aparecerão aqui assim que houver fotos selecionadas.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

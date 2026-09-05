import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import { PaymentHistoryCard } from '@/components/PaymentHistoryCard';
import { PaymentStatusCard } from '@/components/PaymentStatusCard';
import { getBillingModeLabel } from '@/lib/galleryStatus';
import { cn } from '@/lib/utils';

interface DetailsTabProps {
  supabaseGallery: any;
  effectiveClienteId?: string | null;
  deadline: Date;
  valorUnitario: number;
  calculatedExtraTotal: number;
  extrasACobrar: number;
  cobrancasPagas: any[];
  cobrancaData: any;
  onStatusUpdated: () => void;
}

export function DetailsTab({
  supabaseGallery,
  effectiveClienteId,
  deadline,
  valorUnitario,
  calculatedExtraTotal,
  extrasACobrar,
  cobrancasPagas,
  cobrancaData,
  onStatusUpdated,
}: DetailsTabProps) {
  const billing = getBillingModeLabel({
    vendaModo: (supabaseGallery as any).vendaModo,
    vendaPagamentoProvedor: (supabaseGallery as any).vendaPagamentoProvedor,
    saleSettings: supabaseGallery.configuracoes?.saleSettings as { mode?: string; paymentMethod?: string } | undefined,
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="lunari-card p-5 space-y-4">
        <h3 className="font-medium">Informações do Cliente</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Nome</span>
            {effectiveClienteId ? (
              <Link
                to={`/app/clientes/${effectiveClienteId}`}
                className="font-medium text-primary hover:underline inline-flex items-center gap-1.5 group"
                title="Ver perfil do cliente no CRM"
              >
                <span>{supabaseGallery.clienteNome || 'N/A'}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
              </Link>
            ) : (
              <span className="font-medium">{supabaseGallery.clienteNome || 'N/A'}</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{supabaseGallery.clienteEmail || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sessão</span>
            <span className="font-medium">{supabaseGallery.nomeSessao || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pacote</span>
            <span className="font-medium">{supabaseGallery.nomePacote || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fotos incluídas</span>
            <span className="font-medium">{supabaseGallery.fotosIncluidas}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor foto extra</span>
            <span className="font-medium">R$ {valorUnitario.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="lunari-card p-5 space-y-4">
        <h3 className="font-medium">Configurações da Galeria</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Prazo</span>
            <span className="font-medium">
              {format(deadline, "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Permissão</span>
            <span className="font-medium capitalize">
              {supabaseGallery.permissao === 'public' ? 'Pública' : 'Privada'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Modo de cobrança</span>
            <span className={cn(
              "font-medium",
              billing.missingProvider ? "text-amber-500" : "text-foreground"
            )}>
              {billing.label}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Comentários</span>
            <span className="font-medium">
              {supabaseGallery.configuracoes?.allowComments ? 'Sim' : 'Não'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Download</span>
            <span className="font-medium">
              {supabaseGallery.configuracoes?.allowDownload ? 'Ativado' : 'Desativado'}
            </span>
          </div>
        </div>
      </div>

      {/* Payment History Card */}
      {cobrancasPagas.length > 0 && (
        <PaymentHistoryCard
          cobrancas={cobrancasPagas}
          valorTotalPago={supabaseGallery.valorTotalVendido || 0}
          totalFotosExtrasVendidas={supabaseGallery.totalFotosExtrasVendidas || 0}
        />
      )}

      {/* Current Payment Status */}
      {((calculatedExtraTotal > 0 && cobrancaData && !['pago', 'pago_manual', 'cancelado'].includes(cobrancaData.status)) || supabaseGallery.statusPagamento === 'aguardando_confirmacao') && (
        <PaymentStatusCard
          status={cobrancaData?.status || 'pendente'}
          provedor={cobrancaData?.provedor || (supabaseGallery.statusPagamento === 'aguardando_confirmacao' ? 'pix_manual' : undefined)}
          valor={Number(cobrancaData?.valor) || 0}
          dataPagamento={cobrancaData?.data_pagamento}
          receiptUrl={cobrancaData?.ip_receipt_url}
          checkoutUrl={cobrancaData?.ip_checkout_url}
          sessionId={supabaseGallery.sessionId || undefined}
          cobrancaId={cobrancaData?.id}
          galleryId={supabaseGallery.id}
          extraCount={extrasACobrar}
          variant="full"
          showPendingAmount={true}
          onStatusUpdated={onStatusUpdated}
        />
      )}

      {supabaseGallery.mensagemBoasVindas && (
        <div className="lunari-card p-5 space-y-4 md:col-span-2">
          <h3 className="font-medium">Mensagem de Boas-vindas</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {supabaseGallery.mensagemBoasVindas}
          </p>
        </div>
      )}
    </div>
  );
}

import { useRef, useCallback, useState } from 'react';
import { ActiveMethodsList } from './ActiveMethodsList';
import { MercadoPagoCard, MercadoPagoCardRef } from './MercadoPagoCard';
import { MercadoPagoSettingsModal, MercadoPagoSettings } from './MercadoPagoSettingsModal';
import { InfinitePayCardNew, InfinitePayCardNewRef } from './InfinitePayCardNew';
import { PixManualCard, PixManualCardRef, PixManualData } from './PixManualCard';
import { ProvedorPagamento } from './ActiveMethodRow';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PagamentosTabProps {
  // Mercado Pago
  mercadoPagoStatus: 'conectado' | 'desconectado' | 'pendente' | 'erro';
  mercadoPagoConnectedAt?: string;
  mercadoPagoUserId?: string;
  mercadoPagoSettings?: MercadoPagoSettings | null;
  onConnectMercadoPago: () => void;
  onDisconnectMercadoPago: () => Promise<void>;
  onUpdateMercadoPagoSettings?: (settings: Partial<MercadoPagoSettings>) => Promise<void>;
  
  // InfinitePay
  infinitePayStatus: 'conectado' | 'desconectado';
  infinitePayHandle?: string | null;
  onSaveInfinitePay: (handle: string) => Promise<void>;
  onDisconnectInfinitePay: () => Promise<void>;
  
  // PIX Manual
  pixManualStatus: 'conectado' | 'desconectado';
  pixManualData?: PixManualData | null;
  onSavePixManual: (data: PixManualData) => Promise<void>;
  onDisconnectPixManual: () => Promise<void>;
  
  // Padrão
  provedorPadrao: ProvedorPagamento | null;
  onSetProvedorPadrao: (provedor: ProvedorPagamento) => Promise<void>;
  
  loading?: boolean;
  connecting?: boolean;
}

export function PagamentosTab({
  mercadoPagoStatus,
  mercadoPagoConnectedAt,
  mercadoPagoUserId,
  mercadoPagoSettings,
  onConnectMercadoPago,
  onDisconnectMercadoPago,
  onUpdateMercadoPagoSettings,
  infinitePayStatus,
  infinitePayHandle,
  onSaveInfinitePay,
  onDisconnectInfinitePay,
  pixManualStatus,
  pixManualData,
  onSavePixManual,
  onDisconnectPixManual,
  provedorPadrao,
  onSetProvedorPadrao,
  loading,
  connecting,
}: PagamentosTabProps) {
  const mercadoPagoRef = useRef<MercadoPagoCardRef>(null);
  const infinitePayRef = useRef<InfinitePayCardNewRef>(null);
  const pixManualRef = useRef<PixManualCardRef>(null);
  
  const [disconnectDialog, setDisconnectDialog] = useState<{
    open: boolean;
    provedor: ProvedorPagamento | null;
  }>({ open: false, provedor: null });

  const [mpSettingsOpen, setMpSettingsOpen] = useState(false);

  // Build active methods list
  const activeMethods: Array<{
    provedor: ProvedorPagamento;
    info: string;
    isPadrao: boolean;
  }> = [];

  if (mercadoPagoStatus === 'conectado') {
    activeMethods.push({
      provedor: 'mercadopago',
      info: mercadoPagoUserId ? `ID: ${mercadoPagoUserId}` : 'Conta conectada',
      isPadrao: provedorPadrao === 'mercadopago',
    });
  }

  if (infinitePayStatus === 'conectado' && infinitePayHandle) {
    activeMethods.push({
      provedor: 'infinitepay',
      info: `@${infinitePayHandle}`,
      isPadrao: provedorPadrao === 'infinitepay',
    });
  }

  if (pixManualStatus === 'conectado' && pixManualData) {
    activeMethods.push({
      provedor: 'pix_manual',
      info: pixManualData.nomeTitular,
      isPadrao: provedorPadrao === 'pix_manual',
    });
  }

  const handleEdit = useCallback((provedor: ProvedorPagamento) => {
    switch (provedor) {
      case 'mercadopago':
        // Open settings modal instead of just scrolling
        setMpSettingsOpen(true);
        break;
      case 'infinitepay':
        infinitePayRef.current?.scrollIntoView();
        infinitePayRef.current?.setEditMode(true);
        break;
      case 'pix_manual':
        pixManualRef.current?.scrollIntoView();
        pixManualRef.current?.setEditMode(true);
        break;
    }
  }, []);

  const handleDisconnectClick = useCallback((provedor: ProvedorPagamento) => {
    setDisconnectDialog({ open: true, provedor });
  }, []);

  const handleConfirmDisconnect = useCallback(async () => {
    const { provedor } = disconnectDialog;
    if (!provedor) return;

    switch (provedor) {
      case 'mercadopago':
        await onDisconnectMercadoPago();
        break;
      case 'infinitepay':
        await onDisconnectInfinitePay();
        break;
      case 'pix_manual':
        await onDisconnectPixManual();
        break;
    }

    setDisconnectDialog({ open: false, provedor: null });
  }, [disconnectDialog, onDisconnectMercadoPago, onDisconnectInfinitePay, onDisconnectPixManual]);

  const provedorNames: Record<ProvedorPagamento, string> = {
    mercadopago: 'Mercado Pago',
    infinitepay: 'InfinitePay',
    pix_manual: 'PIX Manual',
  };

  return (
    <div className="space-y-6">
      {/* Active Methods */}
      <ActiveMethodsList
        methods={activeMethods}
        onSetPadrao={onSetProvedorPadrao}
        onEdit={handleEdit}
        onDisconnect={handleDisconnectClick}
        loading={loading}
      />

      <Separator />

      {/* Provider Configuration Cards */}
      <div className="space-y-4">
        <MercadoPagoCard
          ref={mercadoPagoRef}
          status={mercadoPagoStatus}
          connectedAt={mercadoPagoConnectedAt}
          mpUserId={mercadoPagoUserId}
          habilitarPix={mercadoPagoSettings?.habilitarPix}
          habilitarCartao={mercadoPagoSettings?.habilitarCartao}
          maxParcelas={mercadoPagoSettings?.maxParcelas}
          onConnect={onConnectMercadoPago}
          onDisconnect={onDisconnectMercadoPago}
          onConfigure={() => setMpSettingsOpen(true)}
          loading={connecting}
        />

        <InfinitePayCardNew
          ref={infinitePayRef}
          status={infinitePayStatus}
          handle={infinitePayHandle}
          onSave={onSaveInfinitePay}
          onDisconnect={onDisconnectInfinitePay}
          loading={loading}
        />

        <PixManualCard
          ref={pixManualRef}
          status={pixManualStatus}
          data={pixManualData}
          onSave={onSavePixManual}
          onDisconnect={onDisconnectPixManual}
          loading={loading}
        />
      </div>

      {/* Instructions */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-2">
        <h4 className="text-sm font-medium">Como funciona?</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• <strong>Mercado Pago:</strong> PIX e cartão com confirmação automática</li>
          <li>• <strong>InfinitePay:</strong> Checkout com confirmação automática</li>
          <li>• <strong>PIX Manual:</strong> Você confirma os pagamentos manualmente</li>
          <li>• Defina um método padrão para novas cobranças</li>
          <li>• Os pagamentos vão direto para sua conta - o Lunari não processa valores</li>
        </ul>
      </div>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog
        open={disconnectDialog.open}
        onOpenChange={(open) => setDisconnectDialog({ open, provedor: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar {disconnectDialog.provedor ? provedorNames[disconnectDialog.provedor] : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a integração. Você não receberá mais pagamentos por este método até reconectar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisconnect}>
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mercado Pago Settings Modal */}
      {onUpdateMercadoPagoSettings && (
        <MercadoPagoSettingsModal
          open={mpSettingsOpen}
          onOpenChange={setMpSettingsOpen}
          settings={mercadoPagoSettings || null}
          onSave={async (settings) => {
            await onUpdateMercadoPagoSettings(settings);
          }}
          loading={loading}
        />
      )}
    </div>
  );
}

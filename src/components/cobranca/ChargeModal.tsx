import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AsaasPixModal } from './AsaasPixModal';
import { ChargeHistory } from './ChargeHistory';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { ChargeModalProps } from './modal/types';
import { useChargeModalState } from './modal/useChargeModalState';
import { ChargeModalHeader } from './modal/ChargeModalHeader';
import { ChargeModalForm } from './modal/ChargeModalForm';

export type { ChargeModalProps } from './modal/types';

export function ChargeModal(props: ChargeModalProps) {
  const {
    isOpen,
    onClose,
    clienteNome,
    step,
    finalidade = 'sessao',
    valorSinal,
    valorSugerido,
    allowChangeValor = true,
    clienteWhatsapp,
    valorSessaoComponente,
    valorExtrasComponente,
    qtdFotos,
    nomeSessao,
  } = props;

  const state = useChargeModalState(props);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent
          side="right"
          className={cn(
            'w-full sm:max-w-[520px] p-0 gap-0 flex flex-col',
            'h-dvh max-h-dvh bg-background backdrop-blur-none shadow-2xl',
          )}
        >
          <ChargeModalHeader
            finalidade={finalidade}
            clienteNome={clienteNome}
            step={step}
            nomeSessao={nomeSessao}
            activeTab={state.activeTab}
            onTabChange={state.setActiveTab}
            cobrancasCount={state.cobrancas.length}
          />

          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {state.activeTab === 'cobrar' ? (
              <ChargeModalForm
                finalidade={finalidade}
                valorSessaoComponente={valorSessaoComponente}
                valorExtrasComponente={valorExtrasComponente}
                qtdFotos={qtdFotos}
                valor={state.valor}
                setValor={state.setValor}
                valorType={state.valorType}
                onSelectValorType={state.handleSelectValorType}
                valorSugerido={valorSugerido}
                valorSinal={valorSinal}
                allowChangeValor={allowChangeValor}
                descricao={state.descricao}
                setDescricao={state.setDescricao}
                selectedProvider={state.selectedProvider}
                onProviderSelect={state.handleProviderSelect}
                currentCharge={state.currentCharge}
                currentChargeId={state.currentChargeId}
                creatingCharge={state.creatingCharge}
                checkingStatus={state.checkingStatus}
                clienteWhatsapp={clienteWhatsapp}
                onGenerateCharge={state.handleGenerateCharge}
                onConfirmPixManualPayment={state.confirmPixManualPayment}
                onCheckStatus={state.handleCheckStatus}
                asaasMode={state.asaasMode}
                asaasSettings={state.asaasSettings}
                asaasSelectedMethod={state.asaasSelectedMethod}
                onSelectAsaasMethod={state.setAsaasSelectedMethod}
                asaasPixLoading={state.asaasPixLoading}
                asaasLinkLoading={state.asaasLinkLoading}
                onAsaasGeneratePix={state.handleAsaasGeneratePix}
                onAsaasGenerateLink={state.handleAsaasGenerateLink}
              />
            ) : (
              <ChargeHistory cobrancas={state.cobrancas} onCancel={state.handleCancelCharge} />
            )}
          </div>

          <footer className="shrink-0 border-t border-border/60 p-3 px-4 bg-background/95 backdrop-blur-sm flex items-center justify-between gap-3 shadow-lg">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-xl h-10 px-5 text-xs font-semibold bg-muted/40 hover:bg-muted border-border/60"
            >
              Cancelar
            </Button>
            {state.activeTab === 'historico' && (
              <Button
                onClick={() => state.setActiveTab('cobrar')}
                className="rounded-xl h-10 px-5 text-xs font-semibold"
              >
                Nova Cobrança
              </Button>
            )}
          </footer>
        </SheetContent>
      </Sheet>
      
      <AsaasPixModal 
        isOpen={state.asaasPixModalOpen}
        onClose={() => state.setAsaasPixModalOpen(false)}
        pixQrCode={state.asaasPixQrCode}
        pixCopiaECola={state.asaasPixCopiaECola}
        valor={state.valor}
      />

      <ConfirmDialog
        state={state.confirmDialogState}
        onConfirm={state.handleConfirmDialog}
        onCancel={state.handleCancelDialog}
        onClose={state.handleCloseDialog}
      />
    </>
  );
}

import { ArrowLeft, ArrowRight, Check, Save, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
import { GALLERY_CREATE_STEPS } from './create/types';
import { useGalleryCreateForm } from './create/hooks/useGalleryCreateForm';
import { Step1Client } from './create/steps/Step1Client';
import { Step2Sale } from './create/steps/Step2Sale';
import { Step3Settings } from './create/steps/Step3Settings';
import { Step4Photos } from './create/steps/Step4Photos';
import { Step5Message } from './create/steps/Step5Message';
import { Step6Review } from './create/steps/Step6Review';

export default function GalleryCreate() {
  const form = useGalleryCreateForm();

  const renderStep = () => {
    switch (form.currentStep) {
      case 1:
        return (
          <Step1Client
            galleryPermission={form.galleryPermission}
            setGalleryPermission={form.setGalleryPermission}
            isAssistedMode={form.isAssistedMode}
            hasGestaoSession={form.hasGestaoSession}
            gestaoParams={form.gestaoParams}
            clients={form.clients}
            isLoadingClients={form.isLoadingClients}
            selectedClient={form.selectedClient}
            handleClientSelect={form.handleClientSelect}
            isClientModalOpen={form.isClientModalOpen}
            setIsClientModalOpen={form.setIsClientModalOpen}
            handleSaveClient={form.handleSaveClient}
            passwordDisabled={form.passwordDisabled}
            setPasswordDisabled={form.setPasswordDisabled}
            useExistingPassword={form.useExistingPassword}
            setUseExistingPassword={form.setUseExistingPassword}
            newPassword={form.newPassword}
            setNewPassword={form.setNewPassword}
            savePasswordToClient={form.savePasswordToClient}
            setSavePasswordToClient={form.setSavePasswordToClient}
            sessionName={form.sessionName}
            setSessionName={form.setSessionName}
            onSessionNameTouched={form.onSessionNameTouched}
            packageName={form.packageName}
            setPackageName={form.setPackageName}
            onPackageNameTouched={form.onPackageNameTouched}
            hasGestaoIntegration={form.hasGestaoIntegration}
            gestaoPackages={form.gestaoPackages}
            isLoadingPackages={form.isLoadingPackages}
            setIncludedPhotos={form.setIncludedPhotos}
            setFixedPrice={form.setFixedPrice}
            includedPhotos={form.includedPhotos}
            customDays={form.customDays}
            setCustomDays={form.setCustomDays}
            settings={form.settings}
            sessionFont={form.sessionFont}
            setSessionFont={form.setSessionFont}
            titleCaseMode={form.titleCaseMode}
            setTitleCaseMode={form.setTitleCaseMode}
            onTypographyTouched={form.onTypographyTouched}
          />
        );
      case 2:
        return (
          <Step2Sale
            saleMode={form.saleMode}
            setSaleMode={form.setSaleMode}
            onSaleModeTouched={form.onSaleModeTouched}
            paymentData={form.paymentData}
            selectedPaymentMethod={form.selectedPaymentMethod}
            setSelectedPaymentMethod={form.setSelectedPaymentMethod}
            onPaymentMethodTouched={form.onPaymentMethodTouched}
            regrasCongeladas={form.regrasCongeladas}
            overridePricing={form.overridePricing}
            setOverridePricing={form.setOverridePricing}
            isLoadingRegras={form.isLoadingRegras}
            pricingModel={form.pricingModel}
            setPricingModel={form.setPricingModel}
            onPricingModelTouched={form.onPricingModelTouched}
            fixedPrice={form.fixedPrice}
            setFixedPrice={form.setFixedPrice}
            discountPackages={form.discountPackages}
            setDiscountPackages={form.setDiscountPackages}
            addDiscountPackage={form.addDiscountPackage}
            updateDiscountPackage={form.updateDiscountPackage}
            removeDiscountPackage={form.removeDiscountPackage}
            isAssistedMode={form.isAssistedMode}
            settings={form.settings}
            createDiscountPreset={form.createDiscountPreset}
            updateDiscountPreset={form.updateDiscountPreset}
            deleteDiscountPreset={form.deleteDiscountPreset}
            chargeType={form.chargeType}
            setChargeType={form.setChargeType}
            onChargeTypeTouched={form.onChargeTypeTouched}
            includedPhotos={form.includedPhotos}
          />
        );
      case 3:
        return (
          <Step3Settings
            imageResizeOption={form.imageResizeOption}
            setImageResizeOption={form.setImageResizeOption}
            onImageResizeTouched={form.onImageResizeTouched}
            watermarkType={form.watermarkType}
            setWatermarkType={form.setWatermarkType}
            watermarkOpacity={form.watermarkOpacity}
            setWatermarkOpacity={form.setWatermarkOpacity}
            clientMode={form.clientMode}
            setClientMode={form.setClientMode}
            onClientModeTouched={form.onClientModeTouched}
            allowComments={form.allowComments}
            setAllowComments={form.setAllowComments}
            onAllowCommentsTouched={form.onAllowCommentsTouched}
            allowDownload={form.allowDownload}
            setAllowDownload={form.setAllowDownload}
            onAllowDownloadTouched={form.onAllowDownloadTouched}
            allowExtraPhotos={form.allowExtraPhotos}
            setAllowExtraPhotos={form.setAllowExtraPhotos}
            onAllowExtraPhotosTouched={form.onAllowExtraPhotosTouched}
            saleMode={form.saleMode}
          />
        );
      case 4:
        return (
          <Step4Photos
            supabaseGalleryId={form.supabaseGalleryId}
            activeFolderId={form.activeFolderId}
            setActiveFolderId={form.setActiveFolderId}
            isCreatingGallery={form.isCreatingGallery}
            imageResizeOption={form.imageResizeOption}
            watermarkType={form.watermarkType}
            watermarkSettings={form.watermarkSettings}
            watermarkOpacity={form.watermarkOpacity}
            allowDownload={form.allowDownload}
            handlePhotoUploadComplete={form.photoManager.handlePhotoUploadComplete}
            setIsUploadingPhotos={form.photoManager.setIsUploadingPhotos}
            setUploadErrorCount={form.photoManager.setUploadErrorCount}
            uploadedCount={form.photoManager.uploadedCount}
            showUploadedPhotos={form.photoManager.showUploadedPhotos}
            setShowUploadedPhotos={form.photoManager.setShowUploadedPhotos}
            uploadedPhotos={form.photoManager.uploadedPhotos}
            handleDeleteUploadedPhoto={form.photoManager.handleDeleteUploadedPhoto}
            deletingPhotoId={form.photoManager.deletingPhotoId}
            showDeleteAllDialog={form.photoManager.showDeleteAllDialog}
            setShowDeleteAllDialog={form.photoManager.setShowDeleteAllDialog}
            handleDeleteAllPhotos={form.photoManager.handleDeleteAllPhotos}
            isDeletingAll={form.photoManager.isDeletingAll}
            isUploadingPhotos={form.photoManager.isUploadingPhotos}
          />
        );
      case 5:
        return (
          <Step5Message
            welcomeMessageEnabled={form.welcomeMessageEnabled}
            setWelcomeMessageEnabled={form.setWelcomeMessageEnabled}
            welcomeMessage={form.welcomeMessage}
            setWelcomeMessage={form.setWelcomeMessage}
            settings={form.settings}
          />
        );
      case 6:
        return (
          <Step6Review
            selectedClient={form.selectedClient}
            sessionName={form.sessionName}
            packageName={form.packageName}
            includedPhotos={form.includedPhotos}
            saleMode={form.saleMode}
            getSaleModeLabel={form.getSaleModeLabel}
            getPaymentMethodLabel={form.getPaymentMethodLabel}
            getPricingModelLabel={form.getPricingModelLabel}
            getChargeTypeLabel={form.getChargeTypeLabel}
            fixedPrice={form.fixedPrice}
            pricingModel={form.pricingModel}
            discountPackages={form.discountPackages}
            uploadedCount={form.photoManager.uploadedCount}
            customDays={form.customDays}
            imageResizeOption={form.imageResizeOption}
            watermarkType={form.watermarkType}
            allowComments={form.allowComments}
            allowDownload={form.allowDownload}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-[79rem] mx-auto w-full bg-background px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-32 sm:pb-36 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={form.handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Nova Galeria</h1>
          <p className="text-muted-foreground text-sm">
            Passo {form.currentStep} de {GALLERY_CREATE_STEPS.length}
          </p>
        </div>
      </div>

      {/* Luxury Step Indicator */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2 scrollbar-none">
        {GALLERY_CREATE_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = form.currentStep === step.id;
          const isCompleted = form.currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-full transition-all duration-300 whitespace-nowrap text-sm',
                  isActive &&
                    'bg-[#ddd1b6]/50 text-[#66502a] dark:text-[#f0e6d2] border border-[#cbb384] ring-2 ring-[#cbb384]/20 shadow-[0_2px_12px_rgba(203,179,132,0.2)] font-semibold',
                  isCompleted &&
                    'bg-[#ddd1b6]/30 text-[#856b3e] dark:text-[#cbb384] border border-[#cbb384]/30 font-medium',
                  !isActive &&
                    !isCompleted &&
                    'text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 text-[#cbb384]" />
                ) : (
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      isActive && 'text-[#cbb384] scale-110'
                    )}
                  />
                )}
                <span className="hidden sm:inline">{step.name}</span>
              </div>
              {index < GALLERY_CREATE_STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-4 md:w-12 mx-1 md:mx-2 rounded-full transition-colors duration-300',
                    isCompleted ? 'bg-[#cbb384]/60 dark:bg-[#cbb384]/40' : 'bg-border/60'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content Card */}
      <div className="lunari-card p-6 md:p-8 mb-6 border border-border/60 dark:border-border/40 shadow-sm rounded-2xl">
        {renderStep()}
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 md:left-16 right-0 border-t bg-background/95 backdrop-blur z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
        <div className="max-w-[79rem] mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 flex justify-between items-center gap-2">
          <Button
            variant="outline"
            onClick={form.handleBack}
            disabled={form.isAdvancing || form.isSavingDraft || form.isGoingBack}
            className={cn(
              'active:scale-[0.98] transition-all rounded-xl',
              form.isGoingBack && 'cursor-wait'
            )}
          >
            {form.isGoingBack ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowLeft className="h-4 w-4 mr-2" />
            )}
            {form.isGoingBack
              ? 'Voltando...'
              : form.currentStep === 1
              ? 'Cancelar'
              : 'Voltar'}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={form.handleSaveDraft}
              disabled={form.isAdvancing || form.isSavingDraft || form.isGoingBack}
              className={cn(
                'active:scale-[0.98] transition-all rounded-xl hover:border-[#cbb384]/40',
                form.isSavingDraft && 'cursor-wait'
              )}
            >
              {form.isSavingDraft ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              <span className="hidden sm:inline">
                {form.isSavingDraft ? 'Salvando...' : 'Salvar Rascunho'}
              </span>
              <span className="sm:hidden">
                {form.isSavingDraft ? 'Salvando...' : 'Salvar'}
              </span>
            </Button>

            <Button
              onClick={form.handleNext}
              disabled={form.isAdvancing || form.isSavingDraft || form.isGoingBack}
              className={cn(
                'bg-[#cbb384] hover:bg-[#bfa574] text-white active:scale-[0.98] transition-all rounded-xl shadow-sm font-medium',
                form.isAdvancing && 'cursor-wait'
              )}
            >
              {form.isAdvancing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {form.isAdvancing
                ? form.currentStep === 6
                  ? 'Criando galeria...'
                  : 'Avançando...'
                : form.currentStep === 6
                ? 'Criar Galeria'
                : 'Próximo'}
              {!form.isAdvancing && form.currentStep < 6 && (
                <ArrowRight className="h-4 w-4 ml-2" />
              )}
            </Button>
          </div>
        </div>

        {/* Recreate gallery alert */}
        <AlertDialog open={form.showRecreateDialog} onOpenChange={form.setShowRecreateDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Recriar galeria desta sessão?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <p>
                    Esta sessão já teve uma galeria
                    {form.priorDeletion?.nome_sessao ? (
                      <>
                        {' '}
                        chamada <strong>"{form.priorDeletion.nome_sessao}"</strong>
                      </>
                    ) : null}{' '}
                    excluída
                    {form.priorDeletion?.deleted_at ? (
                      <>
                        {' '}
                        em{' '}
                        <strong>
                          {new Date(form.priorDeletion.deleted_at).toLocaleDateString('pt-BR')}
                        </strong>
                      </>
                    ) : null}
                    .
                  </p>
                  {form.priorDeletion?.fotos_count ? (
                    <p className="text-muted-foreground">
                      A galeria anterior continha {form.priorDeletion.fotos_count} foto
                      {form.priorDeletion.fotos_count === 1 ? '' : 's'}, que foram removidas
                      definitivamente.
                    </p>
                  ) : null}
                  <p className="text-muted-foreground">
                    O extrato financeiro da sessão (pagamentos e cobranças) foi preservado no
                    Gestão. Você está prestes a criar uma <strong>nova galeria</strong> vinculada à
                    mesma sessão.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async (e) => {
                  e.preventDefault();
                  form.setRecreateConfirmed(true);
                  form.setShowRecreateDialog(false);
                  setTimeout(() => form.handleNext(), 0);
                }}
              >
                Recriar mesmo assim
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

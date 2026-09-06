import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ReactivateGalleryDialog } from '@/components/ReactivateGalleryDialog';
import { ReactivateSuccessModal } from '@/components/ReactivateSuccessModal';
import { ClientModal } from '@/components/ClientModal';
import { useSupabaseGalleries } from '@/hooks/useSupabaseGalleries';
import { useGalleryById } from '@/hooks/useGalleryById';
import { useGalleryClients } from '@/hooks/useGalleryClients';
import { useAuth } from '@/contexts/AuthContext';
import { useGestaoPackages } from '@/hooks/useGestaoPackages';
import { useSettings } from '@/hooks/useSettings';
import { getGalleryUrl } from '@/lib/galleryUrl';

import { useGalleryEditPhotos } from './edit/hooks/useGalleryEditPhotos';
import { useGalleryEditForm } from './edit/hooks/useGalleryEditForm';
import { EditBasicInfoCard } from './edit/components/EditBasicInfoCard';
import { EditBillingRulesCard } from './edit/components/EditBillingRulesCard';
import { EditDeadlineCard } from './edit/components/EditDeadlineCard';
import { EditPhotosCard } from './edit/components/EditPhotosCard';

export default function GalleryEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasGestaoIntegration = !!(user as any)?.hasGestaoIntegration;

  const { packages: gestaoPackages } = useGestaoPackages();
  const { settings } = useSettings();

  const {
    updateGallery,
    deleteGallery,
    reopenSelection,
    fetchGalleryPhotos,
    getPhotoUrl,
    deletePhoto,
    deletePhotos,
    isUpdating,
    isDeletingPhoto,
    isDeletingPhotos,
  } = useSupabaseGalleries({ enabled: false });

  const { data: gallery, isLoading: isGalleryLoading } = useGalleryById(id);

  const {
    clients,
    isLoading: isClientsLoading,
    createClient,
    refetch: refetchClients,
  } = useGalleryClients();

  const photoManager = useGalleryEditPhotos({
    galleryId: id,
    gallery,
    fetchGalleryPhotos,
    deletePhoto,
    deletePhotos,
    isDeletingPhoto,
    isDeletingPhotos,
  });

  const form = useGalleryEditForm({
    gallery,
    clients,
    updateGallery,
    deleteGallery,
    reopenSelection,
    createClient,
    refetchClients,
    settings,
    navigate,
    localPhotoCount: photoManager.localPhotoCount,
    setLocalPhotoCount: photoManager.setLocalPhotoCount,
  });

  const isInitialLoading =
    (isGalleryLoading && !gallery) || (isClientsLoading && clients.length === 0);

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Galeria não encontrada</h2>
        <p className="text-muted-foreground mb-4">
          A galeria solicitada não existe ou foi removida.
        </p>
        <Button variant="outline" onClick={() => navigate('/app/gallery/dashboard')}>
          Voltar às Galerias
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-[79rem] mx-auto w-full bg-background px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate(
                gallery?.tipo === 'entrega'
                  ? `/app/gallery/transfer/${id}`
                  : `/app/gallery/select/${id}`
              )
            }
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Editar Galeria</h1>
            <p className="text-muted-foreground">{gallery.nomeSessao || 'Galeria'}</p>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Info & Deadline */}
        <div className="space-y-6">
          <EditBasicInfoCard
            sessionFont={form.sessionFont}
            setSessionFont={form.setSessionFont}
            nomeSessao={form.nomeSessao}
            setNomeSessao={form.setNomeSessao}
            titleCaseMode={form.titleCaseMode}
            setTitleCaseMode={form.setTitleCaseMode}
            nomePacote={form.nomePacote}
            setNomePacote={form.setNomePacote}
            hasGestaoIntegration={hasGestaoIntegration}
            gestaoPackages={gestaoPackages}
            setFotosIncluidas={form.setFotosIncluidas}
            setValorFotoExtra={form.setValorFotoExtra}
            isBillingLocked={form.isBillingLocked}
            clients={clients}
            selectedClient={form.selectedClient}
            handleClientSelect={form.handleClientSelect}
            setIsClientModalOpen={form.setIsClientModalOpen}
            clienteEmail={form.clienteEmail}
            setClienteEmail={form.setClienteEmail}
            clienteTelefone={form.clienteTelefone}
            handlePhoneChange={form.handlePhoneChange}
            galleryPassword={gallery.galleryPassword}
            showPassword={form.showPassword}
            setShowPassword={form.setShowPassword}
            handleCopyPassword={form.handleCopyPassword}
          />

          <EditBillingRulesCard
            isBillingLocked={form.isBillingLocked}
            isLunariLinked={form.isLunariLinked}
            billingMode={form.billingMode}
            handleBillingModeChange={form.handleBillingModeChange}
            fotosIncluidas={form.fotosIncluidas}
            setFotosIncluidas={form.setFotosIncluidas}
            valorFotoExtra={form.valorFotoExtra}
            setValorFotoExtra={form.setValorFotoExtra}
            setPricingDirty={form.setPricingDirty}
            fotosIncluidasAbaixoDoMinimo={form.fotosIncluidasAbaixoDoMinimo}
            minFotosIncluidasPermitido={form.minFotosIncluidasPermitido}
            discountPackages={form.discountPackages}
            setDiscountPackages={form.setDiscountPackages}
            regrasOverride={form.regrasOverride}
            setRestoreDialogOpen={form.setRestoreDialogOpen}
          />

          <EditDeadlineCard
            prazoSelecao={form.prazoSelecao}
            setPrazoSelecao={form.setPrazoSelecao}
            handleExtendDeadline={form.handleExtendDeadline}
            galleryName={gallery.nomeSessao || 'Esta galeria'}
            handleDelete={form.handleDelete}
          />
        </div>

        {/* Right Column - Photos & Actions */}
        <div className="space-y-6">
          <EditPhotosCard
            gallery={gallery}
            photos={photoManager.photos}
            isLoadingPhotos={photoManager.isLoadingPhotos}
            localPhotoCount={photoManager.localPhotoCount}
            activeFolderId={photoManager.activeFolderId}
            setActiveFolderId={photoManager.setActiveFolderId}
            selectedIds={photoManager.selectedIds}
            toggleSelect={photoManager.toggleSelect}
            toggleSelectAll={photoManager.toggleSelectAll}
            setConfirmBulkDeleteOpen={photoManager.setConfirmBulkDeleteOpen}
            handleDeletePhoto={photoManager.handleDeletePhoto}
            getPhotoUrl={getPhotoUrl}
            showPhotoUploader={photoManager.showPhotoUploader}
            setShowPhotoUploader={photoManager.setShowPhotoUploader}
            handleUploadComplete={photoManager.handleUploadComplete}
            anyDeleting={photoManager.anyDeleting}
          />

          {/* Reactivate Card */}
          {form.canReactivate && (
            <Card className="glass">
              <CardHeader>
                <CardTitle>Reativar Galeria</CardTitle>
                <CardDescription>
                  Permite que o cliente faça novas seleções
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" onClick={() => form.setReactivateOpen(true)}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reativar
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Reactivate Gallery Dialog */}
      <ReactivateGalleryDialog
        open={form.reactivateOpen}
        onOpenChange={form.setReactivateOpen}
        galleryName={gallery.nomeSessao || 'Esta galeria'}
        onReactivate={form.handleReactivate}
        onSuccess={(days) => {
          form.setReactivateDays(days);
          form.setReactivateSuccessOpen(true);
        }}
      />

      {/* Reactivate Success / Share Modal */}
      {settings && (
        <ReactivateSuccessModal
          isOpen={form.reactivateSuccessOpen}
          onOpenChange={form.setReactivateSuccessOpen}
          gallery={gallery}
          settings={settings}
          clientLink={gallery.publicToken ? getGalleryUrl(gallery.publicToken) : null}
          newDeadline={(() => {
            const d = new Date();
            d.setDate(d.getDate() + form.reactivateDays);
            return d;
          })()}
          daysGranted={form.reactivateDays}
        />
      )}

      {/* Restore session rules confirmation */}
      <AlertDialog open={form.restoreDialogOpen} onOpenChange={form.setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar regras da sessão?</AlertDialogTitle>
            <AlertDialogDescription>
              As regras personalizadas desta galeria serão descartadas e a galeria voltará a seguir
              os valores da sessão do Lunari Studio (fotos incluídas, valor da foto extra e
              descontos progressivos). Esta ação não afeta vendas já realizadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={form.handleRestoreSessionRules}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client Modal */}
      <ClientModal
        open={form.isClientModalOpen}
        onOpenChange={form.setIsClientModalOpen}
        onSave={form.handleCreateClient}
      />

      {/* Bulk Delete Confirmation */}
      <AlertDialog
        open={photoManager.confirmBulkDeleteOpen}
        onOpenChange={photoManager.setConfirmBulkDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {photoManager.selectedIds.size} foto
              {photoManager.selectedIds.size !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As fotos serão removidas permanentemente da galeria e
              do armazenamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={photoManager.anyDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                photoManager.handleBulkDelete();
              }}
              disabled={photoManager.anyDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {photoManager.anyDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={form.handleSave}
          disabled={isUpdating || form.fotosIncluidasAbaixoDoMinimo}
          variant="terracotta"
          size="lg"
          className="shadow-2xl gap-2 rounded-full px-6 h-12 backdrop-blur-xl"
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}

import { Image, Upload, Eye, Trash2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { FolderManager } from '@/components/FolderManager';
import { PhotoUploader, UploadedPhoto, QueueState } from '@/components/PhotoUploader';
import { getDisplayUrl } from '@/lib/photoUrl';
import { ImageResizeOption, WatermarkType } from '@/types/gallery';

export interface Step4PhotosProps {
  supabaseGalleryId: string | null;
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  isCreatingGallery: boolean;
  imageResizeOption: ImageResizeOption;
  watermarkType: WatermarkType;
  watermarkSettings: any;
  watermarkOpacity: number;
  allowDownload: boolean;
  handlePhotoUploadComplete: (photos: UploadedPhoto[]) => void;
  setIsUploadingPhotos: (uploading: boolean) => void;
  setUploadErrorCount: (count: number) => void;
  uploadedCount: number;
  showUploadedPhotos: boolean;
  setShowUploadedPhotos: (show: boolean) => void;
  uploadedPhotos: UploadedPhoto[];
  handleDeleteUploadedPhoto: (photoId: string) => Promise<void>;
  deletingPhotoId: string | null;
  showDeleteAllDialog: boolean;
  setShowDeleteAllDialog: (show: boolean) => void;
  handleDeleteAllPhotos: () => Promise<void>;
  isDeletingAll: boolean;
  isUploadingPhotos: boolean;
}

export function Step4Photos({
  supabaseGalleryId,
  activeFolderId,
  setActiveFolderId,
  isCreatingGallery,
  imageResizeOption,
  watermarkType,
  watermarkSettings,
  watermarkOpacity,
  allowDownload,
  handlePhotoUploadComplete,
  setIsUploadingPhotos,
  setUploadErrorCount,
  uploadedCount,
  showUploadedPhotos,
  setShowUploadedPhotos,
  uploadedPhotos,
  handleDeleteUploadedPhoto,
  deletingPhotoId,
  showDeleteAllDialog,
  setShowDeleteAllDialog,
  handleDeleteAllPhotos,
  isDeletingAll,
  isUploadingPhotos,
}: Step4PhotosProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-muted-foreground text-lg">
          Adicione as fotos da sessão para o cliente selecionar
        </p>
      </div>

      {/* Folder Manager */}
      {supabaseGalleryId && (
        <FolderManager
          galleryId={supabaseGalleryId}
          activeFolderId={activeFolderId}
          onActiveFolderChange={setActiveFolderId}
        />
      )}

      {isCreatingGallery ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Preparando galeria para uploads...</p>
        </div>
      ) : supabaseGalleryId ? (
        <PhotoUploader
          galleryId={supabaseGalleryId}
          folderId={activeFolderId}
          maxLongEdge={imageResizeOption}
          watermarkConfig={{
            mode:
              watermarkType === 'standard'
                ? 'system'
                : watermarkType === 'custom'
                ? 'custom'
                : 'none',
            customPathHorizontal: watermarkSettings.path,
            customPathVertical: watermarkSettings.path,
            opacity: watermarkOpacity,
            tileScale:
              watermarkSettings.scale === 15
                ? 'small'
                : watermarkSettings.scale === 40
                ? 'large'
                : 'medium',
          }}
          allowDownload={allowDownload}
          onUploadComplete={handlePhotoUploadComplete}
          onUploadingChange={setIsUploadingPhotos}
          onQueueStateChange={(state: QueueState) => {
            setUploadErrorCount(state.errorCount);
            setIsUploadingPhotos(state.isUploading);
          }}
        />
      ) : (
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Preparando área de upload...</p>
          <p className="text-sm text-muted-foreground">
            A galeria será criada automaticamente
          </p>
        </div>
      )}

      {uploadedCount > 0 && (
        <Collapsible open={showUploadedPhotos} onOpenChange={setShowUploadedPhotos}>
          <div className="lunari-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Image className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{uploadedCount} fotos enviadas</p>
                  <p className="text-sm text-muted-foreground">Fotos salvas com sucesso</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteAllDialog(true)}
                  disabled={isDeletingAll || isUploadingPhotos}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  {isDeletingAll ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  {isDeletingAll ? 'Excluindo...' : 'Excluir todas'}
                </Button>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    {showUploadedPhotos ? 'Ocultar' : 'Ver fotos'}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </div>
          <CollapsibleContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 mt-3">
              {uploadedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group aspect-square rounded-lg overflow-hidden bg-muted"
                >
                  <img
                    src={getDisplayUrl(photo.storageKey)}
                    alt={photo.originalFilename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <button
                    onClick={() => handleDeleteUploadedPhoto(photo.id)}
                    disabled={deletingPhotoId === photo.id}
                    className="absolute top-1 right-1 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive disabled:opacity-50"
                  >
                    {deletingPhotoId === photo.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir todas as fotos?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir todas as {uploadedCount} fotos desta galeria?
              Os créditos serão devolvidos automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllPhotos}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { FolderManager } from '@/components/FolderManager';
import { PhotoUploader, UploadedPhoto } from '@/components/PhotoUploader';
import { DeliverPhotoManager } from '@/components/deliver/DeliverPhotoManager';

interface DeliverCreateStep3PhotosProps {
  supabaseGalleryId: string | null;
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  storageLimitBytes: number;
  storageUsedBytes: number;
  onUploadComplete: (photos: UploadedPhoto[]) => void;
  setIsUploading: (uploading: boolean) => void;
  photoRefreshKey: number;
  coverPhotoId: string | null;
  onCoverChange: (photoId: string | null) => void;
  onPhotosChange: (count: number) => void;
}

export function DeliverCreateStep3Photos({
  supabaseGalleryId,
  activeFolderId,
  setActiveFolderId,
  storageLimitBytes,
  storageUsedBytes,
  onUploadComplete,
  setIsUploading,
  photoRefreshKey,
  coverPhotoId,
  onCoverChange,
  onPhotosChange,
}: DeliverCreateStep3PhotosProps) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="border-b border-border/40 pb-4">
        <h2 className="text-lg font-semibold text-foreground">Fotos da Entrega</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Envie as fotos em alta resolução. O cliente poderá fazer o download com qualidade máxima.
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

      {supabaseGalleryId && (
        <>
          <PhotoUploader
            galleryId={supabaseGalleryId}
            folderId={activeFolderId}
            maxLongEdge={2560}
            allowDownload={true}
            skipCredits={true}
            storageLimit={storageLimitBytes}
            storageUsed={storageUsedBytes}
            onUploadComplete={onUploadComplete}
            onUploadingChange={setIsUploading}
          />
          <DeliverPhotoManager
            galleryId={supabaseGalleryId}
            refreshKey={photoRefreshKey}
            coverPhotoId={coverPhotoId}
            onCoverChange={onCoverChange}
            onPhotosChange={onPhotosChange}
          />
        </>
      )}
    </div>
  );
}

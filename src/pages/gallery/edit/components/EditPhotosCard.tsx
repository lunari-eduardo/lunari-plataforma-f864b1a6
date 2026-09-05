import { Image, Loader2, CheckSquare, Square, Trash2, Play, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { FolderManager } from '@/components/FolderManager';
import { PhotoUploader, UploadedPhoto } from '@/components/PhotoUploader';
import { cn } from '@/lib/utils';

export interface EditPhotosCardProps {
  gallery: any;
  photos: any[];
  isLoadingPhotos: boolean;
  localPhotoCount: number | null;
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: (visibleIds: string[]) => void;
  setConfirmBulkDeleteOpen: (open: boolean) => void;
  handleDeletePhoto: (id: string) => Promise<void>;
  getPhotoUrl: (photo: any, gallery: any, type: string) => string;
  showPhotoUploader: boolean;
  setShowPhotoUploader: (show: boolean) => void;
  handleUploadComplete: (photos: UploadedPhoto[]) => void;
  anyDeleting: boolean;
}

export function EditPhotosCard({
  gallery,
  photos,
  isLoadingPhotos,
  localPhotoCount,
  activeFolderId,
  setActiveFolderId,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  setConfirmBulkDeleteOpen,
  handleDeletePhoto,
  getPhotoUrl,
  showPhotoUploader,
  setShowPhotoUploader,
  handleUploadComplete,
  anyDeleting,
}: EditPhotosCardProps) {
  const filteredPhotos = activeFolderId
    ? photos.filter((p) => p.pastaId === activeFolderId)
    : photos;
  const visibleIds = filteredPhotos.map((p) => p.id);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

  const totalPhotosCount = photos.length || localPhotoCount || gallery?.totalFotos || 0;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Fotos da Galeria
        </CardTitle>
        <CardDescription>
          {activeFolderId
            ? `${filteredPhotos.length} fotos nesta pasta (${totalPhotosCount} total)`
            : `${totalPhotosCount} fotos nesta galeria`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Folder Manager */}
        <FolderManager
          galleryId={gallery.id}
          activeFolderId={activeFolderId}
          onActiveFolderChange={setActiveFolderId}
          photos={photos.map((p) => ({
            id: p.id,
            pastaId: p.pastaId,
            thumbnailUrl: getPhotoUrl(p, gallery, 'thumbnail'),
            originalFilename: p.originalFilename,
          }))}
          showCoverSelect
        />

        {/* Photo List */}
        {isLoadingPhotos ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPhotos.length > 0 ? (
          <div className="space-y-2">
            {/* Selection action bar */}
            <div className="flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                onClick={() => toggleSelectAll(visibleIds)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                disabled={anyDeleting}
              >
                {allVisibleSelected ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {allVisibleSelected ? 'Desmarcar todas' : 'Selecionar todas'}
              </button>
              {selectedVisibleCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {selectedVisibleCount} selecionada{selectedVisibleCount !== 1 ? 's' : ''}
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 px-2 gap-1"
                    onClick={() => setConfirmBulkDeleteOpen(true)}
                    disabled={anyDeleting}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                </div>
              )}
            </div>

            <ScrollArea className="h-[450px] rounded-md border">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 p-2">
                {filteredPhotos.map((photo) => {
                  const isSelected = selectedIds.has(photo.id);
                  const isVideo = photo.mimeType?.startsWith('video/');
                  return (
                    <div
                      key={photo.id}
                      className={cn(
                        'group relative aspect-square rounded-md overflow-hidden border-2 transition-all cursor-pointer bg-muted/20',
                        isSelected
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-transparent hover:border-border'
                      )}
                      onClick={() => !anyDeleting && toggleSelect(photo.id)}
                    >
                      <img
                        src={getPhotoUrl(photo, gallery, 'thumbnail')}
                        alt={photo.originalFilename}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />

                      {/* Video badge */}
                      {isVideo && (
                        <div className="absolute top-1.5 right-1.5 p-1 bg-black/50 text-white rounded-full pointer-events-none">
                          <Play className="h-3 w-3 fill-current" />
                        </div>
                      )}

                      {/* Selection checkbox */}
                      <div
                        className={cn(
                          'absolute top-1.5 left-1.5 transition-opacity',
                          isSelected || selectedIds.size > 0
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(photo.id)}
                          disabled={anyDeleting}
                          className="bg-background/90 border-background"
                        />
                      </div>

                      {/* Hover overlay + filename + delete */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between gap-1 p-1.5 pointer-events-none">
                        <span
                          className="text-[10px] text-white truncate flex-1"
                          title={photo.originalFilename}
                        >
                          {photo.originalFilename}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(photo.id);
                          }}
                          disabled={anyDeleting}
                          className="pointer-events-auto p-1 rounded bg-destructive/90 text-destructive-foreground hover:bg-destructive transition-colors disabled:opacity-50"
                          title="Excluir foto"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {activeFolderId ? 'Nenhuma foto nesta pasta' : 'Nenhuma foto nesta galeria'}
          </p>
        )}

        {/* Upload Button / Uploader */}
        {!showPhotoUploader ? (
          <Button
            variant="outline"
            onClick={() => setShowPhotoUploader(true)}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Adicionar Fotos
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Carregar novas fotos</Label>
              <Button variant="ghost" size="sm" onClick={() => setShowPhotoUploader(false)}>
                Fechar
              </Button>
            </div>
            <PhotoUploader
              galleryId={gallery.id}
              folderId={activeFolderId}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

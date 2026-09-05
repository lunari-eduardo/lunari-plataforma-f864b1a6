import React, { useMemo } from 'react';
import { Check, Heart, Image } from 'lucide-react';
import { MasonryGrid, MasonryItem } from '@/components/MasonryGrid';
import { PhotoCard } from '@/components/PhotoCard';
import { GalleryPhoto } from '@/types/gallery';
import { cn } from '@/lib/utils';

interface PhotosTabProps {
  transformedPhotos: GalleryPhoto[];
  selectedPhotos: GalleryPhoto[];
  favoritePhotos: GalleryPhoto[];
  galleryFolders: Array<{ id: string; nome: string }>;
  activePhotoFilter: string;
  setActivePhotoFilter: (filter: string) => void;
  photoSpacing?: number;
  allowComments?: boolean;
  onViewFullscreen: (index: number) => void;
}

export function PhotosTab({
  transformedPhotos,
  selectedPhotos,
  favoritePhotos,
  galleryFolders,
  activePhotoFilter,
  setActivePhotoFilter,
  photoSpacing = 6,
  allowComments = true,
  onViewFullscreen,
}: PhotosTabProps) {
  const currentPhotosList = useMemo(() => {
    if (activePhotoFilter === 'selected') {
      return transformedPhotos.filter(p => p.isSelected);
    }
    if (activePhotoFilter === 'favorites') {
      return transformedPhotos.filter(p => p.isSelected && p.isFavorite);
    }
    if (activePhotoFilter.startsWith('folder:')) {
      const folderId = activePhotoFilter.replace('folder:', '');
      return transformedPhotos.filter(p => p.folderId === folderId);
    }
    return transformedPhotos;
  }, [transformedPhotos, activePhotoFilter]);

  return (
    <div className="space-y-4">
      {/* Filter pills: Todas, Selecionadas, Favoritas e Pastas */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActivePhotoFilter('all')}
          className={cn(
            'shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border',
            activePhotoFilter === 'all'
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          Todas ({transformedPhotos.length})
        </button>

        <button
          onClick={() => setActivePhotoFilter('selected')}
          className={cn(
            'shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border inline-flex items-center gap-1.5',
            activePhotoFilter === 'selected'
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Check className="h-3.5 w-3.5" />
          Selecionadas ({selectedPhotos.length})
        </button>

        {favoritePhotos.length > 0 && (
          <button
            onClick={() => setActivePhotoFilter('favorites')}
            className={cn(
              'shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border inline-flex items-center gap-1.5',
              activePhotoFilter === 'favorites'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Heart className="h-3.5 w-3.5 text-red-500 fill-current" />
            Favoritas ({favoritePhotos.length})
          </button>
        )}

        {galleryFolders.map((folder) => {
          const count = transformedPhotos.filter(p => p.folderId === folder.id).length;
          const isFolderActive = activePhotoFilter === `folder:${folder.id}`;
          return (
            <button
              key={folder.id}
              onClick={() => setActivePhotoFilter(`folder:${folder.id}`)}
              className={cn(
                'shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                isFolderActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {folder.nome} ({count})
            </button>
          );
        })}
      </div>

      {/* Photos Grid */}
      {currentPhotosList.length > 0 ? (
        <MasonryGrid gap={photoSpacing}>
          {currentPhotosList.map((photo, index) => (
            <MasonryItem key={photo.id} photoWidth={photo.width} photoHeight={photo.height}>
              <PhotoCard
                photo={photo}
                isSelected={photo.isSelected}
                allowComments={allowComments}
                readOnly
                onSelect={() => {}}
                onViewFullscreen={() => onViewFullscreen(index)}
              />
            </MasonryItem>
          ))}
        </MasonryGrid>
      ) : (
        <div className="text-center py-16 lunari-card">
          <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {activePhotoFilter === 'selected'
              ? 'Nenhuma foto selecionada pelo cliente ainda'
              : activePhotoFilter === 'favorites'
                ? 'Nenhuma foto marcada como favorita'
                : activePhotoFilter.startsWith('folder:')
                  ? 'Nenhuma foto nesta pasta'
                  : 'Nenhuma foto adicionada ainda'}
          </p>
        </div>
      )}
    </div>
  );
}

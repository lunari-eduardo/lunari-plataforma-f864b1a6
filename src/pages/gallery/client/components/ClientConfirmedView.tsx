import React, { useState, useEffect } from 'react';
import { Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RowMasonryGrid as MasonryGrid, RowMasonryItem as MasonryItem } from '@/components/RowMasonryGrid';
import { Lightbox } from '@/components/Lightbox';
import { DownloadModal } from '@/components/DownloadModal';
import { Gallery, GalleryPhoto } from '@/types/gallery';
import { getFontFamilyById } from '@/components/FontSelect';
import { cn } from '@/lib/utils';

interface ClientConfirmedViewProps {
  gallery: Gallery;
  localPhotos: GalleryPhoto[];
  studioLogoUrl?: string | null;
  studioName?: string | null;
  themeStyles: React.CSSProperties;
  effectiveBackgroundMode: 'light' | 'dark';
  photoSpacing?: number;
}

export function ClientConfirmedView({
  gallery,
  localPhotos,
  studioLogoUrl,
  studioName,
  themeStyles,
  effectiveBackgroundMode,
  photoSpacing = 6,
}: ClientConfirmedViewProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [hasAutoOpenedDownload, setHasAutoOpenedDownload] = useState(false);

  const confirmedSelectedPhotos = localPhotos.filter(p => p.isSelected);
  const allowDownload = gallery.settings.allowDownload;

  // Auto-open download modal after confirmation (if allowDownload is enabled)
  useEffect(() => {
    const shouldAutoOpen = 
      allowDownload && 
      confirmedSelectedPhotos.length > 0 && 
      !hasAutoOpenedDownload && 
      !showDownloadModal;
    
    if (shouldAutoOpen) {
      const timer = setTimeout(() => {
        setShowDownloadModal(true);
        setHasAutoOpenedDownload(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [allowDownload, confirmedSelectedPhotos.length, hasAutoOpenedDownload, showDownloadModal]);

  // Modo SEM download
  if (!allowDownload) {
    return (
      <div 
        className={cn(
          "min-h-screen flex flex-col bg-background text-foreground",
          effectiveBackgroundMode === 'dark' && 'dark'
        )}
        style={themeStyles}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          {studioLogoUrl && (
            <img 
              src={studioLogoUrl} 
              alt={studioName || 'Logo do estúdio'} 
              className="h-[90px] sm:h-[108px] md:h-[135px] max-w-[250px] sm:max-w-[324px] md:max-w-[405px] object-contain mb-8" 
            />
          )}

          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-5">
            <Check className="h-7 w-7 text-primary" />
          </div>

          <h2 className="text-xl font-semibold text-foreground mb-2">
            Seleção Confirmada
          </h2>

          <p className="text-sm text-muted-foreground mb-6">
            {confirmedSelectedPhotos.length} {confirmedSelectedPhotos.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}
          </p>

          {gallery.sessionName && (
            <p 
              className="text-base font-normal text-muted-foreground mb-8"
              style={{ fontFamily: getFontFamilyById(gallery.settings.sessionFont) }}
            >
              {gallery.sessionName}
            </p>
          )}

          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            Sua galeria já foi finalizada. Para acessá-la novamente, entre em contato com o(a) fotógrafo(a).
          </p>
        </div>
      </div>
    );
  }

  // Modo COM download
  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col bg-background text-foreground",
        effectiveBackgroundMode === 'dark' && 'dark'
      )}
      style={themeStyles}
    >
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="flex items-center justify-center px-3 py-4">
          {studioLogoUrl && (
            <img 
              src={studioLogoUrl} 
              alt={studioName || 'Logo'} 
              className="h-9 max-w-[162px] object-contain"
            />
          )}
        </div>
        <div className="text-center py-2 border-t border-border/30">
          <p 
            className="text-sm font-medium"
            style={{ fontFamily: getFontFamilyById(gallery.settings.sessionFont) }}
          >
            {gallery.sessionName}
          </p>
          <p className="text-xs text-muted-foreground">Seleção confirmada</p>
        </div>
      </header>
      
      <main className="flex-1 p-4 space-y-6">
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Check className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-primary">
              Seleção Confirmada!
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Você selecionou {confirmedSelectedPhotos.length} fotos. 
            Para alterações, entre em contato com o fotógrafo.
          </p>
          
          {confirmedSelectedPhotos.length > 0 && (
            <Button
              onClick={() => setShowDownloadModal(true)}
              className="mt-4 gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar Fotos
            </Button>
          )}
        </div>

        {confirmedSelectedPhotos.length > 0 ? (
          <>
            <h3 className="font-medium text-sm text-muted-foreground">
              Suas fotos selecionadas ({confirmedSelectedPhotos.length})
            </h3>
            <MasonryGrid gap={photoSpacing}>
              {confirmedSelectedPhotos.map((photo, index) => (
                <MasonryItem key={photo.id} photoWidth={photo.width} photoHeight={photo.height}>
                  <div className="relative group cursor-pointer" onClick={() => setLightboxIndex(index)}>
                    <div className="overflow-hidden rounded-lg w-full">
                      <img 
                        src={photo.thumbnailUrl} 
                        alt={photo.filename}
                        className="w-full h-auto block"
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                    {photo.isFavorite && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive flex items-center justify-center shadow-md">
                        <svg className="h-3 w-3 text-destructive-foreground fill-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </div>
                    )}
                    {photo.comment && !photo.isFavorite && (
                      <div className="absolute top-2 right-2 bg-background/90 rounded-full p-1.5 shadow-sm">
                        <svg className="h-3 w-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </MasonryItem>
              ))}
            </MasonryGrid>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma foto foi selecionada.</p>
          </div>
        )}
      </main>

      {lightboxIndex !== null && (
        <Lightbox
          photos={confirmedSelectedPhotos}
          currentIndex={lightboxIndex}
          allowComments={false}
          allowDownload={gallery.settings.allowDownload}
          disabled={true}
          isConfirmedMode={true}
          galleryId={gallery.id}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onSelect={() => {}}
        />
      )}
      
      <DownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        photos={confirmedSelectedPhotos}
        sessionName={gallery.sessionName}
        galleryId={gallery.id}
        onViewIndividual={() => {
          setShowDownloadModal(false);
          if (confirmedSelectedPhotos.length > 0) {
            setLightboxIndex(0);
          }
        }}
      />
    </div>
  );
}

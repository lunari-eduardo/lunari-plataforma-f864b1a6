import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { getPhotoUrl, PhotoPaths } from '@/lib/photoUrl';
import { DeliverPhoto } from './DeliverPhotoGrid';

interface DeliverLightboxProps {
  photos: DeliverPhoto[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDownload: (photo: DeliverPhoto) => void;
}

export function DeliverLightbox({ photos, currentIndex, onClose, onNavigate, onDownload }: DeliverLightboxProps) {
  const photo = photos[currentIndex];
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, photos.length, onNavigate]);

  // Push history state so mobile back button closes lightbox
  const closedByPopstateRef = useRef(false);

  const handleManualClose = useCallback(() => {
    if (window.history.state?.lightbox) {
      closedByPopstateRef.current = true;
      window.history.back();
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    window.history.pushState({ lightbox: true }, '');

    const handlePopstate = () => {
      closedByPopstateRef.current = true;
      onClose();
    };

    window.addEventListener('popstate', handlePopstate);
    return () => {
      window.removeEventListener('popstate', handlePopstate);
      if (!closedByPopstateRef.current && window.history.state?.lightbox) {
        window.history.back();
      }
    };
  }, []);

  // Lock body scroll and listen to keyboard events
  useEffect(() => {
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleManualClose();
      }
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [handleManualClose, goPrev, goNext]);

  // Prefetch adjacent images for instant navigation
  useEffect(() => {
    const prefetchIndexes = [currentIndex - 1, currentIndex + 1].filter(
      (i) => i >= 0 && i < photos.length
    );

    prefetchIndexes.forEach((i) => {
      const p = photos[i];
      if (!p.mimeType?.startsWith('video/')) {
        const img = new Image();
        const pPaths: PhotoPaths = {
          storageKey: p.storageKey,
          previewPath: p.previewPath,
          width: p.width,
          height: p.height,
        };
        img.src = getPhotoUrl(pPaths, 'preview');
      }
    });
  }, [currentIndex, photos]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStart(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart !== null && e.changedTouches.length === 1) {
      const touchEnd = e.changedTouches[0].clientX;
      const diff = touchStart - touchEnd;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentIndex < photos.length - 1) {
          goNext();
        } else if (diff < 0 && currentIndex > 0) {
          goPrev();
        }
      }
      setTouchStart(null);
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleManualClose();
    }
  };

  if (!photo) return null;

  const paths: PhotoPaths = {
    storageKey: photo.storageKey,
    previewPath: photo.previewPath,
    width: photo.width,
    height: photo.height,
  };
  const url = getPhotoUrl(paths, 'preview');

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/35 backdrop-blur-2xl supports-[backdrop-filter]:bg-black/30 flex flex-col animate-fade-in select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 pt-[max(0.75rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/40 via-black/15 to-transparent z-10">
        <div className="flex items-center gap-3 md:gap-4">
          <span className="text-white/90 text-sm font-medium tracking-wide bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-sm">
            {currentIndex + 1} <span className="text-white/40 font-normal">/</span> {photos.length}
          </span>
          <span className="text-white/60 text-xs md:text-sm font-light tracking-wide truncate max-w-[160px] sm:max-w-[320px] md:max-w-[480px]">
            {photo.originalFilename || photo.filename}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDownload(photo)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs md:text-sm text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full transition-all active:scale-95 shadow-sm font-medium"
            title="Baixar mídia"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Baixar</span>
          </button>
          <button
            onClick={handleManualClose}
            className="h-9 w-9 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full transition-all active:scale-95 flex items-center justify-center shadow-sm"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 flex items-center justify-center p-2 md:p-6 relative overflow-hidden cursor-pointer"
        onClick={handleBackgroundClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation arrows */}
        {currentIndex > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 h-11 w-11 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white shadow-xl transition-all active:scale-95 z-20"
            title="Foto anterior"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 h-11 w-11 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white shadow-xl transition-all active:scale-95 z-20"
            title="Próxima foto"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Media Container */}
        <div 
          className="relative flex items-center justify-center max-w-full max-h-full"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleManualClose();
            }
          }}
        >
          {photo.mimeType?.startsWith('video/') ? (
            <div 
              className="relative inline-flex max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <video
                key={photo.id}
                src={url}
                controls
                autoPlay
                className="max-w-[calc(100vw-32px)] md:max-w-[calc(100vw-120px)] max-h-[calc(100vh-140px)] md:max-h-[calc(100vh-160px)] object-contain rounded-[2px] shadow-2xl drop-shadow-[0_25px_60px_rgba(0,0,0,0.7)] select-none"
                playsInline
              />
            </div>
          ) : (
            <div 
              className="relative inline-flex max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={url}
                alt={photo.originalFilename}
                className="max-w-[calc(100vw-32px)] md:max-w-[calc(100vw-120px)] max-h-[calc(100vh-140px)] md:max-h-[calc(100vh-160px)] object-contain rounded-[2px] shadow-2xl drop-shadow-[0_25px_60px_rgba(0,0,0,0.7)] select-none"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

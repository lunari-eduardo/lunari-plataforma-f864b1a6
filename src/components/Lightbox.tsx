import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  MessageSquare,
  ZoomIn,
  ZoomOut,
  Download,
  Heart,
  Loader2
} from 'lucide-react';
import { GalleryPhoto } from '@/types/gallery';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { getOriginalPhotoUrl } from '@/lib/photoUrl';
import { downloadPhoto } from '@/lib/downloadUtils';
import { toast } from 'sonner';

interface LightboxProps {
  photos: GalleryPhoto[];
  currentIndex: number;
  allowComments: boolean;
  allowDownload?: boolean;
  disabled?: boolean;
  isConfirmedMode?: boolean; // When true, shows original photos (no watermark) and enables download
  galleryId?: string; // Required for downloads when isConfirmedMode is true
  onClose: () => void;
  onNavigate: (index: number) => void;
  onSelect: (photoId: string) => void;
  onComment?: (photoId: string, comment: string) => void;
  onFavorite?: (photoId: string) => void;
}

export function Lightbox({ 
  photos, 
  currentIndex, 
  allowComments,
  allowDownload = false,
  disabled,
  isConfirmedMode = false,
  galleryId,
  onClose, 
  onNavigate,
  onSelect,
  onComment,
  onFavorite
}: LightboxProps) {
  const isMobile = useIsMobile();
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  
  // Desktop zoom state
  const [zoom, setZoom] = useState(1);

  // Mobile pinch-to-zoom refs (synchronous to avoid jumps)
  const scaleRef = useRef(1);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef(1);
  const isPinchingRef = useRef(false);
  const isFirstPinchFrameRef = useRef(true);

  // Mobile pan refs
  const positionRef = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);

  // Force re-render for ref-based state
  const [, forceUpdate] = useState({});

  const currentPhoto = photos[currentIndex];
  const [isDownloadingPhoto, setIsDownloadingPhoto] = useState(false);

  // ALWAYS use R2 (previewUrl) for display - both normal and confirmed mode
  // The watermark is burned-in during upload, so previews are already protected
  // Downloads use B2 (originalPath) via signed URLs - that's handled separately in handleDownload
  // NEVER try to access B2 directly from browser (CORS blocked)
  const displayUrl = currentPhoto?.previewUrl || currentPhoto?.originalUrl;

  // Utility function for clamping values
  const clamp = (value: number, min: number, max: number) => 
    Math.min(Math.max(value, min), max);

  // Calculate distance between two touch points
  const getDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleDownload = async () => {
    if (!currentPhoto || !allowDownload) return;
    
    // In confirmed mode with originalPath (B2 path) and galleryId, download original via signed URL
    // Note: originalPath is the B2 path set when allowDownload was true during upload
    const originalPath = (currentPhoto as GalleryPhoto & { originalPath?: string | null }).originalPath;
    
    if (isConfirmedMode && originalPath && galleryId) {
      setIsDownloadingPhoto(true);
      try {
        await downloadPhoto(
          galleryId,
          originalPath, // Use B2 path, not R2 storageKey
          currentPhoto.originalFilename || currentPhoto.filename
        );
      } catch (error) {
        console.error('Download error:', error);
        toast.error('Erro no download. Tente novamente.');
      } finally {
        setIsDownloadingPhoto(false);
      }
      return;
    }
    
    // If no originalPath but download is allowed, show error
    if (isConfirmedMode && !originalPath) {
      toast.error('Arquivo original não disponível para download.');
      return;
    }
    
    // Fallback: simple link download (preview URL) - for non-confirmed mode
    const link = document.createElement('a');
    link.href = currentPhoto.previewUrl;
    link.download = currentPhoto.originalFilename || currentPhoto.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prefetch adjacent images for instant navigation
  useEffect(() => {
    const prefetchIndexes = [currentIndex - 1, currentIndex + 1].filter(
      (i) => i >= 0 && i < photos.length
    );
    
    prefetchIndexes.forEach((i) => {
      const img = new Image();
      img.src = photos[i].previewUrl;
    });
  }, [currentIndex, photos]);

  // Reset state when changing photos
  useEffect(() => {
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    isPinchingRef.current = false;
    isPanningRef.current = false;
    initialPinchDistanceRef.current = null;
    isFirstPinchFrameRef.current = true;
    setComment(currentPhoto?.comment || '');
    setShowComment(false);
    setZoom(1);
    setTouchStart(null);
    forceUpdate({});
  }, [currentIndex, currentPhoto?.comment]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore keyboard shortcuts when user is typing in an input or textarea
    const activeElement = document.activeElement;
    const isTyping = activeElement?.tagName === 'INPUT' || 
                     activeElement?.tagName === 'TEXTAREA' ||
                     activeElement?.getAttribute('contenteditable') === 'true';
    
    if (e.key === 'Escape') {
      if (window.history.state?.lightbox) {
        closedByPopstateRef.current = true;
        window.history.back();
      }
      onClose();
    }
    
    // Only process navigation and selection shortcuts when not typing
    if (!isTyping) {
      if (e.key === 'ArrowLeft' && currentIndex > 0) onNavigate(currentIndex - 1);
      if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
      if (e.key === ' ' && !disabled) {
        e.preventDefault();
        onSelect(currentPhoto.id);
      }
    }
  }, [currentIndex, photos.length, currentPhoto?.id, disabled, onClose, onNavigate, onSelect]);

  // Push history state so mobile back button closes lightbox instead of navigating away
  const closedByPopstateRef = useRef(false);

  useEffect(() => {
    window.history.pushState({ lightbox: true }, '');

    const handlePopstate = () => {
      closedByPopstateRef.current = true;
      onClose();
    };

    window.addEventListener('popstate', handlePopstate);
    return () => {
      window.removeEventListener('popstate', handlePopstate);
      // If closing via cleanup (unmount) and we still have our history entry, remove it
      if (!closedByPopstateRef.current && window.history.state?.lightbox) {
        window.history.back();
      }
    };
  }, []); // intentionally empty – run once on mount

  // Block native browser gestures and keyboard handling
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    // Block native touch gestures on mobile
    const preventDefaultTouch = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('touchmove', preventDefaultTouch, { passive: false });
    document.body.style.touchAction = 'none';
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchmove', preventDefaultTouch);
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [handleKeyDown]);

  // Mobile touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Start pinch-to-zoom
      e.preventDefault();
      isPinchingRef.current = true;
      isFirstPinchFrameRef.current = true;
      initialPinchDistanceRef.current = getDistance(e.touches);
      initialScaleRef.current = scaleRef.current;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      
      if (scaleRef.current > 1) {
        // Pan mode when zoomed
        isPanningRef.current = true;
      } else {
        // Swipe navigation mode
        setTouchStart(touch.clientX);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinchingRef.current) {
      e.preventDefault();
      
      // First frame: only capture reference, no visual change
      if (isFirstPinchFrameRef.current) {
        initialPinchDistanceRef.current = getDistance(e.touches);
        isFirstPinchFrameRef.current = false;
        return;
      }
      
      const currentDistance = getDistance(e.touches);
      const initialDistance = initialPinchDistanceRef.current!;
      
      // Sensitivity factor (200px = 1x additional zoom)
      const sensitivity = 200;
      const delta = (currentDistance - initialDistance) / sensitivity;
      
      // Calculate new scale based on INITIAL value of gesture
      const newScale = clamp(initialScaleRef.current + delta, 1, 2);
      
      scaleRef.current = newScale;
      forceUpdate({});
    } else if (e.touches.length === 1 && isPanningRef.current && scaleRef.current > 1) {
      // Pan image when scale > 1
      e.preventDefault();
      
      const touch = e.touches[0];
      const dx = touch.clientX - lastTouchRef.current.x;
      const dy = touch.clientY - lastTouchRef.current.y;
      
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      
      // Limit pan to container size
      const maxPan = (scaleRef.current - 1) * 150;
      positionRef.current = {
        x: clamp(positionRef.current.x + dx, -maxPan, maxPan),
        y: clamp(positionRef.current.y + dy, -maxPan, maxPan),
      };
      
      forceUpdate({});
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPinchingRef.current) {
      isPinchingRef.current = false;
      initialPinchDistanceRef.current = null;
      isFirstPinchFrameRef.current = true;
      
      // If scale returned to ~1, reset position
      if (scaleRef.current <= 1.05) {
        scaleRef.current = 1;
        positionRef.current = { x: 0, y: 0 };
        forceUpdate({});
      }
      return;
    }
    
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }
    
    // Swipe navigation (only when scale === 1)
    if (touchStart !== null && e.changedTouches.length === 1 && scaleRef.current === 1) {
      const touchEnd = e.changedTouches[0].clientX;
      const diff = touchStart - touchEnd;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentIndex < photos.length - 1) {
          onNavigate(currentIndex + 1);
        } else if (diff < 0 && currentIndex > 0) {
          onNavigate(currentIndex - 1);
        }
      }
      setTouchStart(null);
    }
  };

  // Desktop zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (!isMobile) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom(z => clamp(z + delta, 1, 2));
    }
  };

  const handleSaveComment = () => {
    onComment?.(currentPhoto.id, comment);
    setShowComment(false);
  };

  const handleManualClose = useCallback(() => {
    if (window.history.state?.lightbox) {
      closedByPopstateRef.current = true;
      window.history.back();
    }
    onClose();
  }, [onClose]);

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleManualClose();
    }
  };

  if (!currentPhoto) return null;

  // Calculate image transform based on device
  const getImageTransform = () => {
    if (isMobile) {
      const scale = scaleRef.current;
      const pos = positionRef.current;
      if (scale === 1 && pos.x === 0 && pos.y === 0) {
        return undefined;
      }
      return `scale(${scale}) translate(${pos.x / scale}px, ${pos.y / scale}px)`;
    }
    return zoom > 1 ? `scale(${zoom})` : undefined;
  };

  const isGestureActive = isPinchingRef.current || isPanningRef.current;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/35 backdrop-blur-2xl supports-[backdrop-filter]:bg-black/30 flex flex-col animate-fade-in select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 pt-[max(0.75rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/40 via-black/15 to-transparent z-10">
        <div className="flex items-center gap-3 md:gap-4">
          <span className="text-white/90 text-sm font-medium tracking-wide bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-sm">
            {currentIndex + 1} <span className="text-white/40 font-normal">/</span> {photos.length}
          </span>
          <span className="text-white/60 text-xs md:text-sm font-light tracking-wide truncate max-w-[160px] sm:max-w-[320px] md:max-w-[480px]">
            {currentPhoto.originalFilename || currentPhoto.filename}
          </span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          {!isMobile && (
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md p-1 rounded-full border border-white/10 mr-1 shadow-sm">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-all"
                onClick={() => setZoom(z => Math.max(1, z - 0.25))}
                disabled={zoom <= 1}
                title="Diminuir zoom"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-all"
                onClick={() => setZoom(z => Math.min(2, z + 0.25))}
                disabled={zoom >= 2}
                title="Aumentar zoom"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full transition-all active:scale-95 shadow-sm"
            onClick={handleManualClose}
            title="Fechar (Esc)"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 flex items-center justify-center p-2 md:p-4 relative overflow-hidden cursor-pointer"
        onClick={handleBackgroundClick}
      >
        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 h-11 w-11 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white shadow-xl transition-all active:scale-95 z-20"
            title="Foto anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 h-11 w-11 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white shadow-xl transition-all active:scale-95 z-20"
            title="Próxima foto"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Image wrapper - clicking the empty wrapper space closes the lightbox */}
        <div 
          className="relative flex items-center justify-center overflow-hidden"
          style={{ 
            width: isMobile ? 'calc(100vw - 32px)' : 'calc(100vw - 120px)',
            height: isMobile ? 'calc(100vh - 140px)' : 'calc(100vh - 180px)',
            touchAction: 'none',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleManualClose();
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <div 
            className="relative inline-flex"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={displayUrl}
              alt={currentPhoto.filename}
              className="select-none rounded-[2px] drop-shadow-[0_25px_60px_rgba(0,0,0,0.7)]"
              draggable={false}
              style={{ 
                maxWidth: isMobile ? 'calc(100vw - 32px)' : 'calc(100vw - 120px)',
                maxHeight: isMobile ? 'calc(100vh - 140px)' : 'calc(100vh - 180px)',
                objectFit: 'contain',
                transform: getImageTransform(),
                transformOrigin: 'center center',
                transition: isGestureActive ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onContextMenu={(e) => e.preventDefault()}
            />
            {/* Invisible overlay to prevent image inspection/saving */}
            <div 
              className="absolute inset-0 z-[5]" 
              style={{ background: 'url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)' }}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 md:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/40 via-black/15 to-transparent z-10">
        <div className="flex items-center justify-center gap-2.5 md:gap-3 flex-wrap">
          <Button
            onClick={() => !disabled && onSelect(currentPhoto.id)}
            disabled={disabled}
            variant={currentPhoto.isSelected ? 'terracotta' : 'outline'}
            size={isMobile ? 'icon' : 'default'}
            className={cn(
              !isMobile && 'gap-2 px-5 py-2.5 font-medium shadow-lg backdrop-blur-md',
              currentPhoto.isSelected 
                ? 'shadow-[0_4px_20px_rgba(198,163,106,0.35)]'
                : 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white shadow-md'
            )}
          >
            <Check className="h-4 w-4" />
            {!isMobile && (currentPhoto.isSelected ? 'Selecionada' : 'Selecionar')}
          </Button>

          {onFavorite && (
            <Button
              onClick={() => !disabled && onFavorite(currentPhoto.id)}
              disabled={disabled}
              variant="outline"
              size={isMobile ? 'icon' : 'default'}
              className={cn(
                !isMobile && 'gap-2 px-4 shadow-md backdrop-blur-md',
                currentPhoto.isFavorite 
                  ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30' 
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white'
              )}
            >
              <Heart className={cn("h-4 w-4", currentPhoto.isFavorite && "fill-current")} />
              {!isMobile && (currentPhoto.isFavorite ? 'Favoritada' : 'Favoritar')}
            </Button>
          )}
          
          {allowComments && (
            <Button
              onClick={() => setShowComment(!showComment)}
              variant="outline"
              size={isMobile ? 'icon' : 'default'}
              className={cn(
                !isMobile && 'gap-2 px-4 shadow-md backdrop-blur-md',
                currentPhoto.comment 
                  ? 'bg-primary/20 text-primary border-primary/40 hover:bg-primary/30' 
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white'
              )}
            >
              <MessageSquare className="h-4 w-4" />
              {!isMobile && 'Comentar'}
            </Button>
          )}

          {allowDownload && isConfirmedMode && (
            <Button
              onClick={handleDownload}
              disabled={isDownloadingPhoto}
              variant="outline"
              size={isMobile ? 'icon' : 'default'}
              className={cn(
                !isMobile && 'gap-2 px-4 shadow-md backdrop-blur-md',
                'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white'
              )}
            >
              {isDownloadingPhoto ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {!isMobile && (isDownloadingPhoto ? 'Baixando...' : 'Baixar')}
            </Button>
          )}
        </div>

        {/* Comment Panel */}
        {showComment && (
          <div className="mt-4 max-w-md mx-auto animate-slide-up bg-black/40 backdrop-blur-xl border border-white/15 p-4 rounded-xl shadow-2xl">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Adicione um comentário sobre esta foto..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none focus-visible:ring-primary/50"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setShowComment(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="gallery-primary" 
                size="sm"
                onClick={handleSaveComment}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

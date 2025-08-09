import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { drawImageToCanvasAspect, loadImageFromFile, compressToJpeg } from '@/utils/imageUtils';

interface CropperModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}

// Limites
const MIN_SCALE = 1.0;
const MAX_SCALE = 4.0;

export default function CropperModal({ open, onOpenChange, file, onCancel, onConfirm }: CropperModalProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ dist: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (file) {
        try {
          const image = await loadImageFromFile(file);
          if (!mounted) return;
          setImg(image);
        } catch {
          // ignore
        }
      } else {
        setImg(null);
      }
    })();
    return () => { mounted = false; };
  }, [file]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    lastPtRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !lastPtRef.current) return;
    const dx = e.clientX - lastPtRef.current.x;
    const dy = e.clientY - lastPtRef.current.y;
    lastPtRef.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    lastPtRef.current = null;
  };

  // pinch-to-zoom básico com events de touch
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length === 2) {
        const [a, b] = ev.touches;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (!pinchRef.current) {
          pinchRef.current = { dist };
          return;
        }
        const delta = dist - pinchRef.current.dist;
        pinchRef.current.dist = dist;
        setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta / 200)));
      }
    };
    const onTouchEnd = () => { pinchRef.current = null; };

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY;
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta / 400)));
  };

  const confirm = async () => {
    if (!img) return;
    const canvas = drawImageToCanvasAspect(img, 4 / 5, offset.x, offset.y, scale);
    const dataUrl = await compressToJpeg(canvas, 1080, 0.7);
    onConfirm(dataUrl);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] p-4">
        <div className="space-y-3">
          <div className="text-sm font-medium">Recortar 4:5</div>
          <div
            ref={containerRef}
            className="relative select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
          >
            <AspectRatio ratio={4/5}>
              <div className="relative w-full h-full overflow-hidden bg-muted">
                {img && (
                  <img
                    src={img.src}
                    alt="Pré-visualização de recorte"
                    className="absolute"
                    style={{
                      left: `${offset.x}px`,
                      top: `${offset.y}px`,
                      width: `${img.naturalWidth * scale}px`,
                      height: `${img.naturalHeight * scale}px`,
                      objectFit: 'cover',
                    }}
                    draggable={false}
                  />
                )}
              </div>
            </AspectRatio>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
            <Button onClick={confirm}>Confirmar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

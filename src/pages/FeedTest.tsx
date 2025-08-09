import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Plus, Save, Trash, ImageUp } from 'lucide-react';
import CropperModal from '@/components/feed/CropperModal';
import { FeedStorage } from '@/services/FeedStorage';
import type { FeedImage } from '@/types/feed';
import { useToast } from '@/components/ui/use-toast';

export default function FeedTest() {
  const [images, setImages] = useState<FeedImage[]>(() => FeedStorage.load());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // mobile long press
  const [mobileDragId, setMobileDragId] = useState<string | null>(null);
  const pressTimer = useRef<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    document.title = 'Feed Test – Instagram-like feed 4:5';
    const desc = 'Página Feed Test com upload, recorte 4:5, compressão JPG, drag-and-drop e persistência em LocalStorage.';
    let meta = document.querySelector("meta[name='description']");
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
  }, []);

  // click fora para limpar seleção
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setSelectedId(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
        setCropperOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const openFilePicker = () => inputRef.current?.click();

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropperFile(file);
    setCropperOpen(true);
    // reset value to allow re-select same file
    e.currentTarget.value = '';
  };

  const insertAfterSelectedOrEnd = (dataUrl: string) => {
    setImages((prev) => {
      const newImg: FeedImage = {
        id: crypto.randomUUID(),
        url: dataUrl,
        ordem: prev.length, // default at end
        origem: 'upload',
        criadoEm: Date.now(),
      };

      let next = [...prev];
      const selIdx = selectedId ? next.findIndex((i) => i.id === selectedId) : -1;
      if (selIdx >= 0) {
        // insert after selected
        next.splice(selIdx + 1, 0, newImg);
        next = next.map((img, idx) => ({ ...img, ordem: idx }));
      } else {
        next.push(newImg);
        next = next.map((img, idx) => ({ ...img, ordem: idx }));
      }
      FeedStorage.save(next);
      return next;
    });
  };

  const handleCropConfirm = (dataUrl: string) => {
    insertAfterSelectedOrEnd(dataUrl);
    setCropperFile(null);
  };

  const handleReplace = (id: string) => {
    const doReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCropperFile(file);
      setCropperOpen(true);
      const unsub = (dataUrl: string) => {
        setImages((prev) => {
          const next: FeedImage[] = prev.map((img) =>
            img.id === id ? ({ ...img, url: dataUrl, origem: 'upload' as const, criadoEm: Date.now() } as FeedImage) : img
          );
          FeedStorage.save(next);
          return next;
        });
      };
      // intercept confirm once
      const prevConfirm = handleCropConfirmRef.current;
      handleCropConfirmRef.current = (du: string) => {
        unsub(du);
        handleCropConfirmRef.current = prevConfirm;
        setCropperFile(null);
      };
      e.currentTarget.value = '';
    };

    // open hidden input temporarily
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (ev: any) => doReplace(ev as any);
    input.click();
  };

  const handleDelete = (id: string) => {
    setImages((prev) => {
      const next = prev.filter((i) => i.id !== id).map((img, idx) => ({ ...img, ordem: idx }));
      FeedStorage.save(next);
      if (selectedId === id) setSelectedId(null);
      return next;
    });
  };

  const handleSaveSequence = () => {
    FeedStorage.save(images);
    toast({ title: 'Sequência salva', description: 'A ordem atual foi salva.' });
  };

  // Desktop DnD
  const onDragStart = (id: string, e: React.DragEvent) => {
    setDragId(id);
    e.dataTransfer.setData('text/plain', id);
  };
  const onDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const onDrop = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain') || dragId;
    if (!fromId || fromId === id) return;
    reorderByIds(fromId, id);
    setDragId(null);
    setDragOverId(null);
  };

  const reorderByIds = (fromId: string, toId: string) => {
    setImages((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((i) => i.id === fromId);
      const toIdx = arr.findIndex((i) => i.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      const next = arr.map((img, idx) => ({ ...img, ordem: idx }));
      FeedStorage.save(next);
      return next;
    });
  };

  // Mobile long-press reorder
  const onItemPointerDown = (id: string, e: React.PointerEvent) => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      setMobileDragId(id);
    }, 220);
  };
  const onItemPointerMove = (id: string, e: React.PointerEvent) => {
    if (!mobileDragId) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const item = target?.closest('[data-feed-id]') as HTMLElement | null;
    if (item) {
      const overId = item.getAttribute('data-feed-id');
      if (overId && overId !== dragOverId) setDragOverId(overId);
    }
  };
  const onItemPointerUp = (id: string, e: React.PointerEvent) => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    if (mobileDragId && dragOverId && mobileDragId !== dragOverId) {
      reorderByIds(mobileDragId, dragOverId);
    }
    setMobileDragId(null);
    setDragOverId(null);
  };

  const handleItemClick = (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };

  const handleKeyDown = (id: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleItemClick(id);
    }
  };

  // dynamic confirm for replace flow
  const handleCropConfirmRef = useRef<(du: string) => void>(handleCropConfirm);
  useEffect(() => { handleCropConfirmRef.current = handleCropConfirm; }, [handleCropConfirm]);

  return (
    <main className="w-full">
      <header className="sticky top-0 z-10 bg-background border-b border-lunar-border">
        <div className="mx-auto w-full max-w-[680px] px-[2px] py-2 flex items-center justify-between">
          <h1 className="text-base font-semibold">Feed Test</h1>
          <div className="flex items-center gap-2">
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
            <Button size="sm" onClick={openFilePicker}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={handleSaveSequence}>
              <Save className="h-4 w-4" />
              <span className="ml-2">Salvar Sequência</span>
            </Button>
          </div>
        </div>
      </header>

      <section ref={containerRef} className="mx-auto w-full max-w-[680px] px-[2px] bg-background">
        <div className="flex flex-col gap-[2px]">
          {images.map((item) => (
            <div
              key={item.id}
              data-feed-id={item.id}
              className="relative"
              draggable
              onDragStart={(e) => onDragStart(item.id, e)}
              onDragOver={(e) => onDragOver(item.id, e)}
              onDrop={(e) => onDrop(item.id, e)}
              onPointerDown={(e) => onItemPointerDown(item.id, e)}
              onPointerMove={(e) => onItemPointerMove(item.id, e)}
              onPointerUp={(e) => onItemPointerUp(item.id, e)}
              onClick={(e) => { e.stopPropagation(); handleItemClick(item.id); }}
              onKeyDown={(e) => handleKeyDown(item.id, e)}
              tabIndex={0}
            >
              <AspectRatio ratio={4/5}>
                <img src={item.url} alt={`Imagem do feed ${item.ordem + 1}`} className="w-full h-full object-cover" loading="lazy" draggable={false} />
              </AspectRatio>

              {selectedId === item.id && (
                <div className="absolute top-1 right-1 flex gap-1 z-10">
                  <button
                    aria-label="Excluir"
                    className="h-7 w-7 rounded bg-foreground/70 text-background grid place-items-center"
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Trocar foto"
                    className="h-7 w-7 rounded bg-foreground/70 text-background grid place-items-center"
                    onClick={(e) => { e.stopPropagation(); handleReplace(item.id); }}
                  >
                    <ImageUp className="h-4 w-4" />
                  </button>
                </div>
              )}

              {dragOverId === item.id && (
                <div className="absolute inset-0 ring-2 ring-primary pointer-events-none" />
              )}
            </div>
          ))}
        </div>
      </section>

      <CropperModal
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        file={cropperFile}
        onCancel={() => { setCropperOpen(false); setCropperFile(null); }}
        onConfirm={(du) => handleCropConfirmRef.current(du)}
      />
    </main>
  );
}

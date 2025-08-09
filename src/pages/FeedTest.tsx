import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Plus, Save, Trash, ImageUp, Settings, RotateCcw, Loader2 } from 'lucide-react';
import { FeedStorage } from '@/services/FeedStorage';
import type { FeedImage } from '@/types/feed';
import { useToast } from '@/components/ui/use-toast';
import { loadImageFromFile, compressToJpeg } from '@/utils/imageUtils';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
export default function FeedTest() {
  const [images, setImages] = useState<FeedImage[]>(() => FeedStorage.load());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // mobile long press + modo reorganização
  const [mobileDragId, setMobileDragId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState<boolean>(false);
  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [zoom, setZoom] = useState<number>(1);
  const pressTimer = useRef<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [igUsername, setIgUsername] = useState<string>('');
  const [isLoadingIg, setIsLoadingIg] = useState(false);
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

  // Instagram username from storage
  useEffect(() => {
    const saved = storage.load<string>(STORAGE_KEYS.FEED_INSTAGRAM_USERNAME, '');
    if (saved) setIgUsername(saved);
  }, []);

  // Auto-load Instagram on first visit if username is saved
  useEffect(() => {
    if (!igUsername) return;
    if (!images.some((i) => i.origem === 'instagram')) {
      handleReloadInstagram();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igUsername]);

  // responsividade e zoom
  const [deviceStateReady, setDeviceStateReady] = useState(false);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const next = w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
      setDevice(next as any);
    };
    compute();
    setDeviceStateReady(true);
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  useEffect(() => {
    if (!deviceStateReady) return;
    if (device === 'mobile') {
      setZoom(1);
      return;
    }
    const key = device === 'desktop' ? STORAGE_KEYS.FEED_ZOOM_DESKTOP : STORAGE_KEYS.FEED_ZOOM_TABLET;
    const defaults = device === 'desktop' ? 1 : 0.9;
    const saved = storage.load<number>(key, defaults);
    setZoom(saved);
  }, [device, deviceStateReady]);

  const zoomRange = useMemo(() => {
    if (device === 'desktop') return { min: 0.6, max: 1.3, step: 0.05 } as const;
    if (device === 'tablet') return { min: 0.75, max: 1.0, step: 0.05 } as const;
    return { min: 1, max: 1, step: 1 } as const;
  }, [device]);

  const setZoomPersist = (val: number) => {
    setZoom(val);
    if (device !== 'mobile') {
      const key = device === 'desktop' ? STORAGE_KEYS.FEED_ZOOM_DESKTOP : STORAGE_KEYS.FEED_ZOOM_TABLET;
      storage.save(key, val);
    }
  };

  const gridWidthStyle = useMemo(() => {
    if (device === 'desktop') return { width: `calc(min(33vw, 400px) * ${zoom})` } as React.CSSProperties;
    if (device === 'tablet') return { width: `calc(100vw * ${zoom})` } as React.CSSProperties;
    return undefined;
  }, [device, zoom]);

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

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    try {
      const dataUrls = await Promise.all(
        files.map(async (file) => {
          const img = await loadImageFromFile(file);
          return await compressToJpeg(img, 1080, 0.7);
        })
      );

      setImages((prev) => {
        const uploads = prev.filter((i) => i.origem !== 'instagram');
        const instagram = prev.filter((i) => i.origem === 'instagram');
        const newItems: FeedImage[] = dataUrls.map((du) => ({
          id: crypto.randomUUID(),
          url: du,
          ordem: 0,
          origem: 'upload',
          criadoEm: Date.now(),
        }));
        const uploadsNext = [...newItems, ...uploads];
        const combined = composeAndClamp([...uploadsNext, ...instagram]);
        FeedStorage.save(combined);
        return combined;
      });
    } finally {
      e.currentTarget.value = '';
    }
  };

  // Composition: uploads first (max 30), instagram after (max 9)
  function composeAndClamp(arr: FeedImage[]): FeedImage[] {
    const uploads = arr.filter((i) => i.origem !== 'instagram');
    const instagram = arr.filter((i) => i.origem === 'instagram');
    const uploadsLimited = uploads.slice(0, 30);
    const instagramLimited = instagram.slice(0, 9);
    return [...uploadsLimited, ...instagramLimited].map((img, idx) => ({ ...img, ordem: idx }));
  }

  async function imageUrlToDataUrl(url: string): Promise<string> {
    const res = await fetch(url, { cache: 'no-store' });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  const loadInstagram = async (username: string) => {
    setIsLoadingIg(true);
    try {
      const clean = username.replace(/^@+/, '');
      const urls = Array.from({ length: 9 }).map((_, i) => `https://picsum.photos/seed/${encodeURIComponent(clean)}-${i}/1080/1350.jpg`);
      const dataUrls = await Promise.all(urls.map((u) => imageUrlToDataUrl(u)));
      const newIgItems: FeedImage[] = dataUrls.map((du, idx) => ({
        id: crypto.randomUUID(),
        url: du,
        ordem: 0,
        origem: 'instagram',
        criadoEm: Date.now() - idx,
      }));
      setImages((prev) => {
        const withoutIg = prev.filter((i) => i.origem !== 'instagram');
        const next = composeAndClamp([...withoutIg, ...newIgItems]);
        FeedStorage.save(next);
        return next;
      });
      storage.save(STORAGE_KEYS.FEED_INSTAGRAM_USERNAME, username);
      toast({ title: 'Instagram carregado', description: 'Últimas 9 fotos atualizadas.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Falha ao carregar', description: 'Não foi possível buscar as fotos.' });
    } finally {
      setIsLoadingIg(false);
    }
  };

  const handleReloadInstagram = async () => {
    if (!igUsername) {
      setIsSettingsOpen(true);
      return;
    }
    await loadInstagram(igUsername);
  };

  const handleReplace = (id: string) => {
    const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const img = await loadImageFromFile(file);
      const dataUrl = await compressToJpeg(img, 1080, 0.7);
      setImages((prev) => {
        const updated: FeedImage[] = prev.map((img) =>
          img.id === id ? ({ ...img, url: dataUrl, origem: 'upload' as const, criadoEm: Date.now() } as FeedImage) : img
        );
        const recomposed = composeAndClamp(updated);
        FeedStorage.save(recomposed);
        return recomposed;
      });
      e.currentTarget.value = '';
    };

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (ev: any) => onChange(ev as any);
    input.click();
  };

  const handleDelete = (id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((i) => i.id !== id);
      const next = composeAndClamp(filtered);
      FeedStorage.save(next);
      if (selectedId === id) setSelectedId(null);
      return next;
    });
  };

  const handleSaveSequence = () => {
    const recomposed = composeAndClamp(images);
    setImages(recomposed);
    FeedStorage.save(recomposed);
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
      const next = composeAndClamp(arr);
      FeedStorage.save(next);
      return next;
    });
  };

  // Mobile long-press reorder + modo reorganização
  const onItemPointerDown = (id: string, e: React.PointerEvent) => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    if (device === 'mobile' && reorderMode) {
      e.preventDefault();
      setMobileDragId(id);
    } else {
      pressTimer.current = window.setTimeout(() => {
        setMobileDragId(id);
      }, 220);
    }
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

  return (
    <main className="w-full">
      <header className="sticky top-0 z-10 bg-background border-b border-lunar-border">
        <div className="mx-auto w-full max-w-[680px] px-[2px] py-2 flex items-center justify-between">
          <h1 className="text-base font-semibold">Feed Test</h1>
          <div className="flex items-center gap-2">
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelected} />
            <Button size="sm" onClick={openFilePicker} title="Adicionar fotos">
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={handleSaveSequence} title="Salvar ordem">
              <Save className="h-4 w-4" />
              <span className="ml-2">Salvar Sequência</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { if (igUsername) handleReloadInstagram(); else setIsSettingsOpen(true); }}
              disabled={isLoadingIg}
              title="Recarregar Instagram"
            >
              {isLoadingIg ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsSettingsOpen(true)} title="Configurações do Instagram">
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={reorderMode ? 'destructive' : 'outline'}
              className="md:hidden"
              onClick={() => {
                setReorderMode((prev) => {
                  const next = !prev;
                  if (prev) {
                    FeedStorage.save(composeAndClamp(images));
                    toast({ title: 'Ordem salva', description: 'Reorganização desativada.' });
                  }
                  return next;
                });
              }}
            >
              {reorderMode ? 'Concluir' : 'Reorganizar'}
            </Button>
          </div>
        </div>
      </header>

      <section ref={containerRef} className="w-full px-[2px] bg-background">
        <div className="mx-auto" style={gridWidthStyle as React.CSSProperties}>
          <div className="grid grid-cols-3 gap-[1px]">
            {images.map((item) => (
              <div
                key={item.id}
                data-feed-id={item.id}
                className={`relative transition-transform ${mobileDragId === item.id ? 'ring-2 ring-primary shadow-md scale-[0.98]' : ''}`}
                draggable
                onDragStart={(e) => onDragStart(item.id, e)}
                onDragOver={(e) => onDragOver(item.id, e)}
                onDrop={(e) => onDrop(item.id, e)}
                onPointerDown={(e) => onItemPointerDown(item.id, e)}
                onPointerMove={(e) => onItemPointerMove(item.id, e)}
                onPointerUp={(e) => onItemPointerUp(item.id, e)}
                onClick={(e) => { e.stopPropagation(); handleItemClick(item.id); }}
                onKeyDown={(e) => handleKeyDown(item.id, e)}
                onContextMenu={(e) => { if (reorderMode) e.preventDefault(); }}
                tabIndex={0}
              >
                <AspectRatio ratio={4/5}>
                  <img src={item.url} alt={`Imagem do feed ${item.ordem + 1}`} className="w-full h-full object-cover" loading="lazy" draggable={false} />
                </AspectRatio>

                {selectedId === item.id && !reorderMode && (
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
        </div>
      </section>
        {/* Zoom Controls (md+) */}
        <div className="hidden md:flex fixed bottom-3 left-3 z-20 items-center gap-2 rounded-full bg-foreground/70 text-background px-3 py-2 shadow-md">
          <button
            aria-label="Diminuir zoom"
            className="h-7 w-7 grid place-items-center rounded-full bg-background/20"
            onClick={() => setZoomPersist(Math.max(zoomRange.min, Math.round((zoom - zoomRange.step) * 100) / 100))}
          >
            −
          </button>
          <input
            type="range"
            min={zoomRange.min}
            max={zoomRange.max}
            step={zoomRange.step}
            value={zoom}
            onChange={(e) => setZoomPersist(parseFloat(e.currentTarget.value))}
            className="w-32 accent-background"
            style={{ accentColor: 'hsl(var(--background))' }}
          />
          <button
            aria-label="Aumentar zoom"
            className="h-7 w-7 grid place-items-center rounded-full bg-background/20"
            onClick={() => setZoomPersist(Math.min(zoomRange.max, Math.round((zoom + zoomRange.step) * 100) / 100))}
          >
            +
          </button>
        </div>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações do Instagram</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Usuário do Instagram</label>
            <Input
              value={igUsername}
              onChange={(e) => setIgUsername(e.currentTarget.value)}
              placeholder="@usuario"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Fechar</Button>
              <Button onClick={() => { storage.save(STORAGE_KEYS.FEED_INSTAGRAM_USERNAME, igUsername); handleReloadInstagram(); }}>
                {isLoadingIg ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Carregar do Instagram
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </main>
  );
}

import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Camera, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { uploadProposalImage } from './uploadImage';

interface EditableImageProps {
  value: string | null | undefined;
  onCommit: (url: string) => void;
  editable?: boolean;
  alt?: string;
  /** Rótulo exibido no estado vazio ("Foto A", "Capa"...) */
  label?: string;
  className?: string;
  imgClassName?: string;
  style?: React.CSSProperties;
  /** Classes do wrapper quando vazio no modo público (ex.: cor neutra) */
  publicEmptyClassName?: string;
  /** Modo "preencher" (padrão) ou fluxo natural (masonry usa h-auto) */
  fill?: boolean;
}

// ============================================================
// IMAGEM EDITÁVEL NA ARTE
// No editor: duplo clique abre o seletor de arquivos, faz o
// upload otimizado e comite a URL no mesmo caminho usado pela
// edição de texto (inline.set). Overlay no hover indica a ação.
// No público: renderiza a imagem (ou o placeholder neutro dado).
// ============================================================

export function EditableImage({
  value,
  onCommit,
  editable = false,
  alt = 'Imagem',
  label,
  className,
  imgClassName,
  style,
  publicEmptyClassName,
  fill = true,
}: EditableImageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const pick = (e: React.MouseEvent) => {
    e.stopPropagation();
    inputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadProposalImage(file);
      onCommit(url);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar imagem. Verifique a conexão e tente novamente.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const imgSrc = value || null;

  if (!editable) {
    if (imgSrc) {
      return (
        <img
          src={imgSrc}
          alt={alt}
          className={cn(className, imgClassName ?? 'w-full h-full object-cover')}
          style={style}
        />
      );
    }
    if (publicEmptyClassName) {
      return <div className={cn(className, publicEmptyClassName)} style={style} />;
    }
    return null;
  }

  return (
    <div
      className={cn('group/img', className)}
      style={style}
      onDoubleClick={pick}
      title="Duplo clique para trocar a imagem"
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={alt}
          className={cn(fill ? 'absolute inset-0 w-full h-full' : 'w-full', imgClassName ?? (fill ? 'object-cover' : 'h-auto'))}
          draggable={false}
        />
      ) : (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-primary/25 bg-primary/[0.03] text-primary/50 transition-colors group-hover/img:border-primary/50 group-hover/img:bg-primary/[0.06]',
            fill ? '' : 'relative py-10'
          )}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
          <span className="text-[10px] font-medium tracking-widest uppercase text-center px-2">
            {isUploading ? 'Enviando…' : label ? `${label} · duplo clique` : 'Enviar imagem'}
          </span>
        </div>
      )}

      {/* Overlay de hover com a ação */}
      {imgSrc && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 opacity-0 transition-opacity pointer-events-none group-hover/img:opacity-100">
          <span className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-[11px] font-semibold tracking-wide text-neutral-800 shadow-lg">
            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            {isUploading ? 'Enviando…' : 'Trocar imagem'}
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleUpload}
        disabled={isUploading}
      />
    </div>
  );
}

// ============================================================
// TILE "ADICIONAR FOTO" — exibido ao fim da galeria no editor
// ============================================================
export function AddImageTile({ 
  onAdd, 
  onAddMultiple,
  label = 'Adicionar foto' 
}: { 
  onAdd: (url: string) => void; 
  onAddMultiple?: (urls: string[]) => void;
  label?: string; 
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { uploadMultipleProposalImages } = require('./uploadImage');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    try {
      if (files.length > 1 && onAddMultiple) {
        const urls = await uploadMultipleProposalImages(files);
        onAddMultiple(urls);
      } else {
        const url = await uploadProposalImage(files[0]);
        onAdd(url);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar imagem. Verifique a conexão e tente novamente.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
      onDoubleClick={(e) => e.stopPropagation()}
      className="flex min-h-[120px] flex-col items-center justify-center gap-2 border-2 border-dashed border-white/25 text-white/40 transition-colors hover:border-white/60 hover:text-white/80"
      title={label}
    >
      {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
      <span className="text-[10px] font-medium tracking-widest uppercase">{isUploading ? 'Enviando…' : label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        multiple
        onChange={handleUpload}
        disabled={isUploading}
      />
    </button>
  );
}

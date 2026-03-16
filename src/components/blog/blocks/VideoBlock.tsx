import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link, Loader2, X } from 'lucide-react';
import { useR2Upload } from '@/hooks/useR2Upload';
import { toast } from 'sonner';

interface VideoBlockProps {
  videoUrl: string;
  onUpdate: (updates: { videoUrl?: string }) => void;
}

function getEmbedUrl(url: string): { type: 'iframe' | 'video'; src: string } | null {
  if (!url) return null;

  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return { type: 'iframe', src: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  if (url.match(/\.(mp4|webm|ogg|gif)(\?|$)/i)) {
    return { type: 'video', src: url };
  }

  if (url.startsWith('http')) {
    return { type: 'iframe', src: url };
  }

  return null;
}

export function VideoBlock({ videoUrl, onUpdate }: VideoBlockProps) {
  const [urlInput, setUrlInput] = useState(videoUrl);
  const { uploadFile, uploading } = useR2Upload({
    context: 'blog',
    onSuccess: (url) => {
      onUpdate({ videoUrl: url });
      setUrlInput(url);
      toast.success('Vídeo enviado com sucesso!');
    },
  });

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/') && !file.type.startsWith('image/gif')) {
      toast.error('Por favor, selecione um vídeo (MP4, WebM) ou GIF');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 50MB');
      return;
    }
    await uploadFile(file);
  }, [uploadFile]);

  const embed = getEmbedUrl(videoUrl);

  const removeVideo = () => {
    onUpdate({ videoUrl: '' });
    setUrlInput('');
  };

  if (videoUrl && embed) {
    return (
      <div className="space-y-3">
        <div className="relative group">
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            {embed.type === 'iframe' ? (
              <iframe
                src={embed.src}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={embed.src}
                className="w-full h-full object-contain"
                controls
                loop={videoUrl.endsWith('.gif')}
                autoPlay={videoUrl.endsWith('.gif')}
                muted={videoUrl.endsWith('.gif')}
              />
            )}
          </div>
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); removeVideo(); }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="url" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="url" className="gap-2">
          <Link className="h-4 w-4" />
          URL / YouTube
        </TabsTrigger>
        <TabsTrigger value="upload" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload
        </TabsTrigger>
      </TabsList>

      <TabsContent value="url" className="mt-3">
        <div className="space-y-2">
          <Label className="text-xs">URL do vídeo (YouTube, Vimeo, MP4, GIF)</Label>
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://youtube.com/watch?v=... ou URL direta"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && urlInput.trim()) {
                  onUpdate({ videoUrl: urlInput.trim() });
                }
              }}
            />
            <Button
              onClick={(e) => {
                e.stopPropagation();
                if (urlInput.trim()) onUpdate({ videoUrl: urlInput.trim() });
              }}
              disabled={!urlInput.trim()}
            >
              Adicionar
            </Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="upload" className="mt-3">
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'video/mp4,video/webm,image/gif';
            input.onchange = (ev) => {
              const file = (ev.target as HTMLInputElement).files?.[0];
              if (file) handleFileUpload(file);
            };
            input.click();
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Enviando para CDN...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Arraste um vídeo ou clique para selecionar
              </span>
              <span className="text-xs text-muted-foreground">
                MP4, WebM ou GIF até 50MB
              </span>
            </div>
          )}
        </div>
      </TabsContent>

      {videoUrl && !embed && (
        <p className="text-xs text-muted-foreground mt-2">
          URL não reconhecida. Suportados: YouTube, Vimeo, MP4, WebM, GIF.
        </p>
      )}
    </Tabs>
  );
}

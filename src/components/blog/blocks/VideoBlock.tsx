import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface VideoBlockProps {
  videoUrl: string;
  onUpdate: (updates: { videoUrl?: string }) => void;
}

/**
 * Extrai embed URL de YouTube/Vimeo
 */
function getEmbedUrl(url: string): { type: 'iframe' | 'video'; src: string } | null {
  if (!url) return null;

  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return { type: 'iframe', src: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  // Direct video/gif
  if (url.match(/\.(mp4|webm|ogg|gif)(\?|$)/i)) {
    return { type: 'video', src: url };
  }

  // Fallback: try as iframe
  if (url.startsWith('http')) {
    return { type: 'iframe', src: url };
  }

  return null;
}

export function VideoBlock({ videoUrl, onUpdate }: VideoBlockProps) {
  const embed = getEmbedUrl(videoUrl);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs">URL do vídeo (YouTube, Vimeo, MP4, GIF)</Label>
        <Input
          value={videoUrl}
          onChange={(e) => onUpdate({ videoUrl: e.target.value })}
          placeholder="https://youtube.com/watch?v=... ou URL direta"
        />
      </div>

      {embed && (
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
      )}

      {!embed && videoUrl && (
        <p className="text-xs text-muted-foreground">
          URL não reconhecida. Suportados: YouTube, Vimeo, MP4, WebM, GIF.
        </p>
      )}
    </div>
  );
}

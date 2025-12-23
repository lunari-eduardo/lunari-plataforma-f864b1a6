import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ImageBlockProps {
  imageUrl: string;
  imageCaption: string;
  imageAlt: string;
  onUpdate: (updates: { imageUrl?: string; imageCaption?: string; imageAlt?: string }) => void;
}

export function ImageBlock({ imageUrl, imageCaption, imageAlt, onUpdate }: ImageBlockProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState(imageUrl);
  const { user } = useAuth();

  const handleFileUpload = useCallback(async (file: File) => {
    if (!user) {
      toast.error('Você precisa estar logado para fazer upload');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas imagens');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('blog-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('blog-images')
        .getPublicUrl(fileName);

      onUpdate({ imageUrl: publicUrl });
      setUrlInput(publicUrl);
      toast.success('Imagem enviada com sucesso!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setIsUploading(false);
    }
  }, [user, onUpdate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onUpdate({ imageUrl: urlInput.trim() });
    }
  };

  const removeImage = () => {
    onUpdate({ imageUrl: '', imageCaption: '', imageAlt: '' });
    setUrlInput('');
  };

  if (imageUrl) {
    return (
      <div className="space-y-3">
        <div className="relative group">
          <img
            src={imageUrl}
            alt={imageAlt || 'Imagem do blog'}
            className="w-full rounded-lg object-cover max-h-[400px]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={removeImage}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Texto alternativo (SEO)</Label>
            <Input
              value={imageAlt}
              onChange={(e) => onUpdate({ imageAlt: e.target.value })}
              placeholder="Descreva a imagem..."
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Legenda</Label>
            <Input
              value={imageCaption}
              onChange={(e) => onUpdate({ imageCaption: e.target.value })}
              placeholder="Legenda da imagem..."
              className="text-sm font-body italic"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="upload" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload
        </TabsTrigger>
        <TabsTrigger value="url" className="gap-2">
          <Link className="h-4 w-4" />
          URL
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="upload" className="mt-3">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFileUpload(file);
            };
            input.click();
          }}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Enviando...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Arraste uma imagem ou clique para selecionar
              </span>
              <span className="text-xs text-muted-foreground">
                PNG, JPG ou WebP até 5MB
              </span>
            </div>
          )}
        </div>
      </TabsContent>
      
      <TabsContent value="url" className="mt-3">
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://exemplo.com/imagem.jpg"
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
          />
          <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
            Adicionar
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}

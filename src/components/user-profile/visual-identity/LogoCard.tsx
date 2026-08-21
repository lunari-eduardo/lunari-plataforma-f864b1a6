import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, Loader2, LucideIcon, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface LogoCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  currentUrl?: string | null;
  fallbackUrl?: string | null;
  isInherited?: boolean;
  inheritedLabel?: string;
  dimensionsRecommendation?: string;
  formatRecommendation?: string;
  maxSizeRecommendation?: string;
  aspectRatioLabel?: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function LogoCard({
  title,
  description,
  icon: Icon,
  badge,
  badgeVariant = 'secondary',
  currentUrl,
  fallbackUrl,
  isInherited = false,
  inheritedLabel = 'Usando logotipo principal',
  dimensionsRecommendation = '512x512px ou superior',
  formatRecommendation = 'PNG com fundo transparente, JPG ou WEBP',
  maxSizeRecommendation = 'Até 5MB',
  onUpload,
  onRemove,
  disabled = false,
  className,
}: LogoCardProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = currentUrl || (isInherited ? fallbackUrl : null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Formato de arquivo inválido. Use PNG, JPG, WEBP ou SVG.');
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      toast.error('O arquivo não pode ultrapassar 5MB.');
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar imagem.');
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemove();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover imagem.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Card className={cn("border border-border/60 bg-card/50 transition-all hover:border-border/80 shadow-xs", className)}>
      <CardContent className="p-5 sm:p-6 space-y-5">
        {/* Cabeçalho do Card */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base font-semibold text-foreground tracking-tight">{title}</h4>
                {badge && (
                  <Badge variant={badgeVariant} className="text-[11px] font-normal py-0 px-2">
                    {badge}
                  </Badge>
                )}
                {isInherited && !currentUrl && fallbackUrl && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/60 py-0">
                    {inheritedLabel}
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        </div>

        {/* Área de Preview e Ações */}
        <div className="flex flex-col md:flex-row items-center gap-5 p-4 rounded-xl bg-muted/20 border border-border/40">
          {/* Container da Imagem com Fundo Xadrez para Transparência */}
          <div className="relative w-full md:w-48 h-24 rounded-lg border border-border/60 flex items-center justify-center overflow-hidden shrink-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:8px_8px] bg-background/90 shadow-inner">
            {displayUrl ? (
              <img
                src={displayUrl}
                alt={title}
                className="max-h-[85%] max-w-[85%] object-contain drop-shadow-sm transition-all"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground gap-1 p-2">
                <ImageIcon className="w-6 h-6 stroke-[1.5] opacity-50" />
                <span className="text-[11px] font-medium text-center">Nenhum logo enviado</span>
              </div>
            )}

            {isInherited && !currentUrl && fallbackUrl && (
              <div className="absolute top-1.5 right-1.5 bg-background/80 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] font-medium text-muted-foreground border border-border/40">
                Padrão
              </div>
            )}
          </div>

          {/* Ações e Status */}
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-foreground">
                  {currentUrl
                    ? 'Logotipo personalizado ativo'
                    : isInherited && fallbackUrl
                    ? 'Herdando do Logotipo Principal'
                    : 'Nenhum arquivo enviado'}
                </p>
                {displayUrl && (
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500" title="Ativo" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {currentUrl
                  ? 'Este arquivo substitui a logomarca padrão nesta área'
                  : isInherited && fallbackUrl
                  ? 'Para utilizar uma versão diferente, envie um arquivo específico abaixo'
                  : 'Envie um arquivo para personalizar esta área'}
              </p>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {currentUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemove}
                  disabled={isRemoving || isUploading || disabled}
                  className="text-xs h-9 text-destructive hover:bg-destructive/10 hover:text-destructive border-border/70"
                >
                  {isRemoving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Remover
                </Button>
              )}

              <Button
                type="button"
                variant={currentUrl ? "outline" : "default"}
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isRemoving || disabled}
                className="text-xs h-9 font-medium"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {currentUrl ? 'Substituir' : 'Enviar Logotipo'}
                  </>
                )}
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml,image/x-icon"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading || disabled}
              />
            </div>
          </div>
        </div>

        {/* Guia de Recomendações Técnicas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="text-primary">•</span>
            <span>Formatos: {formatRecommendation}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-primary">•</span>
            <span>Recomendado: {dimensionsRecommendation}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-primary">•</span>
            <span>Tamanho: {maxSizeRecommendation}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

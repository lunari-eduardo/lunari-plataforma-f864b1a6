import { useMemo } from 'react';
import { resolveGalleryColorTokens } from '@/components/gallery/themes/tokens';
import { GlobalSettings } from '@/types/gallery';
import { Check, Sparkles, Image as ImageIcon } from 'lucide-react';

interface GalleryThemePreviewBlockProps {
  settings: GlobalSettings;
  studioName?: string;
  studioLogoUrl?: string;
  borderRadius?: string;
  gap?: number;
}

/**
 * Preview compacto e elegante que simula como a galeria será exibida para o cliente
 * com o tema, modo e cor configurados.
 */
export function GalleryThemePreviewBlock({
  settings,
  studioName,
  studioLogoUrl,
  borderRadius = '0px',
  gap = 6,
}: GalleryThemePreviewBlockProps) {
  const clientMode = settings.clientTheme === 'system' ? 'light' : (settings.clientTheme || 'light');
  const isDark = clientMode === 'dark';

  const primaryColor = settings.customTheme?.primaryColor || '#D1BE9F';

  const tokens = useMemo(
    () => resolveGalleryColorTokens(clientMode as 'light' | 'dark', primaryColor),
    [clientMode, primaryColor]
  );

  const bg = tokens['--gallery-bg'];
  const bgElevated = tokens['--gallery-bg-elevated'];
  const text = tokens['--gallery-text'];
  const textMuted = tokens['--gallery-text-muted'];
  const primary = tokens['--gallery-primary'];
  const primaryFg = tokens['--gallery-primary-fg'];
  const border = tokens['--gallery-border'];

  return (
    <div className="lunari-card p-5 space-y-4 shadow-sm border-border/70">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold tracking-tight text-foreground">Preview da Galeria</p>
          <p className="text-[11px] text-muted-foreground">Simulação em tempo real para o cliente</p>
        </div>
        <span
          className="text-[11px] px-2.5 py-1 rounded-full font-medium flex items-center gap-1 shadow-2xs border"
          style={{
            backgroundColor: bgElevated,
            color: text,
            borderColor: border,
          }}
        >
          {isDark ? '🌙 Escuro' : '☀️ Claro'}
        </span>
      </div>

      {/* Frame da Galeria (Browser/Device Mockup) */}
      <div
        className="rounded-xl overflow-hidden border shadow-inner transition-all duration-300 flex flex-col min-h-[300px]"
        style={{ backgroundColor: bg, borderColor: border }}
      >
        {/* Header do Mockup */}
        <div
          className="px-3.5 py-2.5 flex items-center justify-between border-b"
          style={{ backgroundColor: bgElevated, borderColor: border }}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {studioLogoUrl ? (
              <img
                src={studioLogoUrl}
                alt={studioName || 'Studio'}
                className="h-4 max-w-[70px] object-contain"
              />
            ) : (
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primary }} />
                <span
                  className="text-xs font-serif font-semibold tracking-wide truncate"
                  style={{ color: text }}
                >
                  {studioName || 'Lunari Studio'}
                </span>
              </div>
            )}
          </div>
          <div
            className="text-[9px] tracking-widest uppercase font-mono px-2 py-0.5 rounded"
            style={{ color: textMuted, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
          >
            Seleção
          </div>
        </div>

        {/* Mock photo grid */}
        <div 
          className="p-3.5 grid grid-cols-2 flex-1"
          style={{ gap: `${gap}px` }}
        >
          {/* Foto 1 (Selecionada) */}
          <div
            className="relative overflow-hidden group shadow-2xs transition-transform duration-200"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #252422 0%, #1c1b1a 100%)'
                : 'linear-gradient(135deg, #ebe7e0 0%, #ded9cf 100%)',
              aspectRatio: '4/5',
              borderRadius: borderRadius,
              border: `1.5px solid ${primary}`,
            }}
          >
            {/* Imagem Placeholder Fictícia */}
            <div className="absolute inset-0 flex items-center justify-center opacity-25">
              <ImageIcon className="w-6 h-6" style={{ color: text }} />
            </div>
            
            {/* Badge de Selecionado com a Cor Primária */}
            <div
              className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-in zoom-in-75 duration-200"
              style={{ backgroundColor: primary, color: primaryFg }}
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </div>

            <div 
              className="absolute bottom-1.5 left-2 text-[9px] font-mono tracking-tight font-medium"
              style={{ color: textMuted }}
            >
              #01
            </div>
          </div>

          {/* Foto 2 */}
          <div
            className="relative overflow-hidden group shadow-2xs"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #222120 0%, #181716 100%)'
                : 'linear-gradient(135deg, #e4e0d8 0%, #d8d3c7 100%)',
              aspectRatio: '4/5',
              borderRadius: borderRadius,
              border: `1px solid ${border}`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <ImageIcon className="w-6 h-6" style={{ color: text }} />
            </div>

            <div 
              className="absolute bottom-1.5 left-2 text-[9px] font-mono tracking-tight font-medium"
              style={{ color: textMuted }}
            >
              #02
            </div>
          </div>
        </div>

        {/* Footer / CTA Bar da Galeria */}
        <div
          className="px-3.5 py-2.5 flex items-center justify-between border-t mt-auto shadow-2xs"
          style={{ backgroundColor: bgElevated, borderColor: border }}
        >
          <div>
            <div className="text-[11px] font-medium leading-none" style={{ color: text }}>
              1 foto selecionada
            </div>
            <div className="text-[9px] mt-0.5" style={{ color: textMuted }}>
              Mínimo de 10 fotos
            </div>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-[11px] font-semibold tracking-wide shadow-xs transition-opacity hover:opacity-90 active:scale-95 duration-150 cursor-default"
            style={{ backgroundColor: primary, color: primaryFg }}
          >
            Confirmar Seleção
          </button>
        </div>
      </div>

      {/* Paleta de Cores e Tokens */}
      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Paleta ativa:</span>
          <div className="flex items-center -space-x-1">
            <div
              className="w-4 h-4 rounded-full border shadow-2xs"
              style={{ backgroundColor: bg, borderColor: border }}
              title={`Fundo (${bg})`}
            />
            <div
              className="w-4 h-4 rounded-full border shadow-2xs"
              style={{ backgroundColor: bgElevated, borderColor: border }}
              title={`Superfície (${bgElevated})`}
            />
            <div
              className="w-4 h-4 rounded-full border shadow-2xs ring-1 ring-background"
              style={{ backgroundColor: primary, borderColor: border }}
              title={`Cor Primária (${primary})`}
            />
          </div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          {primary}
        </span>
      </div>
    </div>
  );
}

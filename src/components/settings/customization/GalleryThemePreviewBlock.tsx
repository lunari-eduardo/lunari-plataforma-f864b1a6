import { useMemo } from 'react';
import { resolveGalleryColorTokens } from '@/components/gallery/themes/tokens';
import { GlobalSettings } from '@/types/gallery';

interface GalleryThemePreviewBlockProps {
  settings: GlobalSettings;
  studioName?: string;
  studioLogoUrl?: string;
  borderRadius?: string;
  gap?: number;
}

/**
 * Preview compacto que mostra como a galeria vai aparecer para o cliente
 * com o tema, modo e cor configurados atualmente.
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

  const primaryColor = settings.customTheme?.primaryColor || '#C6A36A';

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
    <div className="lunari-card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Preview da Galeria</p>
      </div>

      {/* Preview Container */}
      <div
        className="rounded-lg overflow-hidden border transition-all duration-300 flex flex-col"
        style={{ backgroundColor: bg, borderColor: border }}
      >
        {/* Header */}
        <div
          className="px-3 py-2 flex items-center justify-between border-b"
          style={{ backgroundColor: bgElevated, borderColor: border }}
        >
          <div className="flex items-center gap-2">
            {studioLogoUrl ? (
              <img
                src={studioLogoUrl}
                alt={studioName || 'Studio'}
                className="h-4 max-w-[60px] object-contain"
              />
            ) : (
              <span
                className="text-xs font-semibold tracking-wide"
                style={{ color: text }}
              >
                {studioName || 'Nome do Estúdio'}
              </span>
            )}
          </div>
          <div
            className="text-[10px] tracking-widest uppercase"
            style={{ color: textMuted }}
          >
            Seleção
          </div>
        </div>

        {/* Fake photo grid - Only 2 columns, 1 row */}
        <div 
          className="p-3 grid grid-cols-2"
          style={{ gap: `${gap}px` }}
        >
          {[4, 5].map((ratio, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: isDark ? '#2A2A2A' : '#E8E4DF',
                aspectRatio: `${ratio}/5`,
                borderRadius: borderRadius,
              }}
            />
          ))}
        </div>

        {/* Footer / CTA Bar */}
        <div
          className="px-3 py-2 flex items-center justify-between border-t mt-auto"
          style={{ backgroundColor: bgElevated, borderColor: border }}
        >
          <div>
            <div className="text-[10px] font-medium" style={{ color: text }}>
              2 selecionadas
            </div>
          </div>
          <button
            className="px-2 py-1 rounded text-[10px] font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: primary, color: primaryFg }}
          >
            Confirmar
          </button>
        </div>
      </div>

      {/* Paleta de cores resumida */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full border"
              style={{ backgroundColor: bg, borderColor: border }}
              title="Fundo"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full border"
              style={{ backgroundColor: primary, borderColor: border }}
              title="Cor Primária"
            />
          </div>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: isDark ? '#2A2A2A' : '#E8E4DF',
            color: textMuted,
          }}
        >
          {isDark ? '🌙 Escuro' : '☀️ Claro'}
        </span>
      </div>
    </div>
  );
}

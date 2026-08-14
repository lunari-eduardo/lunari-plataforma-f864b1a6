import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { resolveGalleryColorTokens } from '@/components/gallery/themes/tokens';
import { GlobalSettings } from '@/types/gallery';

interface GalleryThemePreviewBlockProps {
  settings: GlobalSettings;
  studioName?: string;
  studioLogoUrl?: string;
}

/**
 * Preview compacto que mostra como a galeria vai aparecer para o cliente
 * com o tema, modo e cor configurados atualmente.
 */
export function GalleryThemePreviewBlock({
  settings,
  studioName,
  studioLogoUrl,
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
    <div className="lunari-card p-6 space-y-4">
      <div>
        <p className="text-base font-medium text-foreground">Preview da Galeria do Cliente</p>
        <p className="text-sm text-muted-foreground mt-1">
          Visualização aproximada de como a galeria aparece para o cliente com as configurações atuais.
        </p>
      </div>

      {/* Preview Container */}
      <div
        className="rounded-lg overflow-hidden border transition-all duration-300"
        style={{ backgroundColor: bg, borderColor: border }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between border-b"
          style={{ backgroundColor: bgElevated, borderColor: border }}
        >
          <div className="flex items-center gap-3">
            {studioLogoUrl ? (
              <img
                src={studioLogoUrl}
                alt={studioName || 'Studio'}
                className="h-6 max-w-[80px] object-contain"
              />
            ) : (
              <span
                className="text-sm font-semibold tracking-wide"
                style={{ color: text }}
              >
                {studioName || 'Nome do Estúdio'}
              </span>
            )}
          </div>
          <div
            className="text-xs tracking-widest uppercase"
            style={{ color: textMuted }}
          >
            Galeria de Seleção
          </div>
        </div>

        {/* Fake photo grid */}
        <div className="p-3 grid grid-cols-3 gap-1.5">
          {[4, 3, 5, 3, 4, 4].map((ratio, idx) => (
            <div
              key={idx}
              className="rounded-sm"
              style={{
                backgroundColor: isDark ? '#2A2A2A' : '#E8E4DF',
                aspectRatio: `${ratio}/5`,
              }}
            />
          ))}
        </div>

        {/* Footer / CTA Bar */}
        <div
          className="px-4 py-3 flex items-center justify-between border-t"
          style={{ backgroundColor: bgElevated, borderColor: border }}
        >
          <div>
            <div className="text-xs font-medium" style={{ color: text }}>
              4 fotos selecionadas
            </div>
            <div className="text-xs" style={{ color: textMuted }}>
              Pacote inclui 50 fotos
            </div>
          </div>
          <button
            className="px-4 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: primary, color: primaryFg }}
          >
            Confirmar Seleção
          </button>
        </div>
      </div>

      {/* Paleta de cores resumida */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full border"
            style={{ backgroundColor: bg, borderColor: border }}
            title="Fundo"
          />
          <span className="text-xs text-muted-foreground">Fundo</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full border"
            style={{ backgroundColor: primary, borderColor: border }}
            title="Cor Primária"
          />
          <span className="text-xs text-muted-foreground">Primária</span>
          <code className="text-xs text-muted-foreground font-mono">{primaryColor}</code>
        </div>
        <div className="ml-auto">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: isDark ? '#2A2A2A' : '#E8E4DF',
              color: textMuted,
            }}
          >
            {isDark ? '🌙 Escuro' : '☀️ Claro'}
          </span>
        </div>
      </div>
    </div>
  );
}

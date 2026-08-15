import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { FontSelect } from '@/components/FontSelect';
import { TitleCaseMode } from '@/types/gallery';
import { ThemeConfig } from '@/components/settings/ThemeConfig';
import { CoverConfig } from '@/components/settings/CoverConfig';
import { WatermarkSettings } from '@/components/settings/WatermarkSettings';
import { GalleryThemePreviewBlock } from '@/components/settings/customization/GalleryThemePreviewBlock';
import { GlobalSettings } from '@/types/gallery';
import { UpdateSettingsOptions } from '@/hooks/useGallerySettings';

interface CustomizationAppearanceTabProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>, options?: UpdateSettingsOptions) => void;
  studioLogoUrl?: string;
  studioName?: string;
}

// Paleta de sugestão de cores da identidade Lunari para uso no picker
const SUGGESTED_COLORS = [
  { label: 'Dourado Lunari', value: '#D1BE9F' },
  { label: 'Dourado Suave', value: '#D4B98A' },
  { label: 'Grafite', value: '#171717' },
  { label: 'Off-White', value: '#FAF9F7' },
  { label: 'Terracota', value: '#d97757' },
  { label: 'Vinho', value: '#7C2D4B' },
  { label: 'Azul Safira', value: '#2A4B8D' },
  { label: 'Verde Sálvia', value: '#5A7A64' },
];

export function CustomizationAppearanceTab({
  settings,
  updateSettings,
  studioLogoUrl,
  studioName,
}: CustomizationAppearanceTabProps) {
  const [sessionFont, setSessionFont] = useState('playfair');
  const [titleCaseMode, setTitleCaseMode] = useState<TitleCaseMode>('normal');
  const [localPhotoSpacing, setLocalPhotoSpacing] = useState<number>(6);
  const [localPrimaryColor, setLocalPrimaryColor] = useState(
    settings.customTheme?.primaryColor || '#D1BE9F'
  );
  const [themeModeOption, setThemeModeOption] = useState<'padrao' | 'custom'>(
    settings.customTheme?.primaryColor && settings.customTheme.primaryColor !== '#D1BE9F' ? 'custom' : 'padrao'
  );

  const userTouchedTypographyRef = useRef(false);

  useEffect(() => {
    if (settings) {
      setLocalPhotoSpacing(settings.defaultPhotoSpacing ?? 6);
      const color = settings.customTheme?.primaryColor || '#D1BE9F';
      setLocalPrimaryColor(color);
      setThemeModeOption(color.toUpperCase() !== '#D1BE9F' ? 'custom' : 'padrao');

      if (!userTouchedTypographyRef.current) {
        if (settings.lastSessionFont) {
          setSessionFont(settings.lastSessionFont);
        }
      }
    }
  }, [settings]);

  const handleFontChange = (newFont: string) => {
    userTouchedTypographyRef.current = true;
    setSessionFont(newFont);
    updateSettings({ lastSessionFont: newFont }, { successMessage: 'Fonte padrão atualizada.' });
  };

  const handlePrimaryColorChange = (color: string) => {
    setLocalPrimaryColor(color);
    const currentCustom = settings.customTheme || {
      id: 'custom', name: 'Custom', backgroundMode: 'light',
      accentColor: color, emphasisColor: color,
    };
    updateSettings({
      themeType: 'custom',
      customTheme: { ...currentCustom, primaryColor: color },
    }, { successMessage: 'Cor primária salva.' });
  };

  const currentRadius = settings.themeOverrides?.surface?.borderRadius || '0px';

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-8 space-y-6 lg:space-y-0">
      
      {/* Coluna Principal - Controles */}
      <div className="lg:col-span-8 space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-medium">Aparência da Galeria do Cliente</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Essas configurações são aplicadas em todas as novas galerias. Galerias individuais podem sobrescrever essas preferências.
          </p>
        </div>

        {/* Modo Claro / Escuro */}
        <div className="lunari-card p-6 space-y-4">
          <div>
            <Label className="text-base font-medium">Modo Visual da Galeria</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Define como as galerias são exibidas para os seus clientes
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => updateSettings({ clientTheme: 'light' }, { successMessage: 'Modo Claro ativado.' })}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                settings.clientTheme === 'light'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:border-foreground/30'
              }`}
            >
              <Sun className="h-4 w-4" />
              Claro
            </button>
            <button
              onClick={() => updateSettings({ clientTheme: 'dark' }, { successMessage: 'Modo Escuro ativado.' })}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                settings.clientTheme === 'dark'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:border-foreground/30'
              }`}
            >
              <Moon className="h-4 w-4" />
              Escuro
            </button>
            <button
              onClick={() => updateSettings({ clientTheme: 'system' }, { successMessage: 'Modo Automático ativado.' })}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                (settings.clientTheme === 'system' || !settings.clientTheme)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:border-foreground/30'
              }`}
            >
              <Monitor className="h-4 w-4" />
              Automático
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {settings.clientTheme === 'system'
              ? 'A galeria segue a preferência do dispositivo do cliente (claro ou escuro automaticamente).'
              : settings.clientTheme === 'dark'
              ? 'A galeria sempre abre no modo escuro para os clientes.'
              : 'A galeria sempre abre no modo claro para os clientes.'}
          </p>
        </div>

        {/* Cor Primária */}
        <div className="lunari-card p-6 space-y-4">
          <div>
            <Label className="text-base font-medium">Cor Primária (Botões de Ação)</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Cor usada nos botões de confirmação, destaques e elementos interativos da galeria do cliente
            </p>
          </div>

          {/* Cartões Padrão Lunari vs Personalizado */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                setThemeModeOption('padrao');
                handlePrimaryColorChange('#D1BE9F');
              }}
              className={`p-4 rounded-xl border text-left transition-all ${
                themeModeOption === 'padrao'
                  ? 'border-primary ring-1 ring-primary/20 bg-primary/5'
                  : 'border-border hover:border-foreground/30 bg-background'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-4 h-4 rounded-full bg-[#D1BE9F] shadow-sm" />
                <span className="font-semibold text-sm">Padrão Lunari</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cor dourada fosca exclusiva e elegante.
              </p>
            </button>

            <button
              onClick={() => setThemeModeOption('custom')}
              className={`p-4 rounded-xl border text-left transition-all ${
                themeModeOption === 'custom'
                  ? 'border-primary ring-1 ring-primary/20 bg-primary/5'
                  : 'border-border hover:border-foreground/30 bg-background'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex -space-x-1">
                  <div className="w-4 h-4 rounded-full bg-slate-800 border-2 border-background z-10" />
                  <div className="w-4 h-4 rounded-full bg-rose-500 border-2 border-background z-20" />
                  <div className="w-4 h-4 rounded-full bg-sky-500 border-2 border-background z-30" />
                </div>
                <span className="font-semibold text-sm">Personalizado</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Escolha a cor exata da sua marca.
              </p>
            </button>
          </div>

          {themeModeOption === 'custom' && (
            <div className="pt-4 border-t border-border mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {/* Color picker nativo */}
                <div className="relative">
                  <input
                    type="color"
                    value={localPrimaryColor}
                    onChange={(e) => setLocalPrimaryColor(e.target.value)}
                    onBlur={(e) => handlePrimaryColorChange(e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-border p-0.5 bg-transparent"
                    title="Escolher cor"
                  />
                </div>

                {/* Valor hex */}
                <div className="flex flex-col gap-0.5">
                  <code className="text-sm font-mono font-semibold">{localPrimaryColor.toUpperCase()}</code>
                  <span className="text-xs text-muted-foreground">Hex</span>
                </div>

                {/* Preview do botão */}
                <div className="ml-auto">
                  <button
                    className="px-4 py-2 rounded text-sm font-semibold"
                    style={{
                      backgroundColor: localPrimaryColor,
                      color: '#FAF9F7',
                    }}
                  >
                    Confirmar Seleção
                  </button>
                </div>
              </div>

              {/* Sugestões de cores */}
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Sugestões:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_COLORS.map((sug) => (
                    <button
                      key={sug.value}
                      onClick={() => handlePrimaryColorChange(sug.value)}
                      className="group flex flex-col items-center gap-1"
                      title={sug.label}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg border-2 transition-all group-hover:scale-110 ${
                          localPrimaryColor.toLowerCase() === sug.value.toLowerCase()
                            ? 'border-primary scale-110 shadow-md'
                            : 'border-transparent hover:border-border/60'
                        }`}
                        style={{ backgroundColor: sug.value }}
                      />
                      <span className="text-[9px] text-muted-foreground leading-none">{sug.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Theme Config (Grid layout — Seleção + Entrega) */}
        <div className="lunari-card p-6">
          <ThemeConfig
            defaultThemeId={settings.defaultThemeId || 'lunari'}
            themeOverrides={settings.themeOverrides || {}}
            onUpdate={(data) => updateSettings(data, { successMessage: 'Aparência da galeria atualizada.' })}
          />
        </div>

        {/* Cover Config (Hero — exclusivo Galerias de Entrega) */}
        <div className="lunari-card p-6">
          <CoverConfig
            defaultCoverId={settings.defaultCoverId || 'fullscreen'}
            onUpdate={(data) => updateSettings(data, { successMessage: 'Capa padrão atualizada.' })}
          />
        </div>

        {/* Watermark */}
        <div className="lunari-card p-6">
          <WatermarkSettings />
        </div>

        {/* Typography */}
        <div className="lunari-card p-6 space-y-4">
          <div>
            <Label className="text-base font-medium text-foreground">Tipografia Padrão</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Estilo de título aplicado automaticamente em novas galerias
            </p>
          </div>
          <div className="max-w-md">
            <FontSelect
              value={sessionFont}
              onChange={handleFontChange}
              previewText="Exemplo de Título"
              titleCaseMode={titleCaseMode}
              onTitleCaseModeChange={(mode) => {
                userTouchedTypographyRef.current = true;
                setTitleCaseMode(mode);
              }}
            />
          </div>
        </div>

        {/* Default Grid Spacing */}
        <div className="lunari-card p-6 space-y-4">
          <div>
            <Label className="text-base font-medium">Espaçamento entre fotos (Grid)</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Distância em pixels entre as fotos na galeria do cliente
            </p>
          </div>
          <div className="flex items-center gap-6 max-w-md pt-2">
            <Slider
              value={[localPhotoSpacing]}
              onValueChange={(vals) => setLocalPhotoSpacing(vals[0])}
              onValueCommit={(vals) => updateSettings({ defaultPhotoSpacing: vals[0] })}
              min={0}
              max={40}
              step={1}
              className="flex-1"
            />
            <span className="text-sm font-mono w-10 text-right">{localPhotoSpacing}px</span>
          </div>
        </div>
      </div>

      {/* Coluna Lateral - Preview Sticky */}
      <div className="lg:col-span-4 hidden lg:block relative">
        <div className="sticky top-6">
          <GalleryThemePreviewBlock
            settings={settings}
            studioName={studioName}
            studioLogoUrl={studioLogoUrl}
            gap={localPhotoSpacing}
            borderRadius={currentRadius}
          />
        </div>
      </div>
    </div>
  );
}

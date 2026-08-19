import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Monitor, Check, Plus, SlidersHorizontal, Eye } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { FontSelect } from '@/components/FontSelect';
import { TitleCaseMode } from '@/types/gallery';
import { ThemeConfig } from '@/components/settings/ThemeConfig';
import { CoverConfig } from '@/components/settings/CoverConfig';
import { WatermarkSettings } from '@/components/settings/WatermarkSettings';
import { GalleryThemePreviewBlock } from '@/components/settings/customization/GalleryThemePreviewBlock';
import { CustomColorPickerModal } from '@/components/settings/customization/CustomColorPickerModal';
import { GlobalSettings } from '@/types/gallery';
import { UpdateSettingsOptions } from '@/hooks/useGallerySettings';
import { isColorDark } from '@/components/gallery/themes/tokens';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface CustomizationAppearanceTabProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>, options?: UpdateSettingsOptions) => void;
  studioLogoUrl?: string;
  studioName?: string;
}

// Cores padrão com nomes simples e diretos
export const PRESET_COLORS = [
  { label: 'Dourado Lunari', value: '#D1BE9F' },
  { label: 'Marrom', value: '#804621' },
  { label: 'Terracota', value: '#c46426' },
  { label: 'Verde', value: '#99b691' },
  { label: 'Azul', value: '#6fb6bf' },
  { label: 'Lilás', value: '#b489bb' },
  { label: 'Grafite', value: '#343433' },
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
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);

  const userTouchedTypographyRef = useRef(false);

  useEffect(() => {
    if (settings) {
      setLocalPhotoSpacing(settings.defaultPhotoSpacing ?? 6);
      const color = settings.customTheme?.primaryColor || '#D1BE9F';
      setLocalPrimaryColor(color);

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
    const formattedColor = color.startsWith('#') ? color : `#${color}`;
    setLocalPrimaryColor(formattedColor);
    const currentCustom = settings.customTheme || {
      id: 'custom',
      name: 'Custom',
      backgroundMode: 'light',
      accentColor: formattedColor,
      emphasisColor: formattedColor,
    };
    updateSettings(
      {
        themeType: 'custom',
        customTheme: { ...currentCustom, primaryColor: formattedColor },
      },
      { successMessage: 'Cor da galeria salva.' }
    );
  };

  const isPresetSelected = PRESET_COLORS.some(
    (p) => p.value.toLowerCase() === localPrimaryColor.toLowerCase()
  );

  const currentRadius = settings.themeOverrides?.surface?.borderRadius || '0px';
  const isButtonDarkText = !isColorDark(localPrimaryColor);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Modal Interno de Seleção de Cor Personalizada */}
      <CustomColorPickerModal
        open={isColorModalOpen}
        onOpenChange={setIsColorModalOpen}
        currentColor={localPrimaryColor}
        onApplyColor={handlePrimaryColorChange}
      />

      {/* Botão Mobile para abrir o Preview */}
      <div className="lg:hidden flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border/80 text-sm font-medium shadow-sm hover:bg-muted transition-colors">
              <Eye className="h-4 w-4 text-primary" />
              <span>Ver Preview da Galeria</span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md p-4 bg-background border-border">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-base font-semibold">Preview em Tempo Real</DialogTitle>
            </DialogHeader>
            <GalleryThemePreviewBlock
              settings={settings}
              studioName={studioName}
              studioLogoUrl={studioLogoUrl}
              gap={localPhotoSpacing}
              borderRadius={currentRadius}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Coluna Principal - Controles */}
      <div className="lg:col-span-8 space-y-6">
        {/* Header da Seção */}
        <div className="pb-1 border-b border-border/40">
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            Aparência da Galeria do Cliente
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Essas configurações definem a identidade padrão aplicada em todas as novas galerias criadas no estúdio.
          </p>
        </div>

        {/* Modo Visual da Galeria */}
        <div className="lunari-card p-6 sm:p-7 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <Label className="text-base font-semibold text-foreground">Modo Visual da Galeria</Label>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Define como o esquema de cores e contraste é apresentado para os seus clientes
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              type="button"
              onClick={() => updateSettings({ clientTheme: 'light' }, { successMessage: 'Modo Claro ativado.' })}
              className={`relative flex items-center justify-center sm:justify-start gap-3 p-3.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                settings.clientTheme === 'light'
                  ? 'bg-foreground text-background border-foreground shadow-sm'
                  : 'bg-background/60 hover:bg-muted/40 border-border/80 text-foreground'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${settings.clientTheme === 'light' ? 'bg-background/20' : 'bg-muted'}`}>
                <Sun className="h-4 w-4" />
              </div>
              <div className="text-left">
                <span className="font-semibold block leading-tight">Claro</span>
                <span className={`text-[11px] block mt-0.5 ${settings.clientTheme === 'light' ? 'text-background/75' : 'text-muted-foreground'}`}>
                  Fundo luminoso
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ clientTheme: 'dark' }, { successMessage: 'Modo Escuro ativado.' })}
              className={`relative flex items-center justify-center sm:justify-start gap-3 p-3.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                settings.clientTheme === 'dark'
                  ? 'bg-foreground text-background border-foreground shadow-sm'
                  : 'bg-background/60 hover:bg-muted/40 border-border/80 text-foreground'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${settings.clientTheme === 'dark' ? 'bg-background/20' : 'bg-muted'}`}>
                <Moon className="h-4 w-4" />
              </div>
              <div className="text-left">
                <span className="font-semibold block leading-tight">Escuro</span>
                <span className={`text-[11px] block mt-0.5 ${settings.clientTheme === 'dark' ? 'text-background/75' : 'text-muted-foreground'}`}>
                  Fundo imersivo
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ clientTheme: 'system' }, { successMessage: 'Modo Automático ativado.' })}
              className={`relative flex items-center justify-center sm:justify-start gap-3 p-3.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                (settings.clientTheme === 'system' || !settings.clientTheme)
                  ? 'bg-foreground text-background border-foreground shadow-sm'
                  : 'bg-background/60 hover:bg-muted/40 border-border/80 text-foreground'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${(settings.clientTheme === 'system' || !settings.clientTheme) ? 'bg-background/20' : 'bg-muted'}`}>
                <Monitor className="h-4 w-4" />
              </div>
              <div className="text-left">
                <span className="font-semibold block leading-tight">Automático</span>
                <span className={`text-[11px] block mt-0.5 ${(settings.clientTheme === 'system' || !settings.clientTheme) ? 'text-background/75' : 'text-muted-foreground'}`}>
                  Segue dispositivo
                </span>
              </div>
            </button>
          </div>

          <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-xs text-muted-foreground">
            {settings.clientTheme === 'system'
              ? '✨ A galeria sincroniza automaticamente com as preferências do dispositivo do cliente (modo claro de dia ou escuro à noite).'
              : settings.clientTheme === 'dark'
              ? '🌙 A galeria sempre será exibida no modo escuro cinematográfico para todos os clientes.'
              : '☀️ A galeria sempre será exibida no modo claro editorial para todos os clientes.'}
          </div>
        </div>

        {/* Cor da Galeria (Botões de Ação) */}
        <div className="lunari-card p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <Label className="text-base font-semibold text-foreground">Cor da Galeria (Botões de Ação)</Label>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Cor aplicada nos botões de confirmação, seleções ativas e destaques da galeria
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-muted/60 border border-border/50 text-foreground uppercase">
                {localPrimaryColor}
              </span>
            </div>
          </div>

          {/* Grade de Cores Predefinidas + Botão Personalizado */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-3">
            {PRESET_COLORS.map((preset) => {
              const isSelected = localPrimaryColor.toLowerCase() === preset.value.toLowerCase();
              const isDark = isColorDark(preset.value);

              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handlePrimaryColorChange(preset.value)}
                  className={`group relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'border-primary/90 bg-primary/[0.07] ring-2 ring-primary/20 shadow-xs'
                      : 'border-border/70 hover:border-border hover:bg-muted/40 bg-background/50'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg shadow-sm flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                      isSelected ? 'ring-2 ring-offset-2 ring-primary/40 ring-offset-background' : ''
                    }`}
                    style={{ backgroundColor: preset.value }}
                  >
                    {isSelected && (
                      <Check className={`w-3.5 h-3.5 stroke-[3] ${isDark ? 'text-white' : 'text-neutral-900'}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold block text-foreground truncate">
                      {preset.label}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      {preset.value}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Botão de Cor Personalizada com Modal Interno */}
            <button
              type="button"
              onClick={() => setIsColorModalOpen(true)}
              className={`group relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                !isPresetSelected
                  ? 'border-primary/90 bg-primary/[0.07] ring-2 ring-primary/20 shadow-xs'
                  : 'border-dashed border-border/80 hover:border-primary/60 hover:bg-muted/40 bg-background/30'
              }`}
            >
              {!isPresetSelected ? (
                <div
                  className="w-7 h-7 rounded-lg shadow-sm flex items-center justify-center shrink-0 ring-2 ring-offset-2 ring-primary/40 ring-offset-background"
                  style={{ backgroundColor: localPrimaryColor }}
                >
                  <Check className={`w-3.5 h-3.5 stroke-[3] ${isButtonDarkText ? 'text-neutral-900' : 'text-white'}`} />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-lg bg-muted border border-border/60 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                  <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold block text-foreground truncate">
                    {!isPresetSelected ? 'Personalizada' : 'Outra Cor...'}
                  </span>
                  <SlidersHorizontal className="w-2.5 h-2.5 text-muted-foreground opacity-60" />
                </div>
                <span className="text-[10px] text-muted-foreground truncate block">
                  {!isPresetSelected ? localPrimaryColor.toUpperCase() : 'Definir no seletor'}
                </span>
              </div>
            </button>
          </div>

          {/* Banner de Demonstração Elegante do Botão */}
          <div className="pt-2">
            <div className="p-4 rounded-xl bg-muted/20 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg shadow-xs border border-black/10 shrink-0"
                  style={{ backgroundColor: localPrimaryColor }}
                />
                <div>
                  <p className="text-xs font-medium text-foreground">Demonstração na Galeria do Cliente</p>
                  <p className="text-[11px] text-muted-foreground">
                    Os botões de confirmação e ações primárias serão renderizados com este estilo
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {!isPresetSelected && (
                  <button
                    type="button"
                    onClick={() => setIsColorModalOpen(true)}
                    className="text-xs text-primary hover:underline font-medium px-2 py-1"
                  >
                    Ajustar Cor
                  </button>
                )}
                <div
                  className="px-4 py-2 rounded-lg text-xs font-semibold tracking-wide text-center shadow-xs select-none cursor-default transition-all"
                  style={{
                    backgroundColor: localPrimaryColor,
                    color: isButtonDarkText ? '#1A1614' : '#FAF9F7',
                  }}
                >
                  Confirmar Seleção
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Theme Config (Grid layout — Seleção + Entrega) */}
        <div className="lunari-card p-6 sm:p-7">
          <ThemeConfig
            defaultThemeId={settings.defaultThemeId || 'lunari'}
            themeOverrides={settings.themeOverrides || {}}
            onUpdate={(data) => updateSettings(data, { successMessage: 'Aparência da galeria atualizada.' })}
          />
        </div>

        {/* Cover Config (Hero — exclusivo Galerias de Entrega) */}
        <div className="lunari-card p-6 sm:p-7">
          <CoverConfig
            defaultCoverId={settings.defaultCoverId || 'fullscreen'}
            onUpdate={(data) => updateSettings(data, { successMessage: 'Capa padrão atualizada.' })}
          />
        </div>

        {/* Watermark */}
        <div className="lunari-card p-6 sm:p-7">
          <WatermarkSettings />
        </div>

        {/* Typography */}
        <div className="lunari-card p-6 sm:p-7 space-y-4">
          <div>
            <Label className="text-base font-semibold text-foreground">Tipografia Padrão</Label>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Estilo de título e fonte aplicado automaticamente em novas galerias
            </p>
          </div>
          <div className="max-w-md">
            <FontSelect
              value={sessionFont}
              onChange={handleFontChange}
              previewText="Exemplo de Título Editorial"
              titleCaseMode={titleCaseMode}
              onTitleCaseModeChange={(mode) => {
                userTouchedTypographyRef.current = true;
                setTitleCaseMode(mode);
              }}
            />
          </div>
        </div>

        {/* Default Grid Spacing */}
        <div className="lunari-card p-6 sm:p-7 space-y-4">
          <div>
            <Label className="text-base font-semibold text-foreground">Espaçamento entre Fotos (Grid)</Label>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Distância em pixels (gap) entre as fotografias na grade da galeria do cliente
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
            <span className="text-sm font-mono font-medium px-2 py-1 bg-muted rounded-md border border-border/50 w-12 text-center">
              {localPhotoSpacing}px
            </span>
          </div>
        </div>
      </div>

      {/* Coluna Lateral - Preview Sticky (Desktop) */}
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

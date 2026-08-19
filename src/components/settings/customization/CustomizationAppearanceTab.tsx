import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Monitor, Check, Pipette, Sparkles, Eye } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { FontSelect } from '@/components/FontSelect';
import { TitleCaseMode } from '@/types/gallery';
import { ThemeConfig } from '@/components/settings/ThemeConfig';
import { CoverConfig } from '@/components/settings/CoverConfig';
import { WatermarkSettings } from '@/components/settings/WatermarkSettings';
import { GalleryThemePreviewBlock } from '@/components/settings/customization/GalleryThemePreviewBlock';
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

// Novas cores padrão solicitadas pelo estúdio
export const SUGGESTED_COLORS = [
  { label: 'Conhaque', value: '#804621' },
  { label: 'Terracota', value: '#c46426' },
  { label: 'Sálvia', value: '#99b691' },
  { label: 'Petróleo', value: '#6fb6bf' },
  { label: 'Lavanda', value: '#b489bb' },
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
  const [hexInputText, setHexInputText] = useState(
    (settings.customTheme?.primaryColor || '#D1BE9F').toUpperCase()
  );
  const [themeModeOption, setThemeModeOption] = useState<'padrao' | 'custom'>(
    settings.customTheme?.primaryColor && settings.customTheme.primaryColor.toUpperCase() !== '#D1BE9F' ? 'custom' : 'padrao'
  );

  const userTouchedTypographyRef = useRef(false);

  useEffect(() => {
    if (settings) {
      setLocalPhotoSpacing(settings.defaultPhotoSpacing ?? 6);
      const color = settings.customTheme?.primaryColor || '#D1BE9F';
      setLocalPrimaryColor(color);
      setHexInputText(color.toUpperCase());
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
    const formattedColor = color.startsWith('#') ? color : `#${color}`;
    setLocalPrimaryColor(formattedColor);
    setHexInputText(formattedColor.toUpperCase());
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
      { successMessage: 'Cor primária salva.' }
    );
  };

  const handleHexInputChange = (value: string) => {
    let clean = value.trim();
    if (!clean.startsWith('#')) {
      clean = `#${clean}`;
    }
    setHexInputText(clean.toUpperCase());

    // Se for um hex válido (3 ou 6 caracteres hexadecimais após a #)
    if (/^#([0-9A-F]{3}){1,2}$/i.test(clean)) {
      setLocalPrimaryColor(clean);
      const currentCustom = settings.customTheme || {
        id: 'custom',
        name: 'Custom',
        backgroundMode: 'light',
        accentColor: clean,
        emphasisColor: clean,
      };
      updateSettings(
        {
          themeType: 'custom',
          customTheme: { ...currentCustom, primaryColor: clean },
        },
        { successMessage: 'Cor primária salva.' }
      );
    }
  };

  const currentRadius = settings.themeOverrides?.surface?.borderRadius || '0px';
  const isButtonDarkText = !isColorDark(localPrimaryColor);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
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

        {/* Cor Primária */}
        <div className="lunari-card p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <Label className="text-base font-semibold text-foreground">Cor de Ação & Destaque</Label>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Utilizada nos botões de confirmação, seleções ativas e detalhes interativos da galeria
              </p>
            </div>
            {themeModeOption === 'padrao' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit">
                <Sparkles className="w-3 h-3" /> Assinatura Lunari
              </span>
            )}
          </div>

          {/* Cartões Padrão Lunari vs Personalizado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <button
              type="button"
              onClick={() => {
                setThemeModeOption('padrao');
                handlePrimaryColorChange('#D1BE9F');
              }}
              className={`p-4 rounded-xl border text-left transition-all duration-200 relative overflow-hidden ${
                themeModeOption === 'padrao'
                  ? 'border-primary/80 ring-2 ring-primary/20 bg-primary/[0.04]'
                  : 'border-border/80 hover:border-foreground/20 bg-background/50 hover:bg-background/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#D1BE9F] shadow-sm border border-black/10 flex items-center justify-center">
                    {themeModeOption === 'padrao' && <Check className="w-3 h-3 text-stone-800" />}
                  </div>
                  <span className="font-semibold text-sm">Padrão Lunari</span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">#D1BE9F</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tom dourado fosco nobre e atemporal, harmoniza com qualquer estilo de fotografia.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setThemeModeOption('custom')}
              className={`p-4 rounded-xl border text-left transition-all duration-200 relative overflow-hidden ${
                themeModeOption === 'custom'
                  ? 'border-primary/80 ring-2 ring-primary/20 bg-primary/[0.04]'
                  : 'border-border/80 hover:border-foreground/20 bg-background/50 hover:bg-background/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex -space-x-1.5">
                    <div className="w-5 h-5 rounded-full bg-[#804621] border-2 border-background shadow-sm" />
                    <div className="w-5 h-5 rounded-full bg-[#99b691] border-2 border-background shadow-sm" />
                    <div className="w-5 h-5 rounded-full bg-[#6fb6bf] border-2 border-background shadow-sm" />
                  </div>
                  <span className="font-semibold text-sm">Personalizado</span>
                </div>
                <span className="text-[11px] font-medium text-primary">Cores da Marca</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Selecione uma paleta exclusiva ou insira a cor exata da identidade do seu estúdio.
              </p>
            </button>
          </div>

          {themeModeOption === 'custom' && (
            <div className="pt-5 border-t border-border/50 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Seletor Customizado + Preview Realista */}
              <div className="p-4 rounded-xl bg-muted/20 border border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {/* Color Swatch Trigger */}
                  <label 
                    className="relative cursor-pointer group flex-shrink-0"
                    title="Clique para escolher qualquer cor"
                  >
                    <input
                      type="color"
                      value={localPrimaryColor}
                      onChange={(e) => {
                        setLocalPrimaryColor(e.target.value);
                        setHexInputText(e.target.value.toUpperCase());
                      }}
                      onBlur={(e) => handlePrimaryColorChange(e.target.value)}
                      className="sr-only"
                    />
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-background shadow-md transition-transform group-hover:scale-105 flex items-center justify-center"
                      style={{ backgroundColor: localPrimaryColor }}
                    >
                      <Pipette
                        className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: isButtonDarkText ? '#1A1614' : '#FAF9F7' }}
                      />
                    </div>
                  </label>

                  {/* Input Hexadecimal */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground font-medium">Código Hexadecimal</Label>
                    <div className="relative flex items-center">
                      <Input
                        type="text"
                        maxLength={7}
                        value={hexInputText}
                        onChange={(e) => handleHexInputChange(e.target.value)}
                        onBlur={() => handlePrimaryColorChange(localPrimaryColor)}
                        className="h-9 w-28 font-mono text-sm font-semibold uppercase bg-background border-border/80 text-foreground"
                      />
                    </div>
                  </div>
                </div>

                {/* Demonstração visual do Botão de Ação */}
                <div className="sm:border-l sm:border-border/60 sm:pl-4 flex flex-col justify-center">
                  <span className="text-[11px] text-muted-foreground font-medium mb-1.5">
                    Demonstração do Botão:
                  </span>
                  <div
                    className="px-4 py-2 rounded-lg text-xs font-semibold tracking-wide text-center shadow-sm select-none transition-all duration-200"
                    style={{
                      backgroundColor: localPrimaryColor,
                      color: isButtonDarkText ? '#1A1614' : '#FAF9F7',
                    }}
                  >
                    Confirmar Seleção
                  </div>
                </div>
              </div>

              {/* Cores Sugeridas / Paleta Oficial Atualizada */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Cores Predefinidas
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Toque para aplicar instantaneamente
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {SUGGESTED_COLORS.map((sug) => {
                    const isSelected = localPrimaryColor.toLowerCase() === sug.value.toLowerCase();
                    const isDark = isColorDark(sug.value);

                    return (
                      <button
                        key={sug.value}
                        type="button"
                        onClick={() => handlePrimaryColorChange(sug.value)}
                        className={`group relative flex flex-col items-center p-2.5 rounded-xl border transition-all duration-200 ${
                          isSelected
                            ? 'border-primary/80 bg-primary/[0.06] shadow-sm ring-1 ring-primary/30'
                            : 'border-border/60 hover:border-border hover:bg-muted/30'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-full shadow-sm flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${
                            isSelected ? 'ring-2 ring-offset-2 ring-primary/50 ring-offset-background' : ''
                          }`}
                          style={{ backgroundColor: sug.value }}
                        >
                          {isSelected && (
                            <Check className={`w-4 h-4 ${isDark ? 'text-white' : 'text-neutral-900'}`} />
                          )}
                        </div>
                        <span className="text-xs font-medium text-foreground mt-2 truncate max-w-full">
                          {sug.label}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                          {sug.value}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
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

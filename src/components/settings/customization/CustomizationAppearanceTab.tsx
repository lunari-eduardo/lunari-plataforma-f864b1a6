import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { FontSelect } from '@/components/FontSelect';
import { TitleCaseMode } from '@/types/gallery';
import { ThemeConfig } from '@/components/settings/ThemeConfig';
import { CoverConfig } from '@/components/settings/CoverConfig';
import { WatermarkSettings } from '@/components/settings/WatermarkSettings';
import { GlobalSettings } from '@/types/gallery';
import { UpdateSettingsOptions } from '@/hooks/useGallerySettings';

interface CustomizationAppearanceTabProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>, options?: UpdateSettingsOptions) => void;
}

export function CustomizationAppearanceTab({ settings, updateSettings }: CustomizationAppearanceTabProps) {
  const [sessionFont, setSessionFont] = useState('playfair');
  const [titleCaseMode, setTitleCaseMode] = useState<TitleCaseMode>('normal');
  const [localPhotoSpacing, setLocalPhotoSpacing] = useState<number>(6);
  const userTouchedTypographyRef = useRef(false);

  useEffect(() => {
    if (settings) {
      setLocalPhotoSpacing(settings.defaultPhotoSpacing ?? 6);
      
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

  return (
    <div className="space-y-4">
      {/* Client Gallery Appearance */}
      <h3 className="text-lg font-medium text-muted-foreground">Aparência da Galeria do Cliente</h3>
      <p className="text-sm text-muted-foreground">Essas configurações são aplicadas em todas as novas galerias. Galerias individuais podem sobrescrever essas preferências.</p>
      
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
  );
}

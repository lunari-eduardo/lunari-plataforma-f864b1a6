import { useState, useEffect, useRef } from 'react';
import { useGallerySettings } from '@/hooks/useGallerySettings';
import { FontSelect } from '@/components/FontSelect';
import { TitleCaseMode } from '@/types/gallery';
import { ThemeConfig } from './ThemeConfig';
import { CoverConfig } from './CoverConfig';
import { WatermarkSettings } from './WatermarkSettings';
import { EmailTemplates } from './EmailTemplates';
import { EmailAutomationSettings } from './EmailAutomationSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { defaultWelcomeMessage } from '@/data/mockData';
import { Slider } from '@/components/ui/slider';


export function PersonalizationSettings() {
  const {
    settings,
    updateSettings,
    saveCustomTheme,
    deleteCustomTheme,
    setThemeType,
    updateEmailTemplate,
    isUpdatingEmailTemplate,
  } = useGallerySettings();

  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeTemplate, setWelcomeTemplate] = useState('');
  const [sessionFont, setSessionFont] = useState('playfair');
  const [titleCaseMode, setTitleCaseMode] = useState<TitleCaseMode>('normal');
  const [localPhotoSpacing, setLocalPhotoSpacing] = useState<number>(6);
  const userTouchedTypographyRef = useRef(false);

  useEffect(() => {
    if (settings) {
      setWelcomeEnabled(settings.welcomeMessageEnabled ?? true);
      setWelcomeTemplate(settings.defaultWelcomeMessage || defaultWelcomeMessage);
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

  if (!settings) return null;

  const handleWelcomeEnabledChange = (enabled: boolean) => {
    setWelcomeEnabled(enabled);
    updateSettings({ welcomeMessageEnabled: enabled }, { successMessage: 'Mensagem padrão atualizada.' });
  };

  const handleWelcomeTemplateBlur = () => {
    updateSettings({ defaultWelcomeMessage: welcomeTemplate }, { successMessage: 'Mensagem padrão salva.' });
  };

  return (
    <div className="space-y-8">
       {/* Client Gallery Appearance */}
       <div className="space-y-4">
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
                // Note: We don't have a global titleCaseMode setting yet, 
                // but we can add it to lastSessionFont or simply allow it to be local
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

        {/* Communication */}
        <div className="space-y-4">
        <h3 className="text-lg font-medium text-muted-foreground">Comunicação</h3>
        
        {/* Welcome Message Template */}
        <div className="lunari-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Mensagem de Boas-Vindas Padrão</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Modelo pré-preenchido ao criar novas galerias
              </p>
            </div>
            <Switch
              checked={welcomeEnabled}
              onCheckedChange={handleWelcomeEnabledChange}
            />
          </div>

          {welcomeEnabled && (
            <div className="space-y-3">
              <Textarea
                value={welcomeTemplate}
                onChange={(e) => setWelcomeTemplate(e.target.value)}
                onBlur={handleWelcomeTemplateBlur}
                placeholder="Escreva o modelo de mensagem padrão..."
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Slugs disponíveis: <code className="bg-muted px-1 rounded">{'{cliente}'}</code> (primeiro nome), <code className="bg-muted px-1 rounded">{'{sessao}'}</code> (nome da sessão), <code className="bg-muted px-1 rounded">{'{estudio}'}</code> (nome do estúdio)
              </p>
            </div>
          )}
        </div>

        <div className="lunari-card p-6">
          <EmailAutomationSettings settings={settings} updateSettings={updateSettings} />
        </div>

        {/* Email Templates */}
        <div className="lunari-card p-6">
          <EmailTemplates
            templates={settings.emailTemplates}
            onTemplateSave={updateEmailTemplate}
            isSaving={isUpdatingEmailTemplate}
          />
        </div>
      </div>
    </div>
  );
}
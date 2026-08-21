import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { defaultWelcomeMessage } from '@/data/mockData';
import { EmailAutomationSettings } from '@/components/settings/EmailAutomationSettings';
import { GlobalSettings } from '@/types/gallery';
import { UpdateSettingsOptions } from '@/hooks/useGallerySettings';

interface CustomizationCommunicationTabProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>, options?: UpdateSettingsOptions) => void;
  updateEmailTemplate: (id: string, data: Partial<any>) => void;
  isUpdatingEmailTemplate: boolean;
}

export function CustomizationCommunicationTab({ 
  settings, 
  updateSettings,
  updateEmailTemplate,
  isUpdatingEmailTemplate
}: CustomizationCommunicationTabProps) {
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeTemplate, setWelcomeTemplate] = useState('');

  useEffect(() => {
    if (settings) {
      setWelcomeEnabled(settings.welcomeMessageEnabled ?? true);
      setWelcomeTemplate(settings.defaultWelcomeMessage || defaultWelcomeMessage);
    }
  }, [settings]);

  const handleWelcomeEnabledChange = (enabled: boolean) => {
    setWelcomeEnabled(enabled);
    updateSettings({ welcomeMessageEnabled: enabled }, { successMessage: 'Mensagem padrão atualizada.' });
  };

  const handleWelcomeTemplateBlur = () => {
    updateSettings({ defaultWelcomeMessage: welcomeTemplate }, { successMessage: 'Mensagem padrão salva.' });
  };

  return (
    <div className="space-y-4">
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
        <EmailAutomationSettings 
          settings={settings} 
          updateSettings={updateSettings}
          templates={settings.emailTemplates}
          onTemplateSave={updateEmailTemplate as any}
          isSavingTemplate={isUpdatingEmailTemplate}
        />
      </div>
    </div>
  );
}

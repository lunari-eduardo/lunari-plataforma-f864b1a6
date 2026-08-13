import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/hooks/useSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { PersonalizationSettings } from '@/components/settings/PersonalizationSettings';

interface GallerySettingsProps {
  tab?: 'general' | 'personalization';
}

export default function Settings({ tab = 'general' }: GallerySettingsProps) {
  const { settings, updateSettings, isUpdating } = useSettings();
  const location = useLocation();
  
  const activeTab = tab;

  const handleSave = () => {
    toast.success(isUpdating ? 'Salvando configuraÃ§Ãµes...' : 'ConfiguraÃ§Ãµes jÃ¡ estÃ£o salvas.');
  };

  return (
    <>
      <div className="max-w-[79rem] mx-auto space-y-8 animate-fade-in pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {activeTab === 'general' ? 'ConfiguraÃ§Ãµes PadrÃµes' : 'PersonalizaÃ§Ã£o'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {activeTab === 'general' ? 'Ajuste comportamentos padrÃµes para as novas galerias' : 'Personalize o visual e a marca d\'Ã¡gua das galerias'}
            </p>
          </div>
        </div>

        <div className="mt-6">
          {activeTab === 'general' && (
            <GeneralSettings settings={settings} updateSettings={updateSettings} />
          )}

          {activeTab === 'personalization' && (
            <PersonalizationSettings />
          )}
        </div>
      </div>

      {activeTab !== 'payment' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-lg">
          <div className="max-w-[79rem] mx-auto px-4 py-3 flex justify-end">
            <Button variant="terracotta" size="lg" onClick={handleSave} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {isUpdating ? 'Salvando...' : 'Salvar ConfiguraÃ§Ãµes'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

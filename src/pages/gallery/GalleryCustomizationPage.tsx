import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGallerySettings } from '@/hooks/useGallerySettings';
import { CustomizationAppearanceTab } from '@/components/settings/customization/CustomizationAppearanceTab';
import { CustomizationCommunicationTab } from '@/components/settings/customization/CustomizationCommunicationTab';

export default function GalleryCustomizationPage() {
  const { 
    settings, 
    updateSettings, 
    isUpdating,
    updateEmailTemplate,
    isUpdatingEmailTemplate
  } = useGallerySettings();
  
  const [activeTab, setActiveTab] = useState('aparencia');

  const handleSave = () => {
    toast.success(isUpdating ? 'Salvando configurações...' : 'Configurações já estão salvas.');
  };

  if (!settings) return null;

  return (
    <>
      <div className="max-w-[79rem] mx-auto space-y-8 animate-fade-in pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Personalização</h1>
            <p className="text-muted-foreground mt-1">
              Personalize o visual, comunicação e a marca d'água das galerias
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6 space-y-6">
          <TabsList className="bg-muted/50 border">
            <TabsTrigger value="aparencia">Aparência da Galeria do Cliente</TabsTrigger>
            <TabsTrigger value="comunicacao">Comunicação</TabsTrigger>
          </TabsList>

          <TabsContent value="aparencia" className="mt-0 outline-none">
            <CustomizationAppearanceTab
              settings={settings}
              updateSettings={updateSettings}
              studioName={settings.studioName}
              studioLogoUrl={settings.studioLogo}
            />
          </TabsContent>

          <TabsContent value="comunicacao" className="mt-0 outline-none">
            <CustomizationCommunicationTab 
              settings={settings} 
              updateSettings={updateSettings}
              updateEmailTemplate={updateEmailTemplate}
              isUpdatingEmailTemplate={isUpdatingEmailTemplate}
            />
          </TabsContent>
        </Tabs>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="max-w-[79rem] mx-auto px-4 py-3 flex justify-end">
          <Button variant="terracotta" size="lg" onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isUpdating ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </div>
    </>
  );
}

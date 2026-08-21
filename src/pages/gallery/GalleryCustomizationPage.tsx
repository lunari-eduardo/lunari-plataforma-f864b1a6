import { useState } from 'react';
import { Loader2, Save, Palette, MessageSquare, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGallerySettings } from '@/hooks/useGallerySettings';
import { useUserProfile } from '@/hooks/useUserProfile';
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
  const { profile } = useUserProfile();
  
  const [activeTab, setActiveTab] = useState('aparencia');

  const handleSave = () => {
    toast.success(isUpdating ? 'Salvando alterações...' : 'Todas as configurações estão sincronizadas.');
  };

  if (!settings) return null;

  return (
    <>
      <div className="max-w-[79rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-8 animate-fade-in pb-24">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Personalização
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Configure a identidade visual, padrões editoriais e canais de comunicação das suas galerias.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/80 self-start sm:self-auto bg-muted/40 px-3 py-1.5 rounded-full border border-border/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Salvamento em tempo real</span>
          </div>
        </div>

        {/* Abas de Configuração */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-muted/40 p-1 rounded-xl border border-border/60 inline-flex">
            <TabsTrigger 
              value="aparencia" 
              className="rounded-lg px-4 py-2 text-xs sm:text-sm font-medium gap-2 data-[state=active]:bg-background data-[state=active]:shadow-xs transition-all"
            >
              <Palette className="w-4 h-4" />
              <span>Aparência da Galeria</span>
            </TabsTrigger>
            <TabsTrigger 
              value="comunicacao" 
              className="rounded-lg px-4 py-2 text-xs sm:text-sm font-medium gap-2 data-[state=active]:bg-background data-[state=active]:shadow-xs transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Comunicação</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="aparencia" className="mt-0 outline-none focus-visible:ring-0">
            <CustomizationAppearanceTab
              settings={settings}
              updateSettings={updateSettings}
              studioName={settings.studioName}
              studioLogoUrl={settings.studioLogo || profile?.logo_url || undefined}
            />
          </TabsContent>

          <TabsContent value="comunicacao" className="mt-0 outline-none focus-visible:ring-0">
            <CustomizationCommunicationTab 
              settings={settings} 
              updateSettings={updateSettings}
              updateEmailTemplate={updateEmailTemplate as any}
              isUpdatingEmailTemplate={isUpdatingEmailTemplate}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur-md transition-all">
        <div className="max-w-[79rem] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            As alterações são salvas automaticamente enquanto você edita.
          </span>
          <Button 
            variant="terracotta" 
            size="default" 
            onClick={handleSave} 
            disabled={isUpdating}
            className="ml-auto shadow-sm px-5"
          >
            {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isUpdating ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </div>
    </>
  );
}

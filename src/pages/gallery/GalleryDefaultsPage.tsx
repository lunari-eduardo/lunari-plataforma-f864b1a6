import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/hooks/useSettings';
import { DefaultsGeneralTab } from '@/components/settings/defaults/DefaultsGeneralTab';
import { DefaultsSelectionTab } from '@/components/settings/defaults/DefaultsSelectionTab';
import { DefaultsSalesTab } from '@/components/settings/defaults/DefaultsSalesTab';
import { DefaultsImagesTab } from '@/components/settings/defaults/DefaultsImagesTab';

export default function GalleryDefaultsPage() {
  const { settings, updateSettings, isUpdating } = useSettings();
  const [activeTab, setActiveTab] = useState('geral');

  const handleSave = () => {
    toast.success(isUpdating ? 'Salvando configurações...' : 'Configurações já estão salvas.');
  };

  return (
    <>
      <div className="max-w-[79rem] mx-auto space-y-8 animate-fade-in pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Padrões</h1>
            <p className="text-muted-foreground mt-1">
              Defina os padrões aplicados automaticamente às novas galerias.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6 space-y-6">
          <TabsList className="bg-muted/50 border">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="selecao">Seleção</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="imagens">Imagens</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="mt-0 outline-none">
            <DefaultsGeneralTab settings={settings} updateSettings={updateSettings} />
          </TabsContent>

          <TabsContent value="selecao" className="mt-0 outline-none">
            <DefaultsSelectionTab settings={settings} updateSettings={updateSettings} />
          </TabsContent>

          <TabsContent value="vendas" className="mt-0 outline-none">
            <DefaultsSalesTab settings={settings} updateSettings={updateSettings} />
          </TabsContent>

          <TabsContent value="imagens" className="mt-0 outline-none">
            <DefaultsImagesTab settings={settings} updateSettings={updateSettings} />
          </TabsContent>
        </Tabs>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="max-w-[79rem] mx-auto px-4 py-3 flex justify-end">
          <Button variant="terracotta" size="lg" onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isUpdating ? 'Salvando...' : 'Salvar Padrões'}
          </Button>
        </div>
      </div>
    </>
  );
}

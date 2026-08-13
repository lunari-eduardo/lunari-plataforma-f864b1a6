import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { PersonalizationSettings } from '@/components/settings/PersonalizationSettings';

export default function GalleryCustomizationPage() {
  const { isUpdating } = useSettings();

  const handleSave = () => {
    toast.success(isUpdating ? 'Salvando configurações...' : 'Configurações já estão salvas.');
  };

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

        <div className="mt-6">
          <PersonalizationSettings />
        </div>
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

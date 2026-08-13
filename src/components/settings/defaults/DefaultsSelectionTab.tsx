import { MessageSquare, PlusCircle, CheckSquare } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GlobalSettings } from '@/types/gallery';
import { UpdateSettingsOptions } from '@/hooks/useGallerySettings';

interface DefaultsSelectionTabProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>, options?: UpdateSettingsOptions) => void;
}

export function DefaultsSelectionTab({ settings, updateSettings }: DefaultsSelectionTabProps) {
  return (
    <div className="space-y-6">
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CheckSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Modo de Seleção</h2>
            <p className="text-sm text-muted-foreground">
              Como os clientes interagem com a escolha de fotos nas novas galerias
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <div className="flex items-start gap-4">
              <PlusCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="allow-extra-photos" className="font-medium cursor-pointer">
                  Permitir Fotos Extras
                </Label>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Permite que o cliente selecione mais fotos do que o limite do pacote. As fotos adicionais serão cobradas de acordo com o modelo de vendas.
                </p>
              </div>
            </div>
            <Switch
              id="allow-extra-photos"
              checked={settings.defaultAllowExtraPhotos ?? true}
              onCheckedChange={(v) => updateSettings({ defaultAllowExtraPhotos: v }, { successMessage: 'Comportamento padrão salvo.' })}
            />
          </div>

          <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <div className="flex items-start gap-4">
              <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="allow-comments" className="font-medium cursor-pointer">
                  Permitir Comentários nas Fotos
                </Label>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Se ativado, os clientes poderão deixar comentários individuais em cada foto durante a seleção.
                </p>
              </div>
            </div>
            <Switch
              id="allow-comments"
              checked={settings.defaultAllowComments ?? true}
              onCheckedChange={(v) => updateSettings({ defaultAllowComments: v }, { successMessage: 'Comportamento padrão salvo.' })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

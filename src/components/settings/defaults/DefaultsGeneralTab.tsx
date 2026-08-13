import { Shield, Globe, Lock, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GlobalSettings, GalleryPermission } from '@/types/gallery';
import { UpdateSettingsOptions } from '@/hooks/useGallerySettings';
import { useState, useEffect } from 'react';

interface DefaultsGeneralTabProps {
  settings: GlobalSettings;
  updateSettings: (data: Partial<GlobalSettings>, options?: UpdateSettingsOptions) => void;
}

export function DefaultsGeneralTab({ settings, updateSettings }: DefaultsGeneralTabProps) {
  const [localExpiration, setLocalExpiration] = useState(settings.defaultExpirationDays?.toString() || '30');

  useEffect(() => {
    setLocalExpiration(settings.defaultExpirationDays?.toString() || '30');
  }, [settings.defaultExpirationDays]);

  const handleExpirationBlur = () => {
    const days = parseInt(localExpiration);
    if (!isNaN(days) && days > 0) {
      updateSettings({ defaultExpirationDays: days }, { successMessage: 'Prazo padrão salvo.' });
    } else {
      setLocalExpiration(settings.defaultExpirationDays?.toString() || '30');
    }
  };

  return (
    <div className="space-y-6">
      {/* Gallery Permission Settings */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Permissão Padrão de Galerias</h2>
            <p className="text-sm text-muted-foreground">
              Define a permissão padrão para novas galerias
            </p>
          </div>
        </div>

        <RadioGroup
          value={settings.defaultGalleryPermission || 'public'}
          onValueChange={(v) => updateSettings({ defaultGalleryPermission: v as GalleryPermission }, { successMessage: 'Permissão padrão salva.' })}
          className="space-y-3"
        >
          <div className="flex items-center gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="public" id="perm-public" />
            <Label htmlFor="perm-public" className="flex-1 cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Pública</p>
                  <p className="text-sm text-muted-foreground">
                    Galerias acessíveis sem senha
                  </p>
                </div>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
            </Label>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="private" id="perm-private" />
            <Label htmlFor="perm-private" className="flex-1 cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Privada</p>
                  <p className="text-sm text-muted-foreground">
                    Requer senha do cliente para acesso
                  </p>
                </div>
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Expiration Settings */}
      <div className="lunari-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium">Prazo Padrão</h2>
            <p className="text-sm text-muted-foreground">
              Prazo de expiração padrão para novas galerias
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="expiration-days">Dias para expiração</Label>
            <div className="flex items-center gap-3 max-w-xs">
              <Input
                id="expiration-days"
                type="number"
                min="1"
                max="365"
                value={localExpiration}
                onChange={(e) => setLocalExpiration(e.target.value)}
                onBlur={handleExpirationBlur}
                className="w-24 bg-background"
              />
              <span className="text-sm text-muted-foreground">dias</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { useUserPreferences } from '@/hooks/useUserProfile';
import { PreferencesForm } from '@/components/user-profile/forms/PreferencesForm';
import { UserPreferences, RegimeTributario } from '@/types/userProfile';
import { ForceUpdateButton } from '@/components/shared/ForceUpdateButton';

export default function Preferencias() {
  const { preferences, savePreferences, getPreferencesOrDefault } = useUserPreferences();
  const [formData, setFormData] = useState<UserPreferences>(getPreferencesOrDefault());
  
  useEffect(() => {
    if (preferences) {
      setFormData(preferences);
    }
  }, [preferences]);

  const handlePreferenceChange = useCallback((field: keyof UserPreferences, value: boolean | RegimeTributario) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);
    // Auto-save com debounce
    savePreferences({ [field]: value });
  }, [formData, savePreferences]);

  return (
    <div className="min-h-screen bg-lunar-bg">
      <ScrollArea className="h-screen">
        <div className="container mx-auto p-4 max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-lunar-text mb-2">Preferências</h1>
            <p className="text-lunar-textSecondary">Configure as preferências da sua conta e notificações</p>
          </div>

          <Card className="mb-6">
            <CardContent className="p-6">
              <PreferencesForm
                preferences={formData}
                onChange={handlePreferenceChange}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-lunar-text mb-1">Atualização do App</h3>
                  <p className="text-sm text-lunar-textSecondary mb-4">
                    Force a atualização do aplicativo em todos os dispositivos conectados para garantir que todos estejam usando a versão mais recente.
                  </p>
                </div>
                <ForceUpdateButton />
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
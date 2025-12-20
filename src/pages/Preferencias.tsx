import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserPreferences } from '@/hooks/useUserProfile';
import { PreferencesForm } from '@/components/user-profile/forms/PreferencesForm';
import { UserPreferences, RegimeTributario } from '@/types/userProfile';
import { ForceUpdateButton } from '@/components/shared/ForceUpdateButton';
import { IntegracoesTab } from '@/components/preferencias/IntegracoesTab';
import { Settings, Plug } from 'lucide-react';

export default function Preferencias() {
  const { preferences, savePreferences, getPreferencesOrDefault } = useUserPreferences();
  const [formData, setFormData] = useState<UserPreferences>(getPreferencesOrDefault());
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Determine active tab from URL params
  const tabFromUrl = searchParams.get('tab') || 'geral';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  
  useEffect(() => {
    if (preferences) {
      setFormData(preferences);
    }
  }, [preferences]);

  // Sync tab state with URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'geral') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: value });
    }
  };

  const handlePreferenceChange = useCallback((field: keyof UserPreferences, value: boolean | RegimeTributario) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);
    savePreferences({ [field]: value });
  }, [formData, savePreferences]);

  return (
    <div className="min-h-screen bg-lunar-bg">
      <ScrollArea className="h-screen">
        <div className="container mx-auto p-4 max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-lunar-text mb-2">Preferências</h1>
            <p className="text-lunar-textSecondary">Configure as preferências da sua conta e integrações</p>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="geral" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Geral
              </TabsTrigger>
              <TabsTrigger value="integracoes" className="flex items-center gap-2">
                <Plug className="h-4 w-4" />
                Integrações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-6">
              <Card>
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
            </TabsContent>

            <TabsContent value="integracoes">
              <IntegracoesTab />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

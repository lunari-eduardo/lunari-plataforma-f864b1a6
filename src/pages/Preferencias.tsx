import { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { supabaseUserService } from '@/services/SupabaseUserService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PreferencesForm } from '@/components/user-profile/forms/PreferencesForm';
import { UserPreferences, RegimeTributario } from '@/types/userProfile';

export default function Preferencias() {
  const queryClient = useQueryClient();
  
  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => supabaseUserService.loadPreferences()
  });

  const saveMutation = useMutation({
    mutationFn: (prefs: Partial<UserPreferences>) => supabaseUserService.savePreferences(prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preferences'] })
  });

  const [formData, setFormData] = useState<UserPreferences>(preferences || {
    id: '',
    notificacoesWhatsapp: true,
    habilitarAutomacoesWorkflow: true,
    habilitarAlertaProdutosDoCliente: true,
    regimeTributario: 'mei',
    createdAt: '',
    updatedAt: ''
  });
  
  useEffect(() => {
    if (preferences) {
      setFormData(preferences);
    }
  }, [preferences]);

  const handlePreferenceChange = useCallback((field: keyof UserPreferences, value: boolean | RegimeTributario) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);
    saveMutation.mutate({ [field]: value });
  }, [formData, saveMutation]);

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
        </div>
      </ScrollArea>
    </div>
  );
}
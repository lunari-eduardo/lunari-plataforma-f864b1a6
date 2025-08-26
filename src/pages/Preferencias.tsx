import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUserPreferences } from '@/hooks/useUserProfile';
import { UserPreferences } from '@/types/userProfile';

export default function Preferencias() {
  const { preferences, savePreferences, getPreferencesOrDefault } = useUserPreferences();
  const [formData, setFormData] = useState<UserPreferences>(getPreferencesOrDefault());
  
  useEffect(() => {
    if (preferences) {
      setFormData(prev => ({ ...prev, ...preferences }));
    }
  }, [preferences]);

  const handleSwitchChange = (field: keyof UserPreferences, checked: boolean) => {
    const updatedData = { ...formData, [field]: checked };
    setFormData(updatedData);
    savePreferences({ [field]: checked });
  };

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
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Configurações de Notificação</h3>
                  <p className="text-lunar-textSecondary">
                    Escolha como você deseja receber notificações sobre atividades importantes
                  </p>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="notificacoes-whatsapp">Notificações por WhatsApp</Label>
                          <p className="text-sm text-lunar-textSecondary">
                            Receba notificações rápidas através do WhatsApp Business
                          </p>
                        </div>
                        <Switch
                          id="notificacoes-whatsapp"
                          checked={formData.notificacoesWhatsapp}
                          onCheckedChange={(checked) => handleSwitchChange('notificacoesWhatsapp', checked)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Automações */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Automações</CardTitle>
                      <CardDescription>Controle regras automáticas do Workflow e Orçamentos</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="habilitarAutomacoesWorkflow">Habilitar automações do Workflow</Label>
                          <p className="text-sm text-lunar-textSecondary">Cria tarefas e avisos automaticamente</p>
                        </div>
                        <Switch
                          id="habilitarAutomacoesWorkflow"
                          checked={formData.habilitarAutomacoesWorkflow}
                          onCheckedChange={(checked) => handleSwitchChange('habilitarAutomacoesWorkflow', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="habilitarAlertaProdutosDoCliente">Alertar sobre produtos do cliente</Label>
                          <p className="text-sm text-lunar-textSecondary">Mostra um aviso quando o cliente possui produtos vinculados</p>
                        </div>
                        <Switch
                          id="habilitarAlertaProdutosDoCliente"
                          checked={formData.habilitarAlertaProdutosDoCliente}
                          onCheckedChange={(checked) => handleSwitchChange('habilitarAlertaProdutosDoCliente', checked)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="bg-lunar-surface/50 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-lunar-accent rounded-full mt-2 flex-shrink-0"></div>
                      <div className="text-sm text-lunar-textSecondary">
                        <p className="font-medium mb-1">Sobre as notificações:</p>
                        <ul className="space-y-1">
                          <li>• As configurações são salvas automaticamente</li>
                          <li>• Você pode alterar suas preferências a qualquer momento</li>
                          <li>• Notificações importantes de sistema sempre serão enviadas</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
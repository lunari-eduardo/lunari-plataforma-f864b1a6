import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useUserPreferences } from '@/hooks/useUserProfile';
import { 
  IDIOMAS_OPCOES, 
  FUSOS_HORARIOS_OPCOES, 
  MOEDAS_OPCOES, 
  FORMATOS_DATA_OPCOES 
} from '@/utils/userUtils';
import { UserPreferences } from '@/types/userProfile';

export default function Preferencias() {
  const { preferences, savePreferences, getPreferencesOrDefault } = useUserPreferences();
  const [formData, setFormData] = useState<UserPreferences>(getPreferencesOrDefault());
  const { setTheme } = useTheme();

  useEffect(() => {
    if (preferences) {
      setFormData(preferences);
      if (preferences.tema) {
        if (preferences.tema === 'escuro') {
          setTheme('dark');
        } else if (preferences.tema === 'claro') {
          setTheme('light');
        } else if (preferences.tema === 'sistema') {
          setTheme('system');
        }
      }
    }
  }, [preferences, setTheme]);

  const handleSelectChange = (field: keyof UserPreferences, value: string) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);
    savePreferences({ [field]: value });
    if (field === 'tema') {
      if (value === 'escuro') {
        setTheme('dark');
      } else if (value === 'claro') {
        setTheme('light');
      } else if (value === 'sistema') {
        setTheme('system');
      }
    }
  };

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
              <Tabs defaultValue="gerais" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="gerais">Preferências Gerais</TabsTrigger>
                  <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
                </TabsList>

                <TabsContent value="gerais" className="space-y-6 mt-6">
                  {/* Seção Preferências da Conta */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Preferências da Conta</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="idioma">Idioma</Label>
                        <Select 
                          value={formData.idioma} 
                          onValueChange={(value: 'pt' | 'en' | 'es') => handleSelectChange('idioma', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o idioma" />
                          </SelectTrigger>
                          <SelectContent>
                            {IDIOMAS_OPCOES.map((opcao) => (
                              <SelectItem key={opcao.value} value={opcao.value}>
                                {opcao.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="fusoHorario">Fuso Horário</Label>
                        <Select 
                          value={formData.fusoHorario} 
                          onValueChange={(value) => handleSelectChange('fusoHorario', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o fuso horário" />
                          </SelectTrigger>
                          <SelectContent>
                            {FUSOS_HORARIOS_OPCOES.map((opcao) => (
                              <SelectItem key={opcao.value} value={opcao.value}>
                                {opcao.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="moedaPadrao">Moeda Padrão</Label>
                        <Select 
                          value={formData.moedaPadrao} 
                          onValueChange={(value: 'BRL' | 'USD' | 'EUR') => handleSelectChange('moedaPadrao', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a moeda" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOEDAS_OPCOES.map((opcao) => (
                              <SelectItem key={opcao.value} value={opcao.value}>
                                {opcao.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="formatoData">Formato de Data</Label>
                        <Select 
                          value={formData.formatoData} 
                          onValueChange={(value: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD') => handleSelectChange('formatoData', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o formato" />
                          </SelectTrigger>
                          <SelectContent>
                            {FORMATOS_DATA_OPCOES.map((opcao) => (
                              <SelectItem key={opcao.value} value={opcao.value}>
                                {opcao.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Seção Aparência */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Aparência</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-3">
                        <Label>Tema</Label>
                        <RadioGroup 
                          value={formData.tema} 
                          onValueChange={(value: 'claro' | 'escuro' | 'sistema') => handleSelectChange('tema', value)}
                          className="flex gap-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="claro" id="tema-claro" />
                            <Label htmlFor="tema-claro">Claro</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="escuro" id="tema-escuro" />
                            <Label htmlFor="tema-escuro">Escuro</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="sistema" id="tema-sistema" />
                            <Label htmlFor="tema-sistema">Sistema</Label>
                          </div>
                        </RadioGroup>
                        <p className="text-sm text-lunar-textSecondary">
                          Escolha entre o tema claro ou escuro para a interface
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="notificacoes" className="space-y-6 mt-6">
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
                              <Label htmlFor="notificacoes-email">Notificações por E-mail</Label>
                              <p className="text-sm text-lunar-textSecondary">
                                Receba atualizações sobre orçamentos, agendamentos e lembretes importantes
                              </p>
                            </div>
                            <Switch
                              id="notificacoes-email"
                              checked={formData.notificacoesEmail}
                              onCheckedChange={(checked) => handleSwitchChange('notificacoesEmail', checked)}
                            />
                          </div>
                        </CardContent>
                      </Card>

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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
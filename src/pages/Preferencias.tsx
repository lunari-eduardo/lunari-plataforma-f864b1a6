import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useUserPreferences } from '@/hooks/useUserProfile';
import { 
  IDIOMAS_OPCOES, 
  FUSOS_HORARIOS_OPCOES, 
  MOEDAS_OPCOES, 
  FORMATOS_DATA_OPCOES 
} from '@/utils/userUtils';
import { UserPreferences } from '@/types/userProfile';
import ThemeColorPicker from '@/components/preferences/ThemeColorPicker';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Preferencias() {
  const { preferences, savePreferences, getPreferencesOrDefault } = useUserPreferences();
  const [formData, setFormData] = useState<UserPreferences>(getPreferencesOrDefault());
useEffect(() => {
  if (preferences) {
    setFormData(prev => ({ ...prev, ...preferences }));
  }
}, [preferences]);

  const handleSelectChange = (field: keyof UserPreferences, value: string) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);
    savePreferences({ [field]: value });
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
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="gerais">Preferências Gerais</TabsTrigger>
                  <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
                  <TabsTrigger value="aparencia">Aparência</TabsTrigger>
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
                              <Label htmlFor="habilitarAvisosApenasAgendamentosFuturos">Avisar apenas para agendamentos futuros</Label>
                              <p className="text-sm text-lunar-textSecondary">Ignora sessões passadas para evitar spam</p>
                            </div>
                            <Switch
                              id="habilitarAvisosApenasAgendamentosFuturos"
                              checked={formData.habilitarAvisosApenasAgendamentosFuturos}
                              onCheckedChange={(checked) => handleSwitchChange('habilitarAvisosApenasAgendamentosFuturos', checked)}
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

                          <Separator />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <Label htmlFor="habilitarFollowUpOrcamentosEnviados">Follow-up automático de orçamentos enviados</Label>
                                <p className="text-sm text-lunar-textSecondary">Cria uma tarefa após X dias</p>
                              </div>
                              <Switch
                                id="habilitarFollowUpOrcamentosEnviados"
                                checked={formData.habilitarFollowUpOrcamentosEnviados}
                                onCheckedChange={(checked) => handleSwitchChange('habilitarFollowUpOrcamentosEnviados', checked)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="diasParaFollowUpOrcamento">Dias para follow-up</Label>
                              <Input
                                id="diasParaFollowUpOrcamento"
                                type="number"
                                min={1}
                                max={30}
                                value={formData.diasParaFollowUpOrcamento}
                                onChange={(e) => {
                                  const v = Math.max(1, Math.min(30, Number(e.target.value) || 1));
                                  setFormData(prev => ({ ...prev, diasParaFollowUpOrcamento: v }));
                                  savePreferences({ diasParaFollowUpOrcamento: v });
                                }}
                              />
                            </div>
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

                <TabsContent value="aparencia" className="space-y-6 mt-6">
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Aparência</h3>
                    <p className="text-lunar-textSecondary text-sm">Escolha a cor do sistema para botões, bordas e gráficos</p>
                    <p className="text-[11px] text-lunar-textSecondary">Selecione uma cor e clique em “Salvar e recarregar” para aplicar.</p>
                  </div>

                  <ThemeColorPicker
                    valueKey={formData.temaCor as any}
                    valueHex={formData.temaCorHex}
                    onChange={({ temaCor, temaCorHex }) => {
                      setFormData(prev => ({ ...prev, temaCor, temaCorHex }));
                    }}
                  />

                  <div className="flex items-center justify-end">
                    <Button
                      onClick={async () => {
                        const ok = await savePreferences({ temaCor: formData.temaCor, temaCorHex: formData.temaCorHex });
                        if (ok) {
                          toast.success('Tema salvo. Recarregando...');
                          window.location.reload();
                        } else {
                          toast.error('Não foi possível salvar o tema. Tente novamente.');
                        }
                      }}
                    >
                      Salvar e recarregar
                    </Button>
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
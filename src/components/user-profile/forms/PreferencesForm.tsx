import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPreferences, RegimeTributario } from '@/types/userProfile';

interface PreferencesFormProps {
  preferences: UserPreferences;
  onChange: (field: keyof UserPreferences, value: boolean | RegimeTributario) => void;
}

export function PreferencesForm({ preferences, onChange }: PreferencesFormProps) {
  return (
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
                checked={preferences.notificacoesWhatsapp}
                onCheckedChange={(checked) => onChange('notificacoesWhatsapp', checked)}
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
                checked={preferences.habilitarAutomacoesWorkflow}
                onCheckedChange={(checked) => onChange('habilitarAutomacoesWorkflow', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="habilitarAlertaProdutosDoCliente">Alertar sobre produtos do cliente</Label>
                <p className="text-sm text-lunar-textSecondary">Mostra um aviso quando o cliente possui produtos vinculados</p>
              </div>
              <Switch
                id="habilitarAlertaProdutosDoCliente"
                checked={preferences.habilitarAlertaProdutosDoCliente}
                onCheckedChange={(checked) => onChange('habilitarAlertaProdutosDoCliente', checked)}
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
  );
}
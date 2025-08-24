import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { useAgenda } from '@/hooks/useAgenda';
import { useTasks } from '@/hooks/useTasks';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, Play, RefreshCw, Plus } from 'lucide-react';

export function AutomationDebugger() {
  const { appointments, addAppointment } = useAgenda();
  const { tasks } = useTasks();
  const [testClient, setTestClient] = useState('Cliente Teste');
  const [testDays, setTestDays] = useState('2');
  const [testStatus, setTestStatus] = useState<'a confirmar' | 'confirmado'>('a confirmar');

  const automationFlags = storage.load(STORAGE_KEYS.AUTOMATION_FLAGS, {} as Record<string, boolean>);
  const followupFlags = storage.load(STORAGE_KEYS.FOLLOWUP_FLAGS, {} as Record<string, boolean>);

  const clearAllFlags = () => {
    storage.save(STORAGE_KEYS.AUTOMATION_FLAGS, {});
    storage.save(STORAGE_KEYS.FOLLOWUP_FLAGS, {});
    toast({ title: 'Flags limpos', description: 'Todas as flags de automação foram removidas.' });
  };

  const clearSpecificFlag = (key: string) => {
    const flags = { ...automationFlags };
    delete flags[key];
    storage.save(STORAGE_KEYS.AUTOMATION_FLAGS, flags);
    toast({ title: 'Flag removido', description: `Flag ${key} foi removido.` });
  };

  const createTestAppointment = () => {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + parseInt(testDays));
    
    const testAppointment = {
      title: `Sessão ${testClient}`,
      date: testDate,
      time: '14:00',
      type: 'Teste',
      client: testClient,
      status: testStatus,
      description: 'Appointment criado para teste de automações',
      produtosIncluidos: testStatus === 'confirmado' ? [
        { id: '1', nome: 'Produto Teste', quantidade: 1, valorUnitario: 100, tipo: 'incluso' as const }
      ] : undefined
    };

    addAppointment(testAppointment);
    toast({ 
      title: 'Appointment criado', 
      description: `Appointment de teste criado para ${testDays} dias no futuro com status "${testStatus}".` 
    });
  };

  const forceAutomationRun = () => {
    // Trigger a custom event to force automation engine to run
    window.dispatchEvent(new CustomEvent('force-automation-check'));
    toast({ title: 'Automação forçada', description: 'Verificação de automações executada manualmente.' });
  };

  const futureAppointments = appointments.filter(app => {
    const appDate = app.date instanceof Date ? app.date : new Date(app.date);
    return appDate > new Date();
  });

  const automationTasks = tasks.filter(task => task.source === 'automation');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-lunar-accent" />
          Debug de Automações
        </CardTitle>
        <CardDescription>
          Ferramentas para testar e debugar o sistema de automações do workflow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Geral */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-lunar-surface/30 rounded-lg">
            <div className="text-2xl font-bold text-lunar-accent">{futureAppointments.length}</div>
            <div className="text-sm text-lunar-textSecondary">Agendamentos Futuros</div>
          </div>
          <div className="text-center p-4 bg-lunar-surface/30 rounded-lg">
            <div className="text-2xl font-bold text-lunar-accent">{Object.keys(automationFlags).length}</div>
            <div className="text-sm text-lunar-textSecondary">Flags Ativas</div>
          </div>
          <div className="text-center p-4 bg-lunar-surface/30 rounded-lg">
            <div className="text-2xl font-bold text-lunar-accent">{automationTasks.length}</div>
            <div className="text-sm text-lunar-textSecondary">Tarefas Criadas</div>
          </div>
        </div>

        <Separator />

        {/* Controles de Teste */}
        <div className="space-y-4">
          <h4 className="font-medium">Criar Appointment de Teste</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input 
                value={testClient} 
                onChange={(e) => setTestClient(e.target.value)}
                placeholder="Cliente Teste"
              />
            </div>
            <div className="space-y-2">
              <Label>Dias no Futuro</Label>
              <Input 
                type="number" 
                value={testDays} 
                onChange={(e) => setTestDays(e.target.value)}
                min="1"
                max="30"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={testStatus} onValueChange={(value) => setTestStatus(value as 'a confirmar' | 'confirmado')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a confirmar">A Confirmar</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={createTestAppointment} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Criar Appointment
            </Button>
            <Button onClick={forceAutomationRun} variant="outline" className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Forçar Verificação
            </Button>
          </div>
        </div>

        <Separator />

        {/* Agendamentos Futuros */}
        <div className="space-y-4">
          <h4 className="font-medium">Agendamentos Futuros ({futureAppointments.length})</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {futureAppointments.map(app => {
              const appDate = app.date instanceof Date ? app.date : new Date(app.date);
              const now = new Date();
              const daysDiff = Math.ceil((appDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              
              return (
                <div key={app.id} className="p-3 bg-lunar-surface/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{app.client}</div>
                      <div className="text-sm text-lunar-textSecondary">
                        {format(appDate, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })} 
                        <span className="ml-2">({daysDiff} dias)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={app.status === 'confirmado' ? 'default' : 'secondary'}>
                        {app.status}
                      </Badge>
                      {app.produtosIncluidos?.length && (
                        <Badge variant="outline">{app.produtosIncluidos.length} produtos</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {futureAppointments.length === 0 && (
              <div className="text-center text-lunar-textSecondary py-4">
                Nenhum agendamento futuro encontrado
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Flags Ativas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Flags de Automação Ativas ({Object.keys(automationFlags).length})</h4>
            <Button onClick={clearAllFlags} variant="destructive" size="sm" className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Limpar Todos
            </Button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {Object.entries(automationFlags).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-2 bg-lunar-surface/20 rounded">
                <span className="text-sm font-mono">{key}</span>
                <Button 
                  onClick={() => clearSpecificFlag(key)} 
                  variant="ghost" 
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {Object.keys(automationFlags).length === 0 && (
              <div className="text-center text-lunar-textSecondary py-4">
                Nenhuma flag ativa
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Tarefas Criadas por Automação */}
        <div className="space-y-4">
          <h4 className="font-medium">Tarefas Criadas por Automação ({automationTasks.length})</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {automationTasks.map(task => (
              <div key={task.id} className="p-3 bg-lunar-surface/20 rounded-lg">
                <div className="font-medium">{task.title}</div>
                <div className="text-sm text-lunar-textSecondary">
                  {task.description}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={task.status === 'done' ? 'default' : 'secondary'}>
                    {task.status}
                  </Badge>
                  <Badge variant="outline">{task.priority}</Badge>
                  {task.dueDate && (
                    <span className="text-xs text-lunar-textSecondary">
                      Vence: {format(new Date(task.dueDate), 'dd/MM HH:mm')}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {automationTasks.length === 0 && (
              <div className="text-center text-lunar-textSecondary py-4">
                Nenhuma tarefa criada por automação
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
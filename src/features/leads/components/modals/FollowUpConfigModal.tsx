import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFollowUpSystem } from '@/hooks/useFollowUpSystem';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { Clock, Settings } from 'lucide-react';

interface FollowUpConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FollowUpConfigModal({ open, onOpenChange }: FollowUpConfigModalProps) {
  const { config, updateConfig } = useFollowUpSystem();
  const { statuses } = useLeadStatuses();
  
  const [formData, setFormData] = useState(config);

  const handleSave = () => {
    updateConfig(formData);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setFormData(config);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurar Follow-up
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Sistema Ativo */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Sistema de Follow-up</CardTitle>
                  <CardDescription className="text-xs">
                    Ativar notificações automáticas para leads sem interação
                  </CardDescription>
                </div>
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, ativo: checked }))
                  }
                />
              </div>
            </CardHeader>
          </Card>

          {formData.ativo && (
            <>
              {/* Status Monitorado */}
              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium">
                  Status para Monitoramento
                </Label>
                <Select
                  value={formData.statusMonitorado}
                  onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, statusMonitorado: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map(status => (
                      <SelectItem key={status.id} value={status.key}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-lunar-textSecondary">
                  Leads neste status serão monitorados para follow-up
                </p>
              </div>

              {/* Dias para Follow-up */}
              <div className="space-y-2">
                <Label htmlFor="dias" className="text-sm font-medium">
                  Dias para Follow-up
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="dias"
                    type="number"
                    min="1"
                    max="30"
                    value={formData.diasParaFollowUp}
                    onChange={(e) => 
                      setFormData(prev => ({ 
                        ...prev, 
                        diasParaFollowUp: parseInt(e.target.value) || 1 
                      }))
                    }
                    className="w-20"
                  />
                  <span className="text-sm text-lunar-textSecondary">dias</span>
                </div>
                <p className="text-xs text-lunar-textSecondary">
                  Notificação será criada após este período sem mudança de status
                </p>
              </div>

              {/* Preview */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900">Como funciona:</p>
                      <p className="text-blue-700 mt-1">
                        Quando um lead estiver em <strong>"{statuses.find(s => s.key === formData.statusMonitorado)?.name}"</strong> por <strong>{formData.diasParaFollowUp} dias</strong> sem interação, 
                        uma notificação aparecerá no dashboard e o card receberá uma tag vermelha "Follow-up".
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} className="flex-1">
            Salvar Configuração
          </Button>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Wrench, Calculator, Calendar, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { formatDateForDisplay } from '@/utils/dateUtils';
import { EstruturaCustosService } from '@/services/PricingService';

interface EquipmentSyncModalProps {
  equipment: {
    transacaoId: string;
    nome: string;
    valor: number;
    data: string;
    observacoes?: string;
    allTransactionIds?: string[];
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onClose: () => void;
}

export function EquipmentSyncModal({ 
  equipment, 
  open, 
  onOpenChange, 
  onSuccess, 
  onClose 
}: EquipmentSyncModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: equipment.observacoes || equipment.nome || `Equipamento R$ ${equipment.valor.toFixed(2)}`,
    vidaUtil: '5'
  });

  // Identificar se é parcelado
  const isInstallment = equipment.observacoes?.includes('parcelado') || false;

  // Cálculos automáticos
  const vidaUtilAnos = parseInt(formData.vidaUtil) || 5;
  const depreciacaoMensal = equipment.valor / (vidaUtilAnos * 12);

  const handleConfirm = async () => {
    if (!formData.nome.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do equipamento.",
        variant: "destructive"
      });
      return;
    }

    if (vidaUtilAnos < 1 || vidaUtilAnos > 20) {
      toast({
        title: "Vida útil inválida",
        description: "A vida útil deve estar entre 1 e 20 anos.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Usar diretamente o EstruturaCustosService
      const sucesso = EstruturaCustosService.adicionarEquipamento({
        nome: formData.nome.trim(),
        valorPago: equipment.valor,
        dataCompra: equipment.data,
        vidaUtil: vidaUtilAnos
      });

      if (sucesso) {
        // Marcar transações como processadas para evitar re-notificações
        const processedIds = JSON.parse(localStorage.getItem('equipment_processed_ids') || '[]');
        const allIds = equipment.allTransactionIds || [equipment.transacaoId];
        const updatedIds = [...processedIds, ...allIds];
        localStorage.setItem('equipment_processed_ids', JSON.stringify(updatedIds));
        
        toast({
          title: "✅ Equipamento Adicionado",
          description: `${formData.nome} foi adicionado à precificação com depreciação de R$ ${depreciacaoMensal.toFixed(2)}/mês.`
        });
        
        console.log('🔧 [EquipmentModal] Equipamento criado com sucesso, transações marcadas:', allIds);
        onSuccess();
      } else {
        toast({
          title: "Erro ao adicionar",
          description: "Falha ao criar equipamento na precificação.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao criar equipamento:', error);
      toast({
        title: "Erro inesperado",
        description: "Falha ao processar a solicitação.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <Wrench className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Adicionar à Precificação</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Configure o equipamento para cálculo de depreciação
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dados Automáticos */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Valor:</span>
                  <Badge variant="secondary">
                    R$ {equipment.valor.toFixed(2)}
                  </Badge>
                  {isInstallment && (
                    <Badge variant="outline" className="text-xs">
                      Total
                    </Badge>
                  )}
                  <span className="text-muted-foreground text-xs">(automático)</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Data:</span>
                  <Badge variant="secondary">
                    {formatDateForDisplay(equipment.data)}
                  </Badge>
                  {isInstallment && (
                    <Badge variant="outline" className="text-xs">
                      Compra
                    </Badge>
                  )}
                  <span className="text-muted-foreground text-xs">(automático)</span>
                </div>

                {isInstallment && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-4 w-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                      📋
                    </div>
                    <span className="font-medium">Tipo:</span>
                    <Badge variant="outline" className="text-blue-600">
                      {equipment.observacoes}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Configuração Manual */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="nome" className="text-sm">Nome do Equipamento</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: C��mera Canon EOS R5, Tripé Manfrotto..."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="vidaUtil" className="text-sm">Vida Útil (Anos)</Label>
              <Select
                value={formData.vidaUtil}
                onValueChange={(value) => setFormData(prev => ({ ...prev, vidaUtil: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 anos</SelectItem>
                  <SelectItem value="3">3 anos</SelectItem>
                  <SelectItem value="4">4 anos</SelectItem>
                  <SelectItem value="5">5 anos (padrão)</SelectItem>
                  <SelectItem value="6">6 anos</SelectItem>
                  <SelectItem value="7">7 anos</SelectItem>
                  <SelectItem value="8">8 anos</SelectItem>
                  <SelectItem value="10">10 anos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Preview do Cálculo */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Cálculo Automático</span>
              </div>
              
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Depreciação mensal:</span>
                  <span className="font-medium text-primary">
                    R$ {depreciacaoMensal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vida útil:</span>
                  <span>{vidaUtilAnos} anos ({vidaUtilAnos * 12} meses)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={handleCancel}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm}
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Adicionando...
                </div>
              ) : (
                'Confirmar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
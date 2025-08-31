import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { EstruturaCustosService } from '@/services/PricingService';

interface AddEquipmentFromTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentData: {
    nome: string;
    valor: number;
    data: string;
  };
}

export function AddEquipmentFromTransactionModal({
  isOpen,
  onClose,
  equipmentData
}: AddEquipmentFromTransactionModalProps) {
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    nome: equipmentData.nome,
    valorPago: equipmentData.valor.toString(),
    dataCompra: equipmentData.data,
    vidaUtil: '5'
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.nome || !formData.valorPago) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e valor são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      // Carregar dados atuais da precificação
      const dadosAtuais = EstruturaCustosService.carregar();
      
      // Criar novo equipamento
      const novoEquipamento = {
        id: Date.now().toString(),
        nome: formData.nome,
        valorPago: parseFloat(formData.valorPago) || 0,
        dataCompra: formData.dataCompra || new Date().toISOString().split('T')[0],
        vidaUtil: parseInt(formData.vidaUtil) || 5
      };

      // Adicionar à lista existente
      const equipamentosAtualizados = [...dadosAtuais.equipamentos, novoEquipamento];

      // Salvar de volta
      const dadosAtualizados = {
        ...dadosAtuais,
        equipamentos: equipamentosAtualizados
      };

      const sucesso = EstruturaCustosService.salvar(dadosAtualizados);

      if (sucesso) {
        toast({
          title: "Equipamento adicionado",
          description: "Equipamento foi adicionado com sucesso à precificação."
        });
        onClose();
      } else {
        throw new Error('Falha ao salvar equipamento');
      }

    } catch (error) {
      console.error('Erro ao salvar equipamento:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível adicionar o equipamento.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Equipamento à Precificação</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome do Equipamento</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="Ex: Câmera Canon EOS R6"
            />
          </div>

          <div>
            <Label htmlFor="valorPago">Valor Pago (R$)</Label>
            <Input
              id="valorPago"
              type="number"
              min="0"
              step="0.01"
              value={formData.valorPago}
              onChange={(e) => setFormData(prev => ({ ...prev, valorPago: e.target.value }))}
              placeholder="0,00"
            />
          </div>

          <div>
            <Label htmlFor="dataCompra">Data da Compra</Label>
            <Input
              id="dataCompra"
              type="date"
              value={formData.dataCompra}
              onChange={(e) => setFormData(prev => ({ ...prev, dataCompra: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="vidaUtil">Vida Útil (anos)</Label>
            <Input
              id="vidaUtil"
              type="number"
              min="1"
              max="20"
              value={formData.vidaUtil}
              onChange={(e) => setFormData(prev => ({ ...prev, vidaUtil: e.target.value }))}
              placeholder="5"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? 'Salvando...' : 'Adicionar à Precificação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
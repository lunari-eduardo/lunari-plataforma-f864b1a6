import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NovaTransacaoFinanceira } from '@/types/financas';
import { parseFinancialInput } from '@/utils/financialPrecision';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: Partial<NovaTransacaoFinanceira>) => void;
  initialData: {
    valor: number;
    data_vencimento: string;
    observacoes?: string | null;
  };
}

export default function EditTransactionModal({
  isOpen,
  onClose,
  onSave,
  initialData
}: EditTransactionModalProps) {
  const [valor, setValor] = useState(initialData.valor.toString());
  const [dataVencimento, setDataVencimento] = useState(initialData.data_vencimento);
  const [observacoes, setObservacoes] = useState(initialData.observacoes || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    // Validações com precisão financeira
    const valorNumerico = parseFinancialInput(valor);
    if (valorNumerico <= 0) {
      alert('Por favor, insira um valor válido maior que zero');
      return;
    }

    if (!dataVencimento) {
      alert('Por favor, insira uma data válida');
      return;
    }

    setIsLoading(true);
    
    try {
      onSave({
        valor: valorNumerico,
        data_vencimento: dataVencimento,
        observacoes: observacoes.trim() || null
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      alert('Erro ao salvar a transação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Resetar valores ao fechar
    setValor(initialData.valor.toString());
    setDataVencimento(initialData.data_vencimento);
    setObservacoes(initialData.observacoes || '');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="valor">Valor</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </div>
          
          <div>
            <Label htmlFor="data">Data de Vencimento</Label>
            <Input
              id="data"
              type="date"
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Adicione observações..."
              rows={3}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
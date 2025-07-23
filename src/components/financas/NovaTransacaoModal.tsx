
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TransacaoFinanceira, CategoriaFinanceira, TipoTransacao, TipoRecorrencia } from "@/types/financas";
import { formatCurrency, parseCurrency } from "@/utils/financialUtils";

interface NovaTransacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: CategoriaFinanceira[];
  onSalvar: (transacao: Omit<TransacaoFinanceira, 'id' | 'userId' | 'criadoEm'>) => void;
  transacaoEdit?: TransacaoFinanceira | null;
}

export default function NovaTransacaoModal({
  open,
  onOpenChange,
  categorias,
  onSalvar,
  transacaoEdit
}: NovaTransacaoModalProps) {
  const [formData, setFormData] = useState({
    tipo: 'despesa' as TipoTransacao,
    categoriaId: '',
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    observacoes: '',
    tipoRecorrencia: 'unica' as TipoRecorrencia,
    quantidadeParcelas: 1,
    dataInicio: new Date().toISOString().split('T')[0]
  });

  const resetForm = () => {
    setFormData({
      tipo: 'despesa',
      categoriaId: '',
      descricao: '',
      valor: '',
      data: new Date().toISOString().split('T')[0],
      observacoes: '',
      tipoRecorrencia: 'unica',
      quantidadeParcelas: 1,
      dataInicio: new Date().toISOString().split('T')[0]
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const valorNumerico = parseCurrency(formData.valor);
    
    if (!formData.categoriaId || !formData.descricao || valorNumerico <= 0) {
      return;
    }

    const novaTransacao: Omit<TransacaoFinanceira, 'id' | 'userId' | 'criadoEm'> = {
      tipo: formData.tipo,
      categoriaId: formData.categoriaId,
      descricao: formData.descricao,
      valor: valorNumerico,
      data: formData.data,
      observacoes: formData.observacoes || undefined,
      tipoRecorrencia: formData.tipoRecorrencia,
      quantidadeParcelas: formData.tipoRecorrencia === 'parcelada' ? formData.quantidadeParcelas : undefined,
      dataInicio: formData.tipoRecorrencia === 'parcelada' ? formData.dataInicio : undefined,
      status: 'faturado'
    };

    onSalvar(novaTransacao);
    resetForm();
    onOpenChange(false);
  };

  const categoriasFiltradas = categorias.filter(categoria => {
    if (formData.tipo === 'receita') {
      return categoria.tipo === 'receita_nao_operacional';
    } else {
      return categoria.tipo !== 'receita_nao_operacional';
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {transacaoEdit ? 'Editar Transação' : 'Nova Transação'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tipo">Tipo</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value: TipoTransacao) => {
                  setFormData(prev => ({ 
                    ...prev, 
                    tipo: value,
                    categoriaId: '' // Reset categoria quando muda o tipo
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={formData.categoriaId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, categoriaId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {categoriasFiltradas.map(categoria => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Ex: Assinatura do Figma"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="valor">Valor</Label>
              <Input
                id="valor"
                value={formData.valor}
                onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                placeholder="R$ 0,00"
                required
              />
            </div>

            <div>
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                type="date"
                value={formData.data}
                onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="recorrencia">Tipo de Recorrência</Label>
            <Select
              value={formData.tipoRecorrencia}
              onValueChange={(value: TipoRecorrencia) => 
                setFormData(prev => ({ ...prev, tipoRecorrencia: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unica">Única</SelectItem>
                <SelectItem value="parcelada">Parcelada</SelectItem>
                <SelectItem value="programada">Programada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.tipoRecorrencia === 'parcelada' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="parcelas">Qtd. Parcelas</Label>
                <Input
                  id="parcelas"
                  type="number"
                  min="2"
                  max="60"
                  value={formData.quantidadeParcelas}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    quantidadeParcelas: parseInt(e.target.value) 
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="dataInicio">Data de Início</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={formData.dataInicio}
                  onChange={(e) => setFormData(prev => ({ ...prev, dataInicio: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
              placeholder="Observações adicionais (opcional)"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {transacaoEdit ? 'Salvar Alterações' : 'Adicionar Transação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

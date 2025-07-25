import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/utils/localStorage';

interface ProdutoAdicional {
  id: string;
  nome: string;
  custo: number;
  valorVenda: number;
  quantidade: number;
}

interface SalvarPacoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  precoFinal: number;
  produtos: ProdutoAdicional[];
  horasEstimadas: number;
  markup: number;
}

export function SalvarPacoteModal({
  isOpen,
  onClose,
  precoFinal,
  produtos,
  horasEstimadas,
  markup
}: SalvarPacoteModalProps) {
  const { categorias } = useAppContext();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    categoria_id: '',
    valor_base: precoFinal,
    valor_foto_extra: 35,
    observacoes: ''
  });

  // Atualizar valor base quando precoFinal mudar
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      valor_base: precoFinal
    }));
  }, [precoFinal]);

  // Gerar nome sugerido baseado nos produtos e preço
  useEffect(() => {
    if (produtos.length > 0) {
      const nomesProdutos = produtos.map(p => p.nome).join(', ');
      const nomeSugerido = `Pacote ${precoFinal.toFixed(0)} - ${nomesProdutos.substring(0, 30)}${nomesProdutos.length > 30 ? '...' : ''}`;
      setFormData(prev => ({
        ...prev,
        nome: prev.nome || nomeSugerido
      }));
    }
  }, [produtos, precoFinal]);

  const handleSave = () => {
    if (!formData.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome do pacote é obrigatório",
        variant: "destructive"
      });
      return;
    }

    // Mapear produtos para o formato esperado
    const produtosIncluidos = produtos.map(produto => ({
      produtoId: produto.id,
      quantidade: produto.quantidade
    }));

    // Criar novo pacote
    const novoPacote = {
      id: Date.now().toString(),
      nome: formData.nome.trim(),
      categoria_id: formData.categoria_id || '1', // Default para primeira categoria
      valor_base: formData.valor_base,
      valor_foto_extra: formData.valor_foto_extra,
      produtosIncluidos,
      // Metadados da precificação para referência
      metadata: {
        horasEstimadas,
        markup,
        criadoEm: new Date().toISOString(),
        origem: 'precificacao'
      }
    };

    // Salvar no localStorage
    const pacotesExistentes = storage.load('configuracoes_pacotes', []);
    const novosPacotes = [...pacotesExistentes, novoPacote];
    storage.save('configuracoes_pacotes', novosPacotes);

    toast({
      title: "Sucesso",
      description: `Pacote "${formData.nome}" criado com sucesso!`,
    });

    // Limpar formulário e fechar
    setFormData({
      nome: '',
      categoria_id: '',
      valor_base: precoFinal,
      valor_foto_extra: 35,
      observacoes: ''
    });
    onClose();
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      categoria_id: '',
      valor_base: precoFinal,
      valor_foto_extra: 35,
      observacoes: ''
    });
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Salvar Novo Pacote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nome do Pacote */}
          <div>
            <Label htmlFor="nome">Nome do Pacote *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="Ex: Pacote Completo Gestante"
              className="mt-1"
            />
          </div>

          {/* Categoria */}
          <div>
            <Label htmlFor="categoria">Categoria</Label>
            <Select 
              value={formData.categoria_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, categoria_id: value }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((categoria, index) => (
                  <SelectItem key={index + 1} value={String(index + 1)}>
                    {categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor Base */}
          <div>
            <Label htmlFor="valor_base">Valor Base do Pacote</Label>
            <Input
              id="valor_base"
              type="number"
              min="0"
              step="0.01"
              value={formData.valor_base}
              onChange={(e) => setFormData(prev => ({ ...prev, valor_base: parseFloat(e.target.value) || 0 }))}
              className="mt-1"
            />
          </div>

          {/* Valor Foto Extra */}
          <div>
            <Label htmlFor="valor_foto_extra">Valor Foto Extra</Label>
            <Input
              id="valor_foto_extra"
              type="number"
              min="0"
              step="0.01"
              value={formData.valor_foto_extra}
              onChange={(e) => setFormData(prev => ({ ...prev, valor_foto_extra: parseFloat(e.target.value) || 0 }))}
              className="mt-1"
            />
          </div>

          {/* Resumo dos produtos inclusos */}
          {produtos.length > 0 && (
            <div className="bg-lunar-bg/50 p-3 rounded-lg">
              <p className="text-sm font-medium text-lunar-text mb-2">
                Produtos Inclusos ({produtos.length}):
              </p>
              <div className="space-y-1">
                {produtos.map((produto, index) => (
                  <div key={index} className="text-xs text-lunar-textSecondary">
                    • {produto.nome} ({produto.quantidade}x)
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar Pacote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
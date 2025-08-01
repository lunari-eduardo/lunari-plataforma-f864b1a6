import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Save, Settings } from 'lucide-react';
import { toast } from 'sonner';
import {
  TabelaPrecos,
  FaixaPreco,
  obterTabelaCategoria,
  salvarTabelaCategoria,
  criarTabelaExemplo,
  validarTabelaPrecos,
  formatarMoeda,
  calcularTotalFotosExtras
} from '@/utils/precificacaoUtils';

interface TabelaPrecosModalProps {
  categoriaId: string;
  categoriaNome: string;
  categoriaCor: string;
}

export default function TabelaPrecosModal({ categoriaId, categoriaNome, categoriaCor }: TabelaPrecosModalProps) {
  const [open, setOpen] = useState(false);
  const [tabela, setTabela] = useState<TabelaPrecos | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewQuantidade, setPreviewQuantidade] = useState(10);

  // Carregar tabela da categoria ao abrir modal
  useEffect(() => {
    if (open) {
      const tabelaExistente = obterTabelaCategoria(categoriaId);
      if (tabelaExistente) {
        setTabela(tabelaExistente);
      } else {
        // Criar tabela exemplo se não existir
        const novaTabela = {
          ...criarTabelaExemplo(),
          id: `categoria_${categoriaId}_${Date.now()}`,
          nome: `Tabela ${categoriaNome}`
        };
        setTabela(novaTabela);
      }
    }
  }, [open, categoriaId, categoriaNome]);

  const salvarTabela = async () => {
    if (!tabela) return;

    setLoading(true);
    try {
      const erros = validarTabelaPrecos(tabela);
      if (erros.length > 0) {
        toast.error(`Erro na validação: ${erros[0]}`);
        return;
      }

      salvarTabelaCategoria(categoriaId, tabela);
      toast.success('Tabela de preços salva com sucesso!');
      setOpen(false);
    } catch (error) {
      console.error('Erro ao salvar tabela:', error);
      toast.error('Erro ao salvar tabela de preços');
    } finally {
      setLoading(false);
    }
  };

  const adicionarFaixa = () => {
    if (!tabela) return;
    
    const ultimaFaixa = tabela.faixas[tabela.faixas.length - 1];
    const novaFaixa: FaixaPreco = {
      min: ultimaFaixa ? (ultimaFaixa.max || ultimaFaixa.min) + 1 : 1,
      max: null,
      valor: 20
    };
    
    setTabela(prev => prev ? {
      ...prev,
      faixas: [...prev.faixas, novaFaixa]
    } : null);
  };

  const removerFaixa = (index: number) => {
    if (!tabela) return;
    
    setTabela(prev => prev ? {
      ...prev,
      faixas: prev.faixas.filter((_, i) => i !== index)
    } : null);
  };

  const atualizarFaixa = (index: number, campo: keyof FaixaPreco, valor: any) => {
    if (!tabela) return;
    
    setTabela(prev => prev ? {
      ...prev,
      faixas: prev.faixas.map((faixa, i) => 
        i === index ? { ...faixa, [campo]: valor } : faixa
      )
    } : null);
  };

  const atualizarNomeTabela = (nome: string) => {
    setTabela(prev => prev ? { ...prev, nome } : null);
  };

  const calcularPreview = () => {
    if (!tabela || previewQuantidade <= 0) return 'Configure a quantidade';
    
    // Simular cálculo usando a tabela atual
    let valorUnitario = 0;
    const faixasOrdenadas = [...tabela.faixas].sort((a, b) => a.min - b.min);
    
    for (const faixa of faixasOrdenadas) {
      if (previewQuantidade >= faixa.min && (faixa.max === null || previewQuantidade <= faixa.max)) {
        valorUnitario = faixa.valor;
        break;
      }
    }
    
    if (valorUnitario === 0 && faixasOrdenadas.length > 0) {
      valorUnitario = faixasOrdenadas[faixasOrdenadas.length - 1].valor;
    }
    
    const total = previewQuantidade * valorUnitario;
    return `${formatarMoeda(valorUnitario)} por foto = ${formatarMoeda(total)} total`;
  };

  const tabelaExistente = obterTabelaCategoria(categoriaId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Settings className="h-3 w-3" />
          {tabelaExistente ? 'Editar Preços' : 'Configurar Preços'}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full" 
              style={{ backgroundColor: categoriaCor }}
            />
            Configurar Preços - {categoriaNome}
          </DialogTitle>
          <DialogDescription>
            Configure a tabela de preços progressivos para fotos extras desta categoria
          </DialogDescription>
        </DialogHeader>

        {tabela && (
          <div className="space-y-6">
            {/* Nome da Tabela */}
            <div>
              <Label>Nome da Tabela</Label>
              <Input
                value={tabela.nome}
                onChange={(e) => atualizarNomeTabela(e.target.value)}
                placeholder="Nome da tabela de preços"
                className="mt-1"
              />
            </div>

            {/* Tabela de Faixas */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base font-medium">Faixas de Preços</Label>
                <Button onClick={adicionarFaixa} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Faixa
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quantidade (De)</TableHead>
                      <TableHead>Até</TableHead>
                      <TableHead>Valor por Foto</TableHead>
                      <TableHead className="w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tabela.faixas.map((faixa, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            type="number"
                            value={faixa.min}
                            onChange={(e) => atualizarFaixa(index, 'min', parseInt(e.target.value) || 0)}
                            className="w-20"
                            min="1"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={faixa.max || ''}
                            onChange={(e) => atualizarFaixa(index, 'max', e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="∞"
                            className="w-20"
                            min={faixa.min}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-sm">R$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={faixa.valor}
                              onChange={(e) => atualizarFaixa(index, 'valor', parseFloat(e.target.value) || 0)}
                              className="w-24"
                              min="0"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => removerFaixa(index)}
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            disabled={tabela.faixas.length <= 1}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {tabela.faixas.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma faixa configurada</p>
                  <Button onClick={adicionarFaixa} variant="outline" className="mt-2">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Primeira Faixa
                  </Button>
                </div>
              )}
            </div>

            {/* Preview de Cálculo */}
            <div className="bg-muted p-4 rounded-lg">
              <Label className="text-base font-medium">Preview de Cálculo</Label>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <Label>Quantidade:</Label>
                  <Input
                    type="number"
                    value={previewQuantidade}
                    onChange={(e) => setPreviewQuantidade(parseInt(e.target.value) || 0)}
                    className="w-20"
                    min="1"
                  />
                  <span className="text-sm text-muted-foreground">fotos</span>
                </div>
              </div>
              <div className="mt-2 text-sm">
                <strong>Resultado:</strong> {calcularPreview()}
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarTabela} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Salvando...' : 'Salvar Tabela'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Info, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import {
  ConfiguracaoPrecificacao,
  TabelaPrecos,
  FaixaPreco,
  obterConfiguracaoPrecificacao,
  salvarConfiguracaoPrecificacao,
  obterTabelaGlobal,
  salvarTabelaGlobal,
  criarTabelaExemplo,
  validarTabelaPrecos,
  formatarMoeda,
  calcularTotalFotosExtras,
  obterTabelaCategoria
} from '@/utils/precificacaoUtils';
import TabelaPrecosModal from './TabelaPrecosModal';
import { CongelamentoRegrasInfo } from "./CongelamentoRegrasInfo";
import { SnapshotControle } from './SnapshotControle';
import { useAppContext } from '@/contexts/AppContext';

interface PrecificacaoFotosProps {
  categorias: Array<{
    id: string;
    nome: string;
    cor: string;
  }>;
}

export default function PrecificacaoFotos({ categorias }: PrecificacaoFotosProps) {
  const { fazerSnapshotValores } = useAppContext();
  const [config, setConfig] = useState<ConfiguracaoPrecificacao>(obterConfiguracaoPrecificacao());
  const [tabelaGlobal, setTabelaGlobal] = useState<TabelaPrecos | null>(obterTabelaGlobal());
  const [editandoTabela, setEditandoTabela] = useState(false);
  const [previewQuantidade, setPreviewQuantidade] = useState(10);

  // Salvar configuração automaticamente
  useEffect(() => {
    const configAnterior = obterConfiguracaoPrecificacao();
    const mudouModelo = configAnterior.modelo !== config.modelo;
    
    // Fazer snapshot antes de salvar nova configuração
    if (mudouModelo) {
      console.log('🔄 Modelo mudou, fazendo snapshot dos valores...');
      fazerSnapshotValores();
    }
    
    salvarConfiguracaoPrecificacao(config);
    
    // Notificar outras partes do sistema sobre mudança de modelo
    const evento = new CustomEvent('precificacao-modelo-changed', { 
      detail: { novoModelo: config.modelo } 
    });
    window.dispatchEvent(evento);
  }, [config, fazerSnapshotValores]);

  // Salvar tabela global automaticamente
  useEffect(() => {
    if (tabelaGlobal) {
      salvarTabelaGlobal(tabelaGlobal);
    }
  }, [tabelaGlobal]);

  const handleModeloChange = (modelo: 'fixo' | 'global' | 'categoria') => {
    setConfig(prev => ({ ...prev, modelo }));
    
    if (modelo === 'global' && !tabelaGlobal) {
      // Criar tabela exemplo se não existir
      const novaTabela = criarTabelaExemplo();
      setTabelaGlobal(novaTabela);
    }
  };

  const adicionarFaixa = () => {
    if (!tabelaGlobal) return;
    
    const novaFaixa: FaixaPreco = {
      min: tabelaGlobal.faixas.length > 0 ? 
           (tabelaGlobal.faixas[tabelaGlobal.faixas.length - 1].max || 0) + 1 : 1,
      max: null,
      valor: 20
    };
    
    setTabelaGlobal(prev => prev ? {
      ...prev,
      faixas: [...prev.faixas, novaFaixa]
    } : null);
  };

  const removerFaixa = (index: number) => {
    if (!tabelaGlobal) return;
    
    setTabelaGlobal(prev => prev ? {
      ...prev,
      faixas: prev.faixas.filter((_, i) => i !== index)
    } : null);
  };

  const atualizarFaixa = (index: number, campo: keyof FaixaPreco, valor: any) => {
    if (!tabelaGlobal) return;
    
    setTabelaGlobal(prev => prev ? {
      ...prev,
      faixas: prev.faixas.map((faixa, i) => 
        i === index ? { ...faixa, [campo]: valor } : faixa
      )
    } : null);
  };

  const criarNovaTabelaGlobal = () => {
    const novaTabela = criarTabelaExemplo();
    setTabelaGlobal(novaTabela);
    setEditandoTabela(true);
    toast.success('Nova tabela criada! Configure as faixas de preços abaixo.');
  };

  const calcularPreview = () => {
    if (config.modelo === 'fixo') {
      return 'Depende do valor configurado em cada pacote';
    }
    
    if (config.modelo === 'global' && tabelaGlobal) {
      const total = calcularTotalFotosExtras(previewQuantidade);
      const valorUnitario = previewQuantidade > 0 ? total / previewQuantidade : 0;
      return `${formatarMoeda(valorUnitario)} por foto = ${formatarMoeda(total)} total`;
    }
    
    if (config.modelo === 'categoria') {
      return 'Depende da categoria do pacote selecionado';
    }
    
    return 'Configure o modelo para ver o preview';
  };

  return (
    <div className="space-y-6">
      {/* Sistema de Snapshot */}
      <SnapshotControle />
      
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Precificação de Fotos Extras</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure como os preços de fotos extras serão calculados no sistema.
        </p>
      </div>

      {/* Seletor de Modelo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modelo de Precificação</CardTitle>
          <CardDescription>
            Escolha como os preços de fotos extras serão determinados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={config.modelo} 
            onValueChange={handleModeloChange}
            className="space-y-4"
          >
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="fixo" id="fixo" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="fixo" className="font-medium">
                  Valor Fixo por Pacote
                </Label>
                <p className="text-sm text-muted-foreground">
                  Cada pacote tem seu próprio valor para fotos extras (modelo atual).
                  O valor é configurado individualmente na página de Pacotes.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="global" id="global" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="global" className="font-medium">
                  Tabela Progressiva Global
                </Label>
                <p className="text-sm text-muted-foreground">
                  Uma única tabela de preços progressivos aplicada a todos os pacotes.
                  O preço por foto diminui conforme a quantidade aumenta.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="categoria" id="categoria" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="categoria" className="font-medium">
                  Tabela Progressiva por Categoria
                </Label>
                <p className="text-sm text-muted-foreground">
                  Cada categoria de serviço tem sua própria tabela de preços progressivos.
                  Configure tabelas específicas para Gestante, Newborn, etc.
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Configuração da Tabela Global */}
      {config.modelo === 'global' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Tabela de Preços Global
            </CardTitle>
            <CardDescription>
              Configure as faixas de quantidade e seus respectivos valores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!tabelaGlobal ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Nenhuma tabela de preços configurada
                </p>
                <Button onClick={criarNovaTabelaGlobal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Tabela de Preços
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Nome da Tabela</Label>
                    <Input
                      value={tabelaGlobal.nome}
                      onChange={(e) => setTabelaGlobal(prev => prev ? 
                        { ...prev, nome: e.target.value } : null
                      )}
                      className="mt-1"
                      placeholder="Nome da tabela de preços"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setEditandoTabela(!editandoTabela)}
                  >
                    {editandoTabela ? 'Parar Edição' : 'Editar Tabela'}
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quantidade (De)</TableHead>
                        <TableHead>Até</TableHead>
                        <TableHead>Valor por Foto</TableHead>
                        {editandoTabela && <TableHead className="w-20">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tabelaGlobal.faixas.map((faixa, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {editandoTabela ? (
                              <Input
                                type="number"
                                value={faixa.min}
                                onChange={(e) => atualizarFaixa(index, 'min', parseInt(e.target.value) || 0)}
                                className="w-20"
                              />
                            ) : (
                              faixa.min
                            )}
                          </TableCell>
                          <TableCell>
                            {editandoTabela ? (
                              <Input
                                type="number"
                                value={faixa.max || ''}
                                onChange={(e) => atualizarFaixa(index, 'max', e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="∞"
                                className="w-20"
                              />
                            ) : (
                              faixa.max || '∞'
                            )}
                          </TableCell>
                          <TableCell>
                            {editandoTabela ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={faixa.valor}
                                onChange={(e) => atualizarFaixa(index, 'valor', parseFloat(e.target.value) || 0)}
                                className="w-24"
                              />
                            ) : (
                              formatarMoeda(faixa.valor)
                            )}
                          </TableCell>
                          {editandoTabela && (
                            <TableCell>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => removerFaixa(index)}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {editandoTabela && (
                  <Button onClick={adicionarFaixa} variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Faixa
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuração por Categoria */}
      {config.modelo === 'categoria' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuração por Categoria</CardTitle>
            <CardDescription>
              Configure tabelas de preços específicas para cada categoria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {categorias.map(categoria => {
                const temTabela = obterTabelaCategoria(categoria.id) !== null;
                return (
                  <div key={categoria.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: categoria.cor }}
                      />
                      <div>
                        <span className="font-medium">{categoria.nome}</span>
                        {temTabela && (
                          <div className="text-xs text-green-600 mt-1">
                            ✓ Tabela configurada
                          </div>
                        )}
                      </div>
                    </div>
                    <TabelaPrecosModal 
                      categoriaId={categoria.id}
                      categoriaNome={categoria.nome}
                      categoriaCor={categoria.cor}
                    />
                  </div>
                );
              })}
              {categorias.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma categoria cadastrada. Configure as categorias primeiro.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview de Cálculo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Preview de Cálculo
          </CardTitle>
          <CardDescription>
            Veja como o preço será calculado com o modelo atual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Quantidade de fotos para teste:</Label>
            <Input
              type="number"
              value={previewQuantidade}
              onChange={(e) => setPreviewQuantidade(parseInt(e.target.value) || 0)}
              className="w-24"
              min="1"
            />
          </div>
          
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Resultado:</strong> {calcularPreview()}
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Informações Importantes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-orange-600">
            Informações Importantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li>• A mudança de modelo afeta todos os cálculos futuros no sistema</li>
            <li>• Dados existentes no Workflow mantêm seus valores até serem recalculados</li>
            <li>• O modelo "Fixo por Pacote" é o comportamento atual do sistema</li>
            <li>• Tabelas progressivas permitem descontos por volume</li>
          </ul>
        </CardContent>
      </Card>

      {/* Informações sobre Congelamento de Regras */}
      <CongelamentoRegrasInfo />
    </div>
  );
}
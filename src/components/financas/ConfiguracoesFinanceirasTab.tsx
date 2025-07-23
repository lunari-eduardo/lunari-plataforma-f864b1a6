import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { useToast } from '@/hooks/use-toast';
interface ConfiguracoesFinanceirasTabProps {
  itensFinanceiros: ItemFinanceiro[];
  adicionarItemFinanceiro: (nome: string, grupo: GrupoPrincipal) => void;
  removerItemFinanceiro: (id: string) => void;
  atualizarItemFinanceiro: (id: string, dadosAtualizados: Partial<ItemFinanceiro>) => void;
}
export default function ConfiguracoesFinanceirasTab({
  itensFinanceiros,
  adicionarItemFinanceiro,
  removerItemFinanceiro,
  atualizarItemFinanceiro
}: ConfiguracoesFinanceirasTabProps) {
  const [novoItemNome, setNovoItemNome] = useState('');
  const [novoItemGrupo, setNovoItemGrupo] = useState<GrupoPrincipal>('Despesa Fixa');
  const [itemEditando, setItemEditando] = useState<string | null>(null);
  const [nomeEditando, setNomeEditando] = useState('');
  const {
    toast
  } = useToast();
  const grupos: GrupoPrincipal[] = ['Despesa Fixa', 'Despesa Variável', 'Investimento', 'Receita Não Operacional'];
  const handleAdicionarItem = () => {
    if (!novoItemNome.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira um nome para o item.",
        variant: "destructive"
      });
      return;
    }

    // Verificar se já existe um item com o mesmo nome
    const itemExistente = itensFinanceiros.find(item => item.nome.toLowerCase() === novoItemNome.trim().toLowerCase());
    if (itemExistente) {
      toast({
        title: "Erro",
        description: "Já existe um item com este nome.",
        variant: "destructive"
      });
      return;
    }
    adicionarItemFinanceiro(novoItemNome.trim(), novoItemGrupo);
    setNovoItemNome('');
    toast({
      title: "Sucesso",
      description: "Item adicionado com sucesso!"
    });
  };
  const handleEditarItem = (item: ItemFinanceiro) => {
    setItemEditando(item.id);
    setNomeEditando(item.nome);
  };
  const handleSalvarEdicao = (id: string) => {
    if (!nomeEditando.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira um nome válido.",
        variant: "destructive"
      });
      return;
    }

    // Verificar se já existe um item com o mesmo nome (exceto o atual)
    const itemExistente = itensFinanceiros.find(item => item.id !== id && item.nome.toLowerCase() === nomeEditando.trim().toLowerCase());
    if (itemExistente) {
      toast({
        title: "Erro",
        description: "Já existe um item com este nome.",
        variant: "destructive"
      });
      return;
    }
    atualizarItemFinanceiro(id, {
      nome: nomeEditando.trim()
    });
    setItemEditando(null);
    setNomeEditando('');
    toast({
      title: "Sucesso",
      description: "Item atualizado com sucesso!"
    });
  };
  const handleCancelarEdicao = () => {
    setItemEditando(null);
    setNomeEditando('');
  };
  const handleRemoverItem = (id: string, nome: string) => {
    if (confirm(`Tem certeza que deseja remover "${nome}"? Esta ação também removerá todas as transações relacionadas.`)) {
      removerItemFinanceiro(id);
      toast({
        title: "Sucesso",
        description: "Item removido com sucesso!"
      });
    }
  };
  const getCorGrupo = (grupo: GrupoPrincipal) => {
    switch (grupo) {
      case 'Despesa Fixa':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Despesa Variável':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Investimento':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Receita Não Operacional':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  const itensPorGrupo = grupos.reduce((acc, grupo) => {
    acc[grupo] = itensFinanceiros.filter(item => item.grupo_principal === grupo && item.ativo);
    return acc;
  }, {} as Record<GrupoPrincipal, ItemFinanceiro[]>);
  return <div className="space-y-6">
      {/* Formulário para Adicionar Novo Item */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-5 w-5" />
            Adicionar Novo Item Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome-item">Nome do Item</Label>
              <Input id="nome-item" placeholder="Ex: Adobe, Combustível, etc." value={novoItemNome} onChange={e => setNovoItemNome(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAdicionarItem()} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="grupo-item">Grupo Principal</Label>
              <Select value={novoItemGrupo} onValueChange={value => setNovoItemGrupo(value as GrupoPrincipal)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map(grupo => <SelectItem key={grupo} value={grupo}>
                      {grupo}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button onClick={handleAdicionarItem} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Itens por Grupo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-0 py-0">
        {grupos.map(grupo => <Card key={grupo} className="my-0 py-0">
            <CardHeader className="my-0 py-0">
              <CardTitle className="text-lg py-0 my-[4px]">
                <Badge className={getCorGrupo(grupo)}>
                  {grupo}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-[3px] my-0">
              {itensPorGrupo[grupo].length === 0 ? <p className="text-gray-500 text-sm italic py-0 my-0">Nenhum item cadastrado neste grupo.</p> : <div className="space-y-2">
                  {itensPorGrupo[grupo].map(item => <div key={item.id} className="flex items-center justify-between p-1 bg-gray-50 border rounded-md my-0 py-0 px-[5px]">
                      {itemEditando === item.id ? <div className="flex items-center gap-2 flex-1">
                          <Input value={nomeEditando} onChange={e => setNomeEditando(e.target.value)} className="flex-1" onKeyPress={e => e.key === 'Enter' && handleSalvarEdicao(item.id)} />
                          <Button size="sm" onClick={() => handleSalvarEdicao(item.id)}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelarEdicao}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div> : <>
                          <span className="text-gray-900 text-xs font-normal">{item.nome}</span>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleEditarItem(item)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleRemoverItem(item.id, item.nome)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>}
                    </div>)}
                </div>}
            </CardContent>
          </Card>)}
      </div>
    </div>;
}
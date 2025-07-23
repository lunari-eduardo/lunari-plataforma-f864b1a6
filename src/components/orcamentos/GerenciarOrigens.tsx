
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useToast } from '@/hooks/use-toast';

export default function GerenciarOrigens() {
  const { origens, adicionarOrigem, atualizarOrigem, excluirOrigem } = useOrcamentos();
  const { toast } = useToast();
  
  const [novaOrigem, setNovaOrigem] = useState({ nome: '', cor: '#10B981' });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [valorEdicao, setValorEdicao] = useState({ nome: '', cor: '' });
  const [dialogAberto, setDialogAberto] = useState(false);

  const cores = [
    '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  const adicionarNovaOrigem = () => {
    if (!novaOrigem.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome da origem é obrigatório",
        variant: "destructive"
      });
      return;
    }

    adicionarOrigem(novaOrigem);
    setNovaOrigem({ nome: '', cor: '#10B981' });
    setDialogAberto(false);
    
    toast({
      title: "Sucesso",
      description: "Origem adicionada com sucesso!"
    });
  };

  const iniciarEdicao = (origem: any) => {
    setEditandoId(origem.id);
    setValorEdicao({ nome: origem.nome, cor: origem.cor });
  };

  const salvarEdicao = () => {
    if (!valorEdicao.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome da origem é obrigatório",
        variant: "destructive"
      });
      return;
    }

    atualizarOrigem(editandoId!, valorEdicao);
    setEditandoId(null);
    setValorEdicao({ nome: '', cor: '' });
    
    toast({
      title: "Sucesso",
      description: "Origem atualizada com sucesso!"
    });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setValorEdicao({ nome: '', cor: '' });
  };

  const excluirOrigemConfirm = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta origem?')) {
      excluirOrigem(id);
      toast({
        title: "Sucesso",
        description: "Origem excluída com sucesso!"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm">Origens de Cliente</CardTitle>
          <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-3 w-3 mr-1" />
                Nova Origem
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Nova Origem</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">Nome da Origem</label>
                  <Input
                    placeholder="Ex: Instagram, Facebook, Indicação..."
                    value={novaOrigem.nome}
                    onChange={(e) => setNovaOrigem({ ...novaOrigem, nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-2 block">Cor</label>
                  <div className="flex gap-2 flex-wrap">
                    {cores.map(cor => (
                      <button
                        key={cor}
                        className={`w-8 h-8 rounded-full border-2 ${
                          novaOrigem.cor === cor ? 'border-gray-800' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: cor }}
                        onClick={() => setNovaOrigem({ ...novaOrigem, cor })}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setDialogAberto(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={adicionarNovaOrigem}>
                    Salvar Origem
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {origens.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neumorphic-textLight text-sm">
                Nenhuma origem cadastrada. Adicione a primeira origem.
              </p>
            </div>
          ) : (
            origens.map(origem => (
              <div key={origem.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                {editandoId === origem.id ? (
                  <>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex gap-1">
                        {cores.map(cor => (
                          <button
                            key={cor}
                            className={`w-6 h-6 rounded-full border ${
                              valorEdicao.cor === cor ? 'border-gray-800 border-2' : 'border-gray-300'
                            }`}
                            style={{ backgroundColor: cor }}
                            onClick={() => setValorEdicao({ ...valorEdicao, cor })}
                          />
                        ))}
                      </div>
                      <Input
                        value={valorEdicao.nome}
                        onChange={(e) => setValorEdicao({ ...valorEdicao, nome: e.target.value })}
                        className="h-7 text-xs flex-1"
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={salvarEdicao}>
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelarEdicao}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full border border-gray-300"
                        style={{ backgroundColor: origem.cor }}
                      />
                      <span className="text-sm font-medium">{origem.nome}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => iniciarEdicao(origem)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => excluirOrigemConfirm(origem.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

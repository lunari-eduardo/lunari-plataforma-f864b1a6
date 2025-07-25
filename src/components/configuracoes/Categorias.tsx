import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
interface Categoria {
  id: string;
  nome: string;
  cor: string;
}
interface CategoriasProps {
  categorias: Categoria[];
  setCategorias: React.Dispatch<React.SetStateAction<Categoria[]>>;
  pacotes: {
    categoria_id: string;
  }[];
}
export default function Categorias({
  categorias,
  setCategorias,
  pacotes
}: CategoriasProps) {
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novaCor, setNovaCor] = useState('#7950F2');
  const [editandoCategoria, setEditandoCategoria] = useState<string | null>(null);
  const adicionarCategoria = () => {
    if (novaCategoria.trim() === '') {
      toast.error('O nome da categoria não pode estar vazio');
      return;
    }
    const newId = String(Date.now());
    setCategorias([...categorias, {
      id: newId,
      nome: novaCategoria,
      cor: novaCor
    }]);
    setNovaCategoria('');
    setNovaCor('#7950F2');
    toast.success('Categoria adicionada com sucesso!');
  };
  const iniciarEdicaoCategoria = (id: string) => {
    setEditandoCategoria(id);
  };
  const salvarEdicaoCategoria = (id: string, nome: string, cor: string) => {
    setCategorias(categorias.map(cat => cat.id === id ? {
      ...cat,
      nome,
      cor
    } : cat));
    setEditandoCategoria(null);
    toast.success('Categoria atualizada com sucesso!');
  };
  const removerCategoria = (id: string) => {
    const categoriaEmUso = pacotes.some(pacote => pacote.categoria_id === id);
    if (categoriaEmUso) {
      toast.error('Esta categoria não pode ser removida pois está sendo usada em pacotes');
      return;
    }
    setCategorias(categorias.filter(cat => cat.id !== id));
    toast.success('Categoria removida com sucesso!');
  };
  return <div className="space-y-6 mt-4">
      <div>
        <div className="space-y-2">
          <h3 className="font-medium text-sm">Nova Categoria de Sessão</h3>
          <p className="text-muted-foreground text-xs">
            Defina as categorias para seus tipos de sessão fotográfica.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-end gap-3 mt-3">
          <div className="w-full sm:flex-1">
            <label htmlFor="nome" className="block text-sm font-medium mb-1">
              Nome<span className="text-red-500">*</span>
            </label>
            <Input id="nome" placeholder="Nome da categoria" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} className="w-full bg-neutral-50" />
          </div>
          <div className="w-full sm:w-40">
            <label htmlFor="cor" className="block text-sm font-medium mb-1">
              Cor<span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              
              <Input id="cor" type="color" value={novaCor} onChange={e => setNovaCor(e.target.value)} className="w-20 h-7 bg-neutral-50" />
            </div>
          </div>
          <div className="w-full sm:w-auto mt-3 sm:mt-0">
            <Button onClick={adicionarCategoria} className="flex items-center gap-1 w-full bg-lunar-accent">
              <Plus className="h-4 w-4" />
              <span>Adicionar Categoria</span>
            </Button>
          </div>
        </div>
      </div>
      
      <div>
        <div className="space-y-2 mb-4">
          <h3 className="text-base font-medium">Categorias Cadastradas</h3>
          <p className="text-sm text-muted-foreground">
            Lista de todas as categorias de sessão fotográfica.
          </p>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
          <div className="grid grid-cols-6 bg-gray-50/50 px-4 border-b border-gray-100 py-[10px]">
            <div className="font-medium text-sm col-span-3 sm:col-span-2 text-gray-700">Nome</div>
            <div className="font-medium text-sm hidden sm:block text-gray-700">Cor</div>
            <div className="font-medium text-sm col-span-3 text-gray-700">Ações</div>
          </div>
          
          <div className="divide-y divide-gray-50">
            {categorias.map((categoria, index) => <div key={categoria.id} className={`grid grid-cols-6 px-4 py-3 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25/30'} hover:bg-gray-50/70 transition-colors`}>
                {editandoCategoria === categoria.id ? <>
                    <div className="col-span-3 sm:col-span-2 pr-2">
                      <Input defaultValue={categoria.nome} onChange={e => {
                  const novoNome = e.target.value;
                  setCategorias(prev => prev.map(c => c.id === categoria.id ? {
                    ...c,
                    nome: novoNome
                  } : c));
                }} className="h-8 text-sm" />
                    </div>
                    <div className="hidden sm:flex items-center">
                      <Input type="color" defaultValue={categoria.cor} onChange={e => {
                  const novaCor = e.target.value;
                  setCategorias(prev => prev.map(c => c.id === categoria.id ? {
                    ...c,
                    cor: novaCor
                  } : c));
                }} className="w-20 h-8" />
                    </div>
                    <div className="flex justify-end col-span-3 gap-2">
                      <Button variant="outline" size="sm" onClick={() => salvarEdicaoCategoria(categoria.id, categorias.find(c => c.id === categoria.id)?.nome || '', categorias.find(c => c.id === categoria.id)?.cor || '')}>
                        Salvar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditandoCategoria(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </> : <>
                    <div className="text-sm col-span-3 sm:col-span-2 flex items-center">
                      {categoria.nome}
                    </div>
                    <div className="hidden sm:flex items-center">
                      <div className="w-6 h-6 rounded-full border border-gray-200" style={{
                  backgroundColor: categoria.cor
                }} title={categoria.cor} />
                    </div>
                    <div className="flex justify-end col-span-3 gap-2">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => iniciarEdicaoCategoria(categoria.id)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:border-red-200" onClick={() => removerCategoria(categoria.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>}
              </div>)}

            {categorias.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground bg-white">
                Nenhuma categoria cadastrada. Adicione sua primeira categoria acima.
              </div>}
          </div>
        </div>
      </div>
    </div>;
}
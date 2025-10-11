import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Filter, ChevronDown, ChevronUp, Search, Package, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsMobile } from '@/hooks/use-mobile';
import PacoteForm from './PacoteForm';
import PacoteCard from './PacoteCard';
import PacoteEditModal from './PacoteEditModal';
import type { Categoria, Pacote, Produto, PacoteFormData } from '@/types/configuration';
interface PacotesProps {
  pacotes: Pacote[];
  onAdd: (pacote: Omit<Pacote, 'id'>) => void;
  onUpdate: (id: string, dados: Partial<Pacote>) => void;
  onDelete: (id: string) => Promise<boolean>;
  categorias: Categoria[];
  produtos: Produto[];
}
export default function Pacotes({
  pacotes,
  onAdd,
  onUpdate,
  onDelete,
  categorias,
  produtos
}: PacotesProps) {
  // Estados para filtros e modais
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all');
  const [filtroNome, setFiltroNome] = useState<string>('');
  const [novoPacoteAberto, setNovoPacoteAberto] = useState(false);
  const [pacoteEdicao, setPacoteEdicao] = useState<Pacote | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Debounce para filtro de nome
  const debouncedFiltroNome = useDebounce(filtroNome, 300);
  const getCategoria = useCallback((id: string) => {
    return categorias.find(cat => cat.id === id);
  }, [categorias]);

  // Lista filtrada de pacotes
  const pacotesFiltrados = useMemo(() => {
    return pacotes.filter(pacote => {
      const matchCategoria = !filtroCategoria || filtroCategoria === 'all' || pacote.categoria_id === filtroCategoria;
      const matchNome = !debouncedFiltroNome || pacote.nome.toLowerCase().includes(debouncedFiltroNome.toLowerCase());
      return matchCategoria && matchNome;
    });
  }, [pacotes, filtroCategoria, debouncedFiltroNome]);
  const adicionarPacote = useCallback((formData: PacoteFormData) => {
    onAdd(formData);
    setNovoPacoteAberto(false);
  }, [onAdd]);
  const editarPacote = useCallback((pacote: Pacote) => {
    setPacoteEdicao(pacote);
  }, []);
  const salvarEdicaoPacote = useCallback((id: string, dados: Partial<Pacote>) => {
    onUpdate(id, dados);
    setPacoteEdicao(null);
  }, [onUpdate]);
  const removerPacote = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const success = await onDelete(id);
      if (!success) {
        // Error toast already shown by context
      }
    } finally {
      setDeletingId(null);
    }
  }, [onDelete]);
  const limparFiltros = useCallback(() => {
    setFiltroCategoria('all');
    setFiltroNome('');
  }, []);
  const isMobile = useIsMobile();
  return <div className="space-y-4 animate-fade-in">
      {/* Header compacto com ação */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-foreground">Pacotes Fotográficos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie os pacotes disponíveis para venda
          </p>
        </div>
        <Button onClick={() => setNovoPacoteAberto(!novoPacoteAberto)} size="sm" className="gap-2 text-xs">
          <Plus className="h-3.5 w-3.5" />
          {novoPacoteAberto ? 'Cancelar' : 'Novo Pacote'}
        </Button>
      </div>

      {/* Formulário Novo Pacote - Compacto */}
      <Collapsible open={novoPacoteAberto} onOpenChange={setNovoPacoteAberto}>
        <CollapsibleContent>
          <div className="bg-card border border-lunar-border rounded-lg p-4 animate-scale-in">
            <div className="mb-3">
              <h4 className="text-sm font-medium text-foreground mb-1">Novo Pacote</h4>
              <p className="text-2xs text-muted-foreground">
                Configure um novo pacote fotográfico para oferecer aos clientes
              </p>
            </div>
            <PacoteForm categorias={categorias} produtos={produtos} onSubmit={adicionarPacote} onCancel={() => setNovoPacoteAberto(false)} submitLabel="Criar Pacote" />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Filtros Fixos Simplificados */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-muted/30 border border-lunar-border rounded-lg p-3 py-[2px]">
        <div className="flex flex-col-2  sm:flex-row gap-3 flex-1 py-0">
          <div className="space-y-1 flex-1 sm:max-w-[200px]">
            
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todas as categorias</SelectItem>
                {categorias.map(categoria => <SelectItem key={categoria.id} value={categoria.id} className="text-xs">
                    {categoria.nome}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1 flex-1 sm:max-w-[150px]">
            
            <Select value="alphabetical" onValueChange={() => {}}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="A-Z" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alphabetical" className="text-xs">A-Z</SelectItem>
                <SelectItem value="reverse" className="text-xs">Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {filtroCategoria !== 'all' && <Button variant="ghost" size="sm" onClick={() => setFiltroCategoria('all')} className="text-2xs h-7 px-3 gap-1">
            <X className="h-3 w-3" />
            Limpar
          </Button>}
      </div>

      {/* Lista de Pacotes - Grid Responsivo */}
      <div className="space-y-3">
        {pacotesFiltrados.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pacotesFiltrados.map(pacote => <PacoteCard key={pacote.id} pacote={pacote} categoria={getCategoria(pacote.categoria_id)} produtos={produtos} onEdit={editarPacote} onDelete={removerPacote} />)}
          </div> : <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-lunar-border rounded-lg bg-muted/20">
            <div className="rounded-full bg-lunar-accent/10 p-4 mb-4">
              <Package className="h-8 w-8 text-lunar-accent" />
            </div>
            <h4 className="text-sm font-medium text-foreground mb-2">
              {pacotes.length === 0 ? 'Nenhum pacote cadastrado' : 'Nenhum pacote encontrado'}
            </h4>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm">
              {pacotes.length === 0 ? 'Comece criando seu primeiro pacote fotográfico para organizar seus produtos e serviços.' : 'Ajuste os filtros acima para encontrar os pacotes desejados.'}
            </p>
            {pacotes.length === 0 && <Button onClick={() => setNovoPacoteAberto(true)} size="sm" className="gap-2 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Criar primeiro pacote
              </Button>}
          </div>}
      </div>

      {/* Modal de Edição */}
      <PacoteEditModal pacote={pacoteEdicao} categorias={categorias} produtos={produtos} onSave={salvarEdicaoPacote} onClose={() => setPacoteEdicao(null)} />
    </div>;
}
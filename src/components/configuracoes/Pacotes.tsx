import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Package, X } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import ConfigSectionHeader from './ConfigSectionHeader';
import { useDebounce } from '@/hooks/useDebounce';
import PacoteForm from './PacoteForm';
import PacoteCard from './PacoteCard';
import PacoteEditModal from './PacoteEditModal';
import type { Categoria, Pacote, Produto, PacoteFormData } from '@/types/configuration';

interface PacotesProps {
  pacotes: Pacote[];
  onAdd: (pacote: Omit<Pacote, 'id'>) => void;
  onUpdate: (id: string, dados: Partial<Pacote>) => Promise<void>;
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
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all');
  const [filtroNome, setFiltroNome] = useState<string>('');
  const [novoPacoteAberto, setNovoPacoteAberto] = useState(false);
  const [pacoteEdicao, setPacoteEdicao] = useState<Pacote | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const debouncedFiltroNome = useDebounce(filtroNome, 300);

  const getCategoria = useCallback((id: string) => {
    return categorias.find(cat => cat.id === id);
  }, [categorias]);

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

  const salvarEdicaoPacote = useCallback(async (id: string, dados: Partial<Pacote>) => {
    try {
      await onUpdate(id, dados);
      setPacoteEdicao(null);
    } catch (error) {
      console.error('Erro ao atualizar pacote:', error);
    }
  }, [onUpdate]);

  const removerPacote = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }, [onDelete]);

  return (
    <div className="space-y-6 py-4">
      <ConfigSectionHeader
        title="Pacotes Fotográficos"
        subtitle="Configure os pacotes disponíveis para venda."
        action={
          <Button
            onClick={() => setNovoPacoteAberto(!novoPacoteAberto)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {novoPacoteAberto ? 'Cancelar' : 'Novo Pacote'}
          </Button>
        }
      />

      {/* Formulário Novo Pacote */}
      <Collapsible open={novoPacoteAberto} onOpenChange={setNovoPacoteAberto}>
        <CollapsibleContent>
          <div className="p-4 border border-border rounded-lg bg-card">
            <PacoteForm
              categorias={categorias}
              produtos={produtos}
              onSubmit={adicionarPacote}
              onCancel={() => setNovoPacoteAberto(false)}
              submitLabel="Criar Pacote"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center p-3 border border-border rounded-lg bg-muted/30">
        <div className="flex-1 min-w-[180px] max-w-[220px]">
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">Todas as categorias</SelectItem>
              {categorias.map(categoria => (
                <SelectItem key={categoria.id} value={categoria.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: categoria.cor }}
                    />
                    {categoria.nome}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {filtroCategoria !== 'all' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFiltroCategoria('all')}
            className="h-8"
          >
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Lista de Pacotes */}
      <div className="space-y-3">
        {pacotesFiltrados.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pacotesFiltrados.map(pacote => (
              <PacoteCard
                key={pacote.id}
                pacote={pacote}
                categoria={getCategoria(pacote.categoria_id)}
                produtos={produtos}
                onEdit={editarPacote}
                onDelete={removerPacote}
                isDeleting={deletingId === pacote.id}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="text-sm font-medium text-foreground mb-2">
              {pacotes.length === 0 ? 'Nenhum pacote cadastrado' : 'Nenhum pacote encontrado'}
            </h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              {pacotes.length === 0
                ? 'Comece criando seu primeiro pacote fotográfico.'
                : 'Ajuste os filtros para encontrar os pacotes desejados.'}
            </p>
            {pacotes.length === 0 && (
              <Button onClick={() => setNovoPacoteAberto(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro pacote
              </Button>
            )}
          </div>
        )}
      </div>

      <PacoteEditModal
        pacote={pacoteEdicao}
        categorias={categorias}
        produtos={produtos}
        onSave={salvarEdicaoPacote}
        onClose={() => setPacoteEdicao(null)}
      />
    </div>
  );
}

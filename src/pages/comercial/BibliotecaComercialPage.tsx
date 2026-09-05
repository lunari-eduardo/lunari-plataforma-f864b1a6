import React, { useState } from 'react';
import { Plus, Search, BookOpen, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MaterialCard } from './components/MaterialCard';
import { useMaterials } from '@/hooks/useMaterials';
import { useCreateMaterialWizard } from './biblioteca/hooks/useCreateMaterialWizard';
import { CreateMaterialWizardDialog } from './biblioteca/components/CreateMaterialWizardDialog';
import { SendProposalModal } from './biblioteca/components/SendProposalModal';

export { formatWhatsAppNumber, type DbTemplate } from './biblioteca/types';

export default function BibliotecaComercialPage() {
  const navigate = useNavigate();
  const { materials, isLoading, archiveMaterial, deleteMaterial, duplicateMaterial } = useMaterials();

  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sendModalMaterialId, setSendModalMaterialId] = useState<string | null>(null);

  const wizard = useCreateMaterialWizard({
    isOpen: isCreateModalOpen,
    onClose: () => setIsCreateModalOpen(false),
  });

  const handleOpenEditor = (id: string) => {
    navigate(`/app/comercial/construtor/${id}`);
  };

  const handleOpenSendModal = (id: string) => {
    setSendModalMaterialId(id);
  };

  const filteredMaterials = (materials || []).filter((m) => {
    if (!showArchived && m.status === 'archived') return false;
    if (showArchived && m.status !== 'archived') return false;
    return m.title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Propostas</h1>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 hidden sm:inline-flex">
              Admin Only
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            Acompanhe o desempenho de suas propostas, contratos e portfólios compartilhados com seus clientes.
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 shadow-sm shrink-0 bg-primary">
          <Plus size={16} />
          Nova Proposta
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-2 rounded-xl border border-border shadow-sm">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar material pelo título..."
            className="pl-9 bg-transparent border-none shadow-none focus-visible:ring-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center">
          <Button
            variant={showArchived ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className={showArchived ? 'bg-muted' : 'text-muted-foreground hover:text-foreground'}
          >
            <Archive className="mr-2 h-4 w-4" />
            {showArchived ? 'Ocultar Arquivadas' : 'Ver Arquivadas'}
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
              <Skeleton className="aspect-[4/3] w-full rounded-lg" />
              <div className="flex flex-col gap-2 pt-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredMaterials.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-500">
          {filteredMaterials.map((material) => (
            <MaterialCard
              key={material.id}
              id={material.id}
              title={material.title}
              lastUpdated={`Atualizado há ${formatDistanceToNow(new Date(material.updated_at), { locale: ptBR })}`}
              categoryName={material.categoria?.nome}
              isActive={material.status === 'active'}
              isPublished={!!material.current_version?.published_at}
              coverUrl={material.cover_image_url}
              onOpen={handleOpenEditor}
              onArchive={() => archiveMaterial.mutate(material.id)}
              onDelete={() => {
                if (
                  window.confirm(
                    `Excluir "${material.title}" permanentemente?\n\nEsta ação exclui a proposta e todo o histórico de compartilhamentos e não pode ser desfeita.`
                  )
                ) {
                  deleteMaterial.mutate(material.id);
                }
              }}
              onSend={handleOpenSendModal}
              onDuplicate={(id) => duplicateMaterial.mutate(id)}
              onViewShares={() =>
                navigate(`/app/comercial/compartilhamentos?material=${encodeURIComponent(material.title)}`)
              }
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-border rounded-2xl bg-muted/10">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhum material encontrado</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Sua biblioteca está vazia. Comece criando uma nova proposta comercial.
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)} variant="outline" className="gap-2">
            <Plus size={16} />
            Criar primeira proposta
          </Button>
        </div>
      )}

      {/* Modal Nova Proposta */}
      <CreateMaterialWizardDialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        wizard={wizard}
      />

      {/* Modal Enviar Orçamento (Share) */}
      <SendProposalModal
        materialId={sendModalMaterialId}
        onClose={() => setSendModalMaterialId(null)}
      />
    </div>
  );
}

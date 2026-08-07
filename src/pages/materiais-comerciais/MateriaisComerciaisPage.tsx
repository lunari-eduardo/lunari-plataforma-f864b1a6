import React, { useState } from 'react';
import { Plus, Search, BookOpen, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MaterialCard } from './components/MaterialCard';
import { useMaterials } from '@/hooks/useMaterials';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

export default function MateriaisComerciaisPage() {
  const navigate = useNavigate();
  const { materials, isLoading, createMaterial, archiveMaterial, deleteMaterial } = useMaterials();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMaterialTitle, setNewMaterialTitle] = useState('');

  const handleOpenEditor = (id: string) => {
    navigate(`/app/materiais/editor/${id}`);
  };

  const handleArchive = (id: string) => {
    archiveMaterial.mutate(id);
  };

  const handleDelete = (id: string) => {
    deleteMaterial.mutate(id);
  };

  const handleCreateMaterial = () => {
    if (!newMaterialTitle.trim()) return;
    createMaterial.mutate(
      { title: newMaterialTitle },
      {
        onSuccess: (data) => {
          setIsCreateModalOpen(false);
          setNewMaterialTitle('');
          navigate(`/app/materiais/editor/${data.id}`);
        }
      }
    );
  };

  // Client-side filtering
  const filteredMaterials = (materials || []).filter(m => {
    return m.title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex h-full flex-col space-y-6 p-4 md:p-8 max-w-[85rem] mx-auto w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Materiais Comerciais</h1>
            <Badge variant="outline" className="bg-lunar-accent/10 text-lunar-accent border-lunar-accent/20">
              Admin Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Gerencie, compartilhe e acompanhe a conversão de suas propostas comerciais.
          </p>
        </div>
        
        <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 shadow-sm shrink-0">
          <Plus size={16} />
          Novo Material
        </Button>
      </div>

      {/* Toolbar / Filtros */}
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
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
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
              isActive={material.status === 'active'}
              isPublished={!!material.current_version?.published_at}
              coverUrl={material.cover_image_url}
              onOpen={handleOpenEditor}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center animate-in fade-in duration-500">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <BookOpen className="h-8 w-8 text-primary opacity-80" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhum material encontrado</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Sua biblioteca está vazia ou nenhum item corresponde à sua busca.
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)} variant="outline" className="gap-2">
            <Plus size={16} />
            Criar material
          </Button>
        </div>
      )}

      {/* Modal de Criação */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Material Comercial</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Ex: Ensaio Gestante Premium..."
              value={newMaterialTitle}
              onChange={(e) => setNewMaterialTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateMaterial();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateMaterial} disabled={!newMaterialTitle.trim() || createMaterial.isPending}>
              {createMaterial.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar e Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

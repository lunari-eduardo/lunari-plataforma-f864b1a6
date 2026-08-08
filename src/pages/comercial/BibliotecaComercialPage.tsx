import React, { useState } from 'react';
import { Plus, Search, BookOpen, Loader2, Sparkles, LayoutTemplate } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { MaterialCard } from './components/MaterialCard';
import { useMaterials } from '@/hooks/useMaterials';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Mock de JSON gerado por IA para simular a criação mágica
const MOCK_AI_CONTENT = [
  { type: 'cover', data: { title: 'Proposta Exclusiva - Mariana', subtitle: 'Registrando a doce espera do seu maior amor.', image_url: 'https://images.unsplash.com/photo-1518063063544-236b2bb6f0b4?q=80&w=1000&auto=format&fit=crop', btnText: 'Vamos começar' } },
  { type: 'about', data: { title: 'Por que escolher a Lunari', content: 'Minha fotografia não é apenas sobre o click, mas sobre a experiência...' } },
  { type: 'package', data: { title: 'Pacote Essencial', price_cents: 189000, description: '1h de ensaio\n20 fotos digitais\nGaleria online' } },
  { type: 'package', data: { title: 'Pacote Premium', price_cents: 249000, description: '2h de ensaio\nTodas as fotos digitais\nÁlbum 20x20', highlight: true } },
  { type: 'faq', data: { title: 'Dúvidas Comuns', content: 'Posso levar acompanhante? Sim.' } }
];

export default function BibliotecaComercialPage() {
  const navigate = useNavigate();
  const { materials, isLoading, createMaterial, archiveMaterial, deleteMaterial } = useMaterials();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMaterialTitle, setNewMaterialTitle] = useState('');
  const [creationMethod, setCreationMethod] = useState<'ai' | 'template' | null>(null);

  const handleOpenEditor = (id: string) => {
    navigate(`/app/comercial/construtor/${id}`);
  };

  const handleCreate = () => {
    if (!newMaterialTitle.trim() || !creationMethod) return;
    
    const initialContent = creationMethod === 'ai' ? MOCK_AI_CONTENT : undefined; // undefined usa o DEFAULT do hook
    
    createMaterial.mutate(
      { title: newMaterialTitle, initialContent },
      {
        onSuccess: (data) => {
          setIsCreateModalOpen(false);
          setNewMaterialTitle('');
          setCreationMethod(null);
          navigate(`/app/comercial/construtor/${data.id}`);
        }
      }
    );
  };

  const filteredMaterials = (materials || []).filter(m => {
    return m.title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto min-h-[calc(100vh-4rem)]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Biblioteca de Materiais</h1>
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
              onArchive={() => archiveMaterial.mutate(material.id)}
              onDelete={() => deleteMaterial.mutate(material.id)}
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
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => {
        setIsCreateModalOpen(open);
        if (!open) {
          setNewMaterialTitle('');
          setCreationMethod(null);
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Nova Proposta</DialogTitle>
            <DialogDescription>
              Como você deseja iniciar a criação deste material comercial?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card IA */}
              <button
                type="button"
                onClick={() => setCreationMethod('ai')}
                className={cn(
                  "flex flex-col items-start gap-3 p-5 rounded-xl border-2 text-left transition-all",
                  creationMethod === 'ai' 
                    ? "border-primary bg-primary/5" 
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Gerar com IA</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    A inteligência artificial cria a estrutura inicial para você baseada no perfil do cliente.
                  </p>
                </div>
              </button>

              {/* Card Template */}
              <button
                type="button"
                onClick={() => setCreationMethod('template')}
                className={cn(
                  "flex flex-col items-start gap-3 p-5 rounded-xl border-2 text-left transition-all",
                  creationMethod === 'template' 
                    ? "border-primary bg-primary/5" 
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Usar Modelo Padrão</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Comece com uma estrutura limpa e preencha as informações manualmente.
                  </p>
                </div>
              </button>
            </div>

            {/* Input de Titulo aparece depois de selecionar o metodo */}
            {creationMethod && (
              <div className="space-y-3 animate-in slide-in-from-top-2 fade-in duration-300">
                <label className="text-sm font-medium text-foreground">
                  Título da Proposta
                </label>
                <Input
                  placeholder="Ex: Proposta Premium de Casamento..."
                  value={newMaterialTitle}
                  onChange={(e) => setNewMaterialTitle(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                  }}
                  className="h-11"
                />
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleCreate} 
              disabled={!newMaterialTitle.trim() || !creationMethod || createMaterial.isPending}
              className="gap-2"
            >
              {createMaterial.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {creationMethod === 'ai' ? 'Gerar Proposta' : 'Criar Proposta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

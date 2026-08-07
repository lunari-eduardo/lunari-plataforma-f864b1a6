import React, { useState } from 'react';
import { Plus, Search, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MaterialCard } from './components/MaterialCard';

// Dados simulados com métricas
const MOCK_MATERIALS = [
  {
    id: 'mat_1',
    categoryName: 'Ensaio Gestante',
    lastUpdated: 'Atualizado hoje',
    isActive: true,
    coverUrl: 'https://images.unsplash.com/photo-1518063063544-236b2bb6f0b4?q=80&w=600&auto=format&fit=crop',
    metrics: { views: 342, shares: 89, conversionRate: 12.5 }
  },
  {
    id: 'mat_2',
    categoryName: 'Newborn Completo',
    lastUpdated: 'Atualizado há 2 dias',
    isActive: true,
    coverUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?q=80&w=600&auto=format&fit=crop',
    metrics: { views: 156, shares: 23, conversionRate: 8.2 }
  },
  {
    id: 'mat_3',
    categoryName: 'Casamento Mini-Wedding',
    lastUpdated: 'Atualizado mês passado',
    isActive: true,
    metrics: { views: 890, shares: 210, conversionRate: 15.4 }
  },
  {
    id: 'mat_4',
    categoryName: 'Ensaio Corporativo',
    lastUpdated: 'Arquivado há 3 meses',
    isActive: false, // Arquivado
    coverUrl: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?q=80&w=600&auto=format&fit=crop',
    metrics: { views: 12, shares: 2, conversionRate: 0 }
  }
];

export default function MateriaisComerciaisPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [orderFilter, setOrderFilter] = useState('recent');
  
  // Handler Fictício
  const handleOpenEditor = (id: string) => {
    console.log('Navegando para o Editor do Material:', id);
    // history.push(`/app/materiais/editor/${id}`)
  };

  // Lógica de Filtro Básica
  const filteredMaterials = MOCK_MATERIALS.filter(m => {
    const matchName = m.categoryName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = categoryFilter === 'all' || m.categoryName.toLowerCase().includes(categoryFilter);
    // Para simplificar a demo, vamos mostrar todos (ativos e arquivados)
    return matchName && matchCategory;
  });

  return (
    <div className="flex h-full flex-col space-y-6 p-4 md:p-8 max-w-[85rem] mx-auto w-full">
      
      {/* Header Evoluído */}
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
        
        <Button className="gap-2 shadow-sm shrink-0">
          <Plus size={16} />
          Novo Material
        </Button>
      </div>

      {/* Toolbar / Filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-2 rounded-xl border border-border shadow-sm">
        <div className="relative w-full sm:flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar material..." 
            className="pl-9 bg-transparent border-none shadow-none focus-visible:ring-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="h-6 w-px bg-border hidden sm:block mx-1" />
        
        <div className="flex w-full sm:w-auto gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[160px] border-none shadow-none bg-transparent focus:ring-0 text-sm">
              <SelectValue placeholder="Categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              <SelectItem value="gestante">Gestante</SelectItem>
              <SelectItem value="casamento">Casamento</SelectItem>
              <SelectItem value="infantil">Infantil</SelectItem>
            </SelectContent>
          </Select>

          <Select value={orderFilter} onValueChange={setOrderFilter}>
            <SelectTrigger className="w-full sm:w-[170px] border-none shadow-none bg-transparent focus:ring-0 text-sm">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Última edição</SelectItem>
              <SelectItem value="accessed">Mais acessados</SelectItem>
              <SelectItem value="conversion">Maior conversão</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de Materiais */}
      {filteredMaterials.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-500">
          {filteredMaterials.map((material) => (
            <MaterialCard 
              key={material.id}
              id={material.id}
              categoryName={material.categoryName}
              lastUpdated={material.lastUpdated}
              isActive={material.isActive}
              coverUrl={material.coverUrl}
              metrics={material.metrics}
              onOpen={handleOpenEditor}
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
            Sua biblioteca está vazia. Crie propostas dinâmicas e comece a rastrear o engajamento dos seus clientes.
          </p>
          <Button variant="outline" className="gap-2">
            <Plus size={16} />
            Criar meu primeiro material
          </Button>
        </div>
      )}

    </div>
  );
}

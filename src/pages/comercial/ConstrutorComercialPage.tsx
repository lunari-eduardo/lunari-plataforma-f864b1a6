import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Edit3, Trash2, Eye, LayoutTemplate, Loader2 } from 'lucide-react';
import { useMaterials } from '@/hooks/useMaterials';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ConstrutorComercialPage() {
  const navigate = useNavigate();
  const { materials, isLoading, deleteMaterial } = useMaterials();

  const activeMaterials = materials.filter(m => m.status === 'active');

  return (
    <PageContainer>
      <div className="mb-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/app/comercial">Comercial</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Construtor</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader 
          title="Construtor" 
          description="Gerencie suas propostas criadas ou crie novas a partir da biblioteca." 
        />
        <Button onClick={() => navigate('/app/comercial/biblioteca')}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Proposta da Biblioteca
        </Button>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : activeMaterials.length === 0 ? (
          <div className="p-8 border border-border border-dashed rounded-xl flex flex-col items-center justify-center bg-muted/20 text-muted-foreground text-sm gap-4">
            <LayoutTemplate className="w-12 h-12 text-muted-foreground/50 mb-2" />
            <p>Você ainda não criou nenhuma proposta personalizada.</p>
            <p>Vá até a Biblioteca para começar.</p>
            <Button variant="outline" onClick={() => navigate('/app/comercial/biblioteca')}>Acessar Biblioteca</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {activeMaterials.map(material => {
              // Verifica se é PDF ou bloco
              const isPdf = material.current_version?.content?.type === 'pdf';

              return (
                <div key={material.id} className="group relative rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-all flex flex-col">
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] w-full bg-muted flex items-center justify-center relative border-b border-border overflow-hidden">
                    {material.cover_image_url ? (
                      <img src={material.cover_image_url} alt={material.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <LayoutTemplate className="w-10 h-10 text-muted-foreground/30" />
                    )}
                    {isPdf && (
                      <div className="absolute top-2 right-2 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                        PDF
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-semibold text-foreground text-sm line-clamp-1 mb-1">{material.title}</h3>
                    <p className="text-[11px] text-muted-foreground mb-4">
                      Atualizado em {format(new Date(material.updated_at), "dd MMM, HH:mm", { locale: ptBR })}
                    </p>
                    
                    <div className="mt-auto flex items-center gap-2">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1 text-xs h-8"
                        onClick={() => navigate(`/app/comercial/construtor/${material.id}`)}
                      >
                        <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                        Editar
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Ver Online"
                        onClick={() => window.open(`/p/${material.id}`, '_blank')}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        title="Excluir"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja excluir esta proposta?')) {
                            deleteMaterial.mutate(material.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

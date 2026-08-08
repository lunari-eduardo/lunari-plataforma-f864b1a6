import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function ConstrutorComercialPage() {
  const navigate = useNavigate();

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
          description="Crie novas propostas ou edite modelos existentes." 
        />
        <Button onClick={() => navigate('/app/comercial/biblioteca')}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Proposta da Biblioteca
        </Button>
      </div>

      <div className="mt-8 p-8 border border-border border-dashed rounded-xl flex flex-col items-center justify-center bg-muted/20 text-muted-foreground text-sm gap-4">
        <p>A lista de propostas criadas independentes aparecerá aqui.</p>
        <p>Para iniciar uma agora, vá até a Biblioteca.</p>
        <Button variant="outline" onClick={() => navigate('/app/comercial/biblioteca')}>Acessar Biblioteca</Button>
      </div>
    </PageContainer>
  );
}

import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from 'react-router-dom';

export default function EstrategiaComercialPage() {
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
              <BreadcrumbPage>Estratégia / Estilo</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <PageHeader 
        title="Estratégia e Estilo" 
        description="Defina sua identidade comercial, linguagem, referências visuais e diretrizes." 
      />

      <div className="mt-8 p-8 border border-border border-dashed rounded-xl flex items-center justify-center bg-muted/20 text-muted-foreground text-sm">
        Formulário de configurações estratégicas em construção...
      </div>
    </PageContainer>
  );
}

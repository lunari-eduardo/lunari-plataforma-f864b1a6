import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from 'react-router-dom';

export default function RelatoriosComercialPage() {
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
              <BreadcrumbPage>Relatórios</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <PageHeader 
        title="Relatórios" 
        description="Analise o desempenho das suas propostas e a taxa de conversão." 
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <div className="p-4 border border-border rounded-xl bg-card">
          <div className="text-sm text-muted-foreground mb-1">Enviadas</div>
          <div className="text-2xl font-bold">42</div>
        </div>
        <div className="p-4 border border-border rounded-xl bg-card">
          <div className="text-sm text-muted-foreground mb-1">Visualizadas</div>
          <div className="text-2xl font-bold">35</div>
        </div>
        <div className="p-4 border border-border rounded-xl bg-card">
          <div className="text-sm text-muted-foreground mb-1">Aprovadas</div>
          <div className="text-2xl font-bold text-green-600">18</div>
        </div>
        <div className="p-4 border border-border rounded-xl bg-card">
          <div className="text-sm text-muted-foreground mb-1">Taxa de Aprovação</div>
          <div className="text-2xl font-bold text-primary">51,4%</div>
        </div>
        <div className="p-4 border border-border rounded-xl bg-card col-span-2">
          <div className="text-sm text-muted-foreground mb-1">Valor Potencial</div>
          <div className="text-2xl font-bold">R$ 24.800</div>
        </div>
        <div className="p-4 border border-border rounded-xl bg-card col-span-2">
          <div className="text-sm text-muted-foreground mb-1">Valor Aprovado</div>
          <div className="text-2xl font-bold text-green-600">R$ 13.200</div>
        </div>
      </div>
      
      <div className="mt-8 p-8 border border-border border-dashed rounded-xl flex items-center justify-center bg-muted/20 text-muted-foreground text-sm">
        Gráficos de Funil e Desempenho por Categoria em construção...
      </div>
    </PageContainer>
  );
}

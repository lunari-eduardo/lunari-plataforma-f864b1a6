import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from 'react-router-dom';
import { useComercialIntelligence } from '@/hooks/useComercialIntelligence';
import { Loader2 } from 'lucide-react';

export default function RelatoriosComercialPage() {
  const { data, isLoading } = useComercialIntelligence();
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

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground mt-8">
          <Loader2 className="w-8 h-8 animate-spin mr-3" />
          Carregando relatórios...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="p-4 border border-border rounded-xl bg-card">
              <div className="text-sm text-muted-foreground mb-1">Total de Propostas</div>
              <div className="text-2xl font-bold">{data?.propostasCriadas || 0}</div>
            </div>
            <div className="p-4 border border-border rounded-xl bg-card">
              <div className="text-sm text-muted-foreground mb-1">Leads Acionados</div>
              <div className="text-2xl font-bold">{data?.leadsComProposta || 0}</div>
            </div>
            <div className="p-4 border border-border rounded-xl bg-card">
              <div className="text-sm text-muted-foreground mb-1">Aberturas Únicas</div>
              <div className="text-2xl font-bold text-primary">{data?.aberturasUnicas || 0}</div>
            </div>
            <div className="p-4 border border-border rounded-xl bg-card">
              <div className="text-sm text-muted-foreground mb-1">Taxa de Abertura</div>
              <div className="text-2xl font-bold text-primary">{data?.taxaAbertura.toFixed(1)}%</div>
            </div>
            
            <div className="p-4 border border-border rounded-xl bg-card col-span-2">
              <div className="text-sm text-muted-foreground mb-1">Cliques no WhatsApp</div>
              <div className="text-2xl font-bold">{data?.ctasClicados || 0}</div>
            </div>
            <div className="p-4 border border-border rounded-xl bg-card col-span-2">
              <div className="text-sm text-muted-foreground mb-1">Leads Convertidos</div>
              <div className="text-2xl font-bold text-green-600">{data?.leadsConvertidos || 0} ({data?.taxaConversaoLead.toFixed(1)}%)</div>
            </div>
          </div>
          
          <div className="mt-8 p-8 border border-border border-dashed rounded-xl flex flex-col items-center justify-center bg-muted/20 text-muted-foreground text-sm">
            <h3 className="font-semibold text-lg text-foreground mb-2">Gráficos de Funil</h3>
            <p>Os gráficos detalhados de desempenho por categoria estarão disponíveis na próxima atualização.</p>
          </div>
        </>
      )}
    </PageContainer>
  );
}

import { useParams, useNavigate } from 'react-router-dom';
import { User, History, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from '@/components/layout/PageContainer';
import { PAGE_TABS_LIST, PAGE_TABS_TRIGGER, PAGE_TABS_CONTENT } from '@/components/layout/PageTabs';
import { useClientDetails } from '@/components/cliente-detalhe/hooks/useClientDetails';
import { ClientHeader } from '@/components/cliente-detalhe/shared/ClientHeader';
import { ClientMetricsGrid } from '@/components/cliente-detalhe/shared/ClientMetricsGrid';
import { ContactoTab } from '@/components/cliente-detalhe/tabs/ContactoTab';
import { HistoricoTab } from '@/components/cliente-detalhe/tabs/HistoricoTab';
import { DocumentosTab } from '@/components/cliente-detalhe/tabs/DocumentosTab';
import { GaleriasTab } from '@/components/cliente-detalhe/tabs/GaleriasTab';
import { ImageIcon } from 'lucide-react';

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cliente, metricas, isLoading, atualizarCliente } = useClientDetails(id);

  if (isLoading) {
    return (
      <PageContainer className="py-4">
        <div className="flex items-center gap-3 pb-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[74px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-5 h-64 w-full rounded-xl" />
      </PageContainer>
    );
  }

  if (!cliente) {
    return (
      <PageContainer className="py-4">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 p-12 text-center">
          <User className="mb-3 h-10 w-10 text-accent-gold" />
          <h2 className="text-[15px] font-semibold text-foreground">Cliente não encontrado</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O cliente solicitado não existe ou foi removido.
          </p>
          <Button
            onClick={() => navigate('/app/clientes')}
            variant="outline"
            size="sm"
            className="mt-4 h-8 text-xs"
          >
            Voltar para Clientes
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-4">
      <ClientHeader cliente={cliente} onBack={() => navigate('/app/clientes')} />

      <ClientMetricsGrid metrics={metricas} />

      <Tabs defaultValue="historico" className="mt-5 w-full">
        <TabsList className={PAGE_TABS_LIST}>
          <TabsTrigger value="historico" className={PAGE_TABS_TRIGGER}>
            <History className="h-3.5 w-3.5" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="contacto" className={PAGE_TABS_TRIGGER}>
            <User className="h-3.5 w-3.5" />
            Contacto
          </TabsTrigger>
          <TabsTrigger value="galerias" className={PAGE_TABS_TRIGGER}>
            <ImageIcon className="h-3.5 w-3.5" />
            Galerias
          </TabsTrigger>
          <TabsTrigger value="documentos" className={PAGE_TABS_TRIGGER}>
            <FileText className="h-3.5 w-3.5" />
            Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className={PAGE_TABS_CONTENT}>
          <HistoricoTab cliente={cliente} />
        </TabsContent>

        <TabsContent value="contacto" className={PAGE_TABS_CONTENT}>
          <ContactoTab cliente={cliente} onUpdate={atualizarCliente} />
        </TabsContent>

        <TabsContent value="galerias" className={PAGE_TABS_CONTENT}>
          <GaleriasTab cliente={cliente} />
        </TabsContent>

        <TabsContent value="documentos" className={PAGE_TABS_CONTENT}>
          <DocumentosTab cliente={cliente} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

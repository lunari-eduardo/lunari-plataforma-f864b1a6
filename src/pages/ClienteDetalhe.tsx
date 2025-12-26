import { useParams, useNavigate } from 'react-router-dom';
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, FileText } from "lucide-react";
import { useClientDetails } from '@/components/cliente-detalhe/hooks/useClientDetails';
import { ClientHeader } from '@/components/cliente-detalhe/shared/ClientHeader';
import { ClientMetricsGrid } from '@/components/cliente-detalhe/shared/ClientMetricsGrid';
import { ContactoTab } from '@/components/cliente-detalhe/tabs/ContactoTab';
import { HistoricoTab } from '@/components/cliente-detalhe/tabs/HistoricoTab';
import { DocumentosTab } from '@/components/cliente-detalhe/tabs/DocumentosTab';

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cliente, metricas, isLoading, atualizarCliente } = useClientDetails(id);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground mt-2">Carregando cliente...</p>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <User className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Cliente não encontrado</h2>
        <p className="text-muted-foreground mb-4">O cliente solicitado não existe ou foi removido.</p>
        <Button onClick={() => navigate('/clientes')} variant="outline">
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-[calc(100vh-100px)] md:h-[calc(100vh-120px)]">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 space-y-4 md:space-y-6">
        {/* Header - Mobile First Layout */}
        <ClientHeader cliente={cliente} onBack={() => navigate('/clientes')} />

        {/* Métricas Rápidas - Grid 2x2 em mobile */}
        <ClientMetricsGrid metrics={metricas} />

        {/* Tabs - Responsivo com scroll em mobile */}
        <Tabs defaultValue="historico" className="w-full">
          <TabsList className="overflow-x-auto whitespace-nowrap px-1 gap-2 sm:grid sm:grid-cols-3 w-full">
            <TabsTrigger value="historico" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <History className="h-3 w-3 md:h-4 md:w-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="contacto" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <User className="h-3 w-3 md:h-4 md:w-4" />
              Contacto
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <FileText className="h-3 w-3 md:h-4 md:w-4" />
              Documentos
            </TabsTrigger>
          </TabsList>

          {/* Aba 1: Histórico & Projetos (Principal) */}
          <TabsContent value="historico" className="space-y-6">
            <HistoricoTab cliente={cliente} />
          </TabsContent>

          {/* Aba 2: Dados de Contacto */}
          <TabsContent value="contacto" className="space-y-6">
            <ContactoTab cliente={cliente} onUpdate={atualizarCliente} />
          </TabsContent>

          {/* Aba 3: Documentos */}
          <TabsContent value="documentos" className="space-y-6">
            <DocumentosTab cliente={cliente} />
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
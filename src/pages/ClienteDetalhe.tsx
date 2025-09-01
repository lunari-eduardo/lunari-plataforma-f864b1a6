import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, History, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useFileUpload } from '@/hooks/useFileUpload';

// Refactored components
import { useClientDetails } from '@/components/cliente-detalhe/hooks/useClientDetails';
import { ClientHeader } from '@/components/cliente-detalhe/shared/ClientHeader';
import { ClientMetricsGrid } from '@/components/cliente-detalhe/shared/ClientMetricsGrid';
import { ContactoTab } from '@/components/cliente-detalhe/tabs/ContactoTab';
import { HistoricoTab } from '@/components/cliente-detalhe/tabs/HistoricoTab';
import { DocumentosTab } from '@/components/cliente-detalhe/tabs/DocumentosTab';
export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { loadFiles } = useFileUpload();
  const { cliente, metricas } = useClientDetails(id);

  // Load files on mount
  loadFiles();
  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <User className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Cliente não encontrado</h2>
        <p className="text-muted-foreground mb-4">
          O cliente solicitado não existe ou foi removido.
        </p>
      </div>
    );
  }
  return (
    <ScrollArea className="min-h-[calc(100vh-100px)] md:h-[calc(100vh-120px)]">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 space-y-4 md:space-y-6">
        {/* Header Section */}
        <ClientHeader cliente={cliente} />

        {/* Metrics Grid */}
        <ClientMetricsGrid metrics={metricas} />

        {/* Tabs Section */}
        <Tabs defaultValue="contacto" className="w-full">
          <TabsList className="overflow-x-auto whitespace-nowrap px-1 gap-2 sm:grid sm:grid-cols-3 w-full">
            <TabsTrigger value="contacto" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <User className="h-3 w-3 md:h-4 md:w-4" />
              Contacto
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <History className="h-3 w-3 md:h-4 md:w-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <FileText className="h-3 w-3 md:h-4 md:w-4" />
              Documentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacto" className="space-y-6">
            <ContactoTab cliente={cliente} />
          </TabsContent>

          <TabsContent value="historico" className="space-y-6">
            <HistoricoTab cliente={cliente} />
          </TabsContent>

          <TabsContent value="documentos" className="space-y-6">
            <DocumentosTab cliente={cliente} />
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
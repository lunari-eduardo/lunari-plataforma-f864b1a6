import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from 'react-router-dom';
import { Briefcase, Paintbrush, Users, Goal, Compass } from 'lucide-react';

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

      <div className="mt-8">
        <Tabs defaultValue="business" className="w-full">
          <TabsList className="mb-8 overflow-x-auto overflow-y-hidden max-w-full justify-start pb-px border-b flex h-auto">
            <TabsTrigger value="business" className="gap-2 pb-3">
              <Briefcase className="h-4 w-4" />
              Identidade Comercial
            </TabsTrigger>
            <TabsTrigger value="brand" className="gap-2 pb-3">
              <Compass className="h-4 w-4" />
              Marca
            </TabsTrigger>
            <TabsTrigger value="audience" className="gap-2 pb-3">
              <Users className="h-4 w-4" />
              Público
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2 pb-3">
              <Goal className="h-4 w-4" />
              Como eu vendo
            </TabsTrigger>
            <TabsTrigger value="style" className="gap-2 pb-3">
              <Paintbrush className="h-4 w-4" />
              Estilo Visual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="business" className="mt-0">
            <div className="p-8 border border-border border-dashed rounded-xl flex items-center justify-center bg-muted/20 text-muted-foreground text-sm">
              Formulário de Identidade Comercial (Posicionamento, Proposta de Valor) em construção...
            </div>
          </TabsContent>

          <TabsContent value="brand" className="mt-0">
            <div className="p-8 border border-border border-dashed rounded-xl flex items-center justify-center bg-muted/20 text-muted-foreground text-sm">
              Formulário de Identidade de Marca (Tom de voz, vocabulário, cores) em construção...
            </div>
          </TabsContent>

          <TabsContent value="audience" className="mt-0">
            <div className="p-8 border border-border border-dashed rounded-xl flex items-center justify-center bg-muted/20 text-muted-foreground text-sm">
              Gerenciamento de Perfis de Público (Necessidades, Objeções) em construção...
            </div>
          </TabsContent>

          <TabsContent value="sales" className="mt-0">
            <div className="p-8 border border-border border-dashed rounded-xl flex items-center justify-center bg-muted/20 text-muted-foreground text-sm">
              Seleção de Estratégias de Venda do Catálogo (Pesos, Notas) em construção...
            </div>
          </TabsContent>

          <TabsContent value="style" className="mt-0">
            <div className="p-8 border border-border border-dashed rounded-xl flex items-center justify-center bg-muted/20 text-muted-foreground text-sm">
              Preferências Visuais (Densidade, Energia, Escala Tipográfica) em construção...
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}

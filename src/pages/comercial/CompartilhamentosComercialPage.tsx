import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from 'react-router-dom';

export default function CompartilhamentosComercialPage() {
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
              <BreadcrumbPage>Compartilhamentos</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <PageHeader 
        title="Compartilhamentos" 
        description="Acompanhe o status e a interação dos materiais enviados aos clientes." 
      />

      <div className="mt-8">
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-6 py-3">Proposta</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Enviada</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border hover:bg-muted/30">
                <td className="px-6 py-4 font-medium">Ensaio Gestante</td>
                <td className="px-6 py-4">Ana Silva</td>
                <td className="px-6 py-4 text-muted-foreground">07/08/2026</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">Visualizada</span></td>
              </tr>
              <tr className="border-b border-border hover:bg-muted/30">
                <td className="px-6 py-4 font-medium">Ensaio Newborn</td>
                <td className="px-6 py-4">Mariana Costa</td>
                <td className="px-6 py-4 text-muted-foreground">06/08/2026</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">Aguardando</span></td>
              </tr>
              <tr className="border-b border-border hover:bg-muted/30">
                <td className="px-6 py-4 font-medium">Casamento</td>
                <td className="px-6 py-4">João e Maria</td>
                <td className="px-6 py-4 text-muted-foreground">05/08/2026</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Aprovada</span></td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="px-6 py-4 font-medium">Ensaio Família</td>
                <td className="px-6 py-4">Carla Souza</td>
                <td className="px-6 py-4 text-muted-foreground">03/08/2026</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">Expirada</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}

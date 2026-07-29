import { ScrollArea } from '@/components/ui/scroll-area';
import { IntegracoesTab } from '@/components/preferencias/IntegracoesTab';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';

export default function Integracoes() {
  return (
    <div className="min-h-screen">
      <ScrollArea className="h-screen">
        <PageContainer className="py-4">
          <PageHeader
            title="Integrações"
            description="Gerencie as integrações e conexões da sua conta"
          />
          <IntegracoesTab />
        </PageContainer>
      </ScrollArea>
    </div>
  );
}

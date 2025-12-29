import { ScrollArea } from '@/components/ui/scroll-area';
import { IntegracoesTab } from '@/components/preferencias/IntegracoesTab';

export default function Integracoes() {
  return (
    <div className="min-h-screen bg-lunar-bg">
      <ScrollArea className="h-screen">
        <div className="container mx-auto p-4 max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-lunar-text mb-2">Integrações</h1>
            <p className="text-lunar-textSecondary">Gerencie as integrações e conexões da sua conta</p>
          </div>

          <IntegracoesTab />
        </div>
      </ScrollArea>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { ChevronRight, FolderTree, Target, CreditCard } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { useMetasPersonalizadas } from '@/hooks/useMetasPersonalizadas';
import { useCreditCardsSupabase } from '@/hooks/useCreditCardsSupabase';
import MetasConfigTab from '@/components/financas/MetasConfigTab';
import ConfiguracaoCartoes from '@/components/financas/ConfiguracaoCartoes';
import CategoriasPanel from './CategoriasPanel';

type PanelKey = 'metas' | 'cartoes' | null;
type View = 'hub' | 'categorias';

interface RowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  summary: string;
  onClick: () => void;
}

function HubRow({ icon, title, description, summary, onClick }: RowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div className="size-9 rounded-lg bg-muted/60 grid place-items-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:inline">{summary}</span>
        <ChevronRight className="size-4 text-muted-foreground/70" />
      </div>
    </div>
  );
}

export default function GerenciarView() {
  const [view, setView] = useState<View>('hub');
  const [panel, setPanel] = useState<PanelKey>(null);

  const { itensFinanceiros } = useNovoFinancas();
  const currentYear = new Date().getFullYear();
  const { metas } = useMetasPersonalizadas(currentYear);
  const { cartoes } = useCreditCardsSupabase();

  const categoriasCount = useMemo(
    () => itensFinanceiros.filter((i) => i.ativo !== false).length,
    [itensFinanceiros]
  );
  const metasCount = Array.isArray(metas) ? metas.length : 0;
  const cartoesCount = Array.isArray(cartoes) ? cartoes.length : 0;

  if (view === 'categorias') {
    return (
      <div className="w-full">
        <CategoriasPanel onBack={() => setView('hub')} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Gerenciar</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Organize as configurações financeiras do seu estúdio.
        </p>
      </header>

      <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm divide-y divide-border/60 overflow-hidden">
        <HubRow
          icon={<FolderTree className="size-4" />}
          title="Categorias"
          description="Organize receitas, despesas e investimentos."
          summary={`${categoriasCount} ${categoriasCount === 1 ? 'categoria cadastrada' : 'categorias cadastradas'}`}
          onClick={() => setView('categorias')}
        />
        <HubRow
          icon={<Target className="size-4" />}
          title="Metas"
          description="Defina suas metas financeiras mensais."
          summary={`${metasCount} ${metasCount === 1 ? 'meta ativa' : 'metas ativas'}`}
          onClick={() => setPanel('metas')}
        />
        <HubRow
          icon={<CreditCard className="size-4" />}
          title="Cartões"
          description="Gerencie cartões e datas de fechamento."
          summary={`${cartoesCount} ${cartoesCount === 1 ? 'cartão cadastrado' : 'cartões cadastrados'}`}
          onClick={() => setPanel('cartoes')}
        />
      </div>

      {/* Metas sheet */}
      <Sheet open={panel === 'metas'} onOpenChange={(v) => !v && setPanel(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg font-semibold">Metas financeiras</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-4 -mx-2 px-2">
            <MetasConfigTab />
          </div>
        </SheetContent>
      </Sheet>

      {/* Cartões sheet */}
      <Sheet open={panel === 'cartoes'} onOpenChange={(v) => !v && setPanel(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg font-semibold">Cartões de crédito</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-4 -mx-2 px-2">
            <ConfiguracaoCartoes />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

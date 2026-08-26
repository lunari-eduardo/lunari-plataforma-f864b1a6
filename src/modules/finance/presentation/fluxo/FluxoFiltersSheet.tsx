import { memo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal } from 'lucide-react';
import type { FiltrosExtrato, ExtratoOrigem, ExtratoStatus, ExtratoEscopo } from '@/types/extrato';
import { SidePanel } from '@/modules/finance/presentation/shell/SidePanel';

interface FluxoFiltersSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filtros: FiltrosExtrato;
  onChange: (patch: Partial<FiltrosExtrato>) => void;
  onReset: () => void;
  valorMin: string;
  valorMax: string;
  onValorMinChange: (v: string) => void;
  onValorMaxChange: (v: string) => void;
}

const FluxoFiltersSheet = memo(function FluxoFiltersSheet({
  open,
  onOpenChange,
  filtros,
  onChange,
  onReset,
  valorMin,
  valorMax,
  onValorMinChange,
  onValorMaxChange,
}: FluxoFiltersSheetProps) {
  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      icone={SlidersHorizontal}
      titulo="Filtros"
      subtitulo="Refine o que aparece na sua timeline."
      width="sm"
      footer={
        <SidePanel.Footer
          left={
            <Button variant="ghost" size="sm" onClick={onReset}>
              Limpar filtros
            </Button>
          }
          right={
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Aplicar filtros
            </Button>
          }
        />
      }
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Origem</Label>
          <Select
            value={filtros.origem ?? 'todos'}
            onValueChange={(v) => onChange({ origem: v as ExtratoOrigem | 'todos' })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="financeiro">Financeiro</SelectItem>
              <SelectItem value="workflow">Workflow</SelectItem>
              <SelectItem value="gallery">Galeria</SelectItem>
              <SelectItem value="venda_avulsa">Venda Avulsa</SelectItem>
              <SelectItem value="cartao">Cartão</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={filtros.status ?? 'todos'}
            onValueChange={(v) => onChange({ status: v as ExtratoStatus | 'todos' })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="Pago">Pago</SelectItem>
              <SelectItem value="Faturado">Faturado</SelectItem>
              <SelectItem value="Agendado">Agendado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Escopo do pagamento</Label>
          <Select
            value={filtros.escopo ?? 'todos'}
            onValueChange={(v) => onChange({ escopo: v as ExtratoEscopo | 'todos' })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sessao">Sessão</SelectItem>
              <SelectItem value="fotos_extras">Fotos extras</SelectItem>
              <SelectItem value="sessao_e_extras">Sessão + extras</SelectItem>
              <SelectItem value="avulso">Avulso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Cliente</Label>
          <Input
            value={filtros.cliente ?? ''}
            onChange={(e) => onChange({ cliente: e.target.value })}
            placeholder="Nome do cliente"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Forma de pagamento</Label>
          <Input
            value={filtros.formaPagamento ?? ''}
            onChange={(e) => onChange({ formaPagamento: e.target.value })}
            placeholder="PIX, Cartão, Boleto…"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor mínimo</Label>
            <Input
              inputMode="decimal"
              value={valorMin}
              onChange={(e) => onValorMinChange(e.target.value)}
              placeholder="R$ 0,00"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor máximo</Label>
            <Input
              inputMode="decimal"
              value={valorMax}
              onChange={(e) => onValorMaxChange(e.target.value)}
              placeholder="R$ 0,00"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Período</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => onChange({ dataInicio: e.target.value })}
            />
            <Input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => onChange({ dataFim: e.target.value })}
            />
          </div>
        </div>
      </div>
    </SidePanel>
  );
});

export default FluxoFiltersSheet;

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ClientSearchCombobox from "@/components/agenda/ClientSearchCombobox";
import { PackageCombobox } from "@/components/workflow/PackageCombobox";
import { CategoryCombobox } from "@/components/workflow/CategoryCombobox";

const getMonthName = (month: number) => {
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return monthNames[month - 1];
};

interface Props {
  clienteId: string;
  setClienteId: (v: string) => void;
  diaSessao: string;
  setDiaSessao: (v: string) => void;
  currentMonth: { month: number; year: number };
  pacote: string;
  onPackageChange: (data: { nome: string; valorBase: number; valorFotoExtra: number; categoria: string }) => void;
  onClearPackage: () => void;
  categoria: string;
  autoFilledByPackage: boolean;
  categoryOptions: { id: string; nome: string }[];
  onCategoryChange: (v: string) => void;
}

export function QuickSessionBasicFields({
  clienteId, setClienteId, diaSessao, setDiaSessao, currentMonth,
  pacote, onPackageChange, onClearPackage,
  categoria, autoFilledByPackage, categoryOptions, onCategoryChange,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div className="space-y-1" data-quick-session-cliente>
        <Label className="text-xs">Cliente *</Label>
        <ClientSearchCombobox value={clienteId} onSelect={setClienteId} placeholder="Buscar cliente..." />
      </div>

      <div className="space-y-1">
        <Label className="text-xs" htmlFor="qs-dia">
          Dia * <span className="text-muted-foreground font-normal">
            ({getMonthName(currentMonth.month)} {currentMonth.year})
          </span>
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="qs-dia"
            type="number"
            min="1"
            max="31"
            value={diaSessao}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || (parseInt(val) >= 1 && parseInt(val) <= 31)) {
                setDiaSessao(val);
              }
            }}
            placeholder="DD"
            className="h-7 text-xs w-16"
          />
          <span className="text-xs text-muted-foreground">
            / {String(currentMonth.month).padStart(2, "0")} / {currentMonth.year}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs flex items-center justify-between">
          <span>Pacote</span>
          {pacote && (
            <button
              type="button"
              onClick={onClearPackage}
              className="text-2xs text-muted-foreground hover:text-destructive"
            >
              (limpar)
            </button>
          )}
        </Label>
        <PackageCombobox value={pacote} onValueChange={onPackageChange} />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">
          Categoria *{autoFilledByPackage && categoria && " (auto)"}
        </Label>
        <CategoryCombobox
          value={categoria}
          disabled={autoFilledByPackage && !!categoria}
          categoryOptions={categoryOptions}
          onValueChange={onCategoryChange}
        />
      </div>
    </div>
  );
}

import React from "react";
import { Calendar } from "lucide-react";
import { PanelSection, PanelField } from "../PanelSection";
import { CategorySelector } from "@/components/ui/category-selector";
import PackageSearchCombobox from "../../PackageSearchCombobox";
import type { PanelFormState } from "../types";

interface SessionDetailsSectionProps {
  form: PanelFormState;
  setForm: React.Dispatch<React.SetStateAction<PanelFormState>>;
  categorias: unknown[];
  handlePackageSelect: (packageId: string, packageData?: any) => void;
}

export const SessionDetailsSection: React.FC<SessionDetailsSectionProps> = ({
  form,
  setForm,
  categorias,
  handlePackageSelect,
}) => {
  return (
    <PanelSection icon={Calendar} title="Sessão">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PanelField label="Categoria">
          <CategorySelector
            categorias={categorias as unknown as string[]}
            value={form.categoria}
            onValueChange={(categoria) =>
              setForm((prev) => ({ ...prev, categoria, packageId: "" }))
            }
            placeholder="Filtrar pacotes..."
          />
        </PanelField>

        <PanelField label="Pacote">
          <PackageSearchCombobox
            value={form.packageId}
            onSelect={handlePackageSelect}
            placeholder="Selecionar pacote..."
            filtrarPorCategoria={form.categoria}
            hidePrice
          />
        </PanelField>
      </div>
    </PanelSection>
  );
};

/**
 * GroupCategorySelector — Onda C
 *
 * Seletor hierárquico (Grupo → Categoria) baseado no catálogo fixo
 * `fin_groups` + categorias do usuário (`fin_items_master.group_code`).
 *
 * - Esconde a Natureza (inferida automaticamente pelo Grupo).
 * - Filtra grupos por tipo de lançamento (receita vs despesa).
 * - Permite criação inline de categoria dentro do grupo selecionado.
 */

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCapabilityMutation, useCapabilityQuery } from "@/shared/capability";
import { GROUP_LIST, NATURES, listCategories, createCategory } from "@/modules/finance";
import type { NatureCode } from "@/modules/finance";

const RECEITA_NATURES: NatureCode[] = ["receita_operacional", "receita_financeira"];
const DESPESA_NATURES: NatureCode[] = [
  "despesa_operacional",
  "investimento_ativos",
  "impostos",
  "pro_labore",
  "distribuicao_lucros",
  "financiamento",
  "emprestimo",
];

interface GroupCategorySelectorProps {
  tipoLancamento: "receita" | "despesa";
  itemId: string;
  onItemIdChange: (id: string) => void;
  /** Grupo inicial sugerido (opcional). */
  initialGroupCode?: string;
}

export default function GroupCategorySelector({
  tipoLancamento,
  itemId,
  onItemIdChange,
  initialGroupCode,
}: GroupCategorySelectorProps) {
  const queryClient = useQueryClient();
  const allowedNatures = tipoLancamento === "receita" ? RECEITA_NATURES : DESPESA_NATURES;

  const groupsByNature = useMemo(() => {
    const map = new Map<NatureCode, typeof GROUP_LIST>();
    for (const nature of allowedNatures) {
      const list = GROUP_LIST.filter((g) => g.natureCode === nature);
      if (list.length) map.set(nature, list);
    }
    return map;
  }, [allowedNatures]);

  const [groupCode, setGroupCode] = useState<string>(() => {
    if (initialGroupCode && allowedNatures.includes(
      (GROUP_LIST.find((g) => g.code === initialGroupCode)?.natureCode ?? "") as NatureCode,
    )) {
      return initialGroupCode;
    }
    return "";
  });

  const categoriesQuery = useCapabilityQuery(
    listCategories,
    { groupCode: groupCode || undefined },
    {
      queryKey: ["finance", "categories", groupCode || "_"],
      enabled: !!groupCode,
      staleTime: 30_000,
    },
  );

  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  const createMutation = useCapabilityMutation(createCategory, {
    onSuccess: (res) => {
      onItemIdChange(res.id);
      setNovoNome("");
      setCriando(false);
      queryClient.invalidateQueries({ queryKey: ["finance", "categories", groupCode] });
      queryClient.invalidateQueries({ queryKey: ["financial-items"] });
      queryClient.invalidateQueries({ queryKey: ["novo-financas"] });
    },
    onError: (e) => toast.error(e.message || "Não foi possível criar a categoria."),
  });

  const handleCriar = () => {
    const nome = novoNome.trim();
    if (!groupCode) {
      toast.error("Selecione um grupo antes de criar a categoria.");
      return;
    }
    if (nome.length < 2) {
      toast.error("Digite ao menos 2 caracteres.");
      return;
    }
    createMutation.mutate({ nome, groupCode, source: "user" });
  };

  const handleGroupChange = (code: string) => {
    setGroupCode(code);
    onItemIdChange("");
    setCriando(false);
    setNovoNome("");
  };

  const categorias = categoriesQuery.data?.categories ?? [];

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="grupo">Grupo</Label>
        <Select value={groupCode} onValueChange={handleGroupChange}>
          <SelectTrigger id="grupo">
            <SelectValue placeholder="Selecione um grupo..." />
          </SelectTrigger>
          <SelectContent>
            {Array.from(groupsByNature.entries()).map(([nature, groups]) => (
              <SelectGroup key={nature}>
                <SelectLabel className="text-xs uppercase text-muted-foreground">
                  {NATURES[nature].label}
                </SelectLabel>
                {groups.map((g) => (
                  <SelectItem key={g.code} value={g.code}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="categoria">Categoria</Label>
        <Select
          value={itemId}
          onValueChange={onItemIdChange}
          disabled={!groupCode || categoriesQuery.isLoading}
        >
          <SelectTrigger id="categoria">
            <SelectValue
              placeholder={
                !groupCode
                  ? "Escolha um grupo primeiro"
                  : categoriesQuery.isLoading
                    ? "Carregando..."
                    : "Selecione uma categoria..."
              }
            />
          </SelectTrigger>
          <SelectContent>
            {categorias.length > 0 ? (
              categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                Nenhuma categoria neste grupo ainda.
              </div>
            )}
          </SelectContent>
        </Select>

        {/* Inline creator */}
        {groupCode && (
          !criando ? (
            <button
              type="button"
              onClick={() => setCriando(true)}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary opacity-70 hover:opacity-100 transition-opacity"
            >
              <Plus className="h-3 w-3" />
              Nova categoria neste grupo
            </button>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <Input
                autoFocus
                placeholder="Nome da categoria"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleCriar(); }
                  if (e.key === "Escape") { setCriando(false); setNovoNome(""); }
                }}
                className="h-8 text-sm"
                disabled={createMutation.isPending}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCriar}
                disabled={createMutation.isPending || novoNome.trim().length < 2}
                className="h-8"
              >
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => { setCriando(false); setNovoNome(""); }}
                className="h-8"
              >
                Cancelar
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

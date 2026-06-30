/**
 * GroupCategorySelector
 *
 * Seleção em 2 passos:
 *  - Grupo (Combobox pesquisável, agrupado por Natureza, escopo configurável)
 *  - Categoria (apenas quando o grupo `requiresCategory`)
 *
 * Em grupos finais (Equipamentos, Acervo, Estrutura…), o item-mestre "espelho"
 * é criado/resolvido automaticamente (idempotente) e a UI foca em Descrição.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronsUpDown, Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCapabilityMutation, useCapabilityQuery } from "@/shared/capability";
import {
  GROUPS,
  GROUP_LIST,
  NATURES,
  SCOPE_NATURES,
  listCategories,
  createCategory,
  type GroupScope,
} from "@/modules/finance";
import type { NatureCode } from "@/modules/finance";
import { cn } from "@/lib/utils";

interface GroupCategorySelectorProps {
  /**
   * Escopo do seletor — define quais Naturezas (e portanto Grupos) aparecem.
   * Default: derivado do `tipoLancamento`.
   */
  scope?: GroupScope;
  tipoLancamento: "receita" | "despesa";
  itemId: string;
  onItemIdChange: (id: string) => void;
  /** Grupo inicial sugerido (opcional). */
  initialGroupCode?: string;
}

export default function GroupCategorySelector({
  scope,
  tipoLancamento,
  itemId,
  onItemIdChange,
  initialGroupCode,
}: GroupCategorySelectorProps) {
  const queryClient = useQueryClient();

  const effectiveScope: GroupScope =
    scope ?? (tipoLancamento === "receita" ? "receita_extra" : "despesa");
  const allowedNatures = SCOPE_NATURES[effectiveScope] as readonly NatureCode[];

  const groupsByNature = useMemo(() => {
    const map = new Map<NatureCode, typeof GROUP_LIST>();
    for (const nature of allowedNatures) {
      const list = GROUP_LIST.filter((g) => g.natureCode === nature);
      if (list.length) map.set(nature, list);
    }
    return map;
  }, [allowedNatures]);

  const [open, setOpen] = useState(false);
  const [groupCode, setGroupCode] = useState<string>(() => {
    if (
      initialGroupCode &&
      allowedNatures.includes(
        (GROUP_LIST.find((g) => g.code === initialGroupCode)?.natureCode ?? "") as NatureCode,
      )
    ) {
      return initialGroupCode;
    }
    return "";
  });

  const selectedGroup = groupCode ? GROUPS[groupCode as keyof typeof GROUPS] : undefined;
  const needsCategory = !!selectedGroup?.requiresCategory;

  const categoriesQuery = useCapabilityQuery(
    listCategories,
    { groupCode: groupCode || undefined },
    {
      queryKey: ["finance", "categories", groupCode || "_"],
      enabled: !!groupCode && needsCategory,
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

  // Resolve item-espelho automaticamente para grupos finais.
  const mirrorResolvedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!groupCode || needsCategory) return;
    if (mirrorResolvedFor.current === groupCode) return;
    mirrorResolvedFor.current = groupCode;
    const label = GROUPS[groupCode as keyof typeof GROUPS]?.label ?? groupCode;
    createMutation.mutate({ nome: label, groupCode, source: "automation" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupCode, needsCategory]);

  const handleGroupChange = (code: string) => {
    setGroupCode(code);
    onItemIdChange("");
    setCriando(false);
    setNovoNome("");
    mirrorResolvedFor.current = null;
    setOpen(false);
  };

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

  const categorias = categoriesQuery.data?.categories ?? [];
  const groupedEntries = Array.from(groupsByNature.entries());

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="grupo">Grupo</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id="grupo"
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
            >
              {selectedGroup ? selectedGroup.label : "Selecione um grupo..."}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-[--radix-popover-trigger-width]"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command>
              <CommandInput placeholder="Buscar grupo..." />
              <CommandList className="max-h-[320px]">
                <CommandEmpty>Nenhum grupo encontrado.</CommandEmpty>
                {groupedEntries.map(([nature, groups]) => (
                  <CommandGroup
                    key={nature}
                    heading={NATURES[nature].label.toUpperCase()}
                  >
                    {groups.map((g) => (
                      <CommandItem
                        key={g.code}
                        value={`${g.label} ${nature}`}
                        onSelect={() => handleGroupChange(g.code)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            groupCode === g.code ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span>{g.label}</span>
                        {!g.requiresCategory && (
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            sem categoria
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {needsCategory && (
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

          {!criando ? (
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
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCriar();
                  }
                  if (e.key === "Escape") {
                    setCriando(false);
                    setNovoNome("");
                  }
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
                {createMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Criar"
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCriando(false);
                  setNovoNome("");
                }}
                className="h-8"
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      {groupCode && !needsCategory && (
        <p className="text-xs text-muted-foreground -mt-1">
          Este grupo é final — detalhe o lançamento no campo <strong>Descrição/Observações</strong>{" "}
          (ex.: "Canon R6 Mark II", "Painel ripado").
        </p>
      )}
    </div>
  );
}

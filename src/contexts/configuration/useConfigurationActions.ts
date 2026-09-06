import { useCallback } from "react";
import { configurationService } from "@/services/ConfigurationService";
import { workflowStore } from "@/features/workflow";
import { toast } from "sonner";
import type { Categoria, Pacote, Produto, EtapaTrabalho } from "@/types/configuration";

interface UseConfigurationActionsProps {
  suppress: (id: string) => void;
  categoriasOps: {
    add: (item: Categoria, persist: () => Promise<void>) => Promise<void>;
    update: (id: string, updates: Partial<Categoria>, persist: () => Promise<void>) => Promise<void>;
    remove: (id: string, persist: () => Promise<void>) => Promise<void>;
    set: (data: Categoria[]) => void;
  };
  pacotesOps: {
    add: (item: Pacote, persist: () => Promise<void>) => Promise<void>;
    update: (id: string, updates: Partial<Pacote>, persist: () => Promise<void>) => Promise<void>;
    remove: (id: string, persist: () => Promise<void>) => Promise<void>;
    set: (data: Pacote[]) => void;
  };
  produtosOps: {
    add: (item: Produto, persist: () => Promise<void>) => Promise<void>;
    update: (id: string, updates: Partial<Produto>, persist: () => Promise<void>) => Promise<void>;
    remove: (id: string, persist: () => Promise<void>) => Promise<void>;
    set: (data: Produto[]) => void;
  };
  etapasOps: {
    add: (item: EtapaTrabalho, persist: () => Promise<void>) => Promise<void>;
    update: (id: string, updates: Partial<EtapaTrabalho>, persist: () => Promise<void>) => Promise<void>;
    remove: (id: string, persist: () => Promise<void>) => Promise<void>;
    set: (data: EtapaTrabalho[]) => void;
  };
  categoriasRef: React.MutableRefObject<Categoria[]>;
  pacotesRef: React.MutableRefObject<Pacote[]>;
  produtosRef: React.MutableRefObject<Produto[]>;
  etapasRef: React.MutableRefObject<EtapaTrabalho[]>;
}

export function useConfigurationActions({
  suppress,
  categoriasOps,
  pacotesOps,
  produtosOps,
  etapasOps,
  categoriasRef,
  pacotesRef,
  produtosRef,
  etapasRef,
}: UseConfigurationActionsProps) {
  // ==================== CATEGORIAS ====================

  const adicionarCategoria = useCallback(
    async (categoria: Omit<Categoria, "id">) => {
      if (!categoria.nome.trim()) {
        toast.error("Nome da categoria é obrigatório");
        return;
      }

      console.log("📋 [adicionarCategoria] Iniciando...", {
        categoria,
        currentCount: categoriasRef.current.length,
      });

      const newCategoria: Categoria = { id: crypto.randomUUID(), ...categoria };
      suppress(newCategoria.id);

      console.log("📋 [adicionarCategoria] Nova categoria criada:", newCategoria);

      await categoriasOps.add(newCategoria, async () => {
        console.log("📋 [adicionarCategoria] Salvando no Supabase...");
        await configurationService.saveCategorias([newCategoria]);
        console.log("📋 [adicionarCategoria] Salvo com sucesso!");
      });
    },
    [suppress, categoriasOps, categoriasRef],
  );

  const atualizarCategoria = useCallback(
    async (id: string, dados: Partial<Categoria>): Promise<void> => {
      const currentItem = categoriasRef.current.find((c) => c.id === id);
      if (!currentItem) {
        console.error("[atualizarCategoria] Item not found:", id);
        toast.error("Categoria não encontrada");
        throw new Error("Categoria não encontrada");
      }

      suppress(id);

      return categoriasOps.update(id, dados, async () => {
        await configurationService.updateCategoriaById(id, dados);
        console.log("✅ [atualizarCategoria] Salvo:", { id, dados });

        if (dados.nome && dados.nome !== currentItem.nome) {
          console.log("🔄 [atualizarCategoria] Nome alterado, invalidando store do workflow");
          workflowStore.clear();
        }
      });
    },
    [suppress, categoriasOps, categoriasRef],
  );

  const canDeleteCategoria = useCallback((id: string) => {
    return configurationService.canDeleteCategoria(id, pacotesRef.current);
  }, [pacotesRef]);

  const removerCategoria = useCallback(
    async (id: string): Promise<boolean> => {
      console.log("🗑️ [removerCategoria] Iniciando exclusão", id);

      if (!canDeleteCategoria(id)) {
        const pacotesVinculados = pacotesRef.current
          .filter((p) => p.categoria_id === id)
          .map((p) => p.nome)
          .join(", ");

        toast.error(
          `Não é possível excluir esta categoria. Ela está sendo usada pelos pacotes: ${pacotesVinculados}`,
        );
        return false;
      }

      const existsLocally = categoriasRef.current.some((c) => c.id === id);

      if (existsLocally) {
        suppress(id);
        try {
          await categoriasOps.remove(id, async () => {
            await configurationService.deleteCategoriaById(id);
          });
        } catch (error) {
          console.error("❌ [removerCategoria] Erro ao excluir", error);
          toast.error("Erro ao excluir categoria. Alteração foi revertida.");
          return false;
        }
      } else {
        try {
          await configurationService.deleteCategoriaById(id);
        } catch (error) {
          console.error("❌ [removerCategoria] Erro ao excluir diretamente", error);
          toast.error("Erro ao excluir categoria.");
          return false;
        }
      }

      console.log("✅ [removerCategoria] Exclusão confirmada", id);
      return true;
    },
    [categoriasOps, suppress, canDeleteCategoria, categoriasRef, pacotesRef],
  );

  // ==================== PACOTES ====================

  const adicionarPacote = useCallback(
    async (pacote: Omit<Pacote, "id">) => {
      if (!pacote.nome.trim()) {
        toast.error("Nome do pacote é obrigatório");
        return;
      }

      console.log("📦 [adicionarPacote] Iniciando...", {
        pacote,
        currentCount: pacotesRef.current.length,
      });

      const newPacote: Pacote = {
        id: crypto.randomUUID(),
        ...pacote,
      };
      suppress(newPacote.id);

      console.log("📦 [adicionarPacote] Novo pacote criado:", newPacote);

      await pacotesOps.add(newPacote, async () => {
        console.log("📦 [adicionarPacote] Salvando no Supabase...");
        await configurationService.savePacotes([newPacote]);
        console.log("📦 [adicionarPacote] Salvo com sucesso!");
      });
    },
    [suppress, pacotesOps, pacotesRef],
  );

  const atualizarPacote = useCallback(
    async (id: string, dados: Partial<Pacote>): Promise<void> => {
      const currentItem = pacotesRef.current.find((p) => p.id === id);
      if (!currentItem) {
        console.error("[atualizarPacote] Item not found:", id);
        toast.error("Pacote não encontrado");
        throw new Error("Pacote não encontrado");
      }

      const updatedItem = { ...currentItem, ...dados };

      return pacotesOps.update(id, dados, async () => {
        await configurationService.savePacotes([updatedItem]);
        console.log("✅ [atualizarPacote] Salvo:", updatedItem);
      });
    },
    [suppress, pacotesOps, pacotesRef],
  );

  const removerPacote = useCallback(
    async (id: string): Promise<boolean> => {
      console.log("🗑️ [removerPacote] Iniciando exclusão", id);

      const existsLocally = pacotesRef.current.some((p) => p.id === id);

      if (existsLocally) {
        suppress(id);
        try {
          await pacotesOps.remove(id, async () => {
            await configurationService.deletePacoteById(id);
          });
        } catch (error) {
          console.error("❌ [removerPacote] Erro ao excluir", error);
          toast.error("Erro ao excluir pacote. Alteração foi revertida.");
          return false;
        }
      } else {
        try {
          await configurationService.deletePacoteById(id);
        } catch (error) {
          console.error("❌ [removerPacote] Erro ao excluir diretamente", error);
          toast.error("Erro ao excluir pacote.");
          return false;
        }
      }

      console.log("✅ [removerPacote] Exclusão confirmada", id);
      return true;
    },
    [pacotesOps, suppress, pacotesRef],
  );

  // ==================== PRODUTOS ====================

  const canDeleteProduto = useCallback((id: string) => {
    return configurationService.canDeleteProduto(id, pacotesRef.current);
  }, [pacotesRef]);

  const adicionarProduto = useCallback(
    async (produto: Omit<Produto, "id">) => {
      if (!produto.nome.trim()) {
        toast.error("Nome do produto é obrigatório");
        return;
      }

      console.log("🛍️ [adicionarProduto] Iniciando...", {
        produto,
        currentCount: produtosRef.current.length,
      });

      const newProduto: Produto = { id: crypto.randomUUID(), ...produto };
      suppress(newProduto.id);

      console.log("🛍️ [adicionarProduto] Novo produto criado:", newProduto);

      await produtosOps.add(newProduto, async () => {
        console.log("🛍️ [adicionarProduto] Salvando no Supabase...");
        await configurationService.saveProdutos([newProduto]);
        console.log("🛍️ [adicionarProduto] Salvo com sucesso!");
      });
    },
    [suppress, produtosOps, produtosRef],
  );

  const atualizarProduto = useCallback(
    async (id: string, dados: Partial<Produto>): Promise<void> => {
      const currentItem = produtosRef.current.find((p) => p.id === id);
      if (!currentItem) {
        console.error("[atualizarProduto] Item not found:", id);
        toast.error("Produto não encontrado");
        throw new Error("Produto não encontrado");
      }

      const updatedItem = { ...currentItem, ...dados };

      return produtosOps.update(id, dados, async () => {
        await configurationService.saveProdutos([updatedItem]);
        console.log("✅ [atualizarProduto] Salvo:", updatedItem);
      });
    },
    [suppress, produtosOps, produtosRef],
  );

  const removerProduto = useCallback(
    async (id: string): Promise<boolean> => {
      console.log("🗑️ [removerProduto] Iniciando exclusão", id);

      if (!canDeleteProduto(id)) {
        const pacotesVinculados = pacotesRef.current
          .filter((p) => p.produtosIncluidos?.some((pid) => pid.produtoId === id))
          .map((p) => p.nome)
          .join(", ");

        toast.error(
          `Não é possível excluir este produto. Ele está sendo usado pelos pacotes: ${pacotesVinculados}`,
        );
        return false;
      }

      const existsLocally = produtosRef.current.some((p) => p.id === id);

      if (existsLocally) {
        suppress(id);
        try {
          await produtosOps.remove(id, async () => {
            await configurationService.deleteProdutoById(id);
          });
        } catch (error) {
          console.error("❌ [removerProduto] Erro ao excluir", error);
          toast.error("Erro ao excluir produto. Alteração foi revertida.");
          return false;
        }
      } else {
        try {
          await configurationService.deleteProdutoById(id);
        } catch (error) {
          console.error("❌ [removerProduto] Erro ao excluir diretamente", error);
          toast.error("Erro ao excluir produto.");
          return false;
        }
      }

      console.log("✅ [removerProduto] Exclusão confirmada", id);
      return true;
    },
    [produtosOps, suppress, canDeleteProduto, produtosRef, pacotesRef],
  );

  // ==================== ETAPAS ====================

  const adicionarEtapa = useCallback(
    async (etapa: Omit<EtapaTrabalho, "id" | "ordem">) => {
      if (!etapa.nome.trim()) {
        toast.error("Nome da etapa é obrigatório");
        return;
      }

      console.log("📋 [adicionarEtapa] Iniciando...", {
        etapa,
        currentCount: etapasRef.current.length,
      });

      const ordem =
        etapasRef.current.length > 0
          ? Math.max(...etapasRef.current.map((e) => e.ordem)) + 1
          : 1;
      const newEtapa: EtapaTrabalho = { id: crypto.randomUUID(), ...etapa, ordem };
      suppress(newEtapa.id);

      console.log("📋 [adicionarEtapa] Nova etapa criada:", newEtapa);

      await etapasOps.add(newEtapa, async () => {
        console.log("📋 [adicionarEtapa] Salvando no Supabase...");
        await configurationService.saveEtapas([newEtapa]);
        console.log("📋 [adicionarEtapa] Salvo com sucesso!");
      });

      console.log("📋 [adicionarEtapa] Concluído");
    },
    [suppress, etapasOps, etapasRef],
  );

  const atualizarEtapa = useCallback(
    async (id: string, dados: Partial<EtapaTrabalho>): Promise<void> => {
      const currentItem = etapasRef.current.find((e) => e.id === id);
      if (!currentItem) {
        console.error("[atualizarEtapa] Item not found:", id);
        toast.error("Etapa não encontrada");
        throw new Error("Etapa não encontrada");
      }

      const updatedItem = { ...currentItem, ...dados };

      return etapasOps.update(id, dados, async () => {
        await configurationService.saveEtapas([updatedItem]);
        console.log("✅ [atualizarEtapa] Salvo:", updatedItem);
      });
    },
    [suppress, etapasOps, etapasRef],
  );

  const removerEtapa = useCallback(
    async (id: string): Promise<boolean> => {
      console.log("🗑️ [removerEtapa] Iniciando exclusão", id);

      const existsLocally = etapasRef.current.some((e) => e.id === id);

      if (existsLocally) {
        suppress(id);
        try {
          await etapasOps.remove(id, async () => {
            await configurationService.deleteEtapaById(id);
          });
        } catch (error) {
          console.error("❌ [removerEtapa] Erro ao excluir", error);
          toast.error("Erro ao excluir etapa. Alteração foi revertida.");
          return false;
        }
      } else {
        try {
          await configurationService.deleteEtapaById(id);
        } catch (error) {
          console.error("❌ [removerEtapa] Erro ao excluir diretamente", error);
          toast.error("Erro ao excluir etapa.");
          return false;
        }
      }

      console.log("✅ [removerEtapa] Exclusão confirmada", id);
      return true;
    },
    [etapasOps, suppress, etapasRef],
  );

  const moverEtapa = useCallback(
    async (id: string, direcao: "cima" | "baixo") => {
      const sorted = [...etapasRef.current].sort((a, b) => a.ordem - b.ordem);
      const currentIndex = sorted.findIndex((e) => e.id === id);
      if (currentIndex === -1) return;

      const newIndex = direcao === "cima" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= sorted.length) return;

      const reordered = [...sorted];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(newIndex, 0, moved);

      const updated = reordered.map((e, idx) => ({ ...e, ordem: idx + 1 }));

      updated.forEach((e) => suppress(e.id));

      etapasOps.set(updated);

      try {
        await configurationService.saveEtapas(updated);
      } catch (error) {
        console.error("❌ [moverEtapa] Erro ao salvar reordenação", error);
        toast.error("Erro ao reordenar etapas. Alteração pode não ter sido salva.");
        try {
          const reloaded = await configurationService.loadEtapasAsync();
          etapasOps.set(reloaded);
        } catch (reloadError) {
          console.error("❌ [moverEtapa] Erro ao recarregar etapas", reloadError);
        }
      }
    },
    [suppress, etapasOps, etapasRef],
  );

  return {
    adicionarCategoria,
    atualizarCategoria,
    removerCategoria,
    canDeleteCategoria,
    adicionarPacote,
    atualizarPacote,
    removerPacote,
    adicionarProduto,
    atualizarProduto,
    removerProduto,
    canDeleteProduto,
    adicionarEtapa,
    atualizarEtapa,
    removerEtapa,
    moverEtapa,
  };
}

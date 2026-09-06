import { useState, useEffect, useCallback } from "react";
import { storage, STORAGE_KEYS } from "@/utils/localStorage";
import { syncLeadsWithClientUpdate } from "@/utils/leadClientSync";
import type { Cliente, OrigemCliente } from "@/types/cliente";
import type { Template } from "@/types/template";
import type { ConfigurationContextType } from "@/contexts/ConfigurationContext";

export function useAppCrm(realtimeConfig: ConfigurationContextType) {
  const [templates, setTemplates] = useState<Template[]>(() => {
    return storage.load(STORAGE_KEYS.TEMPLATES, []);
  });

  const [origens, setOrigens] = useState<OrigemCliente[]>(() => {
    return storage.load(STORAGE_KEYS.ORIGINS, []);
  });

  // MIGRATED TO SUPABASE: Usar useClientesRealtime() para clientes
  const [clientes, setClientes] = useState<Cliente[]>([]);

  // Categorias vindas do ConfigurationContext
  const categoriasFull = (realtimeConfig.categorias || []) as Array<{ id: string; nome: string }>;
  const categorias = categoriasFull.map((cat: any) => cat.nome);
  const produtos = realtimeConfig.produtos || [];
  const pacotes = realtimeConfig.pacotes || [];

  // Storage Persistence Effects
  useEffect(() => {
    storage.save(STORAGE_KEYS.TEMPLATES, templates);
  }, [templates]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.ORIGINS, origens);
  }, [origens]);

  useEffect(() => {
    storage.save(STORAGE_KEYS.CLIENTS, clientes);
  }, [clientes]);

  // Template Actions
  const adicionarTemplate = useCallback((template: Omit<Template, "id">) => {
    const novoTemplate: Template = {
      ...template,
      id: Date.now().toString(),
    };
    setTemplates((prev) => [...prev, novoTemplate]);
    return novoTemplate;
  }, []);

  const atualizarTemplate = useCallback((id: string, template: Partial<Template>) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...template } : t)));
  }, []);

  const excluirTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const definirTemplatePadrao = useCallback((id: string) => {
    setTemplates((prev) => prev.map((t) => ({ ...t, isPadrao: t.id === id })));
  }, []);

  // Origem Actions
  const adicionarOrigem = useCallback((origem: Omit<OrigemCliente, "id">) => {
    const novaOrigem: OrigemCliente = {
      ...origem,
      id: Date.now().toString(),
    };
    setOrigens((prev) => [...prev, novaOrigem]);
    return novaOrigem;
  }, []);

  const atualizarOrigem = useCallback((id: string, origem: Partial<OrigemCliente>) => {
    setOrigens((prev) => prev.map((o) => (o.id === id ? { ...o, ...origem } : o)));
  }, []);

  const excluirOrigem = useCallback((id: string) => {
    setOrigens((prev) => prev.filter((o) => o.id !== id));
  }, []);

  // Cliente Actions
  const adicionarCliente = useCallback((cliente: Omit<Cliente, "id">) => {
    const novoCliente: Cliente = {
      ...cliente,
      id: Date.now().toString(),
    };
    setClientes((prev) => [...prev, novoCliente]);

    // Sync with leads system
    syncLeadsWithClientUpdate(novoCliente.id, novoCliente);

    return novoCliente;
  }, []);

  const atualizarCliente = useCallback((id: string, dadosAtualizados: Partial<Cliente>) => {
    let clienteAtualizado: Cliente | null = null;

    setClientes((prev) => {
      const updated = prev.map((c) => {
        if (c.id === id) {
          clienteAtualizado = { ...c, ...dadosAtualizados };
          return clienteAtualizado;
        }
        return c;
      });
      return updated;
    });

    if (clienteAtualizado) {
      // Sync with other systems
      syncLeadsWithClientUpdate(id, dadosAtualizados);

      // Update workflow sessions that have clienteId
      try {
        const workflowSessions = JSON.parse(localStorage.getItem("workflow_sessions") || "[]");
        let orcamentosAtualizados = 0;

        const sessionsAtualizadas = workflowSessions.map((session: any) => {
          if (session.clienteId === id) {
            orcamentosAtualizados++;
            return {
              ...session,
              nome: dadosAtualizados.nome || session.nome,
              whatsapp: dadosAtualizados.telefone || session.whatsapp,
              email: dadosAtualizados.email || session.email,
            };
          }
          return session;
        });

        if (orcamentosAtualizados > 0) {
          localStorage.setItem("workflow_sessions", JSON.stringify(sessionsAtualizadas));
        }
      } catch (error) {
        console.error("❌ Erro ao atualizar workflow sessions:", error);
      }
    }
  }, []);

  const removerCliente = useCallback((id: string) => {
    setClientes((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Categoria Actions (Bridged to ConfigurationContext)
  const adicionarCategoria = useCallback(
    (categoria: string) => {
      realtimeConfig.adicionarCategoria({ nome: categoria, cor: "#3b82f6" });
    },
    [realtimeConfig],
  );

  const removerCategoria = useCallback(
    (categoria: string) => {
      const categoriaObj = realtimeConfig.categorias.find((c) => c.nome === categoria);
      if (categoriaObj) {
        realtimeConfig.removerCategoria(categoriaObj.id);
      }
    },
    [realtimeConfig],
  );

  return {
    templates,
    origens,
    clientes,
    categorias,
    categoriasFull,
    produtos,
    pacotes,
    adicionarTemplate,
    atualizarTemplate,
    excluirTemplate,
    definirTemplatePadrao,
    adicionarOrigem,
    atualizarOrigem,
    excluirOrigem,
    adicionarCliente,
    atualizarCliente,
    removerCliente,
    adicionarCategoria,
    removerCategoria,
  };
}

import React, { createContext, useContext, useEffect, useRef } from "react";
import { useOptimisticConfiguration } from "@/hooks/useOptimisticConfiguration";
import { useAuth } from "@/contexts/AuthContext";
import type { Categoria, Pacote, Produto, EtapaTrabalho } from "@/types/configuration";
import type { ConfigurationContextType } from "./configuration/types";
import { useConfigurationRealtime } from "./configuration/useConfigurationRealtime";
import { useConfigurationActions } from "./configuration/useConfigurationActions";

export type { ConfigurationContextType } from "./configuration/types";

const ConfigurationContext = createContext<ConfigurationContextType | undefined>(undefined);

export const useConfigurationContext = () => {
  const context = useContext(ConfigurationContext);
  if (!context) {
    throw new Error("useConfigurationContext must be used within ConfigurationProvider");
  }
  return context;
};

export const ConfigurationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Optimistic state management - array destructuring [state, operations]
  const [categoriasState, categoriasOps] = useOptimisticConfiguration<Categoria>([]);
  const [pacotesState, pacotesOps] = useOptimisticConfiguration<Pacote>([]);
  const [produtosState, produtosOps] = useOptimisticConfiguration<Produto>([]);
  const [etapasState, etapasOps] = useOptimisticConfiguration<EtapaTrabalho>([]);

  // Refs to store current state (prevents callback recreation)
  const categoriasRef = useRef(categoriasState.data);
  const pacotesRef = useRef(pacotesState.data);
  const produtosRef = useRef(produtosState.data);
  const etapasRef = useRef(etapasState.data);

  // Update refs when state changes
  useEffect(() => {
    categoriasRef.current = categoriasState.data;
  }, [categoriasState.data]);
  useEffect(() => {
    pacotesRef.current = pacotesState.data;
  }, [pacotesState.data]);
  useEffect(() => {
    produtosRef.current = produtosState.data;
  }, [produtosState.data]);
  useEffect(() => {
    etapasRef.current = etapasState.data;
  }, [etapasState.data]);

  // Realtime subscriptions & synchronization
  const { suppress } = useConfigurationRealtime({
    user,
    categoriasOps,
    pacotesOps,
    produtosOps,
    etapasOps,
    categoriasRef,
    pacotesRef,
    produtosRef,
    etapasRef,
  });

  // Action handlers
  const actions = useConfigurationActions({
    suppress,
    categoriasOps,
    pacotesOps,
    produtosOps,
    etapasOps,
    categoriasRef,
    pacotesRef,
    produtosRef,
    etapasRef,
  });

  // Computed Values
  const isLoading =
    categoriasState.syncing ||
    pacotesState.syncing ||
    produtosState.syncing ||
    etapasState.syncing;

  const value: ConfigurationContextType = {
    // State
    categorias: categoriasState.data,
    pacotes: pacotesState.data,
    produtos: produtosState.data,
    etapas: etapasState.data,

    // Loading
    isLoadingCategorias: categoriasState.syncing,
    isLoadingPacotes: pacotesState.syncing,
    isLoadingProdutos: produtosState.syncing,
    isLoadingEtapas: etapasState.syncing,
    isLoading,

    // Operations
    ...actions,
  };

  return <ConfigurationContext.Provider value={value}>{children}</ConfigurationContext.Provider>;
};

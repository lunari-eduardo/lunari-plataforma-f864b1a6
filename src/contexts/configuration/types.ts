import type { Categoria, Pacote, Produto, EtapaTrabalho } from "@/types/configuration";

export const CONFIGURATION_DEBUG = false;
export const SUPPRESS_TTL = 3000; // 3 seconds

export interface ConfigurationContextType {
  // State
  categorias: Categoria[];
  pacotes: Pacote[];
  produtos: Produto[];
  etapas: EtapaTrabalho[];

  // Loading states
  isLoadingCategorias: boolean;
  isLoadingPacotes: boolean;
  isLoadingProdutos: boolean;
  isLoadingEtapas: boolean;
  isLoading: boolean;

  // Operations - matching ConfigurationActions interface
  adicionarCategoria: (categoria: Omit<Categoria, "id">) => void;
  atualizarCategoria: (id: string, dados: Partial<Categoria>) => Promise<void>;
  removerCategoria: (id: string) => Promise<boolean>;

  adicionarPacote: (pacote: Omit<Pacote, "id">) => void;
  atualizarPacote: (id: string, dados: Partial<Pacote>) => Promise<void>;
  removerPacote: (id: string) => Promise<boolean>;

  adicionarProduto: (produto: Omit<Produto, "id">) => void;
  atualizarProduto: (id: string, dados: Partial<Produto>) => Promise<void>;
  removerProduto: (id: string) => Promise<boolean>;

  adicionarEtapa: (etapa: Omit<EtapaTrabalho, "id" | "ordem">) => void;
  atualizarEtapa: (id: string, dados: Partial<EtapaTrabalho>) => Promise<void>;
  removerEtapa: (id: string) => Promise<boolean>;
  moverEtapa: (id: string, direcao: "cima" | "baixo") => void;
}

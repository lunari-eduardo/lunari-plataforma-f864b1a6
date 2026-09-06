/**
 * Supabase Configuration Adapter - Async operations
 * Handles all configuration data persistence to Supabase
 *
 * Refatorado: Fachada orquestradora delegando para adaptadores especializados (< 500 linhas).
 */

import type { Categoria, Pacote, Produto, EtapaTrabalho } from "@/types/configuration";
import * as categoriasAdapter from "./configuration-async/categoriasAdapter";
import * as pacotesAdapter from "./configuration-async/pacotesAdapter";
import * as produtosAdapter from "./configuration-async/produtosAdapter";
import * as etapasAdapter from "./configuration-async/etapasAdapter";

export class SupabaseConfigurationAdapterAsync {
  // ============= CATEGORIAS =============

  async loadCategorias(): Promise<Categoria[]> {
    return categoriasAdapter.loadCategorias();
  }

  async saveCategorias(categorias: Categoria[]): Promise<void> {
    return categoriasAdapter.saveCategorias(categorias);
  }

  async updateCategoriaById(id: string, dados: Partial<Categoria>): Promise<void> {
    return categoriasAdapter.updateCategoriaById(id, dados);
  }

  async deleteCategoriaById(id: string): Promise<void> {
    return categoriasAdapter.deleteCategoriaById(id);
  }

  async syncCategorias(categorias: Categoria[]): Promise<void> {
    return categoriasAdapter.syncCategorias(categorias);
  }

  // ============= PACOTES =============

  async loadPacotes(): Promise<Pacote[]> {
    return pacotesAdapter.loadPacotes();
  }

  async savePacotes(pacotes: Pacote[]): Promise<void> {
    return pacotesAdapter.savePacotes(pacotes);
  }

  async deletePacoteById(id: string): Promise<void> {
    return pacotesAdapter.deletePacoteById(id);
  }

  async syncPacotes(pacotes: Pacote[]): Promise<void> {
    return pacotesAdapter.syncPacotes(pacotes);
  }

  // ============= PRODUTOS =============

  async loadProdutos(): Promise<Produto[]> {
    return produtosAdapter.loadProdutos();
  }

  async saveProdutos(produtos: Produto[]): Promise<void> {
    return produtosAdapter.saveProdutos(produtos);
  }

  async deleteProdutoById(id: string): Promise<void> {
    return produtosAdapter.deleteProdutoById(id);
  }

  async syncProdutos(produtos: Produto[]): Promise<void> {
    return produtosAdapter.syncProdutos(produtos);
  }

  // ============= ETAPAS =============

  async loadEtapas(): Promise<EtapaTrabalho[]> {
    return etapasAdapter.loadEtapas();
  }

  async saveEtapas(etapas: EtapaTrabalho[]): Promise<void> {
    return etapasAdapter.saveEtapas(etapas);
  }

  async deleteEtapaById(id: string): Promise<void> {
    return etapasAdapter.deleteEtapaById(id);
  }

  async syncEtapas(etapas: EtapaTrabalho[]): Promise<void> {
    return etapasAdapter.syncEtapas(etapas);
  }
}

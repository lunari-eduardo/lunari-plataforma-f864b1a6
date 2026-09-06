import { useEffect, useCallback } from "react";
import { storage, STORAGE_KEYS } from "@/utils/localStorage";
import { useCreditCardsSupabase } from "@/hooks/useCreditCardsSupabase";
import { SupabaseCreditCardsAdapter } from "@/adapters/SupabaseCreditCardsAdapter";
import type { CreateTransactionInput } from "@/hooks/useFinancialTransactionsSupabase";

export function useAppCreditCardsAndEngine() {
  const creditCardsHook = useCreditCardsSupabase();
  const cartoes = creditCardsHook.cartoes;

  // ============= MIGRAÇÃO DE CARTÕES (UMA VEZ - COM FLAG PERSISTENTE) =============
  const MIGRATION_FLAG = "credit_cards_migration_v3_done";

  useEffect(() => {
    const checkAndMigrate = async () => {
      if (localStorage.getItem(MIGRATION_FLAG)) return;

      const localCards = storage.load(STORAGE_KEYS.CARDS, []);
      if (localCards && localCards.length > 0) {
        localStorage.setItem(MIGRATION_FLAG, "true");

        const cardsToMigrate = [...localCards];
        storage.remove(STORAGE_KEYS.CARDS);

        console.log("🔄 Iniciando migração única de cartões...");

        for (const card of cardsToMigrate) {
          try {
            await SupabaseCreditCardsAdapter.createCard(
              card.nome,
              card.diaVencimento,
              card.diaFechamento,
            );
            console.log(`✅ Cartão migrado: ${card.nome}`);
          } catch (error) {
            console.error(`❌ Erro ao migrar cartão ${card.nome}:`, error);
          }
        }
      }
    };

    checkAndMigrate();
  }, []);

  useEffect(() => {
    storage.save(STORAGE_KEYS.CARDS, cartoes);
  }, [cartoes]);

  const adicionarCartao = useCallback(
    (cartao: { nome: string; diaVencimento: number; diaFechamento: number }) => {
      creditCardsHook.adicionarCartao(cartao);
    },
    [creditCardsHook],
  );

  const atualizarCartao = useCallback(
    (
      id: string,
      dadosAtualizados: Partial<{
        nome: string;
        diaVencimento: number;
        diaFechamento: number;
        ativo: boolean;
      }>,
    ) => {
      creditCardsHook.atualizarCartao(id, dadosAtualizados);
    },
    [creditCardsHook],
  );

  const removerCartao = useCallback(
    (id: string) => {
      creditCardsHook.removerCartao(id);
    },
    [creditCardsHook],
  );

  const createTransactionEngine = useCallback((_input: CreateTransactionInput) => {
    console.warn("[AppContext] createTransactionEngine deprecated");
  }, []);

  return {
    cartoes,
    adicionarCartao,
    atualizarCartao,
    removerCartao,
    createTransactionEngine,
  };
}

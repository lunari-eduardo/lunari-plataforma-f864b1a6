import { useState, useEffect, useMemo } from 'react';
import { Cliente } from '@/types/cliente';
import { normalizeString, areSimilar, areExactMatch } from '@/utils/stringNormalization';

interface DuplicateCheckResult {
  clientesSimilares: Cliente[];
  isDuplicata: boolean;
  clienteDuplicado: Cliente | null;
  isSearching: boolean;
}

/**
 * Hook para verificar duplicatas e sugestões de clientes similares
 * Busca em tempo real enquanto o usuário digita
 */
export const useClienteDuplicateCheck = (
  nomeDigitado: string,
  clientes: Cliente[],
  clienteEditandoId?: string
): DuplicateCheckResult => {
  const [isSearching, setIsSearching] = useState(false);

  // Debounce da busca
  useEffect(() => {
    if (nomeDigitado.length >= 3) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setIsSearching(false);
    }
  }, [nomeDigitado]);

  const result = useMemo<DuplicateCheckResult>(() => {
    // Não buscar se nome muito curto
    if (nomeDigitado.length < 3) {
      return {
        clientesSimilares: [],
        isDuplicata: false,
        clienteDuplicado: null,
        isSearching: false
      };
    }

    const nomeNormalizado = normalizeString(nomeDigitado);

    // Filtrar clientes excluindo o que está sendo editado
    const clientesFiltrados = clientes.filter(
      c => !clienteEditandoId || c.id !== clienteEditandoId
    );

    // Verificar duplicata exata
    const duplicata = clientesFiltrados.find(cliente =>
      areExactMatch(cliente.nome, nomeDigitado)
    );

    // Buscar similares
    const similares = clientesFiltrados
      .filter(cliente => {
        // Não incluir a duplicata exata nas sugestões
        if (duplicata && cliente.id === duplicata.id) return false;
        
        return areSimilar(cliente.nome, nomeDigitado);
      })
      .map(cliente => {
        // Calcular score de relevância
        const nomeClienteNormalizado = normalizeString(cliente.nome);
        let score = 0;

        // Nome contém o texto buscado
        if (nomeClienteNormalizado.includes(nomeNormalizado)) {
          score += 10;
        }

        // Texto buscado contém o nome
        if (nomeNormalizado.includes(nomeClienteNormalizado)) {
          score += 8;
        }

        // Palavras em comum
        const palavrasBusca = nomeNormalizado.split(' ');
        const palavrasCliente = nomeClienteNormalizado.split(' ');
        const palavrasEmComum = palavrasBusca.filter(p => 
          palavrasCliente.some(pc => pc.includes(p) || p.includes(pc))
        ).length;
        score += palavrasEmComum * 3;

        return { ...cliente, _score: score };
      })
      .sort((a, b) => (b._score || 0) - (a._score || 0))
      .slice(0, 5) // Limitar a 5 sugestões
      .map(({ _score, ...cliente }) => cliente); // Remover score do resultado

    return {
      clientesSimilares: similares,
      isDuplicata: !!duplicata,
      clienteDuplicado: duplicata || null,
      isSearching: false
    };
  }, [nomeDigitado, clientes, clienteEditandoId]);

  return {
    ...result,
    isSearching
  };
};

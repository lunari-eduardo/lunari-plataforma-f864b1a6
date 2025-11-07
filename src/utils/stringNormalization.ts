/**
 * Utilitários para normalização e comparação de strings
 */

/**
 * Remove acentos e converte para lowercase
 */
export const normalizeString = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Normaliza múltiplos espaços
};

/**
 * Calcula a distância de Levenshtein entre duas strings
 */
export const levenshteinDistance = (str1: string, str2: string): number => {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Inicializa matriz
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Preenche matriz
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Deleção
        matrix[i][j - 1] + 1,      // Inserção
        matrix[i - 1][j - 1] + cost // Substituição
      );
    }
  }

  return matrix[len1][len2];
};

/**
 * Verifica se duas strings são similares
 */
export const areSimilar = (str1: string, str2: string, threshold: number = 3): boolean => {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);

  // Exatamente iguais após normalização
  if (normalized1 === normalized2) return true;

  // Uma contém a outra
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true;

  // Distância de Levenshtein menor que threshold
  const distance = levenshteinDistance(normalized1, normalized2);
  return distance <= threshold;
};

/**
 * Verifica se duas strings são exatamente iguais (após normalização)
 */
export const areExactMatch = (str1: string, str2: string): boolean => {
  return normalizeString(str1) === normalizeString(str2);
};

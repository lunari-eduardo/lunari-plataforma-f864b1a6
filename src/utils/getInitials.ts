/**
 * Extrai as iniciais de um nome
 * Exemplo: "João Silva" -> "JS"
 */
export function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'U';
  
  const nameParts = name.trim().split(' ').filter(Boolean);
  
  if (nameParts.length === 0) return 'U';
  if (nameParts.length === 1) {
    return nameParts[0].substring(0, 2).toUpperCase();
  }
  
  // Pegar primeira letra do primeiro nome e primeira letra do último nome
  const firstInitial = nameParts[0][0];
  const lastInitial = nameParts[nameParts.length - 1][0];
  
  return (firstInitial + lastInitial).toUpperCase();
}

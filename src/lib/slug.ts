/**
 * Gera um slug URL-friendly a partir de um título
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s-]/g, '')    // remove caracteres especiais
    .trim()
    .replace(/\s+/g, '-')            // espaços → hífens
    .replace(/-+/g, '-')             // múltiplos hífens → um hífen
    .slice(0, 100);                  // limite de 100 chars
}

/**
 * Verifica se um slug é válido
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

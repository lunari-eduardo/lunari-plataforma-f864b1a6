/**
 * Utility para proteger tokens do Supabase de serem removidos
 * NUNCA remover chaves que começam com "sb-" (tokens do Supabase)
 */

export const clearAppData = () => {
  const keysToKeep: string[] = [];
  
  // Identificar todas as chaves do Supabase
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-')) {
      keysToKeep.push(key);
    }
  }

  // Salvar valores das chaves do Supabase
  const supabaseData: Record<string, string> = {};
  keysToKeep.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      supabaseData[key] = value;
    }
  });

  // Limpar tudo
  localStorage.clear();

  // Restaurar tokens do Supabase
  Object.entries(supabaseData).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });

  console.log('🔒 App data cleared, Supabase tokens protected');
};

export const isSuperbaseKey = (key: string): boolean => {
  return key.startsWith('sb-');
};

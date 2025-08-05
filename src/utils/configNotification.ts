/**
 * Utilitário para notificar atualizações de configurações
 * Garante que o AppContext seja notificado quando configurações são alteradas
 */

export const notifyConfigUpdate = (configType: 'pacotes' | 'produtos' | 'categorias') => {
  // Disparar evento personalizado
  window.dispatchEvent(new CustomEvent('configuracoes-updated', {
    detail: { configType }
  }));
};

/**
 * Wrapper para salvar configurações com notificação automática
 */
export const saveConfigWithNotification = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
  
  // Determinar tipo de configuração baseado na chave
  if (key.includes('pacotes')) {
    notifyConfigUpdate('pacotes');
  } else if (key.includes('produtos')) {
    notifyConfigUpdate('produtos');
  } else if (key.includes('categorias')) {
    notifyConfigUpdate('categorias');
  }
  
  // console.log(`✅ Configuração salva e notificada: ${key}`);
};
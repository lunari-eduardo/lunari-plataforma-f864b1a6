/// <reference types="vite/client" />

// Types para virtual:pwa-register do vite-plugin-pwa
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    /**
     * Se true, registra o SW imediatamente ao invés de esperar window.onload
     */
    immediate?: boolean;
    
    /**
     * Callback quando nova versão está disponível e precisa refresh
     */
    onNeedRefresh?: () => void;
    
    /**
     * Callback quando o app está pronto para uso offline
     */
    onOfflineReady?: () => void;
    
    /**
     * Callback quando o SW é registrado com sucesso
     */
    onRegisteredSW?: (swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
    
    /**
     * Callback quando ocorre erro no registro do SW
     */
    onRegisterError?: (error: Error) => void;
  }

  /**
   * Registra o Service Worker e retorna função para forçar atualização
   * @param options Opções de configuração
   * @returns Função que, quando chamada com true, força reload da página
   */
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

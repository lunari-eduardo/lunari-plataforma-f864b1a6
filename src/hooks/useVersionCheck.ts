import { useEffect, useState } from 'react';
import { BUILD_VERSION } from '@/version';

/**
 * Hook para verificar se há nova versão do app
 * Compara BUILD_VERSION local com version.json remoto
 */
export function useVersionCheck() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    checkVersion();
  }, []);

  async function checkVersion() {
    try {
      setIsChecking(true);
      
      // Buscar version.json com cache-busting
      const response = await fetch(`/version.json?t=${Date.now()}`);
      const remoteVersion = await response.json();

      console.log('🔍 [Version Check] Local:', BUILD_VERSION, 'Remote:', remoteVersion.version);

      if (remoteVersion.version !== BUILD_VERSION) {
        console.warn('⚠️ [Version Check] Nova versão detectada, atualizando...');
        setNeedsUpdate(true);
        
        // Aguardar 2s e acionar limpeza
        await new Promise(resolve => setTimeout(resolve, 2000));
        await forceUnregisterAndReload();
      } else {
        console.log('✅ [Version Check] Versão atualizada');
      }
    } catch (error) {
      console.error('❌ [Version Check] Erro ao verificar versão:', error);
    } finally {
      setIsChecking(false);
    }
  }

  async function forceUnregisterAndReload() {
    try {
      console.log('🔄 [Version Check] Limpeza agressiva...');
      
      // 1. Unregister TODOS os Service Workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`🧹 Removendo ${registrations.length} service worker(s)...`);
      await Promise.all(registrations.map(registration => registration.unregister()));
      
      // 2. Limpar TODOS os caches
      const cacheNames = await caches.keys();
      console.log(`🧹 Limpando ${cacheNames.length} cache(s)...`);
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      
      // 3. Limpar IndexedDB (Safari não suporta indexedDB.databases())
      try {
        const knownDbs = ['photoflow-app', 'workbox-precache', 'workbox-runtime', 'vite-cache'];
        if ('databases' in indexedDB) {
          const dbs = await (indexedDB as any).databases();
          dbs.forEach((db: any) => {
            if (db.name && (db.name.includes('workbox') || db.name.includes('vite'))) {
              console.log(`🧹 Removendo IndexedDB: ${db.name}`);
              indexedDB.deleteDatabase(db.name);
            }
          });
        } else {
          // Safari fallback: deletar por nomes conhecidos
          knownDbs.forEach((name) => {
            try { indexedDB.deleteDatabase(name); } catch { /* noop */ }
          });
        }
      } catch (idbError) {
        console.warn('⚠️ Erro ao limpar IndexedDB:', idbError);
      }

      
      console.log('✅ Limpeza completa, recarregando...');
      
      // 4. Hard reload
      window.location.reload();
    } catch (error) {
      console.error('❌ Erro na limpeza:', error);
      window.location.reload();
    }
  }

  return {
    needsUpdate,
    isChecking,
    checkVersion,
  };
}

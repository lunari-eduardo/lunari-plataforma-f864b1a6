import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// Marcador de build injetado em produção. Fonte de verdade: SHA do commit
// que a Vercel está compilando (VERCEL_GIT_COMMIT_SHA). Localmente cai para
// 'local-dev'. Usado para provar qual commit está sendo servido pelo domínio.
const BUILD_COMMIT =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  'local-dev';
const BUILD_TIME = new Date().toISOString();

// Plugin: escreve dist/version.json ao final do build com { commit, time }.
// Substitui o public/version.json congelado, permitindo `curl /version.json`
// em produção retornar o SHA real do deploy.
function writeVersionJsonPlugin(): Plugin {
  return {
    name: 'lunari-write-version-json',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      try {
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const payload = JSON.stringify({
          commit: BUILD_COMMIT,
          time: BUILD_TIME,
          // Mantém o campo "version" legado para não quebrar leitores antigos.
          version: BUILD_COMMIT.slice(0, 12),
        });
        fs.writeFileSync(path.join(outDir, 'version.json'), payload, 'utf-8');
      } catch (err) {
        console.warn('[lunari-write-version-json] falhou:', err);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'lovable-uploads/caa859cc-c72e-4964-b21b-1cad68a4a9a5.png'],
      manifest: {
        name: 'Lunari Studio',
        short_name: 'Lunari Studio',
        description: 'Sistema de gestão completo para fotógrafos e estúdios fotográficos',
        theme_color: '#6B7280',
        background_color: '#0A0A0A',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/app',
        icons: [
          {
            src: '/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigationPreload: false,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      navigateFallbackDenylist: [/^\/formulario\//, /^\/checkout\//, /^\/pay\//, /^\/l\//],
      runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 horas
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false,
      }
    }),
    writeVersionJsonPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: "globalThis",
    VITE_APP_VERSION: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_COMMIT__: JSON.stringify(BUILD_COMMIT),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-select']
        }
      }
    }
  },
}));

import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isVitest = mode === 'test';
  const plugins = [react(), tailwindcss()];

  if (!isVitest) {
    plugins.push(
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          globPatterns: ['**/*.{html,css,ico,png,svg,woff2}'],
          globIgnores: [
            '**/heic2any*.js',
            '**/charts-vendor*.js',
            '**/ConnectPhoneForm*.js',
            '**/SetWalletPasswordForm*.js',
            '**/BridgeNetworkSelectionView*.js',
            '**/w3m-modal*.js',
            '**/ConnectWalletView*.js',
            '**/secp256k1*.js',
          ],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/gyiqdkmvlixwgedjhycc\.supabase\.co/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24,
                },
              },
            },
            {
              urlPattern: /(ConnectPhoneForm|SetWalletPasswordForm|BridgeNetworkSelectionView|w3m-modal|ConnectWalletView|secp256k1).*\.js$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'wallet-bridge-lazy',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
            {
              urlPattern: /heic2any.*\.js$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'heic2any-lazy',
                expiration: {
                  maxEntries: 2,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              urlPattern: /assets\/.*\.js$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'js-chunks',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
          ],
        },
      })
    );
  }

  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/recharts/')) {
              return 'charts-vendor';
            }
            return undefined;
          },
        },
      },
    },
  };
});

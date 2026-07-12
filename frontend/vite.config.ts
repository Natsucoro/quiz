import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// ローカル開発かどうかを判定（LOCAL=true を渡すとローカルモード）
const isLocal = process.env.LOCAL === 'true'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'わたしはダレでしょう？クイズ！',
        short_name: 'クイズ！',
        description: '音声とタップで遊べる楽しいクイズアプリ',
        lang: 'ja',
        id: '/',
        theme_color: '#FF6EC7',
        background_color: '#FFC0CB',
        icons: [
          { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
          { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // PWAとしてキャッシュさせたいファイルの種類（jsonデータなどを含む）
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webp,mp3,wav}'],
        // クイズデータの増加でバンドルが5MBを超えるため上限を再度引き上げる
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      }
    })
  ],
  server: {
    host: '0.0.0.0', // Allow connections from outside the container
    port: 5173,
    watch: {
      usePolling: true, // Needed for file change detection in some environments
      // Explicitly ignore the folders that are causing the ghost reloads
      ignored: ['**/dist/**', '**/dist_bak/**'],
    },
    hmr: isLocal
      ? true                      // ローカル: HMR をデフォルト（localhost）で動かす
      : { clientPort: 443 },      // クラウドIDE: HTTPS プロキシ経由
  }
})

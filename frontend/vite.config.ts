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
        theme_color: '#FF6EC7',
        icons: [
          {
            src: '/vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        // PWAとしてキャッシュさせたいファイルの種類（jsonデータなどを含む）
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webp,mp3,wav}']
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

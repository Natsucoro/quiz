import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
    // The port is now passed in by the IDE via the `$PORT` variable
    watch: {
      usePolling: true, // Needed for file change detection in some environments
      // Explicitly ignore the folders that are causing the ghost reloads
      ignored: ['**/dist/**', '**/dist_bak/**'],
    },
    hmr: {
      clientPort: 443, // Port for HMR updates through the proxy
    },
  }
})

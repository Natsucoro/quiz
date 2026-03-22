import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // $PORT 環境変数があればそれを使い、なければ 5173 を使います
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    // HMR（画面の自動更新）をクラウド越しに効かせるための設定
    hmr: {
      clientPort: 443,
    },
  }
})
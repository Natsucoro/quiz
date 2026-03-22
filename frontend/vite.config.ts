import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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

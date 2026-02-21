import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use './' so built asset paths are relative to index.html.
  // This allows the frontend to be deployed to any subdirectory
  // (e.g. /test/) without breaking JS/CSS loading.
  base: './',
  server: {
    port: 3000,
    open: true,
    proxy: {
      // All /api/* requests are forwarded to the PHP backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Strip the /api prefix before forwarding to PHP
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})


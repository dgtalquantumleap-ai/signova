import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    cssCodeSplit: true, // each route chunk gets its own CSS — reduces initial CSS parse time
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react-vendor'
          if (id.includes('node_modules/react-router')) return 'router'
          if (id.includes('node_modules/react-helmet-async')) return 'helmet'
          if (id.includes('node_modules/@vercel')) return 'vercel-analytics'
        },
      },
    },
    chunkSizeWarningLimit: 600,
    // Vite 8 uses OXC by default — fast and produces smaller bundles
    target: 'es2020',
  },
})

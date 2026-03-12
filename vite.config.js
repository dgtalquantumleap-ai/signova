import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core in its own chunk — cached until React version changes
          'react-vendor': ['react', 'react-dom'],
          // Router separately
          'router': ['react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})

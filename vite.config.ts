import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/build/[name]-[hash].js',
        chunkFileNames: 'assets/build/[name]-[hash].js',
        assetFileNames: 'assets/build/[name]-[hash][extname]',
      },
    },
  },
  worker: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/build/[name]-[hash].js',
        chunkFileNames: 'assets/build/[name]-[hash].js',
        assetFileNames: 'assets/build/[name]-[hash][extname]',
      },
    },
  },
})

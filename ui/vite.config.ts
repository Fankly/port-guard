import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:1421', changeOrigin: true } },
  },
  preview: {
    proxy: { '/api': { target: 'http://127.0.0.1:1421', changeOrigin: true } },
  },
  build: {
    // The app shell (React, Radix, Motion, Query, Zustand) is ~205 kB gzip.
    // Recharts is split into its own lazy chunk; raise the advisory limit so
    // the shell is not reported as an accidental monolithic bundle.
    chunkSizeWarningLimit: 700,
  },
})

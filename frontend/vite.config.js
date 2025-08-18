import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: '/',
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('cytoscape')) return 'vendor-cytoscape';
            if (id.includes('@radix-ui')) return 'vendor-radix';
            if (id.includes('react-day-picker') || id.includes('date-fns')) return 'vendor-dates';
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('d3') || id.includes('recharts')) return 'vendor-charts';
            // fallback: group remaining node_modules into vendor chunk
            return 'vendor';
          }
        }
      }
    }
  }
})



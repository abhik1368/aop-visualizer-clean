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
  cacheDir: 'vite-cache',
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'lucide-react',
      'clsx',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      'tailwind-merge',
      'cytoscape',
      'cytoscape-euler',
      'cytoscape-dagre',
    ],
  },
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
            return 'vendor';
          }
        }
      }
    }
  }
})



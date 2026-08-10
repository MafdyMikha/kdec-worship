import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('@dnd-kit')) return 'drag-and-drop'
          if (id.includes('date-fns')) return 'date-fns'
          if (id.includes('qrcode')) return 'qr-code'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('react')) return 'react'
          return 'vendor'
        },
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    allowedHosts: ['crm.greywoodhome.es'],
    proxy: {
      '/api': {
        target: 'http://api:3001',
        changeOrigin: true,
      }
    }
  }
})

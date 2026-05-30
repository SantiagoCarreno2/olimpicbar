import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // <--- Cambia esta línea
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
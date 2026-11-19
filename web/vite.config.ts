import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Keep generated asset references relative so the app can live at any path.
  base: './',
  plugins: [react()],
})

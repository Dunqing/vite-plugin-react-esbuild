import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import plugin from 'vite-plugin-react-esbuild'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), plugin()],
})

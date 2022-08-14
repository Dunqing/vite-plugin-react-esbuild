import * as path from 'path'
import { defineConfig } from 'vite'
import react from 'vite-plugin-react-esbuild'
import antdLayout from 'vite-plugin-antd-layout'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^~/,
        replacement: '',
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, 'src'),
      },
    ],
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        additionalData: '@root-entry-name: default;',
      },
    },
  },
  plugins: [react(), antdLayout()],
})

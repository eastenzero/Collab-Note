import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      'y-supabase': path.resolve(__dirname, 'node_modules/y-supabase/dist/index.js'),
    },
  },
})

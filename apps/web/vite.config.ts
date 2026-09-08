import path from 'node:path'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
    alias: {
      'react-konva': path.resolve(__dirname, '../../packages/engine-ui/node_modules/react-konva'),
    },
  },
  server: {
    proxy: {
      '/v1': {
        target: process.env.CATALOG_API_URL || 'http://127.0.0.1:3100',
        changeOrigin: true,
      },
    },
  },
})

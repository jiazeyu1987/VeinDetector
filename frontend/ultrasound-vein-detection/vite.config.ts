import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const isProd = process.env.BUILD_MODE === 'prod'
export default defineConfig({
  plugins: [
    react(),
    sourceIdentifierPlugin({
      enabled: !isProd,
      attributePrefix: 'data-matrix',
      includeProps: true,
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: false,
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      port: 3001,
      overlay: true,
    },
    cors: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
})


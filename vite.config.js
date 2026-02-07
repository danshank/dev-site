import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    host: true, // Expose to local network
  },
  build: {
    outDir: 'dist',
  },
})

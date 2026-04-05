import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // allow access via IP
    port: 5173,
    strictPort: true,

    // ✅ Fix HMR for IP access
    hmr: {
      host: '10.76.86.38', // your server IP
      protocol: 'ws',
      port: 5173,
    },

    // ✅ Optional (helps in some network cases)
    cors: true,
  },
})
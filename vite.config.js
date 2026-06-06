import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      host: '10.231.32.253',
      protocol: 'ws',
      port: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://10.231.32.253:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '10.76.86.38',
    port: 5173,
    strictPort: true,
  },
});
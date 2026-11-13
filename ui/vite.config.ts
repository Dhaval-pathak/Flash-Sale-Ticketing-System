import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.API_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8501,
    allowedHosts: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true }
    },
    watch: {
      usePolling: true
    }
  }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8501,
    allowedHosts: true,
    watch: {
      usePolling: true
    }
  }
});

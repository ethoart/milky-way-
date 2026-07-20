import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: true,
    allowedHosts: ['oms.hyperoms.xyz', 'erp.hyperoms.xyz', 'oms.arobazzar.lk', 'localhost', '127.0.0.1']
  }
});

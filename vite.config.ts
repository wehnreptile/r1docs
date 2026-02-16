
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Polyfill process.env for browser compatibility
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || 'YOUR_FALLBACK_KEY')
  },
  server: {
    port: 3000,
    open: true
  }
});

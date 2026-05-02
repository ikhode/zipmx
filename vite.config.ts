import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  server: {
    hmr: {
      host: 'localhost',
      port: 5173,
      protocol: 'ws',
    },
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Function-based chunk splitting: avoids issues with packages that lack root entries (e.g. firebase)
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'vendor-firebase';
          if (id.includes('node_modules/react-leaflet') || id.includes('node_modules/leaflet')) return 'vendor-leaflet';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) return 'vendor-react';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  // Router plugin must come before react(); it generates src/routeTree.gen.ts
  // from the files under src/routes.
  plugins: [TanStackRouterVite(), react()],
  server: { port: 5173 },
  build: {
    // Split long-lived vendor code into its own chunks so app updates don't bust
    // the framework cache (xlsx is already lazy-imported, so it stays separate).
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'tanstack-vendor': ['@tanstack/react-query', '@tanstack/react-router'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});

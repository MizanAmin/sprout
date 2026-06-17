import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  // Router plugin must come before react(); it generates src/routeTree.gen.ts
  // from the files under src/routes.
  plugins: [TanStackRouterVite(), react()],
  server: { port: 5173 },
});

import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

import { reticle } from '@reticlehq/core/vite';
// https://vite.dev/config/
export default defineConfig({
  // Absolute base so asset URLs work on deep SPA routes (e.g. /admin/dashboard).
  // Relative './' breaks nginx: missing JS paths fall through to index.html → MIME error.
  base: '/',
  plugins: [reticle(), inspectAttr(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

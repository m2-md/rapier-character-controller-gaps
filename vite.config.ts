import { defineConfig } from "vite";

// main.ts calls `await RAPIER.init()` on startup (top-level await).
// Vite's default target (es2020) does not support TLA; we pull it up to esnext.
export default defineConfig({
  build: {
    target: "esnext",
  },
  esbuild: {
    target: "esnext",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
});

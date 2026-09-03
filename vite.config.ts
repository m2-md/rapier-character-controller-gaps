import { defineConfig } from "vite";

// main.ts açılışta `await RAPIER.init()` çağırıyor (top-level await).
// Vite'ın varsayılan hedefi (es2020) TLA'yı desteklemez; esnext'e çekiyoruz.
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

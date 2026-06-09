import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");

          if (!normalizedId.includes("/node_modules/")) return;

          if (
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/") ||
            normalizedId.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }

          if (normalizedId.includes("/node_modules/@react-three/fiber/")) {
            return "react-three-fiber";
          }

          if (normalizedId.includes("/node_modules/three/")) {
            return "three";
          }

          if (
            normalizedId.includes("/node_modules/firebase/") ||
            normalizedId.includes("/node_modules/@firebase/")
          ) {
            if (normalizedId.includes("/firestore")) return "firebase-firestore";
            if (normalizedId.includes("/auth")) return "firebase-auth";
            return "firebase-core";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

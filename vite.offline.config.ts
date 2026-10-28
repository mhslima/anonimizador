// Offline build: one self-contained HTML file (see scripts/build-offline.mjs and src/standalone/).
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "standalone",
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "~tesseract": path.resolve(__dirname, "public/tesseract"),
    },
  },
  publicDir: false,
  assetsInclude: ["**/*.gz"],
  define: { "import.meta.env.VITE_PSI_OFFLINE": JSON.stringify("1") },
  build: {
    outDir: "../dist-offline",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 100_000,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});

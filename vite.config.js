import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: "public",
  build: {
    copyPublicDir: true,
    assetsDir: "assets",
  },
});

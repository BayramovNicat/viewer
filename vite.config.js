import { defineConfig } from "vite";
import { terser } from "rollup-plugin-terser";

export default defineConfig({
  base: "./",
  publicDir: "public",
  build: {
    // minify: "terser",
    copyPublicDir: true,
    assetsDir: "assets",
    // terserOptions: {
    //   format: {
    //     comments: false, // Remove comments
    //   },
    //   compress: {
    //     passes: 2, // Apply multiple passes for better compression
    //   },
    // },
  },
});

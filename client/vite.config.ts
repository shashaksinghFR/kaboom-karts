import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({ resolve: { alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) } }, server: { fs: { allow: [".."] } } });

import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    https: {
      key: fs.readFileSync(path.join(__dirname, "certs", "key.pem")),
      cert: fs.readFileSync(path.join(__dirname, "certs", "cert.pem")),
    },
    proxy: {
      "/ws": {
        target: "http://localhost:3016",
        ws: true,
      },
    },
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
});

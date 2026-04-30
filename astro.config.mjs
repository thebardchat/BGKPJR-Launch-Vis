import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";

export default defineConfig({
  site: "https://thebardchat.github.io",
  base: "/BGKPJR-Launch-Vis",
  integrations: [svelte()],
  server: { host: "0.0.0.0", port: 4322 },
  vite: {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["gulfshores", "neworleans", "100.112.169.111", "100.100.90.66", "localhost"],
      hmr: { host: "gulfshores" },
    },
    ssr: { noExternal: ["three", "satellite.js"] },
  },
});

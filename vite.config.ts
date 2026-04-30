// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import netlify from "@netlify/vite-plugin-tanstack-start";

// Netlify deploy adapter for TanStack Start (SSR + server functions + server routes).
// Active only when building on Netlify (BUILD on Netlify sets NETLIFY=true).
// On Lovable / Cloudflare builds this plugin is skipped so the existing Cloudflare
// build pipeline keeps working.
const isNetlifyBuild = process.env.NETLIFY === "true";

export default defineConfig({
  vite: {
    plugins: isNetlifyBuild ? [netlify()] : [],
  },
});

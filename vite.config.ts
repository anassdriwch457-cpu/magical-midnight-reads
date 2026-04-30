// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import netlify from "@netlify/vite-plugin-tanstack-start";

// Build target detection.
// - NETLIFY=true        → Netlify Functions adapter
// - STANDALONE=true     → Plain Node/Bun server build for VPS / Coolify / Docker
//                         (Cloudflare plugin is disabled, output is a Node-compatible
//                          dist/server/index.js + dist/client/ that server.mjs serves)
// - default             → Lovable / Cloudflare Workers (existing behaviour)
const isNetlifyBuild = process.env.NETLIFY === "true";
const isStandaloneBuild = process.env.STANDALONE === "true";

export default defineConfig({
  // Disable the bundled Cloudflare plugin for standalone builds — otherwise the
  // build emits a Worker bundle instead of a Node-runnable server entry.
  cloudflare: isStandaloneBuild ? false : undefined,
  vite: {
    plugins: isNetlifyBuild ? [netlify()] : [],
    // Allow any host header in dev/preview (covers sslip.io, custom domains,
    // tunnels, Coolify ingress, etc.). Vite blocks unknown Host headers by
    // default since v5.
    server: {
      allowedHosts: true,
      host: true,
    },
    preview: {
      allowedHosts: true,
      host: true,
      port: Number(process.env.PORT) || 3000,
    },
  },
});

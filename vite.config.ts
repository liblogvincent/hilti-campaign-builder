// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Deployment target is controlled by the NITRO_PRESET environment variable.
// - Lovable / Cloudflare Workers (default):  NITRO_PRESET unset  → uses src/server.ts wrapper
// - Vercel Edge:                             NITRO_PRESET=vercel-edge
// - Vercel Node serverless:                  NITRO_PRESET=vercel
//
// On Vercel we let Nitro emit its own SSR entry (writes .vercel/output/ that
// Vercel auto-detects). The custom src/server.ts wrapper is Workers-shaped
// (`fetch(request, env, ctx)`) and is only used on Cloudflare.
const isVercel = process.env.NITRO_PRESET?.startsWith("vercel");

export default defineConfig({
  tanstackStart: isVercel
    ? {}
    : {
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        // nitro/vite builds from this
        server: { entry: "server" },
      },
});

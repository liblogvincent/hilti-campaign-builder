# Deploying Luban to Vercel

The project targets Cloudflare Workers by default (via Nitro). Vercel works
too — you just need to tell Nitro which preset to use and let it emit its
own SSR entry.

## 1. Import the repo in Vercel

- **Framework preset:** Other (not "Vite")
- **Build command:** `bun run build` (or `npm run build`)
- **Install command:** `bun install` (or leave default for npm)
- **Output directory:** leave empty — Nitro writes `.vercel/output/` and
  Vercel auto-detects it. Do NOT add a `vercel.json` with rewrites; Nitro's
  Vercel preset already emits the correct route config and a manual
  `vercel.json` will conflict with SPA fallback and API routes.

## 2. Set environment variables (Project Settings → Environment Variables)

Required:

| Key            | Value                                          |
| -------------- | ---------------------------------------------- |
| `NITRO_PRESET` | `vercel-edge` (recommended) or `vercel` (Node) |

`vercel-edge` matches the current Workers runtime constraints (no Node-only
packages like `sharp`, `child_process`, native addons). `vercel` runs on
Node serverless and lifts those restrictions but is slower to cold-start.

Also re-add every `VITE_*` (public) and server-side secret your app uses.
`process.env.*` values are only visible server-side.

## 3. What changes in the code

`vite.config.ts` detects `NITRO_PRESET=vercel*` and skips the custom
`src/server.ts` entry override. That entry exports the Cloudflare Workers
`{ fetch(request, env, ctx) }` shape and does not match Vercel's runtime
contract. On Vercel, Nitro's own entry is used instead.

The tradeoff: the custom SSR error-page wrapper in `src/server.ts`
(`normalizeCatastrophicSsrResponse`) is skipped on Vercel. The h3-level
error middleware in `src/start.ts` still runs, so server-function errors
are still caught — only the "h3 swallowed a 500" recovery path is dropped.

## 4. Deploy

Push to the connected branch. First deploy provisions the `*.vercel.app`
URL; connect a custom domain from Vercel's Domains UI afterwards.

## Runtime caveats

- Do NOT import `sharp`, `puppeteer`, or anything requiring native addons
  in server functions when using `vercel-edge`. Fine on `vercel` (Node).
- Server functions read `process.env.*` inside `.handler()` bodies, not at
  module scope (same rule as Cloudflare).

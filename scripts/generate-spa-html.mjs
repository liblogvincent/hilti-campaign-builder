#!/usr/bin/env node
/**
 * Post-build step: generate index.html for SPA deployment (GitHub Pages).
 *
 * The Nitro Cloudflare preset builds the server worker + client assets
 * but doesn't emit index.html (SSR renders it at request time). This
 * script finds the client-side entry chunks and writes an index.html
 * that boots the SPA without a server.
 */
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PUBLIC_DIR = join(process.cwd(), ".output", "public");
const ASSETS_DIR = join(PUBLIC_DIR, "assets");

async function main() {
  const files = await readdir(ASSETS_DIR);

  const jsFiles = files.filter((f) => f.endsWith(".js"));
  const cssFiles = files.filter((f) => f.endsWith(".css"));

  // TanStack Start entry point is typically named index-<hash>.js
  const entryJs = jsFiles.find((f) => f.startsWith("index-"));
  const styleCss = cssFiles.find((f) => f.startsWith("styles-"));

  if (!entryJs) {
    console.error("❌ Could not find index-*.js in assets/");
    console.error("   Available JS files:", jsFiles);
    process.exit(1);
  }

  const cssLink = styleCss
    ? `    <link rel="stylesheet" href="./assets/${styleCss}" />`
    : "";

  const html = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Luban — Agentic Marketing for Hilti</title>
    <meta name="description" content="Conversational campaign agent with human approval gates and a compounding skills library." />
    <meta property="og:title" content="Luban — Agentic Marketing for Hilti" />
    <meta name="twitter:title" content="Luban — Agentic Marketing for Hilti" />
    <meta property="og:description" content="Conversational campaign agent with human approval gates and a compounding skills library." />
    <meta name="twitter:description" content="Conversational campaign agent with human approval gates and a compounding skills library." />
    <meta property="og:image" content="https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c4a97b83-03cb-412c-aadd-7549df704892/id-preview-24328a9d--c1091e6c-b426-4c2c-b5ad-0ff8c2f1d969.lovable.app-1782651847678.png" />
    <meta name="twitter:image" content="https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c4a97b83-03cb-412c-aadd-7549df704892/id-preview-24328a9d--c1091e6c-b426-4c2c-b5ad-0ff8c2f1d969.lovable.app-1782651847678.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta property="og:type" content="website" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
${cssLink}
    <script type="module" crossorigin src="./assets/${entryJs}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

  const outPath = join(PUBLIC_DIR, "index.html");
  await writeFile(outPath, html);
  console.log(`✅ Generated index.html → ${outPath}`);

  // Also create 404.html for SPA client-side routing fallback.
  // GitHub Pages serves 404.html for any missing route; the SPA
  // router then picks up the path and renders the correct page.
  const notFoundPath = join(PUBLIC_DIR, "404.html");
  await writeFile(notFoundPath, html);
  console.log(`✅ Generated 404.html → ${notFoundPath}`);
  console.log(`   Entry: assets/${entryJs}`);
  if (styleCss) console.log(`   Style: assets/${styleCss}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

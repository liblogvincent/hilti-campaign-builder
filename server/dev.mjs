import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { join } from "node:path";
import { handlePandaApiRequest, loadEnv } from "./panda-api.mjs";

const root = process.cwd();
loadEnv(join(root, ".env"));

const port = Number(process.env.PANDA_API_PORT || 8787);

createServer(handlePandaApiRequest).listen(port, "127.0.0.1", () => {
  console.log(`Panda API listening on http://127.0.0.1:${port}`);
});

const vite = spawn("npx", ["vite", "--host", "127.0.0.1"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.on("SIGINT", () => {
  vite.kill("SIGINT");
  process.exit(0);
});

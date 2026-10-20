import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, transformWithOxc } from "vite";
import { isProject, manifest } from "./model.mjs";
const manifests = [
  process.env.COR01_ASSET_MANIFEST,
  process.env.COR01_TRANSFER_ASSET_MANIFEST,
].filter(Boolean);
const saveDir = process.env.COR01_SAVE_DIR;
const assets = new Map(
  manifests
    .flatMap((path) => JSON.parse(readFileSync(path, "utf8")).images ?? [])
    .map((a) => [a.assetId, a]),
);
const expected = new Map(manifest.assets.map((a) => [a.assetId, a.sha256]));
export default defineConfig({
  publicDir: false,
  optimizeDeps: { rolldownOptions: { moduleTypes: { ".js": "jsx" } } },
  server: { host: "127.0.0.1", port: 4317, strictPort: true, fs: { allow: [resolve(".")] } },
  plugins: [
    {
      name: "cor01-jsx",
      enforce: "pre",
      transform(src, id) {
        if (id.endsWith("/src/main.js")) return transformWithOxc(src, id, { lang: "jsx" });
      },
    },
    {
      name: "cor01-private-routes",
      configureServer(server) {
        server.middlewares.use("/approved-assets", (req, res) => {
          const match = /^\/([a-z0-9-]+)\.jpg$/.exec(req.url ?? "");
          const a = match && assets.get(match[1]);
          if (req.method !== "GET" || !a || expected.get(a.assetId) !== a.sha256)
            return res.writeHead(404).end();
          try {
            const bytes = readFileSync(a.sourcePath);
            if (createHash("sha256").update(bytes).digest("hex") !== a.sha256)
              return res.writeHead(409).end();
            res.setHeader("Content-Type", "image/jpeg");
            res.end(bytes);
          } catch {
            res.writeHead(404).end();
          }
        });
        server.middlewares.use("/research-save", (req, res) => {
          res.setHeader("Cache-Control", "no-store");
          if (!saveDir) return res.writeHead(503).end("Private save directory not configured");
          const target = resolve(saveDir, "puck-local-draft.json");
          if (req.method === "GET") {
            if (!existsSync(target)) return res.writeHead(404).end();
            try {
              const bytes = readFileSync(target, "utf8");
              if (!isProject(JSON.parse(bytes))) return res.writeHead(409).end();
              res.setHeader("Content-Type", "application/json");
              return res.end(bytes);
            } catch {
              return res.writeHead(409).end();
            }
          }
          if (req.method !== "POST") return res.writeHead(405).end();
          if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
            return res.writeHead(403).end();
          let body = "";
          let oversized = false;
          req.on("data", (chunk) => {
            if (!oversized) body += chunk;
            if (Buffer.byteLength(body) > 500000) {
              oversized = true;
              body = "";
            }
          });
          req.on("end", () => {
            if (oversized) return res.writeHead(413).end();
            try {
              const value = JSON.parse(body);
              if (!isProject(value)) return res.writeHead(422).end();
              mkdirSync(saveDir, { recursive: true });
              writeFileSync(target + ".tmp", JSON.stringify(value, null, 2) + "\n", {
                mode: 0o600,
              });
              renameSync(target + ".tmp", target);
              res.writeHead(204).end();
            } catch {
              res.writeHead(400).end();
            }
          });
        });
      },
    },
  ],
});

// Standalone Node/Bun HTTP server for the TanStack Start production build.
//
// Used by Coolify / VPS / Docker deployments. Run AFTER `STANDALONE=true bun run build`,
// which produces:
//   - dist/server/index.js  (ESM, default export = fetch handler)
//   - dist/client/          (static assets, hashed under /_build, plus public files)
//
// This file:
//   1. Serves static files from dist/client (cache-busted /_build/* with long TTL)
//   2. Forwards everything else to the SSR fetch handler
//   3. Listens on HOST:PORT (defaults 0.0.0.0:3000)

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = resolve(__dirname, "dist");
const CLIENT_DIR = join(DIST, "client");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// The server entry filename depends on the build target: standalone Node builds
// emit dist/server/server.js; Cloudflare/other targets may emit dist/server/index.js.
// Pick whichever exists.
const SERVER_CANDIDATES = ["server.js", "index.js", "index.mjs"];
const serverFile = SERVER_CANDIDATES
  .map((f) => join(DIST, "server", f))
  .find((p) => existsSync(p));
if (!serverFile) {
  console.error(
    "[server] no server entry found in dist/server/. Run `bun run build:standalone` first.",
  );
  process.exit(1);
}

const mod = await import(pathToFileURL(serverFile).href);
const fetchHandler = mod.default;
if (typeof fetchHandler !== "function") {
  console.error(`[server] ${serverFile} has no default fetch handler export.`);
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

async function tryServeStatic(urlPath) {
  // Strip query string, decode, and prevent path traversal
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  if (clean.includes("..")) return null;
  const filePath = join(CLIENT_DIR, clean);
  if (!filePath.startsWith(CLIENT_DIR)) return null;
  try {
    const s = await stat(filePath);
    if (!s.isFile()) return null;
    const ext = extname(filePath).toLowerCase();
    const body = await readFile(filePath);
    const isHashed = clean.startsWith("/_build/") || clean.startsWith("/assets/");
    return {
      body,
      headers: {
        "content-type": MIME[ext] || "application/octet-stream",
        "content-length": String(body.length),
        "cache-control": isHashed
          ? "public, max-age=31536000, immutable"
          : "public, max-age=300",
      },
    };
  } catch {
    return null;
  }
}

function nodeReqToWebRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || `${HOST}:${PORT}`;
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (value != null) {
      headers.set(key, String(value));
    }
  }

  const init = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = new ReadableStream({
      start(controller) {
        req.on("data", (chunk) => controller.enqueue(chunk));
        req.on("end", () => controller.close());
        req.on("error", (err) => controller.error(err));
      },
    });
    init.duplex = "half";
  }
  return new Request(url, init);
}

async function writeWebResponse(res, webRes) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (!webRes.body) return res.end();
  const reader = webRes.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

const server = createServer(async (req, res) => {
  try {
    // 1. Static files from dist/client
    const asset = await tryServeStatic(req.url);
    if (asset) {
      res.writeHead(200, asset.headers);
      res.end(asset.body);
      return;
    }

    // 2. SSR / server functions / API routes
    const webReq = nodeReqToWebRequest(req);
    const webRes = await fetchHandler(webReq);
    await writeWebResponse(res, webRes);
  } catch (err) {
    console.error("[server] request failed:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});

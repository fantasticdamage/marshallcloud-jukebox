const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === "/api/health") {
    return sendJson(res, 200, {
      status: "ok",
      app: "MarshallCloud Jukebox",
      version: "0.1.0",
      spotifyConfigured: Boolean(process.env.SPOTIFY_CLIENT_ID),
      homeAssistantConfigured: Boolean(process.env.HA_URL && process.env.HA_TOKEN)
    });
  }

  let relativePath = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1);
  relativePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(publicDir, relativePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (statError, stats) => {
    if (!statError && stats.isFile()) {
      const extension = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[extension] || "application/octet-stream",
        "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600"
      });
      return fs.createReadStream(filePath).pipe(res);
    }

    // SPA fallback
    filePath = path.join(publicDir, "index.html");
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`MarshallCloud Jukebox listening on port ${port}`);
});

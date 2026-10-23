// Zero-dependency static file server for Quadrealm Quest.
// Serves this folder and the sibling Cards/ and board asset folders.
// Run: node server.js   then open http://localhost:5173
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5173;
const ROOT = __dirname;                 // game/
const REPO = path.join(__dirname, ".."); // repo root (for Cards/ and board)

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";

    // Assets live one level up (Cards/, QuadRealm Quest/). Allow /assets/* to reach them.
    let filePath;
    if (urlPath.startsWith("/assets/")) {
      filePath = path.join(REPO, urlPath.slice("/assets/".length));
    } else {
      filePath = path.join(ROOT, urlPath);
    }

    // Prevent path traversal outside the repo.
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(REPO))) {
      res.writeHead(403); res.end("Forbidden"); return;
    }

    fs.readFile(resolved, (err, data) => {
      if (err) { res.writeHead(404); res.end("Not found"); return; }
      const ext = path.extname(resolved).toLowerCase();
      res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
      res.end(data);
    });
  } catch (e) {
    res.writeHead(500); res.end("Server error");
  }
});

server.listen(PORT, () => {
  console.log(`Quadrealm Quest running at http://localhost:${PORT}`);
});

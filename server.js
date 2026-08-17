const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname);

const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp"
};

function safeFilePath(requestUrl) {
    let requestPath;
    try {
        requestPath = decodeURIComponent(
            String(requestUrl || "/").split("?")[0]
        );
    } catch {
        return null;
    }

    if (!requestPath || requestPath === "/") {
        requestPath = "/index.html";
    }

    const relativePath = requestPath.replace(/^[/\\]+/, "");
    const filePath = path.resolve(ROOT, relativePath);
    const relative = path.relative(ROOT, filePath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return null;
    }

    return filePath;
}

const server = http.createServer((req, res) => {
    const filePath = safeFilePath(req.url);

    if (!filePath) {
        res.writeHead(403, {
            "Content-Type": "text/plain; charset=utf-8"
        });
        res.end("403 - Forbidden");
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-store"
            });
            res.end("404 - File not found");
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType =
            mimeTypes[ext] || "application/octet-stream";

        res.writeHead(200, {
            "Content-Type": contentType,
            "Cache-Control": "no-cache"
        });

        fs.createReadStream(filePath).pipe(res);
    });
});

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(
            `Port ${PORT} is already in use. Stop the existing server on port ${PORT} and run SAMS again.`
        );
    } else {
        console.error("SAMS server error:", error);
    }
    process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("==========================================");
    console.log("  SAMS - Student Assessment Management");
    console.log("==========================================");
    console.log("");
    console.log(`SAMS is running on port ${PORT}`);
    console.log(`Browser: http://localhost:${PORT}`);
    console.log("");
    console.log("Press Ctrl+C to stop SAMS.");
    console.log("");
});

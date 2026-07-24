import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = Number(process.env.PORT) || 5173;
const REPO_ROOT = path.resolve(__dirname, '../..');
const DEMO_ROOT = path.join(__dirname, 'demo');

const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};

// Route → HTML page under demo/
const PAGE_ROUTES: Record<string, string> = {
    '/browse': 'browse.html',
    '/browse/': 'browse.html',
    '/studio': 'studio.html',
    '/studio/': 'studio.html',
    '/graph': 'graph.html',
    '/graph/': 'graph.html',
};

const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);

    // Root → redirect to /browse
    if (url === '/' || url === '') {
        res.writeHead(302, { Location: '/browse' });
        res.end();
        return;
    }

    // Named routes → HTML pages
    if (PAGE_ROUTES[url]) {
        servePath(res, path.join(DEMO_ROOT, PAGE_ROUTES[url]));
        return;
    }

    // /assets/* → demo/assets/*
    if (url.startsWith('/assets/')) {
        const rel = url.slice('/assets/'.length);
        const full = path.join(DEMO_ROOT, 'assets', rel);
        if (!full.startsWith(path.join(DEMO_ROOT, 'assets'))) return send(res, 403, 'text/plain', 'Forbidden');
        servePath(res, full);
        return;
    }

    // Fallback: serve from repo root (index.json, brands.json, brands/*.json, ...)
    const safe = path.normalize(url).replace(/^([/\\])+/, '');
    const full = path.join(REPO_ROOT, safe);
    if (!full.startsWith(REPO_ROOT)) return send(res, 403, 'text/plain', 'Forbidden');
    servePath(res, full);
});

function servePath(res: http.ServerResponse, full: string) {
    fs.stat(full, (err, stat) => {
        if (err || !stat.isFile()) return send(res, 404, 'text/plain', 'Not found');
        fs.readFile(full, (err2, data) => {
            if (err2) return send(res, 500, 'text/plain', 'Read error');
            const mime = MIME[path.extname(full).toLowerCase()] ?? 'application/octet-stream';
            send(res, 200, mime, data);
        });
    });
}

function send(res: http.ServerResponse, status: number, type: string, body: string | Buffer) {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
}

server.listen(PORT, () => {
    console.log(`KFE icons demo → http://localhost:${PORT}/`);
    console.log(`  demo root: ${DEMO_ROOT}`);
    console.log(`  repo root: ${REPO_ROOT}`);
});

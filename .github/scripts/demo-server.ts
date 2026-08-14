import http from 'http';
import fs from 'fs';
import path from 'path';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const args = process.argv.slice(2);
const getArg = (flag: string) => {
    const prefix = `${flag}=`;
    const found = args.find(a => a.startsWith(prefix));
    if (found) return found.slice(prefix.length);
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    return undefined;
};

// Default to loopback so the write API (/api/save) isn't exposed to the LAN.
// Pass --host 0.0.0.0 (or HOST=0.0.0.0) to opt in explicitly.
const HOST = getArg('--host') || process.env.HOST || '127.0.0.1';
const PORT = Number(getArg('--port') || process.env.PORT) || 5173;

// Origins the /api/save handler will accept. Cross-origin browser POSTs
// with Content-Type: application/json trigger a CORS preflight — we don't
// answer OPTIONS, so those fail closed. This Origin check is defense in
// depth for the same-origin case and covers non-browser callers.
const ALLOWED_ORIGINS = new Set([
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`,
]);
const REPO_ROOT = path.resolve(__dirname, '../..');
const DEMO_ROOT = path.join(__dirname, 'demo');
const TW_CSS_SRC = path.join(DEMO_ROOT, 'assets', 'css', 'tailwind.css');
const TW_CSS_BASE = path.dirname(TW_CSS_SRC);

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
};

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

// Tailwind on-the-fly compiler. Rebuilds when the source CSS or any scanned
// content file changes since the last request; otherwise returns the cached
// output. Compile object is rebuilt only when the source CSS itself changes,
// since `@source` resolution happens at compile-time.
type TwState = {
    css: string;
    // File → mtimeMs snapshot at the moment `css` was produced.
    fingerprint: Map<string, number>;
};
let twCache: TwState | null = null;
let twCompilerSrcMtime = 0;
let twCompiler: Awaited<ReturnType<typeof compile>> | null = null;

async function buildTailwindCss(): Promise<string> {
    const cssSource = fs.readFileSync(TW_CSS_SRC, 'utf8');
    const srcStat = fs.statSync(TW_CSS_SRC);

    // Rebuild the compiler only when the source CSS changes — otherwise reuse
    // it and just rescan candidates. Compilation is the expensive step.
    if (!twCompiler || twCompilerSrcMtime !== srcStat.mtimeMs) {
        twCompiler = await compile(cssSource, {
            base: TW_CSS_BASE,
            from: TW_CSS_SRC,
            onDependency: () => {},
        });
        twCompilerSrcMtime = srcStat.mtimeMs;
        twCache = null;
    }

    const scanner = new Scanner({ sources: twCompiler.sources });
    const candidates = scanner.scan();

    // Fingerprint: source CSS + every file the scanner touched. If any mtime
    // matches the previous run we can short-circuit the build.
    const fingerprint = new Map<string, number>();
    fingerprint.set(TW_CSS_SRC, srcStat.mtimeMs);
    for (const f of scanner.files) {
        try {
            fingerprint.set(f, fs.statSync(f).mtimeMs);
        } catch {
            // File vanished between scan and stat; ignore.
        }
    }

    if (twCache && sameFingerprint(twCache.fingerprint, fingerprint)) {
        return twCache.css;
    }

    const css = twCompiler.build(candidates);
    twCache = { css, fingerprint };
    return css;
}

function sameFingerprint(a: Map<string, number>, b: Map<string, number>): boolean {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
        if (b.get(k) !== v) return false;
    }
    return true;
}

const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);

    // GET /assets/css/tailwind.css — compile-on-demand, no build step needed.
    if (req.method === 'GET' && url === '/assets/css/tailwind.css') {
        buildTailwindCss()
            .then(css => send(res, 200, MIME['.css'], css))
            .catch(err => {
                console.error('[tailwind] compile failed:', err);
                send(res, 500, 'text/plain', `Tailwind compile error: ${String((err as Error)?.message ?? err)}`);
            });
        return;
    }

    // POST /api/save — writes <repo-root>/<category>/<name>.json
    if (req.method === 'POST' && url === '/api/save') {
        // CSRF guard: reject anything that isn't a same-origin JSON POST.
        // Content-Type must be application/json so browsers can't fire a
        // "simple" cross-origin request without preflight. Origin (when
        // set — browsers always set it on POST) must match one of the
        // demo pages. Referer is the fallback for older callers.
        const contentType = (req.headers['content-type'] || '').split(';')[0]!.trim().toLowerCase();
        if (contentType !== 'application/json') {
            return send(res, 415, 'application/json', JSON.stringify({ error: 'Content-Type must be application/json' }));
        }
        const origin = req.headers.origin;
        if (typeof origin === 'string' && !ALLOWED_ORIGINS.has(origin)) {
            return send(res, 403, 'application/json', JSON.stringify({ error: 'Cross-origin write blocked' }));
        }
        if (typeof origin !== 'string') {
            const referer = req.headers.referer;
            const refererOk = typeof referer === 'string' && [...ALLOWED_ORIGINS].some(o => referer.startsWith(o + '/'));
            if (!refererOk) {
                return send(res, 403, 'application/json', JSON.stringify({ error: 'Missing Origin/Referer' }));
            }
        }
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
            try {
                const { category, name, content } = JSON.parse(body || '{}');
                if (typeof category !== 'string' || typeof name !== 'string' || typeof content !== 'string') {
                    return send(res, 400, 'application/json', JSON.stringify({ error: 'category, name, and content are required strings' }));
                }
                if (!SLUG.test(name) || !SLUG.test(category)) {
                    return send(res, 400, 'application/json', JSON.stringify({ error: 'Invalid slug (a-z, 0-9, hyphens)' }));
                }
                const dir = path.join(REPO_ROOT, category);
                const file = path.join(dir, `${name}.json`);
                // Path traversal guard: resolved path must stay inside REPO_ROOT.
                if (!file.startsWith(REPO_ROOT + path.sep) && file !== REPO_ROOT) {
                    return send(res, 403, 'application/json', JSON.stringify({ error: 'Forbidden path' }));
                }
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(file, content);
                send(res, 200, 'application/json', JSON.stringify({ ok: true, path: `${category}/${name}.json` }));
            } catch (err) {
                send(res, 500, 'application/json', JSON.stringify({ error: String((err as Error)?.message ?? err) }));
            }
        });
        return;
    }

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

server.listen(PORT, HOST, () => {
    console.log(`KFE icons demo → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
    console.log(`  demo root: ${DEMO_ROOT}`);
    console.log(`  repo root: ${REPO_ROOT}`);
    console.log(`  tailwind : ${TW_CSS_SRC} (compiled on-demand at /assets/css/tailwind.css)`);
});

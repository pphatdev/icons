#!/usr/bin/env node
// Validate every icon JSON in the repo against a strict deny-list, before
// a PR can merge. Belt-and-braces with the runtime sanitizer in
// desktop/renderer/lib/sanitize-svg.ts — if a poisoned SVG ever slips into
// the registry, downstream consumers of icon.svg (dangerouslySetInnerHTML,
// innerHTML, DOMParser+appendChild) execute JS.
//
// Zero dependencies (node built-ins only) so this runs before npm install
// in CI — a broken lockfile can't neutralize the check.
//
// Exits 0 = clean, 1 = at least one violation, 2 = usage error.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = process.cwd();

// Categories are top-level directories that aren't hidden/node_modules/src.
// Matches the discovery rule in .github/scripts/update-category.ts so both
// stay in sync.
function findCategoryDirs() {
    return readdirSync(REPO_ROOT).filter((f) => {
        if (f.startsWith('.') || f === 'node_modules' || f === 'src') return false;
        try {
            return statSync(join(REPO_ROOT, f)).isDirectory();
        } catch {
            return false;
        }
    });
}

// Deny-list — matches must be obviously malicious. Case-insensitive because
// SVG parsers accept mixed-case tags (<ForeignObject/> parses the same as
// <foreignobject/>). The runtime sanitizer uses a stricter allowlist; this
// layer is here to give contributors a clear per-file error at PR time.
const CHECKS = [
    { name: '<script> tag', re: /<script\b/i },
    { name: '<foreignObject> tag', re: /<foreignObject\b/i },
    { name: '<iframe> tag', re: /<iframe\b/i },
    { name: '<use> tag (xlink:href attack surface)', re: /<use\b/i },
    { name: '<image> tag (data:/javascript: href)', re: /<image\b/i },
    { name: 'SMIL <animate*> tag', re: /<animate[a-z]*\b/i },
    { name: 'SMIL <set> tag', re: /<set\b/i },
    { name: 'inline <style> tag', re: /<style\b/i },
    { name: 'inline event handler (on…=)', re: /\son[a-z]+\s*=/i },
    { name: 'javascript: URL in href', re: /\bhref\s*=\s*["']?\s*javascript\s*:/i },
    { name: 'javascript: URL in xlink:href', re: /\bxlink:href\s*=\s*["']?\s*javascript\s*:/i },
    { name: 'javascript: URL in src', re: /\bsrc\s*=\s*["']?\s*javascript\s*:/i },
];

function checkSvg(svg) {
    const hits = [];
    for (const check of CHECKS) {
        if (check.re.test(svg)) hits.push(check.name);
    }
    return hits;
}

let violations = 0;
let iconsChecked = 0;
let filesChecked = 0;

for (const category of findCategoryDirs()) {
    let entries;
    try {
        entries = readdirSync(join(REPO_ROOT, category)).filter((f) => f.endsWith('.json'));
    } catch {
        continue;
    }
    for (const entry of entries) {
        const rel = `${category}/${entry}`;
        const full = join(REPO_ROOT, category, entry);
        let parsed;
        try {
            parsed = JSON.parse(readFileSync(full, 'utf8'));
        } catch (err) {
            console.error(`✗ ${rel} — invalid JSON: ${err.message}`);
            violations += 1;
            continue;
        }
        filesChecked += 1;
        const files = Array.isArray(parsed?.files) ? parsed.files : [];
        for (const f of files) {
            if (typeof f?.content !== 'string') continue;
            iconsChecked += 1;
            const hits = checkSvg(f.content);
            if (hits.length > 0) {
                console.error(`✗ ${rel} (${f.path ?? 'unknown'}) — ${hits.join(', ')}`);
                violations += 1;
            }
        }
    }
}

if (violations > 0) {
    console.error(`\n${violations} violation(s) across ${filesChecked} file(s).`);
    console.error('Icons must contain only safe SVG primitives (path, rect, circle, ellipse, polygon, polyline, line, g, defs, title, desc).');
    console.error('See .github/scripts/desktop/renderer/lib/sanitize-svg.ts for the runtime allowlist.');
    process.exit(1);
}

console.log(`✓ ${iconsChecked} icon(s) across ${filesChecked} file(s) — clean.`);

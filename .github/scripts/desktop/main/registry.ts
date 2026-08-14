import { accessSync, promises as fs } from 'node:fs';
import path from 'node:path';

// Repo root is the ancestor containing index.json + brands.json (repo signature).
// Compiled main lives at desktop/out/main/index.js → walk up until we hit the
// marker files rather than hard-coding a relative depth.
export function resolveRepoRoot(): string {
    let dir = __dirname;
    for (let i = 0; i < 8; i++) {
        try {
            accessSync(path.join(dir, 'index.json'));
            accessSync(path.join(dir, 'brands.json'));
            return dir;
        } catch {
            // keep walking
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    throw new Error(`Could not locate repo root (walked up from ${__dirname})`);
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function isSlug(value: unknown): value is string {
    return typeof value === 'string' && SLUG.test(value);
}

// Resolve a path inside the repo and guarantee it hasn't escaped via `..`.
export function safeRepoPath(repoRoot: string, ...segments: string[]): string {
    const full = path.resolve(repoRoot, ...segments);
    if (full !== repoRoot && !full.startsWith(repoRoot + path.sep)) {
        throw new Error(`Path escapes repo root: ${full}`);
    }
    return full;
}

export interface CategoryMeta { name: string; target: string; }
export interface CategoryItem { name: string; target: string; type?: string; }
export interface IconFile { path: string; content: string; }
export interface IconJson { name: string; files?: IconFile[]; }
export interface RegistryIcon { name: string; category: string; svg: string; }
export interface RegistrySnapshot {
    categories: Array<{ name: string; items: CategoryItem[] }>;
    icons: RegistryIcon[];
}

async function readJson<T>(file: string): Promise<T> {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T;
}

export async function loadRegistry(repoRoot: string): Promise<RegistrySnapshot> {
    const index = await readJson<CategoryMeta[]>(safeRepoPath(repoRoot, 'index.json'));

    const categories = await Promise.all(
        index.map(async (cat) => {
            try {
                const items = await readJson<CategoryItem[]>(safeRepoPath(repoRoot, cat.target));
                return { name: cat.name, items };
            } catch {
                return { name: cat.name, items: [] };
            }
        })
    );

    const entries: Array<CategoryItem & { category: string }> = [];
    for (const cat of categories) for (const item of cat.items) entries.push({ ...item, category: cat.name });

    const icons = (
        await Promise.all(
            entries.map(async (e) => {
                try {
                    const data = await readJson<IconJson>(safeRepoPath(repoRoot, e.target));
                    const file = Array.isArray(data.files) ? data.files[0] : null;
                    if (!file?.content) return null;
                    return { name: e.name, category: e.category, svg: file.content };
                } catch {
                    return null;
                }
            })
        )
    ).filter((x): x is RegistryIcon => x !== null);

    return { categories, icons };
}

export interface SaveIconInput {
    category: string;
    name: string;
    // Full JSON body ({ name, files: [{ path, content }] }) already stringified
    // by the caller so we stay faithful to the existing on-disk format.
    content: string;
}

export async function saveIcon(repoRoot: string, input: SaveIconInput): Promise<string> {
    if (!isSlug(input.name)) throw new Error('Invalid icon name (a-z, 0-9, hyphens)');
    if (!isSlug(input.category)) throw new Error('Invalid category (a-z, 0-9, hyphens)');
    if (typeof input.content !== 'string' || input.content.length === 0) throw new Error('Content is required');

    const dir = safeRepoPath(repoRoot, input.category);
    const file = safeRepoPath(repoRoot, input.category, `${input.name}.json`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, input.content, 'utf8');
    return `${input.category}/${input.name}.json`;
}

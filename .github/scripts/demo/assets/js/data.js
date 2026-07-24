export const REPO_ROOT = '/';
export const CUSTOM_STORAGE_KEY = 'kfe-custom-icons';

export async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export function loadCustomIcons() {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch { return []; }
}

export function saveCustomIcons(items) {
  try { localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(items)); }
  catch (err) { console.warn('Could not persist custom icons:', err); }
}

export async function loadAll() {
  const index = await fetchJSON(REPO_ROOT + 'index.json');
  const categories = await Promise.all(index.map(async (cat) => {
    try {
      const items = await fetchJSON(REPO_ROOT + cat.target);
      return { name: cat.name, items };
    } catch { return { name: cat.name, items: [] }; }
  }));

  const entries = [];
  for (const cat of categories) for (const item of cat.items) entries.push({ ...item, category: cat.name });

  const icons = (await Promise.all(entries.map(async (e) => {
    try {
      const data = await fetchJSON(REPO_ROOT + e.target);
      const file = Array.isArray(data.files) ? data.files[0] : null;
      if (!file?.content) return null;
      return { name: e.name, category: e.category, svg: file.content };
    } catch { return null; }
  }))).filter(Boolean);

  const custom = loadCustomIcons();
  if (custom.length) {
    categories.push({ name: 'custom', items: custom.map(c => ({ name: c.name, type: 'custom' })) });
    for (const c of custom) icons.push({ name: c.name, category: 'custom', svg: c.svg });
  }

  return { categories, icons };
}

export function recolor(svg, color) {
  return svg.replace(/currentColor/g, color);
}

export function countShapes(svg) {
  const m = svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line)\b/g);
  return m ? m.length : 0;
}

export const CUSTOM_STORAGE_KEY = 'kfe-custom-icons';

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

// Registry now loaded via the Electron preload bridge (window.kfe.loadRegistry).
// The main-process handler walks index.json → <category>.json → <name>.json
// and returns the same { categories, icons } shape the demo used to build
// from individual fetch() calls, so callers don't need to change.
export async function loadAll() {
  if (!window.kfe?.loadRegistry) {
    throw new Error('window.kfe bridge missing — preload script did not load');
  }
  const { categories, icons } = await window.kfe.loadRegistry();

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

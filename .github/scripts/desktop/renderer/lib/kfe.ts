import type {
  KfeCategoryItem,
  KfeRegistryIcon,
  KfeRegistrySnapshot,
} from '@/types/global';

export const LOCAL_ICONS_KEY = 'kfe-custom-icons';

export interface LocalIcon {
  name: string;
  svg: string;
}

export function loadLocalIcons(): LocalIcon[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ICONS_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    return Array.isArray(items) ? (items as LocalIcon[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalIcons(items: LocalIcon[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_ICONS_KEY, JSON.stringify(items));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Could not persist custom icons:', err);
  }
}

function ensureBridge() {
  if (typeof window === 'undefined' || !window.kfe) {
    throw new Error("IPC bridge missing — preload didn't load");
  }
  return window.kfe;
}

/**
 * loadAll — mirrors legacy `data.js` behavior. Reads the on-disk registry
 * via the Electron preload bridge and appends any localStorage custom icons
 * as a synthetic 'custom' category so both sources render side by side.
 */
export async function loadAll(): Promise<KfeRegistrySnapshot> {
  const bridge = ensureBridge();
  const { categories, icons } = await bridge.loadRegistry();

  const custom = loadLocalIcons();
  if (custom.length) {
    const customItems: KfeCategoryItem[] = custom.map((c) => ({
      name: c.name,
      target: c.name,
      type: 'custom',
    }));
    categories.push({ name: 'custom', items: customItems });
    for (const c of custom) {
      const icon: KfeRegistryIcon = { name: c.name, category: 'custom', svg: c.svg };
      icons.push(icon);
    }
  }

  return { categories, icons };
}

export interface SaveIconInput {
  category: string;
  name: string;
  svg: string;
}

/**
 * saveIconToRepo — writes an icon to the on-disk registry through the
 * Electron main process. Content shape matches what legacy studio.js
 * expected the backend to receive.
 */
export async function saveIconToRepo({ category, name, svg }: SaveIconInput): Promise<string> {
  const bridge = ensureBridge();
  const content = JSON.stringify(
    { name, files: [{ path: `${name}.svg`, content: svg }] },
    null,
    2,
  );
  return bridge.saveIcon({ category, name, content });
}

export function recolor(svg: string, hex: string): string {
  return svg.replace(/currentColor/g, hex);
}

export function countShapes(svg: string): number {
  const m = svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line)\b/g);
  return m ? m.length : 0;
}

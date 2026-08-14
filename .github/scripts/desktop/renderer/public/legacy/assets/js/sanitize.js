// Strict allowlist SVG sanitizer for the vanilla legacy studio/browse pages.
// Mirror of ../../../../lib/sanitize-svg.ts — keep in sync.
//
// Icons load through data.js::loadAll, which sanitizes at the trust boundary
// so downstream innerHTML / DOMParser mounts receive already-clean SVG.

const ALLOWED_ELEMENTS = new Set([
  'svg', 'g', 'defs', 'title', 'desc',
  'path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line',
]);

const ALLOWED_ATTRIBUTES = new Set([
  'id', 'class',
  'viewBox', 'xmlns', 'xmlns:xlink', 'version',
  'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'stroke-miterlimit',
  'opacity', 'transform', 'preserveAspectRatio',
  'clip-rule', 'vector-effect',
]);

// Real icons carry semantic markers like data-foreground="true". Allow any
// well-formed data-* name — they can't smuggle handlers, and the strict CSS
// selector risk (attr(data-x)/content: url(…)) is moot when we also strip
// <style> and style="…".
const DATA_ATTR_RE = /^data-[a-z][a-z0-9-]*$/;

function scrubElement(el) {
  for (const attr of Array.from(el.attributes)) {
    if (!ALLOWED_ATTRIBUTES.has(attr.name) && !DATA_ATTR_RE.test(attr.name)) {
      el.removeAttribute(attr.name);
    }
  }
  for (const child of Array.from(el.children)) {
    if (!ALLOWED_ELEMENTS.has(child.tagName.toLowerCase())) {
      child.remove();
      continue;
    }
    scrubElement(child);
  }
}

export function sanitizeSvg(input) {
  if (typeof input !== 'string' || input.length === 0) return '';
  const doc = new DOMParser().parseFromString(input, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return '';
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') return '';
  scrubElement(root);
  return new XMLSerializer().serializeToString(root);
}

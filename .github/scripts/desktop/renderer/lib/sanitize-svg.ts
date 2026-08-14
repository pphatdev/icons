// Strict allowlist SVG sanitizer.
//
// Icons in this repo come from PR contributions (brands/*.json, regular/*.json)
// whose `files[].content` is inlined verbatim via dangerouslySetInnerHTML.
// Without sanitization, a poisoned icon PR carrying <svg onload="…">,
// <foreignObject><iframe src="javascript:…">, or <animate onbegin="…">
// executes JS in the Electron renderer — which has window.kfe.saveIcon
// exposed via the preload bridge, so an XSS can write attacker-controlled
// files back to the user's checkout.
//
// Strategy: parse the SVG, drop any element or attribute not on the
// allowlist, then reserialize. Allowlists (not blocklists) because SVG
// has many undocumented ways to smuggle JS (SMIL, xlink:href="javascript:",
// CSS url(javascript:…), etc.).
//
// Sanitize at load time — once, at the trust boundary — so callers can
// treat icon.svg as safe by construction. See lib/kfe.ts::loadAll.

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

function scrubElement(el: Element): void {
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

export function sanitizeSvg(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0) return '';
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    // Server-side / non-DOM environment. Callers should only render on the
    // client; return empty to avoid shipping unsanitized markup to the DOM.
    return '';
  }
  const doc = new DOMParser().parseFromString(input, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return '';
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') return '';
  scrubElement(root);
  return new XMLSerializer().serializeToString(root);
}

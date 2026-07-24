import { loadAll, recolor, loadCustomIcons, saveCustomIcons } from './data.js';
import { setStats, showToast } from './shell.js';

// The Studio page has its own title/nav in Tailwind so we skip initShell.
document.title = 'Studio · KFE Icons Studio';

const HISTORY_LIMIT = 100;
const SVG_NS = 'http://www.w3.org/2000/svg';

const state = {
  icons: [], categories: [], selectedIcon: null,
  svgDoc: null,
  selectedEl: null,
  tool: 'select',
  zoom: 4,
  original: null,
  history: { past: [], future: [] },
  clipboard: null,
  nextIdx: 0,
};

// ---- DOM refs ----
const iconList = document.getElementById('icon-list');
const sSearch = document.getElementById('icon-search');
const canvasHost = document.getElementById('canvas-host');
const canvasWrap = document.getElementById('canvas-wrap');
const canvasLabel = document.getElementById('canvas-label');
const handlesEl = document.getElementById('handles');
const treeEl = document.getElementById('tree');
const propsEl = document.getElementById('props');
const nameEl = document.getElementById('current-name');
const zoomLabel = document.getElementById('zoom-label');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomDisplay = document.getElementById('zoom-display');
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const newBtn = document.getElementById('new-icon');
const newBtnSm = document.getElementById('new-icon-sm');
const resetBtn = document.getElementById('reset');
const centerBtn = document.getElementById('center');
const copyBtn = document.getElementById('copy');
const downloadBtn = document.getElementById('download');
const paletteEl = document.getElementById('tools-palette');
const toolDuplicateBtn = document.getElementById('tool-duplicate');
const toolDeleteBtn = document.getElementById('tool-delete');
const treeCountEl = document.getElementById('tree-count');

// ---- Helpers ----
function escapeAttr(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function parseTranslate(t) {
  const m = /translate\(\s*([-\d.]+)\s*[, ]\s*([-\d.]+)\s*\)/.exec(t);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}
function setTranslate(el, x, y) {
  const cur = el.getAttribute('transform') || '';
  const stripped = cur.replace(/translate\([^)]*\)\s*/g, '').trim();
  const t = `translate(${x.toFixed(3)}, ${y.toFixed(3)})`;
  el.setAttribute('transform', stripped ? `${t} ${stripped}` : t);
}
function clientToSvg(svg, x, y) {
  const rect = svg.getBoundingClientRect();
  const vb = (svg.getAttribute('viewBox') || `0 0 ${svg.getAttribute('width')} ${svg.getAttribute('height')}`).split(/\s+/).map(Number);
  const [vx, vy, vw, vh] = vb;
  return { x: vx + ((x - rect.left) / rect.width) * vw, y: vy + ((y - rect.top) / rect.height) * vh };
}
function tagShape(el, idx) { el.setAttribute('data-shape', 'true'); el.setAttribute('data-idx', idx); }
function nextIdx() { return String(state.nextIdx++); }

// ---- Icon list ----
function renderIconList() {
  const q = sSearch.value.toLowerCase();
  const list = state.icons.filter(i => !q || i.name.toLowerCase().includes(q));
  const frag = document.createDocumentFragment();
  for (const icon of list) {
    const item = document.createElement('div');
    const active = state.selectedIcon?.name === icon.name && state.selectedIcon?.category === icon.category;
    item.className = 'icon-list-item' + (active ? ' active' : '');
    item.innerHTML = `${recolor(icon.svg, 'currentColor')}<div class="flex-1 min-w-0"><div class="n">${icon.name}</div><div class="cat">${icon.category}</div></div>`;
    item.addEventListener('click', () => loadIntoStudio(icon));
    frag.appendChild(item);
  }
  iconList.replaceChildren(frag);
}
sSearch.addEventListener('input', renderIconList);

// ---- Load icon ----
function loadIntoStudio(icon) {
  state.selectedIcon = icon;
  state.original = icon.svg;
  state.selectedEl = null;
  state.history = { past: [], future: [] };
  parseAndMount(icon.svg);
  const first = state.svgDoc?.querySelector('[data-shape]');
  if (first) {
    state.selectedEl = first.getAttribute('data-idx');
    applySelection();
  }
  nameEl.textContent = `${icon.category} / ${icon.name}`;
  canvasLabel.textContent = icon.name;
  history.replaceState(null, '', `/studio?icon=${encodeURIComponent(icon.category + '/' + icon.name)}`);
  renderIconList();
  renderTree();
  renderProps();
  updateHistoryButtons();
  renderHandles();
}

function parseAndMount(svgString) {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  const svg = doc.documentElement;
  state.nextIdx = 0;
  svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line').forEach(el => {
    tagShape(el, nextIdx());
  });
  state.svgDoc = svg;
  mountCanvas();
}

function mountCanvas() {
  canvasHost.innerHTML = '';
  if (!state.svgDoc) return;
  const svg = state.svgDoc.cloneNode(true);
  const size = 48 * state.zoom;
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('id', 'canvas');
  svg.querySelectorAll('[data-shape]').forEach(el => el.addEventListener('pointerdown', onShapePointerDown));
  svg.addEventListener('pointerdown', onCanvasPointerDown);
  canvasHost.appendChild(svg);
  applySelection();
  updateCanvasCursor();
  renderHandles();
}
function currentCanvasSvg() { return canvasHost.querySelector('svg'); }
function updateCanvasCursor() {
  const svg = currentCanvasSvg();
  if (svg) svg.style.cursor = state.tool === 'select' ? 'default' : 'crosshair';
}

function selectElement(idx) {
  state.selectedEl = idx;
  applySelection();
  renderTree();
  renderProps();
  renderHandles();
}
function applySelection() {
  const svg = currentCanvasSvg();
  if (!svg) return;
  svg.querySelectorAll('[data-shape]').forEach(el => {
    el.classList.toggle('selected', el.getAttribute('data-idx') === String(state.selectedEl));
  });
}

// ---- Selection handles overlay ----
function renderHandles() {
  handlesEl.innerHTML = '';
  if (state.selectedEl === null) return;
  const svg = currentCanvasSvg();
  if (!svg) return;
  const el = svg.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (!el) return;
  let bbox;
  try { bbox = el.getBBox(); } catch { return; }
  const ctm = el.getScreenCTM();
  if (!ctm) return;
  const wrapRect = canvasWrap.getBoundingClientRect();

  const toLocal = (x, y) => {
    const pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    const p = pt.matrixTransform(ctm);
    return { x: p.x - wrapRect.left, y: p.y - wrapRect.top };
  };
  // All four corners in local (overlay) coords — handles rotation/skew safely
  const corners = [
    toLocal(bbox.x, bbox.y),
    toLocal(bbox.x + bbox.width, bbox.y),
    toLocal(bbox.x, bbox.y + bbox.height),
    toLocal(bbox.x + bbox.width, bbox.y + bbox.height),
  ];
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const w = right - left;
  const h = bottom - top;

  // Axis-aligned bounding rect (matches Figma's selection frame)
  const border = document.createElement('div');
  border.className = 'sel-border';
  border.style.left = left + 'px';
  border.style.top = top + 'px';
  border.style.width = w + 'px';
  border.style.height = h + 'px';
  handlesEl.appendChild(border);

  // Corner handles on the axis-aligned box (interactive: drag to resize)
  const cornerPts = [
    { x: left, y: top, id: 'tl' },
    { x: right, y: top, id: 'tr' },
    { x: left, y: bottom, id: 'bl' },
    { x: right, y: bottom, id: 'br' },
  ];
  for (const c of cornerPts) {
    const hEl = document.createElement('div');
    hEl.className = 'handle';
    hEl.dataset.corner = c.id;
    hEl.style.left = c.x + 'px';
    hEl.style.top = c.y + 'px';
    hEl.addEventListener('pointerdown', (ev) => onHandlePointerDown(c.id, ev));
    handlesEl.appendChild(hEl);
  }

  const label = document.createElement('div');
  label.className = 'm-label';
  label.textContent = `${bbox.width.toFixed(1)} × ${bbox.height.toFixed(1)}`;
  label.style.left = (left + w / 2) + 'px';
  label.style.top = (bottom + 8) + 'px';
  handlesEl.appendChild(label);
}

// ---- Tools palette ----
function setTool(tool) {
  state.tool = tool;
  paletteEl.querySelectorAll('button[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  updateCanvasCursor();
}
paletteEl.querySelectorAll('button[data-tool]').forEach(btn => btn.addEventListener('click', () => setTool(btn.dataset.tool)));

// ---- Canvas pointerdown ----
function onCanvasPointerDown(e) {
  if (e.target.closest('[data-shape]')) return;
  if (state.tool === 'select') { selectElement(null); return; }
  beginDraw(e);
}

// ---- History ----
let pendingBaseline = null;
function snapshot() {
  if (!state.svgDoc) return null;
  return { svg: new XMLSerializer().serializeToString(state.svgDoc), sel: state.selectedEl, nextIdx: state.nextIdx };
}
function markBaseline() { pendingBaseline = snapshot(); }
function commitIfChanged() {
  if (!pendingBaseline) return;
  const now = snapshot();
  if (!now || now.svg === pendingBaseline.svg) { pendingBaseline = null; return; }
  state.history.past.push(pendingBaseline);
  if (state.history.past.length > HISTORY_LIMIT) state.history.past.shift();
  state.history.future.length = 0;
  pendingBaseline = null;
  updateHistoryButtons();
}
function withEdit(fn) { markBaseline(); fn(); commitIfChanged(); }
function restore(snap) {
  const doc = new DOMParser().parseFromString(snap.svg, 'image/svg+xml');
  state.svgDoc = doc.documentElement;
  state.selectedEl = snap.sel;
  state.nextIdx = snap.nextIdx ?? state.nextIdx;
  mountCanvas();
  renderTree();
  renderProps();
}
function undo() {
  const h = state.history;
  if (h.past.length === 0) return;
  const cur = snapshot();
  const prev = h.past.pop();
  if (cur) h.future.push(cur);
  restore(prev);
  updateHistoryButtons();
}
function redo() {
  const h = state.history;
  if (h.future.length === 0) return;
  const cur = snapshot();
  const next = h.future.pop();
  if (cur) h.past.push(cur);
  restore(next);
  updateHistoryButtons();
}
function updateHistoryButtons() {
  undoBtn.disabled = state.history.past.length === 0;
  redoBtn.disabled = state.history.future.length === 0;
}
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

// ---- Shape drag ----
let dragCtx = null;
function onShapePointerDown(e) {
  e.stopPropagation();
  if (state.tool !== 'select') return;
  const idx = e.currentTarget.getAttribute('data-idx');
  selectElement(idx);
  const svg = currentCanvasSvg();
  const pt = clientToSvg(svg, e.clientX, e.clientY);
  const el = e.currentTarget;
  const existing = parseTranslate(el.getAttribute('transform') || '');
  markBaseline();
  dragCtx = { el, startX: pt.x, startY: pt.y, baseTx: existing.x, baseTy: existing.y };
  el.setPointerCapture(e.pointerId);
  el.addEventListener('pointermove', onShapePointerMove);
  el.addEventListener('pointerup', onShapePointerUp, { once: true });
}
function onShapePointerMove(e) {
  if (!dragCtx) return;
  const svg = currentCanvasSvg();
  const pt = clientToSvg(svg, e.clientX, e.clientY);
  const nx = dragCtx.baseTx + (pt.x - dragCtx.startX);
  const ny = dragCtx.baseTy + (pt.y - dragCtx.startY);
  setTranslate(dragCtx.el, nx, ny);
  syncElementToDoc(dragCtx.el);
  renderProps();
  renderHandles();
}
function onShapePointerUp(e) {
  if (dragCtx?.el) dragCtx.el.releasePointerCapture(e.pointerId);
  dragCtx = null;
  commitIfChanged();
}
function syncElementToDoc(el) {
  const idx = el.getAttribute('data-idx');
  const target = state.svgDoc.querySelector(`[data-idx="${idx}"]`);
  if (!target) return;
  for (const attr of el.attributes) target.setAttribute(attr.name, attr.value);
}

// ---- Resize (corner handles) ----
// Replaces the element's translate()+scale() while preserving any other
// transform components. Non-uniform scale is applied by default; hold Shift
// on the pointer to constrain proportionally.
function setTransformResize(el, tx, ty, sx, sy) {
  const cur = el.getAttribute('transform') || '';
  const stripped = cur
    .replace(/translate\([^)]*\)\s*/g, '')
    .replace(/scale\([^)]*\)\s*/g, '')
    .trim();
  const newT = `translate(${tx.toFixed(3)}, ${ty.toFixed(3)}) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
  el.setAttribute('transform', stripped ? `${newT} ${stripped}` : newT);
}

let resizeCtx = null;
function onHandlePointerDown(corner, e) {
  e.stopPropagation();
  e.preventDefault();
  if (state.selectedEl === null) return;
  const canvas = currentCanvasSvg();
  const src = state.svgDoc.querySelector(`[data-idx="${state.selectedEl}"]`);
  const live = canvas?.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (!src || !live) return;

  let bbox;
  try { bbox = live.getBBox(); } catch { return; }
  if (bbox.width <= 0 || bbox.height <= 0) return;

  markBaseline();

  // Effective (post-transform) bbox in the parent's coord space.
  const startPt = clientToSvg(canvas, e.clientX, e.clientY);
  const ctm = live.getCTM(); // element's transform relative to its nearest viewport
  const pt = canvas.createSVGPoint();
  function toParent(x, y) {
    pt.x = x; pt.y = y;
    const p = pt.matrixTransform(ctm);
    return { x: p.x, y: p.y };
  }
  const c00 = toParent(bbox.x, bbox.y);
  const c11 = toParent(bbox.x + bbox.width, bbox.y + bbox.height);
  const effLeft = Math.min(c00.x, c11.x);
  const effTop = Math.min(c00.y, c11.y);
  const effRight = Math.max(c00.x, c11.x);
  const effBottom = Math.max(c00.y, c11.y);

  // Anchor = corner opposite the one grabbed.
  let anchorX = 0, anchorY = 0;
  if (corner === 'tl') { anchorX = effRight; anchorY = effBottom; }
  else if (corner === 'tr') { anchorX = effLeft; anchorY = effBottom; }
  else if (corner === 'bl') { anchorX = effRight; anchorY = effTop; }
  else if (corner === 'br') { anchorX = effLeft; anchorY = effTop; }

  resizeCtx = {
    corner, src, live, bbox,
    anchorX, anchorY,
    startPt,
    aspect: bbox.width / bbox.height,
  };
  window.addEventListener('pointermove', onResizeMove);
  window.addEventListener('pointerup', onResizeEnd, { once: true });
}
function onResizeMove(e) {
  if (!resizeCtx) return;
  const canvas = currentCanvasSvg();
  if (!canvas) return;
  const pt = clientToSvg(canvas, e.clientX, e.clientY);
  let { bbox, anchorX, anchorY, aspect, src, live } = resizeCtx;

  let dx = pt.x - anchorX;
  let dy = pt.y - anchorY;

  if (e.shiftKey) {
    // Constrain to the original aspect ratio.
    const abs = Math.max(Math.abs(dx), Math.abs(dy));
    const sx = Math.sign(dx) || 1;
    const sy = Math.sign(dy) || 1;
    if (Math.abs(dx) / Math.abs(dy || 1) > aspect) {
      dy = sy * (abs / aspect);
    } else {
      dx = sx * (abs * aspect);
    }
  }

  const newLeft = Math.min(anchorX + dx, anchorX);
  const newTop = Math.min(anchorY + dy, anchorY);
  const newWidth = Math.abs(dx);
  const newHeight = Math.abs(dy);

  if (newWidth < 0.5 || newHeight < 0.5) return;

  const sx = newWidth / bbox.width;
  const sy = newHeight / bbox.height;
  const tx = newLeft - bbox.x * sx;
  const ty = newTop - bbox.y * sy;

  setTransformResize(src, tx, ty, sx, sy);
  setTransformResize(live, tx, ty, sx, sy);

  renderProps();
  renderHandles();
}
function onResizeEnd() {
  window.removeEventListener('pointermove', onResizeMove);
  resizeCtx = null;
  commitIfChanged();
}

// ---- Drawing ----
let drawCtx = null;
function createDrawElement(tool, pt) {
  const doc = state.svgDoc.ownerDocument;
  switch (tool) {
    case 'rect': {
      const el = doc.createElementNS(SVG_NS, 'rect');
      el.setAttribute('x', pt.x); el.setAttribute('y', pt.y);
      el.setAttribute('width', 0); el.setAttribute('height', 0);
      el.setAttribute('fill', 'currentColor');
      return el;
    }
    case 'ellipse': {
      const el = doc.createElementNS(SVG_NS, 'ellipse');
      el.setAttribute('cx', pt.x); el.setAttribute('cy', pt.y);
      el.setAttribute('rx', 0); el.setAttribute('ry', 0);
      el.setAttribute('fill', 'currentColor');
      return el;
    }
    case 'line': {
      const el = doc.createElementNS(SVG_NS, 'line');
      el.setAttribute('x1', pt.x); el.setAttribute('y1', pt.y);
      el.setAttribute('x2', pt.x); el.setAttribute('y2', pt.y);
      el.setAttribute('stroke', 'currentColor'); el.setAttribute('stroke-width', '1'); el.setAttribute('fill', 'none');
      return el;
    }
  }
  return null;
}
function updateDrawShape(el, tool, start, current) {
  switch (tool) {
    case 'rect':
      el.setAttribute('x', Math.min(start.x, current.x));
      el.setAttribute('y', Math.min(start.y, current.y));
      el.setAttribute('width', Math.abs(current.x - start.x));
      el.setAttribute('height', Math.abs(current.y - start.y));
      break;
    case 'ellipse':
      el.setAttribute('cx', (start.x + current.x) / 2);
      el.setAttribute('cy', (start.y + current.y) / 2);
      el.setAttribute('rx', Math.abs(current.x - start.x) / 2);
      el.setAttribute('ry', Math.abs(current.y - start.y) / 2);
      break;
    case 'line':
      el.setAttribute('x2', current.x);
      el.setAttribute('y2', current.y);
      break;
  }
}
function isDegenerate(tool, start, current) {
  const dx = Math.abs(current.x - start.x);
  const dy = Math.abs(current.y - start.y);
  if (tool === 'line') return dx < 0.5 && dy < 0.5;
  return dx < 0.5 || dy < 0.5;
}
function beginDraw(e) {
  const canvas = currentCanvasSvg();
  const pt = clientToSvg(canvas, e.clientX, e.clientY);
  markBaseline();
  const el = createDrawElement(state.tool, pt);
  if (!el) { pendingBaseline = null; return; }
  const idx = nextIdx();
  tagShape(el, idx);
  state.svgDoc.appendChild(el);
  drawCtx = { tool: state.tool, startPt: pt, idx };
  mountCanvas();
  selectElement(idx);
  window.addEventListener('pointermove', onDrawMove);
  window.addEventListener('pointerup', onDrawEnd, { once: true });
}
function onDrawMove(e) {
  if (!drawCtx) return;
  const canvas = currentCanvasSvg();
  if (!canvas) return;
  const pt = clientToSvg(canvas, e.clientX, e.clientY);
  const src = state.svgDoc.querySelector(`[data-idx="${drawCtx.idx}"]`);
  const live = canvas.querySelector(`[data-idx="${drawCtx.idx}"]`);
  if (src) updateDrawShape(src, drawCtx.tool, drawCtx.startPt, pt);
  if (live) updateDrawShape(live, drawCtx.tool, drawCtx.startPt, pt);
  renderProps();
  renderHandles();
}
function onDrawEnd(e) {
  window.removeEventListener('pointermove', onDrawMove);
  if (!drawCtx) return;
  const canvas = currentCanvasSvg();
  const pt = clientToSvg(canvas, e.clientX, e.clientY);
  if (isDegenerate(drawCtx.tool, drawCtx.startPt, pt)) {
    state.svgDoc.querySelector(`[data-idx="${drawCtx.idx}"]`)?.remove();
    pendingBaseline = null;
    state.selectedEl = null;
    mountCanvas();
    renderTree();
    renderProps();
  } else {
    commitIfChanged();
  }
  drawCtx = null;
  setTool('select');
}

// ---- Tree ----
const TAG_ICONS = {
  path: 'polyline', rect: 'crop_square', circle: 'circle',
  ellipse: 'circle', line: 'horizontal_rule',
  polygon: 'change_history', polyline: 'polyline',
};
function renderTree() {
  if (!state.svgDoc) { treeEl.innerHTML = '<div class="text-on-surface-variant/60 text-center py-4">Load an icon.</div>'; if (treeCountEl) treeCountEl.textContent = '0'; return; }
  const shapes = state.svgDoc.querySelectorAll('[data-shape]');
  if (treeCountEl) treeCountEl.textContent = String(shapes.length);
  if (shapes.length === 0) { treeEl.innerHTML = '<div class="text-on-surface-variant/60 text-center py-4">No shapes.</div>'; return; }
  const frag = document.createDocumentFragment();
  shapes.forEach(el => {
    const idx = el.getAttribute('data-idx');
    const tag = el.tagName.toLowerCase();
    const node = document.createElement('div');
    node.className = 'tree-node' + (idx === String(state.selectedEl) ? ' selected' : '');
    node.innerHTML = `<span class="idx">${String(idx).padStart(2, '0')}</span><span class="material-symbols-outlined" style="font-size:14px;">${TAG_ICONS[tag] || 'category'}</span><span>${tag}</span>`;
    node.addEventListener('click', () => selectElement(idx));
    frag.appendChild(node);
  });
  treeEl.replaceChildren(frag);
}

// ---- Clipboard / duplicate / delete / layer order ----
function copySelection() {
  if (state.selectedEl === null) return;
  const el = state.svgDoc.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (!el) return;
  state.clipboard = new XMLSerializer().serializeToString(el);
  showToast('Copied');
}
function paste(offset = 10) {
  if (!state.clipboard) return;
  const wrapper = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}">${state.clipboard}</svg>`, 'image/svg+xml');
  const src = wrapper.documentElement.firstElementChild;
  if (!src) return;
  markBaseline();
  const imported = state.svgDoc.ownerDocument.importNode(src, true);
  const idx = nextIdx();
  tagShape(imported, idx);
  const existingT = imported.getAttribute('transform') || '';
  imported.setAttribute('transform', `translate(${offset}, ${offset}) ${existingT}`.trim());
  state.svgDoc.appendChild(imported);
  state.selectedEl = idx;
  mountCanvas();
  renderTree();
  renderProps();
  commitIfChanged();
  showToast('Pasted');
}
function duplicateSelection() { if (state.selectedEl === null) return; copySelection(); paste(); }
function deleteSelection() {
  if (state.selectedEl === null) return;
  markBaseline();
  state.svgDoc.querySelector(`[data-idx="${state.selectedEl}"]`)?.remove();
  state.selectedEl = null;
  mountCanvas();
  renderTree();
  renderProps();
  commitIfChanged();
}
function bringToFront() {
  if (state.selectedEl === null) return;
  const el = state.svgDoc.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (!el?.parentNode) return;
  markBaseline(); el.parentNode.appendChild(el); mountCanvas(); commitIfChanged();
}
function sendToBack() {
  if (state.selectedEl === null) return;
  const el = state.svgDoc.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (!el?.parentNode) return;
  markBaseline(); el.parentNode.insertBefore(el, el.parentNode.firstChild); mountCanvas(); commitIfChanged();
}
function bringForward() {
  if (state.selectedEl === null) return;
  const el = state.svgDoc.querySelector(`[data-idx="${state.selectedEl}"]`);
  const next = el?.nextElementSibling;
  if (!next) return;
  markBaseline(); el.parentNode.insertBefore(next, el); mountCanvas(); commitIfChanged();
}
function sendBackward() {
  if (state.selectedEl === null) return;
  const el = state.svgDoc.querySelector(`[data-idx="${state.selectedEl}"]`);
  const prev = el?.previousElementSibling;
  if (!prev) return;
  markBaseline(); el.parentNode.insertBefore(el, prev); mountCanvas(); commitIfChanged();
}

toolDuplicateBtn.addEventListener('click', duplicateSelection);
toolDeleteBtn.addEventListener('click', deleteSelection);

// ---- Nudge ----
let nudgeTimer = null;
function nudge(dx, dy) {
  if (state.selectedEl === null) return;
  const target = state.svgDoc.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (!target) return;
  if (!nudgeTimer) markBaseline();
  clearTimeout(nudgeTimer);
  const cur = parseTranslate(target.getAttribute('transform') || '');
  setTranslate(target, cur.x + dx, cur.y + dy);
  const live = currentCanvasSvg()?.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (live) setTranslate(live, cur.x + dx, cur.y + dy);
  renderProps(); renderHandles();
  nudgeTimer = setTimeout(() => { commitIfChanged(); nudgeTimer = null; }, 500);
}

// ---- Keyboard shortcuts ----
window.addEventListener('keydown', (e) => {
  const tgt = e.target;
  const inInput = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT');
  const mod = e.ctrlKey || e.metaKey;

  if (mod) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); return; }
    if (!inInput) {
      if (k === 'c') { e.preventDefault(); copySelection(); return; }
      if (k === 'v') { e.preventDefault(); paste(); return; }
      if (k === 'd') { e.preventDefault(); duplicateSelection(); return; }
      if (k === ']') { e.preventDefault(); e.shiftKey ? bringToFront() : bringForward(); return; }
      if (k === '[') { e.preventDefault(); e.shiftKey ? sendToBack() : sendBackward(); return; }
    }
    return;
  }
  if (inInput) return;
  const toolKeys = { v: 'select', r: 'rect', o: 'ellipse', l: 'line' };
  if (toolKeys[e.key.toLowerCase()]) { e.preventDefault(); setTool(toolKeys[e.key.toLowerCase()]); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
  if (e.key.startsWith('Arrow') && state.selectedEl !== null) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    nudge(dx, dy);
  }
});

// ---- Alignment ----
function getEffectiveBBox(el) {
  const canvas = currentCanvasSvg();
  const live = canvas?.querySelector(`[data-idx="${el.getAttribute('data-idx')}"]`);
  if (!live) return null;
  let bbox;
  try { bbox = live.getBBox(); } catch { return null; }
  const ctm = live.getCTM();
  if (!ctm) return null;
  const pt = canvas.createSVGPoint();
  function toParent(x, y) { pt.x = x; pt.y = y; return pt.matrixTransform(ctm); }
  const p1 = toParent(bbox.x, bbox.y);
  const p2 = toParent(bbox.x + bbox.width, bbox.y + bbox.height);
  const left = Math.min(p1.x, p2.x), right = Math.max(p1.x, p2.x);
  const top = Math.min(p1.y, p2.y), bottom = Math.max(p1.y, p2.y);
  return { left, top, right, bottom, width: right - left, height: bottom - top, local: bbox };
}
function alignSelection(dir) {
  if (state.selectedEl === null) return;
  const target = state.svgDoc.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (!target) return;
  const eff = getEffectiveBBox(target);
  if (!eff) return;
  const vb = (state.svgDoc.getAttribute('viewBox') || `0 0 ${state.svgDoc.getAttribute('width') || 48} ${state.svgDoc.getAttribute('height') || 48}`).split(/\s+/).map(Number);
  const [vx, vy, vw, vh] = vb;

  let dx = 0, dy = 0;
  switch (dir) {
    case 'hleft': dx = vx - eff.left; break;
    case 'hcenter': dx = (vx + vw / 2) - (eff.left + eff.width / 2); break;
    case 'hright': dx = (vx + vw) - eff.right; break;
    case 'vtop': dy = vy - eff.top; break;
    case 'vcenter': dy = (vy + vh / 2) - (eff.top + eff.height / 2); break;
    case 'vbottom': dy = (vy + vh) - eff.bottom; break;
  }
  markBaseline();
  const cur = parseTranslate(target.getAttribute('transform') || '');
  setTranslate(target, cur.x + dx, cur.y + dy);
  const live = currentCanvasSvg()?.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (live) { const l = parseTranslate(live.getAttribute('transform') || ''); setTranslate(live, l.x + dx, l.y + dy); }
  renderProps(); renderHandles();
  commitIfChanged();
}
function resizeToDimensions(w, h) {
  if (state.selectedEl === null) return;
  const target = state.svgDoc.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (!target) return;
  const eff = getEffectiveBBox(target);
  if (!eff || !eff.local || eff.local.width <= 0 || eff.local.height <= 0) return;
  const canvas = currentCanvasSvg();
  const live = canvas?.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (!live) return;
  markBaseline();
  const sx = w / eff.local.width;
  const sy = h / eff.local.height;
  const tx = eff.left - eff.local.x * sx;
  const ty = eff.top - eff.local.y * sy;
  setTransformResize(target, tx, ty, sx, sy);
  setTransformResize(live, tx, ty, sx, sy);
  renderProps(); renderHandles();
  commitIfChanged();
}

// ---- Props panel (Material Design sections) ----
function renderProps() {
  const svg = state.svgDoc;
  if (!svg) { propsEl.innerHTML = '<div class="text-on-surface-variant/60 text-center py-8">Load an icon.</div>'; return; }

  const titleEl = svg.querySelector('title');
  const title = titleEl?.textContent || '';
  const iw = svg.getAttribute('width') || '';
  const ih = svg.getAttribute('height') || '';
  const viewBox = svg.getAttribute('viewBox') || '';

  let target = null;
  if (state.selectedEl !== null) target = svg.querySelector(`[data-idx="${state.selectedEl}"]`);

  let html = '';

  // Selection header
  const selName = target ? target.tagName.toLowerCase() : 'Icon';
  const selIcon = target ? (TAG_ICONS[selName] || 'category') : 'image';
  html += `<div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="w-5 h-5 bg-surface-container-highest rounded flex items-center justify-center">
        <span class="material-symbols-outlined" style="font-size:14px;">${selIcon}</span>
      </div>
      <span class="font-semibold text-[13px] text-on-surface">${selName}</span>
      ${target ? `<span class="text-[10px] font-mono text-on-surface-variant/50">#${state.selectedEl}</span>` : ''}
    </div>
    <div class="flex gap-1">
      ${target ? `
        <button class="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded" id="p-duplicate" title="Duplicate"><span class="material-symbols-outlined text-sm">content_copy</span></button>
        <button class="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded" id="p-remove" title="Remove"><span class="material-symbols-outlined text-sm">delete</span></button>
      ` : ''}
    </div>
  </div>`;

  if (target) {
    const fill = target.getAttribute('fill') || 'currentColor';
    const stroke = target.getAttribute('stroke') || '';
    const strokeWidth = target.getAttribute('stroke-width') || '';
    const opacity = target.getAttribute('opacity') || '1';
    const transform = target.getAttribute('transform') || '';
    const trans = parseTranslate(transform);
    const eff = getEffectiveBBox(target) || { width: 0, height: 0 };
    const fillIsCurrent = fill === 'currentColor';
    const fillColor = /^#[0-9a-fA-F]+$/.test(fill) ? fill : '#0d99ff';
    const strokeIsCurrent = stroke === 'currentColor';
    const strokeColor = /^#[0-9a-fA-F]+$/.test(stroke) ? stroke : '#000000';
    const isRect = target.tagName.toLowerCase() === 'rect';
    const rx = target.getAttribute('rx') || target.getAttribute('ry') || '';

    // Alignment
    html += `<div class="space-y-3 pt-4 border-t ui-border">
      <div class="p-title">Alignment</div>
      <div class="grid grid-cols-6 gap-1 p-1 bg-surface-container-lowest rounded-lg border border-outline-variant">
        <button class="align-btn" data-align="hleft"  title="Align left"><span class="material-symbols-outlined text-lg">align_horizontal_left</span></button>
        <button class="align-btn" data-align="hcenter" title="Align center"><span class="material-symbols-outlined text-lg">align_horizontal_center</span></button>
        <button class="align-btn" data-align="hright" title="Align right"><span class="material-symbols-outlined text-lg">align_horizontal_right</span></button>
        <button class="align-btn" data-align="vtop"   title="Align top"><span class="material-symbols-outlined text-lg">align_vertical_top</span></button>
        <button class="align-btn" data-align="vcenter" title="Align middle"><span class="material-symbols-outlined text-lg">align_vertical_center</span></button>
        <button class="align-btn" data-align="vbottom" title="Align bottom"><span class="material-symbols-outlined text-lg">align_vertical_bottom</span></button>
      </div>
    </div>`;

    // Position (X, Y) + Rounded corner (rect only)
    html += `<div class="space-y-3 pt-4 border-t ui-border">
      <div class="p-title">Position</div>
      <div class="grid grid-cols-2 gap-3">
        <div class="input-field rounded-lg px-3 py-2 flex items-center"><span class="text-on-surface-variant text-[11px] font-mono mr-2 w-4">X</span><input type="number" step="0.1" value="${trans.x}" id="p-tx" /></div>
        <div class="input-field rounded-lg px-3 py-2 flex items-center"><span class="text-on-surface-variant text-[11px] font-mono mr-2 w-4">Y</span><input type="number" step="0.1" value="${trans.y}" id="p-ty" /></div>
        ${isRect ? `<div class="input-field rounded-lg px-3 py-2 flex items-center"><span class="material-symbols-outlined text-sm text-on-surface-variant mr-2 w-4">rounded_corner</span><input type="number" step="0.5" min="0" value="${rx}" id="p-rx" placeholder="0" /></div>` : ''}
      </div>
    </div>`;

    // Dimensions (W, H) — editable, resizes proportionally
    html += `<div class="space-y-3 pt-4 border-t ui-border">
      <div class="flex items-center justify-between"><div class="p-title">Dimensions</div></div>
      <div class="grid grid-cols-2 gap-3">
        <div class="input-field rounded-lg px-3 py-2 flex items-center"><span class="text-on-surface-variant text-[11px] font-mono mr-2 w-4">W</span><input type="number" step="0.1" min="0.5" value="${eff.width.toFixed(2)}" id="p-w" /></div>
        <div class="input-field rounded-lg px-3 py-2 flex items-center"><span class="text-on-surface-variant text-[11px] font-mono mr-2 w-4">H</span><input type="number" step="0.1" min="0.5" value="${eff.height.toFixed(2)}" id="p-h" /></div>
      </div>
    </div>`;

    // Fill
    html += `<div class="space-y-2 pt-4 border-t ui-border">
      <div class="p-title">Fill</div>
      <div class="input-field rounded-lg px-2 py-1.5 flex items-center gap-2">
        <input type="color" value="${fillColor}" id="p-fill-color" ${fillIsCurrent ? 'disabled' : ''} />
        <input type="text" value="${escapeAttr(fill)}" id="p-fill-text" class="flex-1 font-mono text-[11px]" />
      </div>
      <label class="flex items-center gap-2 text-[11px] text-on-surface-variant cursor-pointer">
        <input type="checkbox" id="p-fill-current" ${fillIsCurrent ? 'checked' : ''} class="accent-primary" />
        Use <code class="text-primary font-mono">currentColor</code>
      </label>
    </div>`;

    // Stroke
    html += `<div class="space-y-2 pt-4 border-t ui-border">
      <div class="p-title">Stroke</div>
      <div class="input-field rounded-lg px-2 py-1.5 flex items-center gap-2">
        <input type="color" value="${strokeColor}" id="p-stroke-color" ${strokeIsCurrent || !stroke ? 'disabled' : ''} />
        <input type="text" value="${escapeAttr(stroke)}" id="p-stroke" placeholder="none / #hex" class="flex-1 font-mono text-[11px]" />
      </div>
      <div class="grid grid-cols-2 gap-3 mt-2">
        <div class="input-field rounded-lg px-3 py-2 flex items-center"><span class="text-on-surface-variant text-[11px] font-mono mr-2 w-4">W</span><input type="number" step="0.1" min="0" value="${strokeWidth}" id="p-stroke-w" /></div>
        <div class="input-field rounded-lg px-3 py-2 flex items-center"><span class="material-symbols-outlined text-sm text-on-surface-variant mr-2 w-4">opacity</span><input type="number" step="0.05" min="0" max="1" value="${opacity}" id="p-opacity" /></div>
      </div>
    </div>`;

    // Layer order
    html += `<div class="space-y-3 pt-4 border-t ui-border">
      <div class="p-title">Layer</div>
      <div class="grid grid-cols-4 gap-1 p-1 bg-surface-container-lowest rounded-lg border border-outline-variant">
        <button class="align-btn" id="p-to-back"   title="Send to back"><span class="material-symbols-outlined text-lg">vertical_align_bottom</span></button>
        <button class="align-btn" id="p-backward"  title="Send backward"><span class="material-symbols-outlined text-lg">arrow_downward</span></button>
        <button class="align-btn" id="p-forward"   title="Bring forward"><span class="material-symbols-outlined text-lg">arrow_upward</span></button>
        <button class="align-btn" id="p-to-front"  title="Bring to front"><span class="material-symbols-outlined text-lg">vertical_align_top</span></button>
      </div>
    </div>`;

    // Raw transform
    html += `<div class="space-y-2 pt-4 border-t ui-border">
      <div class="p-title">Transform</div>
      <div class="input-field rounded-lg px-3 py-2 flex items-center"><span class="material-symbols-outlined text-sm text-on-surface-variant mr-2 w-4">transform</span><input type="text" value="${escapeAttr(transform)}" id="p-transform" placeholder="translate(0,0)" class="font-mono text-[11px]" /></div>
      <button class="w-full py-1.5 bg-surface-container-highest hover:bg-surface-bright rounded-lg text-[11px] font-medium text-on-surface border border-outline-variant" id="p-clear-t">Clear transform</button>
    </div>`;
  } else {
    html += `<div class="text-on-surface-variant/60 text-center py-6 leading-relaxed text-[11px]">
      Select a shape on the canvas or in the tree to edit its properties, or pick a draw tool from the palette to create a new shape.
    </div>`;
  }

  // Icon Root — always shown
  html += `<div class="space-y-3 pt-4 border-t ui-border">
    <div class="p-title">Icon Root</div>
    <div class="input-field rounded-lg px-3 py-2 flex items-center"><span class="material-symbols-outlined text-sm text-on-surface-variant mr-2 w-4">title</span><input type="text" value="${escapeAttr(title)}" id="p-icon-title" placeholder="accessible title" /></div>
    <div class="grid grid-cols-2 gap-3">
      <div class="input-field rounded-lg px-3 py-2 flex items-center"><span class="text-on-surface-variant text-[11px] font-mono mr-2 w-4">W</span><input type="number" min="1" step="1" value="${iw}" id="p-icon-w" /></div>
      <div class="input-field rounded-lg px-3 py-2 flex items-center"><span class="text-on-surface-variant text-[11px] font-mono mr-2 w-4">H</span><input type="number" min="1" step="1" value="${ih}" id="p-icon-h" /></div>
    </div>
    <div class="input-field rounded-lg px-3 py-2 flex items-center"><span class="material-symbols-outlined text-sm text-on-surface-variant mr-2 w-4">crop_free</span><input type="text" value="${escapeAttr(viewBox)}" id="p-icon-vb" placeholder="0 0 48 48" class="font-mono text-[11px]" /></div>
  </div>`;

  // Export
  html += `<div class="space-y-2 pt-4 border-t ui-border">
    <div class="p-title">Export</div>
    <div class="grid grid-cols-2 gap-2">
      <button id="p-copy-svg" class="py-2 bg-surface-container-highest hover:bg-surface-bright rounded-lg text-[11px] font-semibold text-on-surface border border-outline-variant flex items-center justify-center gap-1"><span class="material-symbols-outlined" style="font-size:14px;">content_copy</span>Copy</button>
      <button id="p-download-svg" class="py-2 bg-surface-container-highest hover:bg-surface-bright rounded-lg text-[11px] font-semibold text-on-surface border border-outline-variant flex items-center justify-center gap-1"><span class="material-symbols-outlined" style="font-size:14px;">download</span>SVG</button>
    </div>
    <button id="p-save-json" class="w-full py-2 bg-primary hover:opacity-90 rounded-lg text-[12px] font-semibold text-white flex items-center justify-center gap-1.5"><span class="material-symbols-outlined" style="font-size:16px;">save</span>Save as &lt;category&gt;/&lt;name&gt;.json</button>
  </div>`;

  propsEl.innerHTML = html;

  // Alignment buttons
  propsEl.querySelectorAll('button[data-align]').forEach(b => b.addEventListener('click', () => alignSelection(b.dataset.align)));

  // Wire icon-root
  const setSvgAttr = (name, val) => {
    if (val === '' || val == null) svg.removeAttribute(name); else svg.setAttribute(name, val);
    const live = currentCanvasSvg();
    if (live) { if (val === '' || val == null) live.removeAttribute(name); else live.setAttribute(name, val); }
  };
  const setTitle = (val) => {
    let t = svg.querySelector('title');
    if (!val) { if (t) t.remove(); return; }
    if (!t) { t = svg.ownerDocument.createElementNS(SVG_NS, 'title'); svg.insertBefore(t, svg.firstChild); }
    t.textContent = val;
  };
  ['p-icon-title', 'p-icon-w', 'p-icon-h', 'p-icon-vb'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('focus', markBaseline);
    el.addEventListener('change', commitIfChanged);
  });
  document.getElementById('p-icon-title').addEventListener('input', e => setTitle(e.target.value));
  document.getElementById('p-icon-w').addEventListener('input', e => setSvgAttr('width', e.target.value));
  document.getElementById('p-icon-h').addEventListener('input', e => setSvgAttr('height', e.target.value));
  document.getElementById('p-icon-vb').addEventListener('input', e => setSvgAttr('viewBox', e.target.value));

  // Wire header action buttons (only present when a shape is selected)
  document.getElementById('p-duplicate')?.addEventListener('click', duplicateSelection);
  document.getElementById('p-remove')?.addEventListener('click', deleteSelection);

  // Export buttons (always present)
  document.getElementById('p-copy-svg')?.addEventListener('click', () => copyBtn.click());
  document.getElementById('p-download-svg')?.addEventListener('click', downloadSvgFile);
  document.getElementById('p-save-json')?.addEventListener('click', openSaveDialog);

  if (!target) return;

  // Layer order buttons (only present when selected)
  document.getElementById('p-to-front')?.addEventListener('click', bringToFront);
  document.getElementById('p-to-back')?.addEventListener('click', sendToBack);
  document.getElementById('p-forward')?.addEventListener('click', bringForward);
  document.getElementById('p-backward')?.addEventListener('click', sendBackward);

  // W/H dimension inputs — resize the selection to the target dimensions
  const wEl = document.getElementById('p-w');
  const hEl = document.getElementById('p-h');
  if (wEl && hEl) {
    const commit = () => {
      const w = parseFloat(wEl.value); const h = parseFloat(hEl.value);
      if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return;
      resizeToDimensions(w, h);
    };
    wEl.addEventListener('change', commit);
    hEl.addEventListener('change', commit);
  }

  // Corner radius (rect only)
  const rxEl = document.getElementById('p-rx');
  rxEl?.addEventListener('focus', markBaseline);
  rxEl?.addEventListener('change', commitIfChanged);
  rxEl?.addEventListener('input', e => {
    const v = e.target.value;
    if (v === '' || +v === 0) { target.removeAttribute('rx'); target.removeAttribute('ry'); }
    else { target.setAttribute('rx', v); target.setAttribute('ry', v); }
    const live = currentCanvasSvg()?.querySelector(`[data-idx="${state.selectedEl}"]`);
    if (live) {
      if (v === '' || +v === 0) { live.removeAttribute('rx'); live.removeAttribute('ry'); }
      else { live.setAttribute('rx', v); live.setAttribute('ry', v); }
    }
  });

  const setAttr = (name, val) => {
    if (val === '' || val == null) target.removeAttribute(name); else target.setAttribute(name, val);
    const live = currentCanvasSvg()?.querySelector(`[data-idx="${state.selectedEl}"]`);
    if (live) { if (val === '' || val == null) live.removeAttribute(name); else live.setAttribute(name, val); }
  };
  ['p-fill-color', 'p-fill-text', 'p-stroke', 'p-stroke-color', 'p-stroke-w', 'p-opacity', 'p-tx', 'p-ty', 'p-transform'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('focus', markBaseline);
    el.addEventListener('pointerdown', markBaseline);
    el.addEventListener('change', commitIfChanged);
  });
  document.getElementById('p-fill-color').addEventListener('input', e => { setAttr('fill', e.target.value); document.getElementById('p-fill-text').value = e.target.value; });
  document.getElementById('p-fill-text').addEventListener('input', e => { setAttr('fill', e.target.value); renderHandles(); });
  document.getElementById('p-fill-current').addEventListener('change', e => withEdit(() => {
    if (e.target.checked) setAttr('fill', 'currentColor');
    else setAttr('fill', document.getElementById('p-fill-color').value);
    renderProps();
  }));
  document.getElementById('p-stroke').addEventListener('input', e => { setAttr('stroke', e.target.value); renderProps(); });
  document.getElementById('p-stroke-color').addEventListener('input', e => { setAttr('stroke', e.target.value); renderProps(); });
  document.getElementById('p-stroke-w').addEventListener('input', e => setAttr('stroke-width', e.target.value));
  document.getElementById('p-opacity').addEventListener('input', e => setAttr('opacity', e.target.value));
  document.getElementById('p-tx').addEventListener('input', e => {
    const y = parseFloat(document.getElementById('p-ty').value) || 0;
    setTranslate(target, parseFloat(e.target.value) || 0, y);
    const live = currentCanvasSvg()?.querySelector(`[data-idx="${state.selectedEl}"]`);
    if (live) setTranslate(live, parseFloat(e.target.value) || 0, y);
    renderHandles();
  });
  document.getElementById('p-ty').addEventListener('input', e => {
    const x = parseFloat(document.getElementById('p-tx').value) || 0;
    setTranslate(target, x, parseFloat(e.target.value) || 0);
    const live = currentCanvasSvg()?.querySelector(`[data-idx="${state.selectedEl}"]`);
    if (live) setTranslate(live, x, parseFloat(e.target.value) || 0);
    renderHandles();
  });
  document.getElementById('p-transform').addEventListener('input', e => { setAttr('transform', e.target.value); renderHandles(); });
  document.getElementById('p-clear-t').addEventListener('click', () => withEdit(() => { setAttr('transform', null); renderProps(); renderHandles(); }));
}

// ---- Toolbar ----
function setZoom(z) {
  state.zoom = Math.max(1, Math.min(12, z));
  const pct = `${Math.round(state.zoom * 100)}%`;
  zoomLabel.textContent = pct;
  if (zoomDisplay) zoomDisplay.textContent = pct;
  mountCanvas();
}
zoomInBtn?.addEventListener('click', () => setZoom(state.zoom + 1));
zoomOutBtn?.addEventListener('click', () => setZoom(state.zoom - 1));
setZoom(state.zoom);
resetBtn.addEventListener('click', () => { if (state.selectedIcon) loadIntoStudio({ ...state.selectedIcon, svg: state.original }); });
centerBtn.addEventListener('click', () => withEdit(() => {
  if (state.selectedEl === null) return;
  const target = state.svgDoc.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (!target) return;
  target.removeAttribute('transform');
  const live = currentCanvasSvg()?.querySelector(`[data-idx="${state.selectedEl}"]`);
  if (live) live.removeAttribute('transform');
  renderProps(); renderHandles();
}));

function serializeStudio() {
  if (!state.svgDoc) return '';
  const clone = state.svgDoc.cloneNode(true);
  clone.querySelectorAll('[data-shape]').forEach(el => {
    el.removeAttribute('data-shape');
    el.removeAttribute('data-idx');
    el.classList.remove('selected');
    if (el.getAttribute('class') === '') el.removeAttribute('class');
  });
  return new XMLSerializer().serializeToString(clone);
}
copyBtn.addEventListener('click', async () => {
  const svg = serializeStudio();
  if (!svg) return;
  await navigator.clipboard.writeText(svg);
  showToast('Copied SVG');
});
function downloadSvgFile() {
  const svg = serializeStudio();
  if (!svg) return;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.selectedIcon?.name || 'icon'}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Save as JSON (matches repo's <category>/<name>.json format) ----
const saveDialog = document.getElementById('save-dialog');
const saveName = document.getElementById('save-name');
const saveCat = document.getElementById('save-category');
const saveNewCatWrap = document.getElementById('save-new-cat-wrap');
const saveNewCat = document.getElementById('save-new-cat');
const savePreview = document.getElementById('save-preview-path');
const saveConfirm = document.getElementById('save-confirm');

function openSaveDialog() {
  if (!state.svgDoc) { showToast('Load an icon first'); return; }

  // Build category list from what we know about the repo.
  saveCat.innerHTML = '';
  const cats = new Set(
    state.categories.map(c => c.name).filter(n => n && n !== 'custom')
  );
  // Sensible defaults so an empty repo still offers targets.
  cats.add('brands');
  cats.add('regular');
  for (const cat of Array.from(cats).sort()) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    saveCat.appendChild(opt);
  }
  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '+ New category…';
  saveCat.appendChild(newOpt);

  // Sensible defaults.
  const cur = state.selectedIcon;
  let defaultName = cur?.name || '';
  if (/^untitled-\d+$/.test(defaultName)) defaultName = '';
  saveName.value = defaultName;
  if (cur?.category && cats.has(cur.category)) saveCat.value = cur.category;
  else saveCat.value = 'brands';
  saveNewCatWrap.classList.add('hidden');
  saveNewCat.value = '';

  updateSavePreview();
  saveDialog.showModal();
  saveName.focus();
  saveName.select?.();
}

function updateSavePreview() {
  const name = (saveName.value || '').trim() || 'icon';
  const cat = saveCat.value === '__new__'
    ? (saveNewCat.value || '').trim() || 'category'
    : saveCat.value;
  savePreview.textContent = `${cat}/${name}.json`;
}
saveName.addEventListener('input', updateSavePreview);
saveNewCat.addEventListener('input', updateSavePreview);
saveCat.addEventListener('change', () => {
  const isNew = saveCat.value === '__new__';
  saveNewCatWrap.classList.toggle('hidden', !isNew);
  if (isNew) saveNewCat.focus();
  updateSavePreview();
});

function validateSlug(s) { return /^[a-z0-9][a-z0-9-]*$/.test(s); }

saveConfirm.addEventListener('click', () => {
  const name = (saveName.value || '').trim().toLowerCase();
  const cat = (saveCat.value === '__new__'
    ? (saveNewCat.value || '').trim().toLowerCase()
    : saveCat.value);
  if (!validateSlug(name)) { showToast('Invalid name (a-z, 0-9, hyphens)'); saveName.focus(); return; }
  if (!validateSlug(cat)) { showToast('Invalid category name'); (saveCat.value === '__new__' ? saveNewCat : saveCat).focus(); return; }

  const svgContent = serializeStudio();
  if (!svgContent) return;
  const json = {
    name,
    files: [{ path: `${name}.svg`, content: svgContent }],
  };
  const body = JSON.stringify(json, null, 2) + '\n';
  const blob = new Blob([body], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);

  // Also persist to the session's custom library.
  const custom = loadCustomIcons();
  const idx = custom.findIndex(c => c.name === name);
  if (idx >= 0) custom[idx] = { name, svg: svgContent };
  else custom.push({ name, svg: svgContent });
  saveCustomIcons(custom);

  saveDialog.close();
  showToast(`Saved ${cat}/${name}.json`);
});

// Top "Export" opens the save dialog; a plain .svg download stays available
// via the props panel button below.
downloadBtn.addEventListener('click', openSaveDialog);

// ---- New icon ----
function createNewIcon() {
  const custom = loadCustomIcons();
  let n = custom.length + 1;
  let name = `untitled-${n}`;
  while (custom.some(c => c.name === name) || state.icons.some(i => i.category === 'custom' && i.name === name)) {
    n++; name = `untitled-${n}`;
  }
  const svg = `<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <title>${name}</title>
  <rect width="48" height="48" fill="currentColor" opacity="0.1"/>
</svg>`;
  const icon = { name, category: 'custom', svg };
  custom.push({ name, svg });
  saveCustomIcons(custom);
  state.icons.push(icon);
  if (!state.categories.find(c => c.name === 'custom')) state.categories.push({ name: 'custom', items: [] });
  loadIntoStudio(icon);
  showToast(`Created ${name}`);
}
newBtn.addEventListener('click', createNewIcon);
newBtnSm?.addEventListener('click', createNewIcon);

// Re-position handles when the window resizes
window.addEventListener('resize', renderHandles);

// ---- Boot ----
(async () => {
  try {
    const { categories, icons } = await loadAll();
    state.categories = categories;
    state.icons = icons;
    setStats(`${icons.length} icons`);
    renderIconList();

    const params = new URLSearchParams(location.search);
    const iconRef = params.get('icon');
    if (iconRef) {
      const [cat, ...rest] = iconRef.split('/');
      const name = rest.join('/');
      const match = icons.find(i => i.category === cat && i.name === name);
      if (match) { loadIntoStudio(match); return; }
    }
    if (icons.length > 0) loadIntoStudio(icons[0]);
  } catch (err) {
    canvasHost.innerHTML = `<div class="text-red-500 p-4">Failed to load: ${err.message}</div>`;
  }
})();

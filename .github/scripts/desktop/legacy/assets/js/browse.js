import { loadAll, recolor } from './data.js';
import { initShell, setStats, showToast } from './shell.js';

initShell('browse');

const VIEW_STORAGE_KEY = 'kfe-browse-view';
const savedView = (() => { try { return JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) || '{}'); } catch { return {}; } })();

const state = {
  icons: [],
  filter: '',
  category: 'all',
  color: '#7cc4ff',
  size: 48,
  view: savedView.view === 'list' ? 'list' : 'grid',
  cols: Number.isInteger(savedView.cols) ? savedView.cols : 0,
};

const grid = document.getElementById('grid');
const search = document.getElementById('search');
const catSel = document.getElementById('category');
const colorInput = document.getElementById('color');
const sizeInput = document.getElementById('size');
const sizeLabel = document.getElementById('sizeLabel');
const sizeWrap = document.getElementById('sizeWrap');
const colsInput = document.getElementById('cols');
const colsWrap = document.getElementById('colsWrap');
const viewGridBtn = document.getElementById('viewGrid');
const viewListBtn = document.getElementById('viewList');
const detail = document.getElementById('detail');
const dTitle = document.getElementById('d-title');
const dPreview = document.getElementById('d-preview');
const dCode = document.getElementById('d-code');
const dCopy = document.getElementById('d-copy');
const dEdit = document.getElementById('d-edit');

function persistView() {
  try { localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ view: state.view, cols: state.cols })); }
  catch { /* ignore */ }
}

function applyViewClasses() {
  const isList = state.view === 'list';
  grid.classList.toggle('view-list', isList);
  grid.classList.toggle('view-grid', !isList);
  grid.classList.toggle('cols-auto', !isList && state.cols === 0);
  grid.classList.toggle('cols-fixed', !isList && state.cols > 0);
  if (!isList && state.cols > 0) grid.style.setProperty('--cols', String(state.cols));
  else grid.style.removeProperty('--cols');

  viewGridBtn.classList.toggle('active', !isList);
  viewListBtn.classList.toggle('active', isList);
  viewGridBtn.setAttribute('aria-pressed', String(!isList));
  viewListBtn.setAttribute('aria-pressed', String(isList));

  // Size slider only affects grid tiles; hide in list mode. Columns only in grid.
  sizeWrap.style.display = isList ? 'none' : '';
  colsWrap.style.display = isList ? 'none' : '';
}

function render() {
  const q = state.filter.toLowerCase();
  const filtered = state.icons.filter(i =>
    (state.category === 'all' || i.category === state.category) &&
    (!q || i.name.toLowerCase().includes(q))
  );
  setStats(`${filtered.length} of ${state.icons.length} icons`);
  document.documentElement.style.setProperty('--icon-size', state.size + 'px');
  applyViewClasses();

  if (filtered.length === 0) { grid.innerHTML = '<div class="text-center text-on-surface-variant py-8">No matches.</div>'; return; }
  const frag = document.createDocumentFragment();
  for (const icon of filtered) {
    const el = document.createElement('div');
    if (state.view === 'list') {
      el.className = 'row';
      el.innerHTML = `${recolor(icon.svg, state.color)}<div class="name">${icon.name}</div><div class="cat">${icon.category}</div>`;
    } else {
      el.className = 'tile';
      el.innerHTML = recolor(icon.svg, state.color) + `<div class="name">${icon.name}</div>`;
    }
    el.addEventListener('click', () => openDetail(icon));
    frag.appendChild(el);
  }
  grid.replaceChildren(frag);
}

function openDetail(icon) {
  dTitle.textContent = `${icon.category} / ${icon.name}`;
  dPreview.innerHTML = recolor(icon.svg, state.color);
  dCode.value = icon.svg;
  dCopy.onclick = async () => { await navigator.clipboard.writeText(icon.svg); showToast('Copied'); };
  dEdit.onclick = () => {
    location.href = `./studio.html?icon=${encodeURIComponent(icon.category + '/' + icon.name)}`;
  };
  detail.showModal();
}

search.addEventListener('input', e => { state.filter = e.target.value; render(); });
catSel.addEventListener('change', e => { state.category = e.target.value; render(); });
colorInput.addEventListener('input', e => { state.color = e.target.value; render(); });
sizeInput.addEventListener('input', e => {
  state.size = +e.target.value;
  sizeLabel.textContent = state.size;
  render();
});
colsInput.addEventListener('input', e => {
  const n = Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0));
  state.cols = n;
  persistView();
  applyViewClasses();
});
viewGridBtn.addEventListener('click', () => { if (state.view === 'grid') return; state.view = 'grid'; persistView(); render(); });
viewListBtn.addEventListener('click', () => { if (state.view === 'list') return; state.view = 'list'; persistView(); render(); });

// Initialize controls from restored state
colsInput.value = String(state.cols);

(async () => {
  try {
    const { categories, icons } = await loadAll();
    state.icons = icons;
    for (const cat of categories) {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = `${cat.name} (${cat.items.length})`;
      catSel.appendChild(opt);
    }
    render();
  } catch (err) {
    grid.innerHTML = `<div class="col-span-full text-center text-red-400 py-8">Failed to load: ${err.message}</div>`;
  }
})();

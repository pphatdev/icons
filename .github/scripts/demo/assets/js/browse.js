import { loadAll, recolor } from './data.js';
import { initShell, setStats, showToast } from './shell.js';

initShell('browse');

const state = {
  icons: [],
  filter: '',
  category: 'all',
  color: '#7cc4ff',
  size: 48,
};

const grid = document.getElementById('grid');
const search = document.getElementById('search');
const catSel = document.getElementById('category');
const colorInput = document.getElementById('color');
const sizeInput = document.getElementById('size');
const sizeLabel = document.getElementById('sizeLabel');
const detail = document.getElementById('detail');
const dTitle = document.getElementById('d-title');
const dPreview = document.getElementById('d-preview');
const dCode = document.getElementById('d-code');
const dCopy = document.getElementById('d-copy');
const dEdit = document.getElementById('d-edit');

function render() {
  const q = state.filter.toLowerCase();
  const filtered = state.icons.filter(i =>
    (state.category === 'all' || i.category === state.category) &&
    (!q || i.name.toLowerCase().includes(q))
  );
  setStats(`${filtered.length} of ${state.icons.length} icons`);
  document.documentElement.style.setProperty('--icon-size', state.size + 'px');

  if (filtered.length === 0) { grid.innerHTML = '<div class="empty">No matches.</div>'; return; }
  const frag = document.createDocumentFragment();
  for (const icon of filtered) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = recolor(icon.svg, state.color) + `<div class="name">${icon.name}</div>`;
    tile.addEventListener('click', () => openDetail(icon));
    frag.appendChild(tile);
  }
  grid.replaceChildren(frag);
}

function openDetail(icon) {
  dTitle.textContent = `${icon.category} / ${icon.name}`;
  dPreview.innerHTML = recolor(icon.svg, state.color);
  dCode.value = icon.svg;
  dCopy.onclick = async () => { await navigator.clipboard.writeText(icon.svg); showToast('Copied'); };
  dEdit.onclick = () => {
    location.href = `/studio?icon=${encodeURIComponent(icon.category + '/' + icon.name)}`;
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
    grid.innerHTML = `<div class="empty">Failed to load: ${err.message}</div>`;
  }
})();

import { loadAll, countShapes } from './data.js';
import { initShell, setStats } from './shell.js';

initShell('graph');

(async () => {
  const { categories, icons } = await loadAll();
  setStats(`${icons.length} icons across ${categories.length} categories`);
  renderGraph(icons, categories);
})();

function renderGraph(icons, categories) {
  const metrics = document.getElementById('g-metrics');
  const total = icons.length;
  const avgShapes = total ? (icons.reduce((s, i) => s + countShapes(i.svg), 0) / total).toFixed(1) : 0;
  const totalBytes = icons.reduce((s, i) => s + i.svg.length, 0);
  const avgBytes = total ? Math.round(totalBytes / total) : 0;
  metrics.innerHTML = `
    <div class="metric-card"><div class="value">${total}</div><div class="label">Total Icons</div></div>
    <div class="metric-card"><div class="value">${categories.length}</div><div class="label">Categories</div></div>
    <div class="metric-card"><div class="value">${avgShapes}</div><div class="label">Avg Shapes/Icon</div></div>
    <div class="metric-card"><div class="value">${(totalBytes / 1024).toFixed(1)}KB</div><div class="label">Total SVG Size</div></div>
    <div class="metric-card"><div class="value">${avgBytes}B</div><div class="label">Avg Size/Icon</div></div>
  `;

  // Per-category
  const perCat = {};
  for (const i of icons) perCat[i.category] = (perCat[i.category] || 0) + 1;
  const catEntries = Object.entries(perCat).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(...catEntries.map(e => e[1]), 1);
  document.getElementById('g-cat-bars').innerHTML = catEntries.map(([n, c]) =>
    `<div class="bar-row"><span>${n}</span><div class="bar" style="width: ${(c / maxCat * 100).toFixed(1)}%;"></div><span class="count">${c}</span></div>`
  ).join('') || '<div class="empty">No data</div>';

  // Complexity buckets
  const buckets = { '1': 0, '2-3': 0, '4-6': 0, '7-10': 0, '11-20': 0, '20+': 0 };
  for (const i of icons) {
    const c = countShapes(i.svg);
    if (c <= 1) buckets['1']++;
    else if (c <= 3) buckets['2-3']++;
    else if (c <= 6) buckets['4-6']++;
    else if (c <= 10) buckets['7-10']++;
    else if (c <= 20) buckets['11-20']++;
    else buckets['20+']++;
  }
  const maxB = Math.max(...Object.values(buckets), 1);
  document.getElementById('g-complexity').innerHTML = Object.entries(buckets).map(([k, v]) =>
    `<div class="bar-row"><span>${k} shape${k === '1' ? '' : 's'}</span><div class="bar" style="width: ${(v / maxB * 100).toFixed(1)}%;"></div><span class="count">${v}</span></div>`
  ).join('');

  // Size distribution
  const sizeBuckets = { '<500B': 0, '500B-1KB': 0, '1-2KB': 0, '2-4KB': 0, '4-8KB': 0, '>8KB': 0 };
  for (const i of icons) {
    const b = i.svg.length;
    if (b < 500) sizeBuckets['<500B']++;
    else if (b < 1024) sizeBuckets['500B-1KB']++;
    else if (b < 2048) sizeBuckets['1-2KB']++;
    else if (b < 4096) sizeBuckets['2-4KB']++;
    else if (b < 8192) sizeBuckets['4-8KB']++;
    else sizeBuckets['>8KB']++;
  }
  const maxS = Math.max(...Object.values(sizeBuckets), 1);
  document.getElementById('g-size-dist').innerHTML = Object.entries(sizeBuckets).map(([k, v]) =>
    `<div class="bar-row"><span>${k}</span><div class="bar" style="width: ${(v / maxS * 100).toFixed(1)}%;"></div><span class="count">${v}</span></div>`
  ).join('');

  // Top 10 largest
  const top = [...icons].sort((a, b) => b.svg.length - a.svg.length).slice(0, 10);
  const maxT = top[0]?.svg.length || 1;
  document.getElementById('g-largest').innerHTML = top.map(i =>
    `<div class="bar-row"><span>${i.name}</span><div class="bar" style="width: ${(i.svg.length / maxT * 100).toFixed(1)}%;"></div><span class="count">${i.svg.length}B</span></div>`
  ).join('');
}

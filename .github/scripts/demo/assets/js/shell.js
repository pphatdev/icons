const TAB_TITLES = { browse: 'Browse', studio: 'Studio', graph: 'Graph' };

export function initShell(activeTab) {
  document.querySelectorAll('nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.tab === activeTab);
  });
  const label = TAB_TITLES[activeTab] || 'Demo';
  document.title = `${label} · KFE Icons Studio`;
}

export function setStats(text) {
  const el = document.getElementById('stats');
  if (el) el.textContent = text;
}

let toastEl = null;
export function showToast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), 1400);
}

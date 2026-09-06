/* Catalogue view: fetch rows from the sheet, render cards, filter + search. */

/* ▶▶ Replace with the gallery's real enquiry address before sharing the link. ◀◀ */
const GALLERY_EMAIL = 'REPLACE_ME';

const state = { cat: 'all', q: '' };
let ALL = [];

const grid    = document.getElementById('grid');
const chipbox = document.getElementById('chips');
const counter = document.getElementById('count');
const search  = document.getElementById('search');

const esc = s => (s || '').replace(/[&<>"]/g, c => (
  { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]
));

init();

async function init(){
  grid.innerHTML = '<p class="state">Loading the catalogue…</p>';
  try{
    ALL = await loadCatalog();
    buildChips();
    bindSearch();
    render();
  }catch(err){
    console.error(err);
    grid.innerHTML =
      '<div class="banner">The catalogue could not be loaded just now. '
      + 'Please check your connection and try again.'
      + '<button type="button" onclick="location.reload()">Retry</button></div>';
    counter.textContent = '';
  }
}

function buildChips(){
  const cats = ['all', ...[...new Set(ALL.map(r => r.category))].sort((a, b) =>
    a.localeCompare(b))];
  chipbox.innerHTML = cats.map(c => {
    const label = c === 'all' ? 'All' : c;
    return `<button class="chip" type="button" data-cat="${esc(c)}"
      aria-pressed="${c === state.cat}">${esc(label)}</button>`;
  }).join('');
  chipbox.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    state.cat = btn.dataset.cat;
    [...chipbox.children].forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.cat === state.cat));
    render();
  });
}

function bindSearch(){
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = search.value; render(); }, 120);
  });
}

function matches(r){
  if (state.cat !== 'all' && r.category !== state.cat) return false;
  const q = state.q.toLowerCase().trim();
  if (!q) return true;
  return r.id.toLowerCase().includes(q)
      || (r.catalogNo != null && String(r.catalogNo) === q)
      || r.category.toLowerCase().includes(q)
      || r.description.toLowerCase().includes(q);
}

function card(r){
  const img = r.filename
    ? `<img loading="lazy" src="thumbs/${encodeURIComponent(r.filename)}"
         alt="${esc(r.description) || esc(r.id)}"
         onerror="this.closest('.thumb').classList.add('noimg');this.remove();">`
    : '';
  const mail = GALLERY_EMAIL && GALLERY_EMAIL !== 'REPLACE_ME'
    ? `<a class="enquire" href="mailto:${encodeURIComponent(GALLERY_EMAIL)}`
      + `?subject=${encodeURIComponent('Enquiry: ' + r.id + ' — ' + r.description)}">Enquire →</a>`
    : '';
  return `<article class="card">
    <div class="thumb" data-no="${r.catalogNo ?? ''}">${img}</div>
    <div class="body">
      <p class="desc">${esc(r.description) || '<em>Untitled</em>'}</p>
      <dl class="meta">
        <dt>ID</dt><dd>${esc(r.id)}</dd>
        <dt>Category</dt><dd>${esc(r.category)}</dd>
        <dt>Price</dt><dd class="price">${esc(r.sellPrice)}</dd>
      </dl>
      ${mail}
    </div>
  </article>`;
}

function render(){
  const shown = ALL.filter(matches);
  grid.innerHTML = shown.length
    ? shown.map(card).join('')
    : '<p class="state">No photographs match that search.</p>';
  counter.textContent = shown.length === ALL.length
    ? `${ALL.length} photographs`
    : `${shown.length} of ${ALL.length} photographs`;
}

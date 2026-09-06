/* Catalogue view: fetch rows from the sheet, render cards, filter + search,
   and open a per-work popup listing the gallery-wall piece plus every stock
   piece available to order (from the Inventory tab). */

/* ▶▶ Replace with the gallery's real enquiry address before sharing the link. ◀◀ */
const GALLERY_EMAIL = 'REPLACE_ME';

const state = { cat: 'all', q: '' };
let ALL = [];
let INVENTORY = new Map();          // Map<ProductID, InventoryItem[]>
let lastFocus = null;

const grid    = document.getElementById('grid');
const chipbox = document.getElementById('chips');
const counter = document.getElementById('count');
const search  = document.getElementById('search');
const modal   = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');

const esc = s => (s || '').replace(/[&<>"]/g, c => (
  { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]
));

init();

async function init(){
  grid.innerHTML = '<p class="state">Loading the catalogue…</p>';
  try{
    const [cat, inv] = await Promise.all([ loadCatalog(), loadInventory() ]);
    ALL = cat;
    INVENTORY = inv;
    buildChips();
    bindSearch();
    bindModal();
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

/* ---- filters -------------------------------------------------------------- */
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

/* ---- cards -------------------------------------------------------------- */
function card(r){
  const img = r.filename
    ? `<img loading="lazy" src="thumbs/${encodeURIComponent(r.filename)}"
         alt="${esc(r.description) || esc(r.id)}"
         onerror="this.closest('.thumb').classList.add('noimg');this.remove();">`
    : '';
  return `<article class="card" role="button" tabindex="0"
      data-id="${esc(r.id)}"
      aria-label="${esc(r.description) || esc(r.id)} — view sizes and stock">
    <div class="thumb" data-no="${r.catalogNo ?? ''}">${img}</div>
    <div class="body">
      <p class="desc">${esc(r.description) || '<em>Untitled</em>'}</p>
      <dl class="meta">
        <dt>ID</dt><dd>${esc(r.id)}</dd>
        <dt>Category</dt><dd>${esc(r.category)}</dd>
        <dt>Gallery wall</dt><dd class="price">${esc(r.sellPrice)}</dd>
      </dl>
      <span class="card-hint">Click for all sizes &amp; stock &rarr;</span>
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

/* ---- popup ------------------------------------------------------------- */
function bindModal(){
  grid.addEventListener('click', e => {
    const c = e.target.closest('.card');
    if (c) openModal(c.dataset.id);
  });
  grid.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const c = e.target.closest('.card');
    if (c){ e.preventDefault(); openModal(c.dataset.id); }
  });
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
}

function enquireLink(r, label){
  if (!GALLERY_EMAIL || GALLERY_EMAIL === 'REPLACE_ME') return '';
  const subject = encodeURIComponent(`Enquiry: ${r.id} — ${r.description}`);
  return `<a class="btn-mail" href="mailto:${encodeURIComponent(GALLERY_EMAIL)}?subject=${subject}">${label}</a>`;
}

function wallSpecLine(r){
  const bits = [r.wallSize, r.wallMaterial, r.wallFrame].filter(Boolean);
  return bits.length ? `<p class="wall-spec">${esc(bits.join(' · '))}</p>` : '';
}

function stockRow(it){
  const cls = it.outOfStock ? ' class="oos"' : '';
  const qty = it.outOfStock
    ? '<span class="tag-oos">Out of stock</span>'
    : esc(it.qtyRaw || String(it.qty || ''));
  return `<tr${cls}>
    <td>${esc(it.size) || '—'}</td>
    <td>${esc(it.material) || '—'}</td>
    <td class="num">${qty}</td>
    <td class="num">${esc(it.price)}</td>
    ${STOCK_HAS_NOTES ? `<td class="note">${esc(it.notes)}</td>` : ''}
  </tr>`;
}

let STOCK_HAS_NOTES = false;

function openModal(id){
  const r = ALL.find(x => x.id === id);
  if (!r) return;
  lastFocus = document.activeElement;

  const items = INVENTORY.get(id) || [];
  STOCK_HAS_NOTES = items.some(it => it.notes);

  const thumb = r.filename
    ? `<img src="thumbs/${encodeURIComponent(r.filename)}" alt="${esc(r.description)}"
         onerror="this.closest('.m-figure').classList.add('noimg');this.remove();">`
    : '';

  const stockTable = items.length
    ? `<div class="stock-wrap"><table class="stock">
         <thead><tr>
           <th>Size</th><th>Material</th><th class="num">In stock</th><th class="num">Price</th>
           ${STOCK_HAS_NOTES ? '<th>Notes</th>' : ''}
         </tr></thead>
         <tbody>${items.map(stockRow).join('')}</tbody>
       </table></div>`
    : `<p class="stock-empty">No additional stock listed &mdash; please enquire with the gallery.</p>`;

  modalBody.innerHTML = `
    <button class="m-close" type="button" data-close aria-label="Close">&times;</button>
    <div class="m-head">
      <figure class="m-figure" data-no="${r.catalogNo ?? ''}">${thumb}</figure>
      <div class="m-meta">
        <p class="m-cat">${esc(r.category)} &nbsp;&middot;&nbsp; ${esc(r.id)}</p>
        <h2 class="m-title">${esc(r.description) || 'Untitled'}</h2>

        <div class="wall-piece">
          <p class="section-label">On the gallery wall</p>
          <p class="wall-price">${esc(r.sellPrice)}</p>
          ${wallSpecLine(r)}
          <p class="wall-note">The framed print currently hanging in the exhibition.</p>
        </div>
      </div>
    </div>

    <div class="m-stock">
      <p class="section-label">Also available to order</p>
      <p class="stock-intro">Other sizes and materials of this photograph held as stock.
        Prices shown are per piece; framing is quoted separately.</p>
      ${stockTable}
    </div>

    ${enquireLink(r, 'Enquire about this photograph') ?
      `<div class="m-foot">${enquireLink(r, 'Enquire about this photograph')}</div>` : ''}
  `;

  modal.hidden = false;
  document.body.classList.add('modal-open');
  modalBody.querySelector('.m-close').focus();
}

function closeModal(){
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

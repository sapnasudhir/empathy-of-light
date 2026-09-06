/* Live data — read straight from the Google Sheet on every page load.
   The sheet is link-shared "Anyone with the link → Viewer"; the gviz CSV endpoint
   returns plain CSV with permissive CORS, so no proxy / no build step is needed.

   Two tabs are read:
     • "Catalog"   — the piece hanging on the gallery wall (one row per work).
     • "Inventory" — every stock piece available to order (many rows per work).

   Google edge-caches these responses for a few minutes, so an edit in the sheet
   shows up here "within a few minutes of a refresh", not instantly. */

const SHEET_ID  = '1jMN2qdXzFzGDvQRodq-XssC59AQ9XkQyRd3-QsewWLE';
const CATALOG_GID = '1697267038';
const INVENTORY_SHEET = 'Inventory';

const ID_PATTERN = /^[A-Za-z]{2,5}\d{2,4}$/;

function norm(s){ return (s || '').toString().toLowerCase().replace(/\s+/g, ' ').trim(); }

/* Match columns by header text, not by fixed position, so a reordered or renamed
   column still resolves. On the Catalog tab the gviz CSV prefixes each header with
   that column's annotation row (e.g. "Pricing is set as a multiple … Cost Mulitple"),
   so the real header is the TAIL — match `===`, then `endsWith`, then a guarded
   `includes` (skipping "cost …" so the Sell Price lookup can't grab Cost Estimate). */
function buildColumnMap(headerRow, aliases){
  const header = headerRow.map(norm);
  const find = alist => {
    for (const a of alist){ const i = header.indexOf(a);                       if (i >= 0) return i; }
    for (const a of alist){ const i = header.findIndex(h => h.endsWith(a));     if (i >= 0) return i; }
    for (const a of alist){
      const i = header.findIndex(h => h.includes(a) && !h.includes('cost '));
      if (i >= 0) return i;
    }
    return -1;
  };
  const col = {};
  for (const [key, alist] of Object.entries(aliases)) col[key] = find(alist);
  return col;
}

const at = (row, i) => (i >= 0 && i < row.length ? row[i] : '') || '';

/* numeric ₹ amount → grouped ₹ string; NFS → Not for sale; blank / pending → Price on request */
function friendlyPrice(raw){
  const v = (raw || '').toString().trim();
  if (!v) return 'Price on request';
  const up = v.toUpperCase();
  if (up === 'NFS' || up === 'N/F/S') return 'Not for sale';
  if (up.includes('PENDING')) return 'Price on request';
  const n = Number(v.replace(/[₹,\s]/g, ''));
  if (isFinite(n) && n > 0) return '₹' + n.toLocaleString('en-IN');
  return 'Price on request';
}

function catalogNumber(filename){
  const m = (filename || '').match(/^\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function fetchCSV(params){
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`
            + `?tqx=out:csv&${params}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheet request failed (${res.status})`);
  return parseCSV(await res.text());
}

/* ---- Catalog tab : the gallery-wall piece --------------------------------- */
const CATALOG_ALIASES = {
  id:          ['unique product id', 'product id'],
  category:    ['category'],
  filename:    ['filename', 'file name'],
  description: ['description'],
  sellPrice:   ['sell price'],
  wallSize:    ['notes on size'],
  wallMaterial:['notes on print material', 'notes on material'],
  wallFrame:   ['notes on frame'],
};

async function loadCatalog(){
  const table = await fetchCSV(`gid=${CATALOG_GID}`);
  if (table.length < 2) throw new Error('Catalog tab returned no rows.');
  const col = buildColumnMap(table[0], CATALOG_ALIASES);
  if (col.filename < 0 && col.id < 0){
    throw new Error('Unexpected Catalog layout: no Product ID / Filename column.');
  }
  return table
    .slice(1)
    .filter(r => ID_PATTERN.test(at(r, col.id).trim()))
    .map(r => {
      const filename = at(r, col.filename).trim();
      return {
        id:          at(r, col.id).trim(),
        category:    at(r, col.category).trim() || 'Uncategorised',
        filename,
        description: at(r, col.description).trim(),
        sellPrice:   friendlyPrice(at(r, col.sellPrice)),
        wallSize:     at(r, col.wallSize).trim(),
        wallMaterial: at(r, col.wallMaterial).trim(),
        wallFrame:    at(r, col.wallFrame).trim(),
        catalogNo:   catalogNumber(filename),
      };
    });
}

/* ---- Inventory tab : every stock piece available to order ----------------- */
const INVENTORY_ALIASES = {
  id:        ['product id', 'unique product id'],
  size:      ['size'],
  material:  ['material'],
  qty:       ['stock qty', 'stock quantity', 'qty', 'quantity'],
  status:    ['status'],
  sellPrice: ['sell price (optional)', 'sell price', 'price'],
  notes:     ['notes'],
};

function isOutOfStock(qtyRaw, statusRaw){
  const q = Number((qtyRaw || '').toString().replace(/[,\s]/g, ''));
  if (isFinite(q) && q > 0) return false;
  if (isFinite(q) && q <= 0) return true;
  return /^\s*(out|nil|none|0)\b/i.test(statusRaw || '');
}

/* Returns Map<ProductID, InventoryItem[]>. Never throws — an Inventory outage
   just means the popup shows the wall piece alone. */
async function loadInventory(){
  const byId = new Map();
  let table;
  try{
    table = await fetchCSV(`sheet=${encodeURIComponent(INVENTORY_SHEET)}`);
  }catch(err){
    console.warn('Inventory unavailable:', err);
    return byId;
  }
  if (!table || table.length < 2) return byId;

  const col = buildColumnMap(table[0], INVENTORY_ALIASES);
  if (col.id < 0){ console.warn('Inventory: no Product ID column'); return byId; }

  for (const r of table.slice(1)){
    const id = at(r, col.id).trim();
    if (!ID_PATTERN.test(id)) continue;
    const qtyRaw = at(r, col.qty).trim();
    const sizeV = at(r, col.size).trim();
    const matV  = at(r, col.material).trim();
    const noteV = at(r, col.notes).trim();
    const priceV = at(r, col.sellPrice).trim();
    const q = Number(qtyRaw.replace(/[,\s]/g, ''));
    /* skip stub rows — one blank placeholder per Product ID with nothing filled in */
    if (!sizeV && !matV && !noteV && !priceV && (!isFinite(q) || q <= 0)) continue;

    const statusV = at(r, col.status).trim();
    const item = {
      size: sizeV,
      material: matV,
      qtyRaw,
      qty: q,
      status: statusV,
      price: friendlyPrice(priceV),
      notes: noteV,
      outOfStock: isOutOfStock(qtyRaw, statusV),
    };
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(item);
  }
  return byId;
}

window.loadCatalog = loadCatalog;
window.loadInventory = loadInventory;

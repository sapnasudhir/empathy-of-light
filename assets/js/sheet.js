/* Live catalogue data — read straight from the Google Sheet on every page load.
   The sheet is link-shared "Anyone with the link → Viewer"; the gviz CSV endpoint
   returns plain CSV with permissive CORS, so no proxy / no build step is needed.

   Google edge-caches this response for a few minutes, so a price edit in the sheet
   shows up here "within a few minutes of a refresh", not instantly. */

const SHEET_ID = '1jMN2qdXzFzGDvQRodq-XssC59AQ9XkQyRd3-QsewWLE';
const GID      = '1697267038';

/* gviz CSV collapses the sheet's 3 annotation/header rows into ONE header row,
   and real data starts on the next line (CHI001…). */
const HEADER_ROW_INDEX = 0;
const ID_PATTERN = /^[A-Za-z]{2,5}\d{2,4}$/;

/* Match columns by header text, not by fixed position, so a reordered or
   renamed column still resolves.

   The gviz CSV prefixes each header with that column's annotation row, e.g.
   "Pricing is set as a multiple … Cost Mulitple". The real header is always the
   TAIL of the string, so match with `===` then `endsWith` and only fall back to a
   loose `includes` — otherwise "…to get to the Sell Price Cost Estimate" would
   wrongly capture the Sell Price lookup. */
const COLUMN_ALIASES = {
  id:          ['unique product id', 'product id'],
  category:    ['category'],
  filename:    ['filename', 'file name'],
  description: ['description'],
  sellPrice:   ['sell price'],
};

function norm(s){ return (s || '').toString().toLowerCase().replace(/\s+/g, ' ').trim(); }

function mapColumns(headerRow){
  const header = headerRow.map(norm);
  const findCol = aliases => {
    for (const a of aliases){ const i = header.indexOf(a);            if (i >= 0) return i; }
    for (const a of aliases){ const i = header.findIndex(h => h.endsWith(a)); if (i >= 0) return i; }
    for (const a of aliases){
      const i = header.findIndex(h => h.includes(a) && !h.includes('cost '));
      if (i >= 0) return i;
    }
    return -1;
  };
  const col = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) col[key] = findCol(aliases);
  if (col.filename < 0 && col.id < 0){
    throw new Error('Unexpected sheet layout: no Product ID / Filename column found.');
  }
  return col;
}

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

async function loadCatalog(){
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`
            + `?tqx=out:csv&gid=${GID}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheet request failed (${res.status})`);

  const table = parseCSV(await res.text());
  if (table.length <= HEADER_ROW_INDEX + 1) throw new Error('Sheet returned no rows.');

  const col = mapColumns(table[HEADER_ROW_INDEX]);
  const at = (row, i) => (i >= 0 && i < row.length ? row[i] : '') || '';

  return table
    .slice(HEADER_ROW_INDEX + 1)
    .filter(r => ID_PATTERN.test((at(r, col.id)).trim()))
    .map(r => {
      const filename = at(r, col.filename).trim();
      return {
        id:          at(r, col.id).trim(),
        category:    at(r, col.category).trim() || 'Uncategorised',
        filename,
        description: at(r, col.description).trim(),
        sellPrice:   friendlyPrice(at(r, col.sellPrice)),
        catalogNo:   catalogNumber(filename),
      };
    });
}

window.loadCatalog = loadCatalog;

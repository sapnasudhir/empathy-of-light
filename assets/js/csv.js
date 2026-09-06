/* Minimal RFC-4180 CSV parser. Returns an array of string[] rows.
   Handles "" escapes, quoted fields with commas / newlines, and CRLF. */
function parseCSV(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  // strip a leading BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (inQuotes){
      if (c === '"'){
        if (text[i + 1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"'){ inQuotes = true; }
      else if (c === ','){ row.push(field); field = ''; }
      else if (c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r'){ /* swallow; \n handles the break */ }
      else { field += c; }
    }
  }
  // trailing field / row (no newline at EOF)
  if (field.length || row.length){ row.push(field); rows.push(row); }
  return rows;
}

window.parseCSV = parseCSV;

# EMPATHY of LIGHT — Gallery G

A two-page static site for Gallery G's retrospective of fine art photography by
**Sudhir Ramchandran** (Bangalore, 6 September – 10 October 2026).

- **`index.html`** — the invitation, rebuilt in HTML/CSS.
- **`catalog.html`** — all 60 photographs as cards, searchable by description,
  category, catalogue number (1–60) or product ID.

Hosted with GitHub Pages: <https://sapnasudhir.github.io/empathy-of-light/>

## How the catalogue stays current

`catalog.html` reads the master Google Sheet **on every page load** — there is no
build step. It calls the sheet's `gviz` CSV endpoint client-side:

```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&gid=<GID>
```

`SHEET_ID` and `GID` live in [`assets/js/sheet.js`](assets/js/sheet.js). Columns are
matched by header name, and only the **Product ID, Category, Filename, Description**
and **Sell Price** columns are used — the cost columns are never read.

**Prices:** a number becomes `₹` with Indian grouping; `NFS` shows as *Not for sale*;
a blank or *Pending Multiple* shows as *Price on request*. Google caches the sheet
response for a few minutes, so an edit appears here within a few minutes of a refresh.

### Requirements for it to work

1. The sheet must stay shared **“Anyone with the link → Viewer.”**
2. Every row's `Filename` must have a matching image committed at `thumbs/<Filename>`.
   A row with no image shows a numbered placeholder tile.

## Updating

| Change | What to do |
|---|---|
| A price / description / category | Edit the Google Sheet. Nothing to deploy. |
| Add a photograph | Add the sheet row **and** commit its image to `thumbs/<Filename>`. |
| Enquiry email address | Set `GALLERY_EMAIL` in [`assets/js/catalog.js`](assets/js/catalog.js) and commit. Until then, cards show no *Enquire* link. |

## Local preview

```bash
cd site        # or the repo root
python -m http.server 8000
# open http://localhost:8000/
```

Use a server, not `file://` — the sheet `fetch` needs a real origin.

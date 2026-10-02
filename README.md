# EMPATHY of LIGHT — Gallery G

A static site for Gallery G's retrospective of fine art photography by
**Sudhir Ramchandran** (Bangalore, 6 September – 10 October 2026).

Hosted with GitHub Pages: <https://sapnasudhir.github.io/empathy-of-light/>

| Page | What it is |
|---|---|
| **`index.html`** | The invitation, rebuilt in HTML/CSS. Its *View the Catalogue* button opens the reference. |
| **`reference.html`** | The Gallerists' Reference — cover, **List view** (one row per work) and **Card view**, both sortable and filterable. |
| **`empathy-of-light-gallerists-reference.pdf`** | The printable A4 card deck, offered as a download from that page. |

`reference.html` and the PDF are **generated, not hand-edited** — see below. The only
page edited by hand is `index.html`.

## The catalogue is a build, not a live read

Both the page and the PDF are produced from the pricing Google Sheet by the
`catalog-cards-pdf` skill, and the data is **baked in at build time**. Editing the
sheet does not change the published site until someone rebuilds and pushes.

```bash
# from the project root, not from site/
python ~/.claude/skills/catalog-cards-pdf/scripts/build_catalog_cards.py --sort id --refresh
python ~/.claude/skills/catalog-cards-pdf/scripts/build_site.py --site site --pdf catalog-cards-by-product-id.pdf
```

The first command writes the PDF; the second writes `reference.html` and **copies**
that same PDF into this repo — it never re-renders it, so the download is always the
exact file that was reviewed. Both read the sheet through the same code, so the page
and the PDF cannot quote different prices.

Pass `--refresh` whenever the sheet has just been edited; the CSVs are cached and you
will otherwise rebuild yesterday's prices. Check the `price column: G - <header>` line
each run — that is the one-glance confirmation the build carries the intended prices.

### The PDF and the page are coupled

The PDF's cover carries a QR code pointing at `reference.html`. **After any PDF
rebuild, run the site script and push**, or the printed code leads to a catalogue
older than the sheet it was built from.

GitHub Pages edge-caches the PDF, so verify the live copy rather than assuming:

```bash
curl -sL -H 'Cache-Control: no-cache' \
  -o /tmp/live.pdf \
  "https://sapnasudhir.github.io/empathy-of-light/empathy-of-light-gallerists-reference.pdf?cb=$(date +%s)"
# then compare its hash against the local build
```

## Requirements for a build to work

1. The sheet must stay shared **“Anyone with the link → Viewer,”** or the download
   returns an HTML sign-in page instead of CSV.
2. Every row's `Filename` must have a matching image committed at `thumbs/<Filename>`.
   A row whose thumbnail is missing is **skipped with a warning** rather than producing
   a broken card — if that warning appears, commit the image and rebuild.

## Updating

| Change | What to do |
|---|---|
| A price, title, description or category | Edit the Google Sheet, then rebuild and push (both commands above, with `--refresh`). |
| Add a photograph | Add the sheet row, commit its image to `thumbs/<Filename>`, then rebuild and push. |
| The invitation's wording, dates or images | Edit `index.html` directly. |
| The reference's layout or columns | Edit the skill scripts, not `reference.html` — the next build overwrites it. |

## Local preview

```bash
cd site
python -m http.server 8000
# open http://localhost:8000/
```

Use a server rather than `file://`.

## History

An earlier `catalog.html` read the sheet live in the browser on every page load. It
was retired in favour of `reference.html`: the sheet's product IDs, tab names and
price columns all changed, and a page that re-derived them client-side silently
returned nothing. Building the data in means a broken sheet fails loudly at build
time instead of quietly in a visitor's browser.

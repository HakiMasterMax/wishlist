# Wishlist Item Shop

A cozy, filterable storefront for my wishlist. It's plain HTML, CSS and JS with no build step. The data comes live from a published Google Sheet, so editing the sheet updates the site within a few minutes.

## Files

```
index.html          page structure
styles.css          all styling
app.js              loads the sheet, filters, cards, Smudge's gift planner
wishlist-images/    item photos, named to match the sheet's image_name column
```

## Put it on GitHub Pages

1. Create a new repository on GitHub, for example `wishlist`.
2. Upload everything in this folder, including the `wishlist-images` folder. You can drag it onto **Add file → Upload files**, or push it with git.
3. Go to **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch to `main`, and folder to `/ (root)`, then click **Save**.
4. After a minute or two the site is live at `https://<your-username>.github.io/wishlist/`.

## Updating the wishlist

Edit the Google Sheet. The published CSV refreshes within about 5 minutes, and the site picks it up on the next page load. You don't need to redeploy anything.

### Sheet columns

| Column | What it does |
|---|---|
| `item_name` | Card title |
| `price` | Number; a `$` is fine. Used for the price filter, sorting and the gift planner |
| `size`, `color_or_pattern`, `notes` | Shown in the **i** details popup (hover on desktop, tap on phones) |
| `quantity` | If more than 1, a ×N tag appears, and Smudge can pick it up to N times |
| `excite` | `TRUE` makes the item **Legendary** (gold card, star badge, picked first) |
| `source` | Merchant filter and tag |
| `tags` | Item types, separated by `:` (e.g. `craft: clothing`). Blank counts as **Other** |
| `image_name` | Photo file name without the extension (e.g. `ear-muffs-amazon`) |
| `link` | Where the **View** button goes (opens in a new tab) |

New tags and merchants show up as filters automatically.

### Adding a photo

Save it into `wishlist-images/` with exactly the name in the `image_name` column, plus `.jpg` (or `.png`/`.webp`), then upload it to the repo. Names are case-sensitive on GitHub Pages. Keep photos around 900px wide so the page stays quick.

## Settings

The top of `app.js` has a `CONFIG` block: the sheet URL, the image folder name and the image file types to try.

## Run it locally

Opening `index.html` straight from Finder won't load the sheet, because browsers block it. Run a tiny server from this folder instead:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

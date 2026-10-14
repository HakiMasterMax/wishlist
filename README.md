# Wishlist Item Shop

A cozy, filterable storefront for my wishlist. It's plain HTML, CSS and JS with no build step. The data comes live from a published Google Sheet, so editing the sheet updates the site within a few minutes.

## Files

```
config.js           your settings: sheet link, photo folder, gift planner, claims (the only file you need to edit)
index.html          page structure
styles.css          all styling
app.js              loads the sheet, filters, cards, Smudge's gift planner
wishlist-images/    item photos, named to match the sheet's image column
prices.json         daily price checks, written by a GitHub Action
wishlist-site/      redirect so old links to /wishlist-site/ still work
```

## Put it on GitHub Pages

1. Create a new repository on GitHub, for example `wishlist`.
2. Upload everything in this folder, including the `wishlist-images` folder. You can drag it onto **Add file → Upload files**, or push it with git.
3. Go to **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch to `main`, and folder to `/ (root)`, then click **Save**.
4. After a minute or two the site is live at `https://<your-username>.github.io/wishlist/`.

## Start your wishlist sheet

**[Make a copy of the wishlist template](https://docs.google.com/spreadsheets/d/1xcYWpix2X1ZDpUfDu7IXhiKeWtpUENBPletfdRZQ8g8/copy)**. It opens a copy in your own Google Drive with example items, a tip on every column header, and a **How to use** tab. Replace the examples with your own items, publish the **Items** tab as CSV (File → Share → Publish to web), and paste that link into `sheetUrl` in `config.js`.

## Updating the wishlist

Edit the Google Sheet. The published CSV refreshes within about 5 minutes, and the site picks it up on the next page load. You don't need to redeploy anything.

### Sheet columns

| Column | What it does |
|---|---|
| `name` | Card title |
| `price` | Number; a `$` is fine. Used for the price filter, sorting and the gift planner |
| `size`, `color`, `notes` | Shown in the **i** details popup (hover on desktop, tap on phones) |
| `quantity` | If more than 1, a ×N tag appears, and Smudge can pick it up to N times |
| `starred` | `TRUE` (or yes / x / ✓, or a ticked checkbox) makes the item **Legendary**: gold card, star badge, picked first |
| `shop` | Where it's sold. Becomes a filter and a tag |
| `category` | What kind of thing it is, separated by `:` (e.g. `craft: clothing`). Blank counts as **Other** |
| `image` | A link to the photo (right-click the product photo → **Copy image address**), or a file name in `wishlist-images/` |
| `link` | Where the **View** button goes (opens in a new tab) |

Only `name` is required, and columns can be in any order. Headers are matched loosely, so `Starred?`, `Shop name` or `IMAGE` all work. The older names (`item_name`, `excite`, `source`, `tags`, `image_name`, `color_or_pattern`) still work too.

New categories and shops show up as filters automatically.

### Gift cards

Set a row's category to `gift card` and put the smallest amount in `price` (or leave it blank for any amount). Gift cards show "From $10" / "Any amount", have no Loot button (several people can give one), always pass the price filter, and sort after regular items. Smudge uses one to fill leftover budget after picking items (a blank minimum counts as $5); it doesn't count toward "Number of gifts".

### Adding a photo

The easy way: on the product page, right-click the photo, choose **Copy image address**, and paste that into the `image` column. Google Drive share links work too, as long as the file is shared with "Anyone with the link". If a photo can't load, the card shows a placeholder.

Or keep photos in the repo: save it into `wishlist-images/` with exactly the name in the `image` column, plus `.jpg` (or `.png`/`.webp`), then upload it to the repo. Names are case-sensitive on GitHub Pages. Keep photos around 900px wide so the page stays quick.

## Looting (gift-givers marking things as bought)

Each card gets a **Loot** button. Pressing it asks how many they bought and records it in a Google Form. The item then shows how many are left, and once none are left it greys out with a LOOTED stamp, sinks to the end of the list, and Smudge stops suggesting it. A giver can **Undo** right after. Other mistakes are fixed by deleting the row in the claims sheet.

The feature is off until the `claims` values in `config.js` are filled in:

| Setting | Where it comes from |
|---|---|
| `csvUrl` | The claims response sheet, published as CSV (File > Share > Publish to web) |
| `formUrl` | The form's pre-filled link, with `viewform?...` replaced by `formResponse` |
| `itemField`, `qtyField`, `refField` | The `entry.123456` ids in the pre-filled link, in question order |

The form needs three short-answer questions titled **item**, **quantity** and **ref**. Don't add number-only validation to quantity, because Undo sends a negative number. Don't require sign-in.

### Spoiler shield

- `…/wishlist/?shield`: turns the shield on in that browser for good. Purchases are never loaded, Loot buttons are hidden, and a "Spoiler shield on" badge shows. Open this once on each of your devices.
- `…/wishlist/?shield=off`: turns it off again in that browser.
- `…/wishlist/?test-claims`: fake purchases and nothing gets sent. Works even with the shield on, so you can try Loot and the animation safely.

When you change `config.js`, `app.js` or `styles.css`, bump the `?v=` number on them in `index.html` so browsers fetch the new version.

Share the plain link with gift-givers.

## Daily price check

A GitHub Action (`.github/workflows/update-prices.yml`) runs `scripts/update-prices.mjs` every morning (about 7:17am Pacific). It can also be run by hand from the repo's **Actions** tab → **Update prices** → **Run workflow**. It reads the sheet link from `config.js` and writes `prices.json`, and the site uses those prices when they're less than 3 days old.

- **Steam** and **Nintendo**: checked automatically, including sales.
- **Etsy**: checked once an `ETSY_API_KEY` secret is added (Settings → Secrets and variables → Actions). The value is `keystring:shared_secret` from your Etsy developer app. Etsy's API gives the listing's normal price, so Etsy sales and coupons may not show. Links that pick a specific size or style (`variation=` in the link) are skipped.
- **Amazon** and everything else: not checked; the sheet price is used.

When the current price is below the store's regular price or your sheet price, the card shows the new price in pink with the old one crossed out and a **Sale −N%** tag. The ⓘ details show when the price was last checked. Smudge's gift picks use current prices.

## Settings

Everything you'd want to change lives in `config.js`, with a comment above each setting: your sheet link, the photo folder, how much of the gift planner budget to hold back for tax and shipping, and the optional claims form. You can edit it right on GitHub with the pencil icon.

## Run it locally

Opening `index.html` straight from Finder won't load the sheet, because browsers block it. Run a tiny server from the repo folder instead:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

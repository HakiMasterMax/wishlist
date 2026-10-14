# Themes

A theme sets the look and the wording of your wishlist shop. Each theme is a folder in here.

| Theme | Folder | What it's like |
|---|---|---|
| RPG Item Shop | `rpg-shop` | A cozy pixel-game shop. Starred items are *Legendary*, gift-givers *Loot* what they buy, and Smudge the soot sprite picks gifts. |
| Starter | `starter` | Plain and simple, with everyday wording and no mascot. A blank slate to copy when making your own. |

## Picking a theme

Open `config.js`, find `theme:`, and put the folder name between the quotes:

```js
theme: 'rpg-shop',
```

**Try before you switch:** add `?theme=` and a folder name to the end of your site's address, like `https://you.github.io/wishlist/?theme=starter`. Only that page view changes; your site keeps its theme for everyone else.

## Making your own theme

1. Copy the `starter` folder and rename the copy, using lowercase letters, numbers and dashes (for example `cozy-cabin`).
2. In `theme.css`, change the colors and fonts. Every one has a comment saying where it shows up.
3. In `theme.json`, give it a name and change any wording you like (see the list below).
4. Optionally add art and a mascot (see below).
5. Preview it with `?theme=your-folder-name`.

Made something you like? Open a pull request so others can use it too.

### What goes in a theme folder

```
your-theme/
  theme.css     colors, fonts, and any extra styling
  theme.json    name, wording, mascot, and which art files to use
  art/          optional SVG pictures
```

Themes are CSS, JSON and SVG only. No JavaScript, so a theme can't break the shop or do anything sneaky.

### Wording (`theme.json` → `"text"`)

List only the words you want to change; everything else uses the default.

- `{name}`-style placeholders get filled in. `{mascot}` is your mascot's name, and `{owner}` is the owner name from `config.js`.
- `"one | many"` picks the right form for the number: `"{n} item | {n} items"`.
- `{i}` (in `welcome`) shows the little info icon.
- A blank `""` hides that piece (for example the `eventTag` badge).

| Key | Default |
|---|---|
| `title` | My Wishlist |
| `eventTag` | *(blank: hidden)* |
| `welcomeName` | *(blank: hidden)* |
| `welcome` | Everything here is on my wishlist. Starred items are the ones I want most. Tap the {i} on a photo for sizes, colors and notes. |
| `footer` | Made from a spreadsheet. |
| `loading` | loading… |
| `stat.items` | {n} item \| {n} items |
| `stat.starred` | {n} starred |
| `stat.shops` | {n} shop \| {n} shops |
| `starred` | Starred |
| `starredOnly` | Starred only |
| `starBadge` | Starred: most wanted |
| `searchLabel` | Search |
| `searchPlaceholder` | Search the list |
| `typeFilter` | Category |
| `shopFilter` | Shop |
| `priceFilter` | Price |
| `reset` | Reset filters |
| `filtersLabel` | Filters |
| `resultsLabel` | Wishlist items |
| `sortLabel` | Sort |
| `sortStarred` | Starred first |
| `sortLow` | Price: low to high |
| `sortHigh` | Price: high to low |
| `sortName` | Name A to Z |
| `count` | {left} / {total} available |
| `countLooted` |  · {n} bought |
| `empty.title` | Nothing matches |
| `empty.text` | No items match those filters. Loosen one or reset them. |
| `detailsTitle` | DETAILS |
| `detailsAria` | Details for {name} |
| `details.size` | Size |
| `details.color` | Color |
| `details.wanted` | Wanted |
| `details.notes` | Notes |
| `details.price` | Price |
| `details.checked` | Checked {date} on {shop} |
| `hint` | Sizes & notes in here |
| `dismissTip` | Dismiss tip |
| `view` | View |
| `viewAria` | View {name} on {shop} (opens in a new tab) |
| `sale` | Sale −{pct}% |
| `wasAria` | was {amount} |
| `qtyWanted` | Quantity wanted |
| `qtyLeft` | {left} of {qty} left |
| `qtyLeftTitle` | {left} of {qty} still needed |
| `giftFrom` | From {amount} |
| `giftAny` | Any amount |
| `priceUnknown` | price ? |
| `loot` | Bought it |
| `lootAria` | Mark {name} as bought |
| `lootedTag` | Bought |
| `lootedStamp` | BOUGHT |
| `lootedNote` | Already gifted. Thank you! |
| `lootTitle` | Mark as bought? |
| `lootCopy` | This tells other gift-givers you bought it, so nobody doubles up. {owner} won't see it. |
| `owner` | The wishlist owner |
| `lootQty` | How many did you get? |
| `lootLeft` | {left} of {qty} still needed. |
| `lootError` | Couldn't save that. Check your connection and try again. |
| `cancel` | Cancel |
| `lootConfirm` | Mark as bought |
| `toast` | Thanks! {qty}{name} is marked as gifted. |
| `undo` | Undo |
| `dismiss` | Dismiss |
| `mode.test` | Test mode: fake purchases, nothing is sent |
| `mode.shield` | Spoiler shield on |
| `mode.shieldTitle` | Purchases are hidden in this browser. Visit with ?shield=off to turn this off. |
| `plannerTitle` | Gift helper |
| `plannerTag` | *(blank: hidden)* |
| `mascotLabel` | *(blank: hidden)* |
| `budgetLabel` | Budget |
| `countLabel` | Number of gifts |
| `optional` | (optional) |
| `countPlaceholder` | any |
| `planner.loading` | Loading the list… |
| `planner.idle` | Enter a budget and I'll suggest gifts that fit. |
| `planner.emptyTitle` | No picks yet |
| `planner.emptySub` | Only items the filters are showing are considered. |
| `planner.emptySubClaims` | Only items the filters are showing are considered, and anything already bought is skipped. |
| `planner.bufferNote` | {pct}% of your budget is saved for tax and shipping. |
| `planner.none` | Nothing fits under {budget} once some is saved for tax and shipping. Try a bigger budget or fewer filters. |
| `planner.noneTitle` | Nothing fits |
| `planner.noneSub` | After setting aside {reserve} for tax and shipping, nothing still available fits in {budget}. Raise the budget or loosen the filters. |
| `planner.onlyCard` | Nothing on the list fits, but a {amount} {name} does! |
| `planner.foundOne` | Found one! |
| `planner.foundMany` | Found {n}! |
| `planner.topUp` | …plus a {amount} {name} to use up the rest! |
| `planner.starredFirst` | Starred items went in first. |
| `planner.squeezed` | Used as much of the budget as possible. |
| `planner.picksTitle` | Suggested gifts |
| `planner.gifts` | {n} gift \| {n} gifts |
| `planner.plusCard` |  + gift card |
| `planner.giftCard` | gift card |
| `planner.total` | Gifts {amount} |
| `planner.reserve` | + ~{amount} est. tax & shipping |
| `planner.spare` | {amount} spare |
| `planner.bufferHint` | About {pct}% of the budget is set aside as a rough guess for tax and shipping. Real costs vary by shop and location, so check the total at checkout. |
| `planner.onlyFit` | Only {n} of {want} gifts fit this budget with the current filters. |
| `planner.maxBudget` | The planner can only count up to {amount} at a time. |
| `planner.claimHint` | Bought one? Mark it on its card so nobody doubles up. |
| `planner.giftCardMeta` | Gift card |
| `planner.giftCardMetaRest` | Gift card · uses up the rest |
| `planner.undone` | Undone. It's back on the list. |
| `error.title` | The list is unavailable |
| `error.text` | The wishlist could not be loaded right now. Please refresh the page in a little while. |
| `error.line` | I couldn't reach the spreadsheet. Try refreshing in a minute? |
| `setup.title` | No sheet connected yet |
| `setup.text` | Paste your published Google Sheet link into sheetUrl in config.js. The README has step-by-step setup. |
| `setup.line` | This list has no items yet. Someone needs to connect a spreadsheet. |

### Art (`theme.json` → `"art"`)

Each slot takes the path of an SVG file inside your theme folder. Leave a slot out and that spot is simply empty.

| Slot | Where it shows | Size |
|---|---|---|
| `heroSky` | Top-right corner of the header (clouds, stars) | 420 × 170 |
| `heroScene` | Strip along the bottom of the header (hills, a little house) | wide: 1200 × 178, cropped on phones |
| `portrait` | Small picture beside the welcome message | 46 × 46 |
| `mascotIdle`, `mascotHappy`, `mascotSad` | The gift planner's helper, waiting / found gifts / nothing fits | 64 × 64 |
| `lootBag` | Pops up when a gift-giver marks something as bought | 96 × 96 |

The mascot shows only if at least one mascot slot is filled. Describe each mood for screen readers in `"mascot"`:

```json
"mascot": {
  "name": "Smudge",
  "idle": "Smudge, a fuzzy little soot sprite, looking up",
  "happy": "Smudge, beaming",
  "sad": "Smudge, sweating nervously"
}
```

Tips for art: set a `viewBox` on the `<svg>`, keep files small, and use plain shapes. Scripts, event handlers and embedded HTML are stripped out when the art loads.

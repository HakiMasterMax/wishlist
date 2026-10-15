# Sheet guide

[← Back to the README](../README.md)

Your wishlist lives on the **Items** tab of your Google Sheet. Each row is one thing you'd like, and each column fills in part of its card.

Only `name` is required. Leave anything else blank, put the columns in any order, and add your own columns if you like: the site ignores ones it doesn't know.

## The columns

| Column | What to put there | Where it shows up |
|---|---|---|
| `name` | What the item is called | The card's title |
| `price` | A number. A `$` is fine | The card, the price filter, sorting and the gift helper |
| `starred` | Tick the box (or type `TRUE`) for the things you want most | They're marked as favorites and listed first. Each theme has its own marker: a gold star, a gumdrop, a brass bell |
| `shop` | Where it's sold: Etsy, Amazon, a local shop… | The card and the store filter |
| `category` | What kind of thing it is. Separate several with `:`, like `art: craft` | The category filter. Blank counts as **Other** |
| `quantity` | How many you'd like. Blank means 1 | A "2 of 2 left" tag. The gift helper can suggest it more than once |
| `size`, `color`, `notes` | Anything a gift-giver should know | The ⓘ details on the photo (hover on a computer, tap on a phone) |
| `image` | A link to a photo of it | The card's picture. See [Adding photos](#adding-photos) |
| `link` | The full address of the product page | The **View** button, which opens it in a new tab |

New categories and stores appear as filters on their own. Stores with only one item are grouped under **Other** in the filter so the list stays short, but each card still shows its real store.

> [!TIP]
> Headers are matched loosely, so `Starred?`, `Shop name` or `IMAGE` all work.

## Adding photos

**The easy way.** On the product page, right-click the photo and choose **Copy image address** (on a phone, press and hold the photo). Paste that into the `image` column.

**From Google Drive.** Paste the photo's share link. Set its sharing to **Anyone with the link** first.

**If a store's photos won't show.** Some stores block their images from appearing on other websites. Save the photo instead, upload it to the `wishlist-images` folder of your copy on GitHub, and put its file name in the `image` column (`dice` or `dice.jpg` both work). File names are case-sensitive, and photos around 900px wide keep the page quick.

If a photo can't load, the card shows a friendly placeholder instead.

## Gift cards

Set the row's `category` to `gift card` and put the smallest amount in `price` (like `From $25`), or leave it blank for any amount.

Gift cards show "From $25" or "Any amount", have no "bought it" button (several people can give one), always pass the price filter, and are listed after regular items. The gift helper uses one to fill leftover budget after picking items.

## The Settings tab

| Setting | What it does |
|---|---|
| **Theme** | The look and wording of your shop. Pick one from the dropdown. |
| **Your name** | Shown to gift-givers, e.g. "Sam won't see it" when they mark something as bought. |
| **List title** | Replaces the theme's title, like "Sam's Birthday List". Optional. |
| **Welcome message** | Replaces the theme's welcome note. Type `{i}` where you want the little ⓘ icon. Optional. |
| **Tax & shipping buffer** | How much of a gift-giver's budget the gift helper holds back, like `15%`. Use `0%` to turn it off. |
| **Enable item claiming** | Lets gift-givers mark what they bought. See [Gift claiming](claiming.md). |
| **Claim form link** | Your claim form's link. See [Gift claiming](claiming.md). |

Leave a setting blank to use the theme's own wording. Changes show up on your site within about 5 minutes.

> [!IMPORTANT]
> Keep **Items** as the first tab of the sheet. Your published link opens the first tab, so moving it breaks the list.

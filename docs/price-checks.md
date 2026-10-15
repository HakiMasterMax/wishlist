# Daily price checks

[← Back to the README](../README.md)

Once a day, your copy can check what your items cost right now and show any sales on the cards: the new price in color, the old one crossed out, and a **Sale −25%** tag. The ⓘ details show when the price was last checked, and the gift helper uses current prices.

## Turn it on

Open your copy on GitHub, click the **Actions** tab, and click the button to enable workflows. That's it. It runs every morning (about 7:17am Pacific).

To run it right away, go to **Actions → Update prices → Run workflow**.

## Which stores it checks

| Store | Checked? |
|---|---|
| Steam | Yes, including sales |
| Nintendo | Yes, including sales |
| Etsy | Yes, once you add a free API key (below). Etsy's API gives the normal price, so Etsy sales and coupons may not show. Links that pick a specific size or style (`variation=` in the link) are skipped. |
| Amazon and everything else | No. The price from your sheet is used. |

## Adding an Etsy key

1. Create a free app at [etsy.com/developers](https://www.etsy.com/developers/register).
2. In your copy on GitHub, go to **Settings → Secrets and variables → Actions → New repository secret**.
3. Name it `ETSY_API_KEY`. For the value, enter your app's keystring and shared secret joined by a colon: `keystring:shared_secret`.

## How it works

The check (`scripts/update-prices.mjs`, run by `.github/workflows/update-prices.yml`) reads your sheet link from `config.js` and saves the results to a separate `prices` branch. It never adds commits to `main`, so it won't get in the way of **Sync fork**. The site uses those prices when they're less than 3 days old.

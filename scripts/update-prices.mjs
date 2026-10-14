// Daily price check for the wishlist. Run by .github/workflows/update-prices.yml (Node 20+, no dependencies).
//
// Reads the published wishlist sheet, looks up the current price for each link it knows how to check,
// and writes wishlist-site/prices.json. The site shows those prices (and sales) when they are recent,
// and falls back to the sheet price otherwise.
//
// Supported:
//   Steam     store.steampowered.com/app/<id>/...   public storefront API, no key
//   Nintendo  nintendo.com/us/store/products/...    product page -> nsuid -> public eShop price API, no key
//   Etsy      etsy.com/listing/<id>/...             official Open API v3, needs ETSY_API_KEY ("keystring:shared_secret")
// Not checked: Amazon (no permitted way without an affiliate/paid API) and anything else.

import { readFile, writeFile } from 'node:fs/promises';

const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQAmDkwXniM3Tz36huytvYjJjBNp1WnambIZV7VS9YQ1-vxYt4ucaziRu6iDFf805wrWUJwmZ9FHalx/pub?output=csv';
const OUT = new URL('../wishlist-site/prices.json', import.meta.url);
const ETSY_KEY = process.env.ETSY_API_KEY || '';
const UA = 'Mozilla/5.0 (compatible; wishlist-price-check/1.0; +https://github.com/nicolenadine/wishlist)';

function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

async function get(url, opts = {}) {
  const res = await fetch(url, { redirect: 'follow', ...opts, headers: { 'user-agent': UA, ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}

const round = (n) => Math.round(n * 100) / 100;

async function steam(link) {
  const id = (link.match(/store\.steampowered\.com\/app\/(\d+)/) || [])[1];
  if (!id) throw new Error('no Steam app id');
  const data = await (await get(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=us&l=en&filters=price_overview`)).json();
  const entry = data[id];
  if (!entry || !entry.success) throw new Error('Steam lookup failed');
  const po = entry.data && entry.data.price_overview;
  if (!po) throw new Error('no price on Steam (free or unreleased?)');
  return { price: po.final / 100, regular: po.initial / 100, currency: po.currency };
}

async function nintendo(link) {
  const html = await (await get(link)).text();
  const nsuid = (html.match(/"nsuid"\s*:\s*"(70\d{12})"/) || html.match(/\b(70010\d{9})\b/) || [])[1];
  if (!nsuid) throw new Error('no nsuid on Nintendo page');
  const data = await (await get(`https://api.ec.nintendo.com/v1/price?country=US&lang=en&ids=${nsuid}`)).json();
  const p = data.prices && data.prices[0];
  if (!p || !p.regular_price) throw new Error('no Nintendo price');
  const regular = parseFloat(p.regular_price.raw_value);
  const sale = p.discount_price ? parseFloat(p.discount_price.raw_value) : regular;
  return { price: sale, regular, currency: p.regular_price.currency };
}

async function etsy(link) {
  if (!ETSY_KEY) throw new Error('skipped: no ETSY_API_KEY secret');
  const id = (link.match(/etsy\.com\/(?:[a-z-]+\/)?listing\/(\d+)/) || [])[1];
  if (!id) throw new Error('no Etsy listing id');
  // The API only gives the listing's base price, which can differ from a chosen size/style.
  if (/[?&]variation\d*=/.test(link)) throw new Error('skipped: link picks a size/style variation');
  const l = await (await get(`https://openapi.etsy.com/v3/application/listings/${id}`, { headers: { 'x-api-key': ETSY_KEY } })).json();
  if (!l.price) throw new Error('no Etsy price');
  if (l.state && l.state !== 'active') throw new Error('Etsy listing is ' + l.state);
  const price = l.price.amount / l.price.divisor;
  return { price, regular: price, currency: l.price.currency_code };
}

function checkerFor(link) {
  if (/store\.steampowered\.com\/app\//.test(link)) return ['steam', steam];
  if (/nintendo\.com\/[a-z-]+\/store\/products\//.test(link)) return ['nintendo', nintendo];
  if (/etsy\.com\/(?:[a-z-]+\/)?listing\//.test(link)) return ['etsy', etsy];
  return null;
}

async function main() {
  let previous = {};
  try { previous = JSON.parse(await readFile(OUT, 'utf8')).prices || {}; } catch { /* first run */ }

  const rows = parseCSV(await (await get(SHEET_CSV)).text());
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const iName = header.indexOf('item_name');
  const iLink = header.indexOf('link');
  const prices = {};
  const log = [];

  for (const r of rows.slice(1)) {
    const name = (r[iName] || '').trim();
    const link = (r[iLink] || '').trim();
    if (!name || !link) continue;
    const checker = checkerFor(link);
    if (!checker) { log.push(`-  ${name}: not checked`); continue; }
    const [source, fn] = checker;
    try {
      const got = await fn(link);
      if (got.currency && got.currency !== 'USD') throw new Error('non-USD price ' + got.currency);
      prices[link] = { price: round(got.price), regular: round(got.regular), source, checked: new Date().toISOString() };
      log.push(`✓  ${name}: $${prices[link].price}` + (got.regular > got.price ? ` (was $${round(got.regular)})` : ''));
    } catch (err) {
      if (previous[link]) prices[link] = previous[link]; // keep the last good check; the site ignores stale ones
      log.push(`!  ${name} [${source}]: ${err.message}`);
    }
    await new Promise((res) => setTimeout(res, 400)); // be gentle
  }

  await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), prices }, null, 2) + '\n');
  console.log(log.join('\n'));
}

main().catch((err) => { console.error(err); process.exit(1); });

/* Wishlist Item Shop
 * Reads a published Google Sheet (CSV) and renders it as a filterable storefront.
 * Gift-givers can mark items as "looted" (purchased); those claims go to a Google Form
 * and are read back from that form's published response sheet.
 * No build step and no dependencies. Settings live in config.js.
 *
 * URL switches
 *   ?shield        turn the spoiler shield ON in this browser (remembered). Claims are never loaded.
 *   ?shield=off    turn the spoiler shield off again in this browser.
 *   ?test-claims   use made-up claims and don't send anything (works even with the shield on).
 */
(() => {
  'use strict';

  const DEFAULTS = {
    sheetUrl: '',
    ownerName: '',
    imageFolder: 'wishlist-images/',
    taxShippingBuffer: 0.15,
    claims: { csvUrl: '', formUrl: '', itemField: '', qtyField: '', refField: '' },
    imageExtensions: ['jpg', 'png', 'jpeg', 'webp'],
    maxPlannerBudget: 5000,
    maxPriceAgeDays: 3,
    groupSmallShops: 2,
  };
  const USER = window.WISHLIST_CONFIG || {};
  const CONFIG = { ...DEFAULTS, ...USER, claims: { ...DEFAULTS.claims, ...(USER.claims || {}) } };
  if (!CONFIG.sheetUrl && USER.dataUrl) CONFIG.sheetUrl = USER.dataUrl; // older setting name
  if (CONFIG.imageFolder && !CONFIG.imageFolder.endsWith('/')) CONFIG.imageFolder += '/';
  CONFIG.pricesUrls = pricesUrls();

  // Daily prices are written to prices.json on the repo's "prices" branch by the GitHub Action
  // (scripts/update-prices.mjs). On GitHub Pages, read it from there; locally, try a prices.json next to the page.
  function pricesUrls() {
    const urls = [];
    const host = window.location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (host) {
      const first = window.location.pathname.split('/').filter(Boolean)[0];
      // A project site lives at owner.github.io/<repo>/; a user site's repo is named owner.github.io.
      const repo = first && first.toLowerCase() !== 'index.html' ? first : host[1] + '.github.io';
      urls.push('https://raw.githubusercontent.com/' + host[1] + '/' + repo + '/prices/prices.json');
    }
    urls.push('prices.json');
    return urls;
  }

  /* Sheet columns. Headers are matched loosely: case, spaces and punctuation are ignored,
   * so "Starred?", "STARRED" and "starred" all work. Older names stay supported. */
  const COLUMNS = {
    name: ['name', 'item_name', 'item', 'title'],
    price: ['price', 'cost'],
    size: ['size'],
    color: ['color', 'colour', 'color_or_pattern', 'pattern'],
    quantity: ['quantity', 'qty', 'how_many'],
    starred: ['starred', 'star', 'excite', 'really_want', 'favorite', 'favourite', 'must_have'],
    shop: ['shop', 'source', 'store', 'vendor', 'merchant'],
    category: ['category', 'categories', 'tags', 'tag', 'type'],
    image: ['image', 'image_name', 'photo', 'picture'],
    notes: ['notes', 'note', 'details'],
    link: ['link', 'url'],
  };
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

  // Returns { field: columnIndex }. Exact matches win; then a header that starts with
  // a known name ("Shop name", "Image file") fills any field still missing.
  function mapColumns(headerRow) {
    const header = headerRow.map(norm);
    const used = new Set();
    const map = {};
    for (const [field, names] of Object.entries(COLUMNS)) {
      for (const n of names.map(norm)) {
        const i = header.findIndex((h, j) => h === n && !used.has(j));
        if (i >= 0) { map[field] = i; used.add(i); break; }
      }
    }
    for (const [field, names] of Object.entries(COLUMNS)) {
      if (field in map) continue;
      for (const n of names.map(norm)) {
        const i = header.findIndex((h, j) => h && h.startsWith(n) && !used.has(j));
        if (i >= 0) { map[field] = i; used.add(i); break; }
      }
    }
    return map;
  }

  const PRICE_BANDS = [
    { id: 'all', label: 'Any', min: -Infinity, max: Infinity },
    { id: 'a', label: 'Under $25', min: 0, max: 25 },
    { id: 'b', label: '$25-50', min: 25, max: 50 },
    { id: 'c', label: '$50-100', min: 50, max: 100 },
    { id: 'd', label: '$100+', min: 100, max: Infinity },
  ];

  const GIFT_SVG = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges"><path d="M2 6h12v8H2z" style="fill:var(--accent)"/><path d="M1 4h14v3H1z" style="fill:var(--accent-mid)"/><path d="M7 4h2v10H7z" style="fill:var(--star)"/><path d="M1 4h14v1H1zM1 6h14v1H1zM1 4h1v3H1zM14 4h1v3h-1zM2 7h1v7H2zM13 7h1v7h-1zM2 13h12v1H2zM4 1h2v1H4zM10 1h2v1h-2zM3 2h1v2H3zM6 2h1v2H6zM9 2h1v2H9zM12 2h1v2h-1z" style="fill:var(--text)"/></svg>';
  const STAR_PATH = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z';
  const SHIELD_KEY = 'wishlist-spoiler-shield';
  const PENDING_KEY = 'wishlist-pending-claims';
  const PENDING_TTL = 10 * 60 * 1000; // a local claim counts for 10 min or until the sheet shows it

  /* ---------- theme: words and art ----------
   * Plain default wording. A theme's theme.json "text" can replace any of these.
   * {placeholders} are filled in; "one | many" picks a form by {n}; {i} becomes the little info icon. */
  const TEXT = {
    title: 'My Wishlist',
    eventTag: '',
    welcomeName: '',
    welcome: 'Everything here is on my wishlist. Starred items are the ones I want most. Tap the {i} on a photo for sizes, colors and notes.',
    footer: 'Made from a spreadsheet.',
    loading: 'loading…',
    'stat.items': '{n} item | {n} items',
    'stat.starred': '{n} starred',
    'stat.shops': '{n} shop | {n} shops',
    starred: 'Starred',
    starredOnly: 'Starred only',
    starBadge: 'Starred: most wanted',
    searchLabel: 'Search',
    searchPlaceholder: 'Search the list',
    typeFilter: 'Category',
    shopFilter: 'Shop',
    priceFilter: 'Price',
    reset: 'Reset filters',
    filtersLabel: 'Filters',
    resultsLabel: 'Wishlist items',
    sortLabel: 'Sort',
    sortStarred: 'Starred first',
    sortLow: 'Price: low to high',
    sortHigh: 'Price: high to low',
    sortName: 'Name A to Z',
    count: '{left} / {total} available',
    countLooted: ' · {n} bought',
    'empty.title': 'Nothing matches',
    'empty.text': 'No items match those filters. Loosen one or reset them.',
    detailsTitle: 'DETAILS',
    detailsAria: 'Details for {name}',
    'details.size': 'Size',
    'details.color': 'Color',
    'details.wanted': 'Wanted',
    'details.notes': 'Notes',
    'details.price': 'Price',
    'details.checked': 'Checked {date} on {shop}',
    hint: 'Sizes & notes in here',
    dismissTip: 'Dismiss tip',
    view: 'View',
    viewAria: 'View {name} on {shop} (opens in a new tab)',
    sale: 'Sale −{pct}%',
    wasAria: 'was {amount}',
    qtyWanted: 'Quantity wanted',
    qtyLeft: '{left} of {qty} left',
    qtyLeftTitle: '{left} of {qty} still needed',
    giftFrom: 'From {amount}',
    giftAny: 'Any amount',
    priceUnknown: 'price ?',
    loot: 'Bought it',
    lootAria: 'Mark {name} as bought',
    lootedTag: 'Bought',
    lootedStamp: 'BOUGHT',
    lootedNote: 'Already gifted. Thank you!',
    lootTitle: 'Mark as bought?',
    lootCopy: "This tells other gift-givers you bought it, so nobody doubles up. {owner} won't see it.",
    owner: 'The wishlist owner',
    lootQty: 'How many did you get?',
    lootLeft: '{left} of {qty} still needed.',
    lootError: "Couldn't save that. Check your connection and try again.",
    cancel: 'Cancel',
    lootConfirm: 'Mark as bought',
    toast: 'Thanks! {qty}{name} is marked as gifted.',
    undo: 'Undo',
    dismiss: 'Dismiss',
    'mode.test': 'Test mode: fake purchases, nothing is sent',
    'mode.shield': 'Spoiler shield on',
    'mode.shieldTitle': 'Purchases are hidden in this browser. Visit with ?shield=off to turn this off.',
    plannerTitle: 'Gift helper',
    plannerTag: '',
    mascotLabel: '',
    budgetLabel: 'Budget',
    countLabel: 'Number of gifts',
    optional: '(optional)',
    countPlaceholder: 'any',
    'planner.loading': 'Loading the list…',
    'planner.idle': "Enter a budget and I'll suggest gifts that fit.",
    'planner.emptyTitle': 'No picks yet',
    'planner.emptySub': 'Only items the filters are showing are considered.',
    'planner.emptySubClaims': 'Only items the filters are showing are considered, and anything already bought is skipped.',
    'planner.bufferNote': '{pct}% of your budget is saved for tax and shipping.',
    'planner.none': 'Nothing fits under {budget} once some is saved for tax and shipping. Try a bigger budget or fewer filters.',
    'planner.noneTitle': 'Nothing fits',
    'planner.noneSub': 'After setting aside {reserve} for tax and shipping, nothing still available fits in {budget}. Raise the budget or loosen the filters.',
    'planner.onlyCard': 'Nothing on the list fits, but a {amount} {name} does!',
    'planner.foundOne': 'Found one!',
    'planner.foundMany': 'Found {n}!',
    'planner.topUp': '…plus a {amount} {name} to use up the rest!',
    'planner.starredFirst': 'Starred items went in first.',
    'planner.squeezed': 'Used as much of the budget as possible.',
    'planner.picksTitle': 'Suggested gifts',
    'planner.gifts': '{n} gift | {n} gifts',
    'planner.plusCard': ' + gift card',
    'planner.giftCard': 'gift card',
    'planner.total': 'Gifts {amount}',
    'planner.reserve': '+ ~{amount} est. tax & shipping',
    'planner.spare': '{amount} spare',
    'planner.bufferHint': 'About {pct}% of the budget is set aside as a rough guess for tax and shipping. Real costs vary by shop and location, so check the total at checkout.',
    'planner.onlyFit': 'Only {n} of {want} gifts fit this budget with the current filters.',
    'planner.maxBudget': 'The planner can only count up to {amount} at a time.',
    'planner.claimHint': 'Bought one? Mark it on its card so nobody doubles up.',
    'planner.giftCardMeta': 'Gift card',
    'planner.giftCardMetaRest': 'Gift card · uses up the rest',
    'planner.undone': "Undone. It's back on the list.",
    'error.title': 'The list is unavailable',
    'error.text': 'The wishlist could not be loaded right now. Please refresh the page in a little while.',
    'error.line': "I couldn't reach the spreadsheet. Try refreshing in a minute?",
    'setup.title': 'No sheet connected yet',
    'setup.text': 'Paste your published Google Sheet link into sheetUrl in config.js. The README has step-by-step setup.',
    'setup.line': 'This list has no items yet. Someone needs to connect a spreadsheet.',
  };

  const THEME = { name: window.WISHLIST_THEME || 'rpg-shop', text: {}, mascot: null, art: {} };

  function t(key, vars) {
    let s = Object.prototype.hasOwnProperty.call(THEME.text, key) ? THEME.text[key] : TEXT[key];
    if (s == null) return key;
    s = String(s);
    const v = { mascot: (THEME.mascot && THEME.mascot.name) || 'The planner', ...vars };
    if (s.includes(' | ')) { const [one, many] = s.split(' | '); s = v.n === 1 ? one : many; }
    return s.replace(/\{(\w+)\}/g, (m, k) => (k !== 'i' && v[k] != null ? String(v[k]) : m));
  }

  // Sets an element's text, turning {i} into the little info icon.
  function fillText(node, s) {
    const parts = String(s).split('{i}');
    node.replaceChildren(...parts.flatMap((p, n) => (n ? [infoIcon(), p] : [p])));
  }
  const infoIcon = () => {
    const i = document.createElement('span');
    i.className = 'inline-i'; i.setAttribute('aria-label', 'info'); i.textContent = 'i';
    return i;
  };

  // Theme art is plain SVG. Anything script-like is stripped before it touches the page.
  function safeSvg(markup) {
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
    root.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
    [root, ...root.querySelectorAll('*')].forEach((n) => [...n.attributes].forEach((a) => {
      if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
    }));
    return document.importNode(root, true);
  }

  async function loadTheme() {
    const base = 'themes/' + THEME.name + '/';
    let data = {};
    try {
      const res = await fetch(base + 'theme.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    } catch (err) {
      console.warn('[wishlist] could not load theme "' + THEME.name + '", using plain defaults:', err);
    }
    THEME.text = (data && data.text) || {};
    THEME.mascot = (data && data.mascot) || null;
    const art = (data && data.art) || {};
    await Promise.all(Object.entries(art).map(async ([slot, file]) => {
      if (!/^[\w./-]+\.svg$/i.test(String(file)) || String(file).includes('..')) return;
      try {
        const res = await fetch(base + file, { cache: 'no-cache' });
        const node = res.ok ? safeSvg(await res.text()) : null;
        if (node) THEME.art[slot] = node;
      } catch (err) { console.warn('[wishlist] could not load theme art', file, err); }
    }));
    applyTheme();
  }

  function applyTheme() {
    document.title = t('title');
    document.querySelectorAll('[data-t]').forEach((n) => fillText(n, t(n.dataset.t)));
    document.querySelectorAll('[data-t-placeholder]').forEach((n) => n.setAttribute('placeholder', t(n.dataset.tPlaceholder)));
    document.querySelectorAll('[data-t-aria]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.tAria)));
    document.querySelectorAll('[data-hide-if-empty]').forEach((n) => { n.hidden = !t(n.dataset.hideIfEmpty); });
    fillText($('#loot-copy'), t('lootCopy', { owner: String(CONFIG.ownerName || '').trim() || t('owner') }));
    document.querySelectorAll('[data-art]').forEach((slot) => {
      const art = THEME.art[slot.dataset.art];
      slot.replaceChildren(...(art ? [art.cloneNode(true)] : []));
    });
    const hasMascot = ['mascotIdle', 'mascotHappy', 'mascotSad'].some((k) => THEME.art[k]);
    if (THEME.mascot && THEME.mascot.idle) $('#mascot').setAttribute('aria-label', THEME.mascot.idle);
    $('.mascot-col').hidden = !hasMascot;
    $('.planner').classList.toggle('no-mascot', !hasMascot);
    document.documentElement.classList.remove('theme-loading');
  }

  /* ---------- mode ---------- */

  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    del(k) { try { window.localStorage.removeItem(k); } catch (e) { /* private mode */ } },
  };

  const params = new URLSearchParams(window.location.search);
  if (params.has('shield')) {
    if (params.get('shield') === 'off') store.del(SHIELD_KEY);
    else store.set(SHIELD_KEY, 'on');
  }
  const SHIELD = store.get(SHIELD_KEY) === 'on';
  const TEST = params.has('test-claims');
  const c = CONFIG.claims;
  const CLAIMS_CONFIGURED = Boolean(c.csvUrl && c.formUrl && c.itemField && c.qtyField);
  // Test mode only ever uses fake claims, so it's allowed even behind the spoiler shield.
  const CLAIMS_ON = TEST || (!SHIELD && CLAIMS_CONFIGURED);
  const pendingKey = TEST ? PENDING_KEY + '-test' : PENDING_KEY;

  const state = {
    items: [],
    sheetClaims: new Map(), // key -> qty claimed according to the sheet
    sheetRefs: new Set(),   // refs already in the sheet
    q: '',
    starOnly: false,
    vendorsOff: new Set(),
    types: new Set(),
    band: 'all',
    sort: 'wanted',
    budget: '',
    count: '',
  };

  /* ---------- helpers ---------- */

  const $ = (sel) => document.querySelector(sel);

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const ch of [].concat(children || [])) {
      if (ch == null || ch === false) continue;
      node.append(ch.nodeType ? ch : document.createTextNode(String(ch)));
    }
    return node;
  }

  function svg(markup) {
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstChild;
  }

  const starSvg = (size) =>
    svg(`<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${STAR_PATH}" style="fill:var(--text)"/></svg>`);
  const chestSvg = () =>
    svg('<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges"><path d="M2 5h12v9H2z" style="fill:var(--star)"/><path d="M2 5h12v1H2zM2 13h12v1H2zM1 5h1v9H1zM14 5h1v9h-1zM2 8h12v1H2zM3 3h10v2H3zM2 4h1v1H2zM13 4h1v1h-1zM4 2h8v1H4z" fill="currentColor"/><path d="M7 7h2v3H7z" fill="currentColor"/></svg>');

  const fmt = (v) => '$' + (Math.round(v * 100) % 100 === 0 ? String(Math.round(v)) : v.toFixed(2));
  const titleCase = (s) => s.toLowerCase().replace(/(^|[\s/-])(\w)/g, (m, a, b) => a + b.toUpperCase());
  const truthy = (v) => /^(true|yes|y|1|x|✓)$/i.test(String(v).trim());
  const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : null);
  const keyOf = (name) => String(name).trim().toLowerCase().replace(/\s+/g, ' ');

  /* ---------- CSV ---------- */

  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch !== '\r') field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  }

  function toItems(rows) {
    if (!rows.length) return [];
    const cols = mapColumns(rows[0]);
    const missing = ['name', 'price'].filter((f) => !(f in cols));
    if (missing.length) console.warn('[wishlist] could not find these columns in the sheet:', missing.join(', '));
    const get = (r, field) => {
      const i = cols[field];
      return i != null && r[i] != null ? r[i].trim() : '';
    };
    return rows.slice(1).map((r, n) => {
      const priceNum = get(r, 'price').replace(/,/g, '').match(/\d+(?:\.\d+)?/); // "$12.99", "From $25", "Any amount"
      const price = priceNum ? parseFloat(priceNum[0]) : NaN;
      let tags = get(r, 'category').split(/[:;,]/).map((t) => t.trim()).filter(Boolean).map(titleCase);
      tags = [...new Set(tags)];
      tags = [...new Set(tags.map((t) => (/^gift ?cards?$/i.test(t) ? 'Gift Cards' : t)))];
      if (!tags.length) tags = ['Other'];
      const name = get(r, 'name');
      return {
        id: n,
        key: keyOf(name),
        name,
        price: Number.isFinite(price) ? price : NaN,
        giftCard: tags.includes('Gift Cards'),
        giftMin: Number.isFinite(price) && price > 0 ? price : 0,
        size: get(r, 'size'),
        color: get(r, 'color'),
        qty: Math.max(1, parseInt(get(r, 'quantity'), 10) || 1),
        starred: truthy(get(r, 'starred')),
        vendor: get(r, 'shop') || 'Other',
        tags,
        image: get(r, 'image'),
        notes: get(r, 'notes'),
        link: safeUrl(get(r, 'link')),
      };
    }).filter((it) => it.name);
  }

  // Shops with only a few items fold into "Other" in the shop filter so the list stays short.
  // Cards still show each item's real shop.
  function groupShops(items) {
    const min = Math.max(0, parseInt(CONFIG.groupSmallShops, 10) || 0);
    const counts = new Map();
    items.forEach((it) => counts.set(it.vendor, (counts.get(it.vendor) || 0) + 1));
    items.forEach((it) => { it.shopGroup = counts.get(it.vendor) < min ? 'Other' : it.vendor; });
  }

  /* ---------- claims ---------- */

  // Reads the form's response sheet: columns are Timestamp plus the form questions.
  function readClaims(rows) {
    const totals = new Map();
    const refs = new Set();
    if (!rows.length) return { totals, refs };
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const find = (word) => header.findIndex((h) => h.includes(word));
    const iItem = find('item');
    const iQty = find('quant');
    const iRef = find('ref');
    if (iItem < 0 || iQty < 0) return { totals, refs };
    rows.slice(1).forEach((r) => {
      const key = keyOf(r[iItem] || '');
      const qty = parseInt(r[iQty], 10);
      if (!key || !Number.isFinite(qty)) return;
      totals.set(key, (totals.get(key) || 0) + qty);
      if (iRef >= 0 && r[iRef]) refs.add(r[iRef].trim());
    });
    return { totals, refs };
  }

  function testClaimsRows(items) {
    // Made-up claims so the looted styling can be worked on without real data.
    const pick = (i, q) => (items[i] ? [items[i].name, String(q)] : null);
    const rows = [['Timestamp', 'item', 'quantity', 'ref']];
    [pick(3, 1), pick(14, 1), pick(1, 1), pick(items.length - 1, 3)].filter(Boolean)
      .forEach(([name, q], n) => rows.push(['', name, q, 'test-' + n]));
    return rows;
  }

  function loadPending() {
    try {
      const list = JSON.parse(store.get(pendingKey) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function savePending(list) { store.set(pendingKey, JSON.stringify(list)); }

  // Local claims this browser made that the published sheet hasn't caught up with yet.
  function livePending() {
    const now = Date.now();
    const list = loadPending().filter((p) => now - p.at < PENDING_TTL && !state.sheetRefs.has(p.ref));
    savePending(list);
    return list;
  }

  function applyClaims() {
    const totals = new Map(state.sheetClaims);
    livePending().forEach((p) => totals.set(p.key, (totals.get(p.key) || 0) + p.qty));
    state.items.forEach((it) => {
      const claimed = CLAIMS_ON ? Math.max(0, totals.get(it.key) || 0) : 0;
      it.remaining = Math.max(0, it.qty - claimed);
      if (it.giftCard) { it.remaining = it.qty; it.looted = false; return; } // never "used up"
      it.looted = CLAIMS_ON && it.remaining === 0;
    });
  }

  async function sendClaim(item, qty) {
    const ref = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    if (!TEST) {
      const body = new URLSearchParams();
      body.set(c.itemField, item.name);
      body.set(c.qtyField, String(qty));
      if (c.refField) body.set(c.refField, ref);
      // Google Forms doesn't allow reading the reply cross-origin; a network error still throws.
      await fetch(c.formUrl, { method: 'POST', mode: 'no-cors', body });
    }
    const list = loadPending();
    list.push({ key: item.key, qty, ref, at: Date.now() });
    savePending(list);
    return ref;
  }

  /* ---------- filtering ---------- */

  function filtered() {
    const band = PRICE_BANDS.find((b) => b.id === state.band) || PRICE_BANDS[0];
    const q = state.q.trim().toLowerCase();
    return state.items.filter((it) => {
      if (state.vendorsOff.has(it.shopGroup)) return false;
      if (state.starOnly && !it.starred) return false;
      if (state.types.size && !it.tags.some((t) => state.types.has(t))) return false;
      if (band.id !== 'all' && !it.giftCard && !(it.price >= band.min && it.price < band.max)) return false;
      if (q) {
        const hay = [it.name, it.vendor, it.tags.join(' '), it.color, it.notes].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  const priceKey = (it, dir) => (Number.isNaN(it.price) ? Infinity : dir * it.price);
  const SORTS = {
    wanted: (a, b) => (b.starred - a.starred) || (priceKey(a, 1) - priceKey(b, 1)),
    low: (a, b) => priceKey(a, 1) - priceKey(b, 1),
    high: (a, b) => priceKey(a, -1) - priceKey(b, -1),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  // Looted items always sink to the end.
  const sortWith = (fn) => (a, b) => (a.looted - b.looted) || (a.giftCard - b.giftCard) || fn(a, b);

  /* ---------- filter controls ---------- */

  function buildFilters() {
    const types = [...new Set(state.items.flatMap((it) => it.tags))].filter((t) => t !== 'Other').sort();
    types.push('Other');
    $('#type-chips').replaceChildren(...types.map((t) => el('button', {
      type: 'button', class: 'chip chip-pill', 'aria-pressed': 'false', 'data-type': t, text: t,
      onclick: (e) => {
        state.types.has(t) ? state.types.delete(t) : state.types.add(t);
        e.currentTarget.setAttribute('aria-pressed', String(state.types.has(t)));
        render();
      },
    })));

    const vendors = [...new Set(state.items.map((it) => it.shopGroup))]
      .sort((a, b) => (a === 'Other') - (b === 'Other') || a.localeCompare(b));
    $('#vendor-list').replaceChildren(...vendors.map((v) => {
      const inGroup = state.items.filter((it) => it.shopGroup === v);
      const shops = [...new Set(inGroup.map((it) => it.vendor))].sort();
      const input = el('input', {
        type: 'checkbox', checked: true, 'data-vendor': v,
        onchange: (e) => { e.target.checked ? state.vendorsOff.delete(v) : state.vendorsOff.add(v); render(); },
      });
      // "Other" lists the shops it holds, so a gift-giver can still see what's in there.
      const named = shops.filter((sh) => sh !== 'Other');
      const title = v === 'Other' && named.length ? 'Includes ' + named.join(', ') : null;
      return el('label', { class: 'vendor', title }, [
        input,
        el('span', { class: 'vendor-name', text: v }),
        el('span', { class: 'vendor-count', text: inGroup.length }),
      ]);
    }));

    $('#price-chips').replaceChildren(...PRICE_BANDS.map((b) => el('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(b.id === state.band), 'data-band': b.id, text: b.label,
      onclick: () => {
        state.band = b.id;
        document.querySelectorAll('#price-chips .chip').forEach((ch) => ch.setAttribute('aria-pressed', String(ch.dataset.band === b.id)));
        render();
      },
    })));
  }

  function resetFilters() {
    state.q = ''; state.starOnly = false; state.vendorsOff.clear(); state.types.clear(); state.band = 'all';
    $('#q').value = '';
    $('#star-only').checked = false;
    document.querySelectorAll('#vendor-list input').forEach((i) => { i.checked = true; });
    document.querySelectorAll('#type-chips .chip').forEach((ch) => ch.setAttribute('aria-pressed', 'false'));
    document.querySelectorAll('#price-chips .chip').forEach((ch) => ch.setAttribute('aria-pressed', String(ch.dataset.band === 'all')));
    render();
  }

  /* ---------- cards ---------- */

  // The image column holds either a pasted image link or a file name in the photo folder.
  function imageCandidates(value) {
    const v = value.trim();
    if (/^https?:\/\//i.test(v)) {
      // A Google Drive share link points at a viewer page, not the image itself.
      const drive = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/i);
      return [drive ? 'https://drive.google.com/thumbnail?id=' + drive[1] + '&sz=w1000' : v];
    }
    const base = CONFIG.imageFolder + encodeURIComponent(v);
    return /\.[a-z0-9]{2,5}$/i.test(v) ? [base] : CONFIG.imageExtensions.map((ext) => base + '.' + ext);
  }

  function photo(it) {
    const box = el('div', { class: 'photo' });
    const placeholder = () => el('div', { class: 'photo-empty' }, [
      svg('<svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/></svg>'),
      'no photo yet',
    ]);
    if (it.image) {
      const candidates = imageCandidates(it.image);
      let i = 0;
      // no-referrer: some shops refuse images requested from other sites.
      const img = el('img', { alt: it.name, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', src: candidates[0] });
      img.addEventListener('error', () => {
        i += 1;
        if (i < candidates.length) img.src = candidates[i];
        else img.replaceWith(placeholder());
      });
      box.append(img);
    } else {
      box.append(placeholder());
    }
    if (it.looted) box.append(el('div', { class: 'looted-stamp', 'aria-hidden': 'true', text: t('lootedStamp') }));
    return box;
  }

  function details(it) {
    const rows = [];
    if (it.size) rows.push([t('details.size'), it.size]);
    if (it.color) rows.push([t('details.color'), it.color]);
    if (it.qty > 1) rows.push([t('details.wanted'), '×' + it.qty]);
    if (it.notes) rows.push([t('details.notes'), it.notes]);
    if (it.checked) rows.push([t('details.price'), t('details.checked', { date: it.checked.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), shop: it.vendor })]);
    if (!rows.length) return null;

    const id = 'details-' + it.id;
    const wrap = el('div', { class: 'info' });
    const btn = el('button', {
      type: 'button', class: 'info-btn', 'aria-expanded': 'false', 'aria-controls': id,
      'aria-label': t('detailsAria', { name: it.name }),
      onclick: (e) => {
        e.stopPropagation();
        dismissHint();
        const open = !wrap.classList.contains('is-open');
        closeAllDetails();
        wrap.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
      },
    }, svg('<svg aria-hidden="true" width="20" height="20" viewBox="0 0 8 8" shape-rendering="crispEdges"><path d="M3 1h2v1h-2zM3 3h2v4h-2z" fill="currentColor"/></svg>'));
    const panel = el('div', { class: 'details', id, role: 'note' }, [
      el('div', { class: 'details-title', text: t('detailsTitle') }),
      el('dl', null, rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])),
    ]);
    wrap.append(btn, panel);
    return wrap;
  }

  function closeAllDetails() {
    document.querySelectorAll('.info.is-open').forEach((w) => {
      w.classList.remove('is-open');
      w.querySelector('.info-btn').setAttribute('aria-expanded', 'false');
    });
  }

  function qtyTag(it) {
    if (it.looted) return el('span', { class: 'tag tag-looted', text: t('lootedTag') });
    if (CLAIMS_ON && it.qty > 1) {
      return el('span', { class: 'tag tag-qty', title: t('qtyLeftTitle', { left: it.remaining, qty: it.qty }), text: t('qtyLeft', { left: it.remaining, qty: it.qty }) });
    }
    if (it.qty > 1) return el('span', { class: 'tag tag-qty', title: t('qtyWanted'), text: '×' + it.qty });
    return null;
  }

  function card(it) {
    const legendary = it.starred;
    const tags = [
      legendary && el('span', { class: 'tag tag-legend', text: t('starred') }),
      el('span', { class: 'tag' + (legendary ? ' tag-vendor-on-gold' : ''), text: it.vendor }),
      el('span', { class: 'tag tag-type', text: it.tags.join(' + ') }),
      it.wasPrice && el('span', { class: 'tag tag-sale', text: t('sale', { pct: it.salePct }) }),
      qtyTag(it),
    ];
    const view = it.link
      ? el('a', {
          class: 'view', href: it.link, target: '_blank', rel: 'noopener noreferrer',
          'aria-label': t('viewAria', { name: it.name, shop: it.vendor }),
        }, [
          el('span', { text: t('view') }),
          svg('<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>'),
        ])
      : null;
    const loot = CLAIMS_ON && !it.looted && !it.giftCard
      ? el('button', {
          type: 'button', class: 'loot-btn', 'aria-label': t('lootAria', { name: it.name }),
          onclick: () => openLootDialog(it),
        }, [chestSvg(), el('span', { text: t('loot') })])
      : null;

    let cls = 'card';
    if (legendary) cls += ' is-legendary';
    if (it.looted) cls += ' is-looted';

    return el('article', { class: cls, 'data-item': it.id }, [
      legendary && el('div', { class: 'star-badge', role: 'img', 'aria-label': t('starBadge') }, starSvg(26)),
      photo(it),
      details(it),
      el('div', { class: 'card-body' }, [
        el('div', { class: 'tags' }, tags),
        el('h2', { text: it.name }),
        el('div', { class: 'card-foot' }, [
          it.giftCard ? el('span', { class: 'price is-giftcard' }, [
            svg(GIFT_SVG),
            it.giftMin ? t('giftFrom', { amount: fmt(it.giftMin) }) : t('giftAny'),
          ]) : el('span', { class: 'price' + (it.wasPrice ? ' is-sale' : '') }, [
            Number.isNaN(it.price) ? t('priceUnknown') : fmt(it.price),
            it.wasPrice && el('s', { class: 'was-price', 'aria-label': t('wasAria', { amount: fmt(it.wasPrice) }), text: fmt(it.wasPrice) }),
          ]),
          el('div', { class: 'card-actions' }, [loot, view]),
        ]),
        it.looted && el('p', { class: 'looted-note', text: t('lootedNote') }),
      ]),
    ]);
  }

  /* ---------- loot dialog + toast ---------- */

  let lootTarget = null;

  function openLootDialog(it) {
    lootTarget = it;
    const dlg = $('#loot-dialog');
    $('#loot-name').textContent = it.name;
    const qty = $('#loot-qty');
    qty.max = String(it.remaining);
    qty.value = '1';
    $('#loot-qty-row').hidden = it.remaining <= 1;
    $('#loot-left').textContent = it.qty > 1 ? t('lootLeft', { left: it.remaining, qty: it.qty }) : '';
    $('#loot-error').hidden = true;
    $('#loot-confirm').disabled = false;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    (it.remaining > 1 ? qty : $('#loot-confirm')).focus();
  }

  function closeLootDialog() {
    const dlg = $('#loot-dialog');
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  async function confirmLoot(e) {
    e.preventDefault();
    const it = lootTarget;
    if (!it) return;
    const n = Math.min(it.remaining, Math.max(1, parseInt($('#loot-qty').value, 10) || 1));
    const btn = $('#loot-confirm');
    btn.disabled = true;
    try {
      await sendClaim(it, n);
    } catch (err) {
      console.error('[wishlist] claim failed:', err);
      $('#loot-error').hidden = false;
      btn.disabled = false;
      return;
    }
    closeLootDialog();
    await lootAnimation(document.querySelector('.card[data-item="' + it.id + '"]'), n);
    applyClaims();
    render();
    showToast(it, n);
  }

  /* Card lifts forward, grows, then shrinks into a pixel loot bag that pops up at the bottom. */

  function lootAnimation(cardEl, n) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!cardEl || reduce || typeof cardEl.animate !== 'function') return Promise.resolve();
    return new Promise((resolve) => {
      const r = cardEl.getBoundingClientRect();
      const ghost = cardEl.cloneNode(true);
      ghost.classList.add('loot-ghost');
      Object.assign(ghost.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
        margin: '0', zIndex: '60', pointerEvents: 'none', transition: 'none', transformOrigin: 'center center',
      });
      const bag = el('div', { class: 'loot-bag', 'aria-hidden': 'true' }, THEME.art.lootBag ? THEME.art.lootBag.cloneNode(true) : null);
      document.body.append(bag, ghost);
      cardEl.style.visibility = 'hidden';

      const b = bag.getBoundingClientRect();
      const dx = (b.left + b.width / 2) - (r.left + r.width / 2);
      const dy = (b.top + b.height * 0.55) - (r.top + r.height / 2);
      const done = () => { ghost.remove(); bag.remove(); cardEl.style.visibility = ''; resolve(); };

      bag.animate(
        [{ transform: 'translateY(160%)' }, { transform: 'translateY(-8%)', offset: 0.7 }, { transform: 'translateY(0)' }],
        { duration: 420, delay: 250, easing: 'ease-out', fill: 'both' },
      );
      const fly = ghost.animate([
        { transform: 'translate(0, 0) scale(1)', boxShadow: '0 4px 14px rgba(43,42,92,0.07)', offset: 0 },
        { transform: 'translate(0, -14px) scale(1.12)', boxShadow: '0 26px 50px rgba(43,42,92,0.30)', offset: 0.28 },
        { transform: 'translate(0, -14px) scale(1.12)', boxShadow: '0 26px 50px rgba(43,42,92,0.30)', offset: 0.46 },
        { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(0.06) rotate(-10deg)', boxShadow: '0 0 0 rgba(43,42,92,0)', opacity: 0.7, offset: 1 },
      ], { duration: 1250, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' });

      fly.onfinish = () => {
        ghost.remove();
        const plus = el('div', { class: 'loot-plus', text: '+' + n });
        bag.append(plus);
        plus.animate([{ transform: 'translate(-50%, 0)', opacity: 1 }, { transform: 'translate(-50%, -46px)', opacity: 0 }],
          { duration: 700, easing: 'ease-out', fill: 'forwards' });
        const gulp = bag.animate([
          { transform: 'scale(1)' }, { transform: 'scale(1.25, 0.85)' }, { transform: 'scale(0.92, 1.12)' }, { transform: 'scale(1)' },
        ], { duration: 380, easing: 'ease-out' });
        gulp.onfinish = () => {
          const out = bag.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(160%)', opacity: 0 }],
            { duration: 320, delay: 260, easing: 'ease-in', fill: 'forwards' });
          out.onfinish = done;
        };
      };
      setTimeout(() => { if (document.body.contains(bag)) done(); }, 4000); // safety net
    });
  }

  let toastTimer = null;
  function showToast(it, n) {
    const toast = $('#toast');
    const undo = el('button', {
      type: 'button', class: 'toast-undo', text: t('undo'),
      onclick: async () => {
        undo.disabled = true;
        try { await sendClaim(it, -n); } catch (err) { console.error(err); undo.disabled = false; return; }
        applyClaims();
        render();
        hideToast();
        setMascot($('#mascot').dataset.mood, t('planner.undone'));
      },
    });
    toast.replaceChildren(
      el('span', { class: 'toast-text', text: t('toast', { qty: n > 1 ? n + ' × ' : '', name: it.name }) }),
      undo,
      el('button', { type: 'button', class: 'toast-close', 'aria-label': t('dismiss'), text: '×', onclick: hideToast }),
    );
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 20000);
  }
  function hideToast() { $('#toast').hidden = true; clearTimeout(toastTimer); }

  /* ---------- gift planner ---------- */

  // Chooses units (an item still needed ×3 can be picked up to 3 times) so that:
  // legendary units come first, then as much of the budget as possible is used.
  // 0/1 knapsack on whole dollars (prices rounded up, so the real total never exceeds the budget).
  function planGifts(list, budget, want) {
    if (!(budget > 0)) return { state: 'idle' };
    const B = Math.min(Math.floor(budget + 1e-9), CONFIG.maxPlannerBudget);
    const W = B + 1;
    const pool = [];
    list.forEach((it) => {
      if (it.looted || it.giftCard || Number.isNaN(it.price) || Math.ceil(it.price) > B) return;
      for (let k = 0; k < it.remaining; k++) pool.push(it);
    });
    const n = pool.length;
    if (!n) return { state: 'none' };
    const cost = pool.map((it) => Math.max(0, Math.ceil(it.price)));
    const val = pool.map((it, i) => (it.starred ? W : 0) + cost[i] + 1e-3);
    const chosen = [];

    if (want > 0) {
      const K = Math.min(want, n);
      const dp = [];
      for (let k = 0; k <= K; k++) { const row = new Float64Array(W); row.fill(k === 0 ? 0 : -1); dp.push(row); }
      const keep = new Uint8Array(n * (K + 1) * W);
      for (let i = 0; i < n; i++) {
        for (let k = K; k >= 1; k--) {
          const prev = dp[k - 1], cur = dp[k];
          for (let w = B; w >= cost[i]; w--) {
            const p = prev[w - cost[i]];
            if (p >= 0 && p + val[i] > cur[w]) { cur[w] = p + val[i]; keep[(i * (K + 1) + k) * W + w] = 1; }
          }
        }
      }
      let k = K;
      while (k > 0 && dp[k][B] < 0) k--;
      let w = B;
      for (let i = n - 1; i >= 0 && k > 0; i--) {
        if (keep[(i * (K + 1) + k) * W + w]) { chosen.push(i); k--; w -= cost[i]; }
      }
    } else {
      const dp = new Float64Array(W);
      const keep = new Uint8Array(n * W);
      for (let i = 0; i < n; i++) {
        for (let w = B; w >= cost[i]; w--) {
          const cand = dp[w - cost[i]] + val[i];
          if (cand > dp[w]) { dp[w] = cand; keep[i * W + w] = 1; }
        }
      }
      let w = B;
      for (let i = n - 1; i >= 0; i--) {
        if (keep[i * W + w]) { chosen.push(i); w -= cost[i]; }
      }
    }
    if (!chosen.length) return { state: 'none' };

    const grouped = new Map();
    chosen.forEach((i) => {
      const it = pool[i];
      const g = grouped.get(it.id) || { item: it, n: 0 };
      g.n += 1;
      grouped.set(it.id, g);
    });
    const picks = [...grouped.values()].sort((a, b) => (b.item.starred - a.item.starred) || (b.item.price - a.item.price));
    const units = chosen.length;
    const total = picks.reduce((s, g) => s + g.item.price * g.n, 0);
    return { state: 'show', picks, units, total };
  }

  function setMascot(mood, line) {
    const m = $('#mascot');
    m.dataset.mood = mood;
    const label = THEME.mascot && THEME.mascot[mood];
    if (label) m.setAttribute('aria-label', label); else m.removeAttribute('aria-label');
    $('#mascot-line').textContent = line;
  }

  // Pick a gift card to fill leftover budget: legendary first, then sheet order. Blank minimum counts as $5.
  function pickGiftCard(list, spare) {
    const fits = list.filter((it) => it.giftCard && (it.giftMin || 5) <= spare);
    return fits.find((it) => it.starred) || fits[0] || null;
  }

  function renderPlanner(list) {
    const box = $('#gp-result');
    const budget = parseFloat(state.budget);
    const want = parseInt(state.count, 10);
    const buffer = Math.min(0.9, Math.max(0, CONFIG.taxShippingBuffer || 0));
    const reserve = budget > 0 ? Math.round(budget * buffer * 100) / 100 : 0;
    const giftBudget = budget > 0 ? budget - reserve : budget;
    const plan = planGifts(list, giftBudget, want > 0 ? want : 0);

    if (plan.state === 'idle') {
      setMascot('idle', t('planner.idle'));
      box.replaceChildren(el('div', { class: 'plan-empty' }, [
        svg('<svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" stroke-width="1.8" stroke-linejoin="round" style="fill:var(--surface);stroke:var(--text)"><path d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z"/><path d="M12 7 L17.5 16 H6.5 Z" style="fill:var(--star)"/><path d="M12 2 V7 M3 7 L6.5 16 M21 7 L17.5 16 M12 22 L6.5 16 M12 22 L17.5 16" fill="none"/></svg>'),
        el('div', { class: 'plan-empty-title', text: t('planner.emptyTitle') }),
        el('p', { class: 'plan-empty-sub', text: t(CLAIMS_ON ? 'planner.emptySubClaims' : 'planner.emptySub') +
          (buffer > 0 ? ' ' + t('planner.bufferNote', { pct: Math.round(buffer * 100) }) : '') }),
      ]));
      return;
    }

    const itemsTotal = plan.state === 'show' ? plan.total : 0;
    const spareWhole = Math.floor(giftBudget - itemsTotal + 1e-9);
    const topCard = pickGiftCard(list, spareWhole);
    const topUp = topCard ? { item: topCard, amount: spareWhole } : null;

    if (plan.state === 'none' && topUp) {
      plan.state = 'show'; plan.picks = []; plan.units = 0; plan.total = 0;
    }

    if (plan.state === 'none') {
      setMascot('sad', t('planner.none', { budget: fmt(giftBudget) }));
      box.replaceChildren(el('div', { class: 'plan-empty' }, [
        el('div', { class: 'plan-empty-title', text: t('planner.noneTitle') }),
        el('p', { class: 'plan-empty-sub', text: t('planner.noneSub', { reserve: fmt(reserve), budget: fmt(giftBudget) }) }),
      ]));
      return;
    }

    const anyGold = plan.picks.some((g) => g.item.starred);
    if (!plan.units) {
      setMascot('happy', t('planner.onlyCard', { amount: fmt(topUp.amount), name: topUp.item.name }));
    } else {
      setMascot('happy', (plan.units === 1 ? t('planner.foundOne') : t('planner.foundMany', { n: plan.units })) + ' ' +
        (topUp ? t('planner.topUp', { amount: fmt(topUp.amount), name: topUp.item.name })
          : t(anyGold ? 'planner.starredFirst' : 'planner.squeezed')));
    }

    const rows = plan.picks.map(({ item, n }) => el('li', { class: 'plan-row' }, [
      el('span', item.starred
        ? { class: 'plan-dot is-gold', role: 'img', 'aria-label': t('starred') }
        : { class: 'plan-dot', 'aria-hidden': 'true' }, item.starred ? starSvg(15) : null),
      el('span', { class: 'plan-name' }, [
        item.link
          ? el('a', { href: item.link, target: '_blank', rel: 'noopener noreferrer', text: item.name })
          : el('span', { text: item.name }),
        el('span', { class: 'plan-meta', text: item.vendor + (n > 1 ? ' · ×' + n : '') }),
      ]),
      el('span', { class: 'plan-price', text: fmt(item.price * n) }),
    ]));
    if (topUp) {
      const gc = topUp.item;
      rows.push(el('li', { class: 'plan-row is-giftcard' }, [
        el('span', { class: 'plan-dot is-gift', 'aria-hidden': 'true' }, svg(GIFT_SVG)),
        el('span', { class: 'plan-name' }, [
          gc.link
            ? el('a', { href: gc.link, target: '_blank', rel: 'noopener noreferrer', text: gc.name })
            : el('span', { text: gc.name }),
          el('span', { class: 'plan-meta', text: t(plan.units ? 'planner.giftCardMetaRest' : 'planner.giftCardMeta') }),
        ]),
        el('span', { class: 'plan-price', text: fmt(topUp.amount) }),
      ]));
    }
    const grand = plan.total + (topUp ? topUp.amount : 0);

    const children = [
      el('div', { class: 'plan-head' }, [el('strong', { text: t('planner.picksTitle') }), el('span', {
        text: (plan.units ? t('planner.gifts', { n: plan.units }) : '') + (topUp ? t(plan.units ? 'planner.plusCard' : 'planner.giftCard') : ''),
      })]),
      el('ul', { class: 'plan-list' }, rows),
      el('div', { class: 'plan-totals' }, [
        el('span', { class: 'plan-total', text: t('planner.total', { amount: fmt(grand) }) }),
        reserve > 0 && el('span', { class: 'plan-left', text: t('planner.reserve', { amount: fmt(reserve) }) }),
        el('span', { class: 'plan-left', text: t('planner.spare', { amount: fmt(Math.max(0, giftBudget - grand)) }) }),
      ]),
    ];
    if (reserve > 0) {
      children.push(el('p', { class: 'plan-hint', text: t('planner.bufferHint', { pct: Math.round(buffer * 100) }) }));
    }
    if (want > 0 && plan.units < want) {
      children.push(el('p', { class: 'plan-note', text: t('planner.onlyFit', { n: plan.units, want }) }));
    }
    if (giftBudget > CONFIG.maxPlannerBudget) {
      children.push(el('p', { class: 'plan-note', text: t('planner.maxBudget', { amount: fmt(CONFIG.maxPlannerBudget) }) }));
    }
    if (CLAIMS_ON && plan.units) {
      children.push(el('p', { class: 'plan-hint', text: t('planner.claimHint') }));
    }
    box.replaceChildren(...children);
  }

  /* ---------- render ---------- */

  function render() {
    const list = filtered();
    const sorted = list.slice().sort(sortWith(SORTS[state.sort] || SORTS.wanted));
    $('#grid').replaceChildren(...sorted.map(card));
    const looted = list.filter((it) => it.looted).length;
    $('#count').textContent = t('count', { left: list.length - looted, total: state.items.length }) + (looted ? t('countLooted', { n: looted }) : '');

    const status = $('#status');
    if (!list.length) {
      status.hidden = false;
      status.replaceChildren(
        el('div', { class: 'status-title', text: t('empty.title') }),
        el('p', { text: t('empty.text') }),
      );
    } else {
      status.hidden = true;
    }
    renderPlanner(list);
    applyHint();
  }

  /* One-time tip pointing at the first info button. Gone for good once any info button is tapped or the tip is closed. */
  const HINT_KEY = 'wishlist-info-hint-seen';
  function dismissHint() {
    store.set(HINT_KEY, '1');
    document.querySelectorAll('.info.has-hint').forEach((w) => {
      w.classList.remove('has-hint');
      w.closest('.card').classList.remove('has-hint-card');
      const tag = w.querySelector('.info-hint');
      if (tag) tag.remove();
    });
  }
  function applyHint() {
    if (store.get(HINT_KEY)) return;
    const wrap = document.querySelector('#grid .card:not(.is-looted) .info') || document.querySelector('#grid .info');
    if (!wrap || wrap.classList.contains('has-hint')) return;
    wrap.classList.add('has-hint');
    wrap.closest('.card').classList.add('has-hint-card');
    wrap.append(el('div', { class: 'info-hint', role: 'note' }, [
      el('span', { text: t('hint') }),
      el('button', {
        type: 'button', 'aria-label': t('dismissTip'), text: '×',
        onclick: (e) => { e.stopPropagation(); dismissHint(); },
      }),
    ]));
  }

  function renderStats() {
    const items = state.items;
    $('#stat-items').textContent = t('stat.items', { n: items.length });
    $('#stat-starred').textContent = t('stat.starred', { n: items.filter((it) => it.starred).length });
    $('#stat-shops').textContent = t('stat.shops', { n: new Set(items.map((it) => it.vendor)).size });
  }

  function renderModeBadge() {
    const badge = $('#mode-badge');
    if (TEST) {
      badge.hidden = false;
      badge.className = 'mode-badge is-test';
      badge.replaceChildren(el('span', { text: t('mode.test') }));
    } else if (SHIELD) {
      badge.hidden = false;
      badge.className = 'mode-badge is-shield';
      badge.replaceChildren(
        svg('<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z"/></svg>'),
        el('span', { text: t('mode.shield') }),
      );
      badge.title = t('mode.shieldTitle');
    }
  }

  function showError(setup) {
    setMascot('sad', t(setup ? 'setup.line' : 'error.line'));
    $('#gp-result').replaceChildren();
    $('#count').textContent = '';
    $('#stat-items').textContent = t('stat.items', { n: '?' });
    const status = $('#status');
    status.hidden = false;
    status.replaceChildren(
      el('div', { class: 'status-title', text: t(setup ? 'setup.title' : 'error.title') }),
      el('p', { text: t(setup ? 'setup.text' : 'error.text') }),
    );
  }

  /* ---------- wiring ---------- */

  function wire() {
    $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
    $('#star-only').addEventListener('change', (e) => { state.starOnly = e.target.checked; render(); });
    $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
    $('#reset').addEventListener('click', resetFilters);
    $('#gp-budget').addEventListener('input', (e) => { state.budget = e.target.value; renderPlanner(filtered()); });
    $('#gp-count').addEventListener('input', (e) => { state.count = e.target.value; renderPlanner(filtered()); });
    $('#loot-form').addEventListener('submit', confirmLoot);
    $('#loot-cancel').addEventListener('click', closeLootDialog);
    $('#loot-dialog').addEventListener('click', (e) => { if (e.target.id === 'loot-dialog') closeLootDialog(); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.info')) closeAllDetails(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllDetails(); });
  }

  async function fetchText(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  }

  /* ---------- current prices ---------- */

  async function loadPrices() {
    for (const url of CONFIG.pricesUrls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) return (await res.json()).prices || {};
      } catch (e) { /* try the next one */ }
    }
    return {};
  }

  // Swap in recent checked prices; mark a sale when the store price is below its regular price or the sheet price.
  function applyPrices(prices) {
    const maxAge = CONFIG.maxPriceAgeDays * 864e5;
    state.items.forEach((it, i) => {
      let p = it.link && prices[it.link];
      if (TEST && !p && i === 2 && it.price > 0) {
        p = { price: Math.round(it.price * 75) / 100, regular: it.price, checked: new Date().toISOString() }; // fake sale to preview
      }
      if (it.giftCard || !p || !(p.price >= 0)) return;
      const checked = new Date(p.checked);
      if (!(Date.now() - checked < maxAge)) return;
      const sheet = it.price;
      const was = Math.max(p.regular || 0, Number.isFinite(sheet) ? sheet : 0);
      it.sheetPrice = sheet;
      it.price = p.price;
      it.checked = checked;
      if (was - p.price >= 0.01) {
        it.wasPrice = was;
        it.salePct = Math.max(1, Math.round((was - p.price) / was * 100));
      }
    });
  }

  async function init() {
    // Start every download at once; the theme's words are needed before anything is drawn.
    const sheetSet = /^https?:\/\//i.test(String(CONFIG.sheetUrl).trim());
    const themeReady = loadTheme();
    const dataPromise = sheetSet ? fetchText(CONFIG.sheetUrl).catch((err) => err) : null;
    const claimsPromise = sheetSet && CLAIMS_ON && !TEST ? fetchText(c.csvUrl).catch((err) => err) : null;
    const pricesPromise = sheetSet ? loadPrices() : null;
    await themeReady;
    wire();
    renderModeBadge();
    if (!sheetSet) {
      showError(true);
      return;
    }
    try {
      const data = await dataPromise;
      if (data instanceof Error) throw data;
      state.items = toItems(parseCSV(data));
      if (!state.items.length) throw new Error('No rows');
      groupShops(state.items);
    } catch (err) {
      console.error('[wishlist] could not load data:', err);
      showError();
      return;
    }
    if (CLAIMS_ON) {
      let rows = [];
      if (TEST) rows = testClaimsRows(state.items);
      else {
        const res = await claimsPromise;
        if (res instanceof Error) console.error('[wishlist] could not load claims:', res);
        else rows = parseCSV(res);
      }
      const { totals, refs } = readClaims(rows);
      state.sheetClaims = totals;
      state.sheetRefs = refs;
    }
    applyPrices(await pricesPromise);
    applyClaims();
    renderStats();
    buildFilters();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

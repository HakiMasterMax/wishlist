/* Wishlist Item Shop
 * Reads a published Google Sheet (CSV) and renders it as a filterable storefront.
 * Gift-givers can mark items as "looted" (purchased); those claims go to a Google Form
 * and are read back from that form's published response sheet.
 * No build step and no dependencies: edit CONFIG below and push to GitHub Pages.
 *
 * URL switches
 *   ?shield        turn the spoiler shield ON in this browser (remembered). Claims are never loaded.
 *   ?shield=off    turn the spoiler shield off again in this browser.
 *   ?test-claims   use made-up claims and don't send anything (works even with the shield on).
 */
(() => {
  'use strict';

  const CONFIG = {
    // Google Sheets: File > Share > Publish to web > (your tab) > CSV
    dataUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQAmDkwXniM3Tz36huytvYjJjBNp1WnambIZV7VS9YQ1-vxYt4ucaziRu6iDFf805wrWUJwmZ9FHalx/pub?output=csv',
    // Folder (next to index.html) holding the photos named in the image_name column.
    imageFolder: 'wishlist-images/',
    // Tried in order when image_name has no extension. GitHub Pages is case-sensitive.
    imageExtensions: ['jpg', 'png', 'jpeg', 'webp'],
    // Upper limit for the gift planner budget (keeps the math fast).
    maxPlannerBudget: 5000,
    // Share of the gift planner budget set aside for tax and shipping (0.15 = 15%).
    taxShippingBuffer: 0.15,

    // "Looted" claims. Leave blank to turn the feature off.
    claims: {
      // Published CSV of the claims form's response sheet.
      csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRdSsy_4ciPhZl43oc8Yx3iC8HfDeyepumtFmE_HhiO5FjC4LZXQ7HaYmFok0QI3mmuSlZoH3lFuQaW/pub?output=csv',
      // https://docs.google.com/forms/d/e/<form id>/formResponse
      formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLScZ8d-t2U92YeqPuCLlDhBSLJbsCOp80O7cXAP1P75z2SD_dA/formResponse',
      // entry.<number> ids from the form's pre-filled link.
      itemField: 'entry.1737454356',
      qtyField: 'entry.871293525',
      refField: 'entry.511342756',
    },
  };

  const PRICE_BANDS = [
    { id: 'all', label: 'Any', min: -Infinity, max: Infinity },
    { id: 'a', label: 'Under $25', min: 0, max: 25 },
    { id: 'b', label: '$25-50', min: 25, max: 50 },
    { id: 'c', label: '$50-100', min: 50, max: 100 },
    { id: 'd', label: '$100+', min: 100, max: Infinity },
  ];

  const STAR_PATH = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z';
  const SHIELD_KEY = 'wishlist-spoiler-shield';
  const PENDING_KEY = 'wishlist-pending-claims';
  const PENDING_TTL = 10 * 60 * 1000; // a local claim counts for 10 min or until the sheet shows it

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

  const starSvg = (size, fill) =>
    svg(`<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="${fill}"/></svg>`);
  const chestSvg = () =>
    svg('<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges"><path d="M2 5h12v9H2z" fill="#FFD166"/><path d="M2 5h12v1H2zM2 13h12v1H2zM1 5h1v9H1zM14 5h1v9h-1zM2 8h12v1H2zM3 3h10v2H3zM2 4h1v1H2zM13 4h1v1h-1zM4 2h8v1H4z" fill="currentColor"/><path d="M7 7h2v3H7z" fill="currentColor"/></svg>');

  const fmt = (v) => '$' + (Math.round(v * 100) % 100 === 0 ? String(Math.round(v)) : v.toFixed(2));
  const titleCase = (s) => s.toLowerCase().replace(/(^|[\s/-])(\w)/g, (m, a, b) => a + b.toUpperCase());
  const truthy = (v) => /^(true|yes|y|1|x|✓)$/i.test(String(v).trim());
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
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
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (name) => header.indexOf(name);
    const get = (r, name) => {
      const i = idx(name);
      return i >= 0 && r[i] != null ? r[i].trim() : '';
    };
    return rows.slice(1).map((r, n) => {
      const price = parseFloat(get(r, 'price').replace(/[$,\s]/g, ''));
      let tags = get(r, 'tags').split(/[:;,]/).map((t) => t.trim()).filter(Boolean).map(titleCase);
      tags = [...new Set(tags)];
      if (!tags.length) tags = ['Other'];
      const name = get(r, 'item_name');
      return {
        id: n,
        key: keyOf(name),
        name,
        price: Number.isFinite(price) ? price : NaN,
        size: get(r, 'size'),
        color: get(r, 'color_or_pattern'),
        qty: Math.max(1, parseInt(get(r, 'quantity'), 10) || 1),
        starred: truthy(get(r, 'excite')),
        vendor: get(r, 'source') || 'Other',
        tags,
        image: get(r, 'image_name'),
        notes: get(r, 'notes'),
        link: safeUrl(get(r, 'link')),
      };
    }).filter((it) => it.name);
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
      if (state.vendorsOff.has(it.vendor)) return false;
      if (state.starOnly && !it.starred) return false;
      if (state.types.size && !it.tags.some((t) => state.types.has(t))) return false;
      if (band.id !== 'all' && !(it.price >= band.min && it.price < band.max)) return false;
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
  const sortWith = (fn) => (a, b) => (a.looted - b.looted) || fn(a, b);

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

    const vendors = [...new Set(state.items.map((it) => it.vendor))].sort();
    $('#vendor-list').replaceChildren(...vendors.map((v) => {
      const input = el('input', {
        type: 'checkbox', checked: true, 'data-vendor': v,
        onchange: (e) => { e.target.checked ? state.vendorsOff.delete(v) : state.vendorsOff.add(v); render(); },
      });
      return el('label', { class: 'vendor' }, [
        input,
        el('span', { class: 'vendor-name', text: v }),
        el('span', { class: 'vendor-count', text: state.items.filter((it) => it.vendor === v).length }),
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

  function photo(it) {
    const box = el('div', { class: 'photo' });
    const placeholder = () => el('div', { class: 'photo-empty' }, [
      svg('<svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/></svg>'),
      'no photo yet',
    ]);
    if (it.image) {
      const base = CONFIG.imageFolder + encodeURIComponent(it.image);
      const candidates = /\.[a-z0-9]{2,5}$/i.test(it.image) ? [base] : CONFIG.imageExtensions.map((ext) => base + '.' + ext);
      let i = 0;
      const img = el('img', { alt: it.name, loading: 'lazy', decoding: 'async', src: candidates[0] });
      img.addEventListener('error', () => {
        i += 1;
        if (i < candidates.length) img.src = candidates[i];
        else img.replaceWith(placeholder());
      });
      box.append(img);
    } else {
      box.append(placeholder());
    }
    if (it.looted) box.append(el('div', { class: 'looted-stamp', 'aria-hidden': 'true', text: 'LOOTED' }));
    return box;
  }

  function details(it) {
    const rows = [];
    if (it.size) rows.push(['Size', it.size]);
    if (it.color) rows.push(['Color', it.color]);
    if (it.qty > 1) rows.push(['Wanted', '×' + it.qty]);
    if (it.notes) rows.push(['Notes', it.notes]);
    if (!rows.length) return null;

    const id = 'details-' + it.id;
    const wrap = el('div', { class: 'info' });
    const btn = el('button', {
      type: 'button', class: 'info-btn', 'aria-expanded': 'false', 'aria-controls': id,
      'aria-label': 'Details for ' + it.name,
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
      el('div', { class: 'details-title', text: 'ITEM DETAILS' }),
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
    if (it.looted) return el('span', { class: 'tag tag-looted', text: 'Looted' });
    if (CLAIMS_ON && it.qty > 1) {
      return el('span', { class: 'tag tag-qty', title: it.remaining + ' of ' + it.qty + ' still needed', text: it.remaining + ' of ' + it.qty + ' left' });
    }
    if (it.qty > 1) return el('span', { class: 'tag tag-qty', title: 'Quantity wanted', text: '×' + it.qty });
    return null;
  }

  function card(it) {
    const legendary = it.starred;
    const tags = [
      legendary && el('span', { class: 'tag tag-legend', text: 'Legendary' }),
      el('span', { class: 'tag' + (legendary ? ' tag-vendor-on-gold' : ''), text: it.vendor }),
      el('span', { class: 'tag tag-type', text: it.tags.join(' + ') }),
      qtyTag(it),
    ];
    const view = it.link
      ? el('a', {
          class: 'view', href: it.link, target: '_blank', rel: 'noopener noreferrer',
          'aria-label': 'View ' + it.name + ' on ' + it.vendor + ' (opens in a new tab)',
        }, [
          el('span', { text: 'View' }),
          svg('<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>'),
        ])
      : null;
    const loot = CLAIMS_ON && !it.looted
      ? el('button', {
          type: 'button', class: 'loot-btn', 'aria-label': 'Mark ' + it.name + ' as looted (purchased)',
          onclick: () => openLootDialog(it),
        }, [chestSvg(), el('span', { text: 'Loot' })])
      : null;

    let cls = 'card';
    if (legendary) cls += ' is-legendary';
    if (it.looted) cls += ' is-looted';

    return el('article', { class: cls, 'data-item': it.id }, [
      legendary && el('div', { class: 'star-badge', role: 'img', 'aria-label': 'Legendary: most wanted' }, starSvg(26, '#2B2A5C')),
      photo(it),
      details(it),
      el('div', { class: 'card-body' }, [
        el('div', { class: 'tags' }, tags),
        el('h2', { text: it.name }),
        el('div', { class: 'card-foot' }, [
          el('span', { class: 'price', text: Number.isNaN(it.price) ? 'price ?' : fmt(it.price) }),
          el('div', { class: 'card-actions' }, [loot, view]),
        ]),
        it.looted && el('p', { class: 'looted-note', text: 'Already gifted. Thank you!' }),
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
    $('#loot-left').textContent = it.qty > 1 ? it.remaining + ' of ' + it.qty + ' still needed.' : '';
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
  const BAG_SVG = '<svg aria-hidden="true" width="96" height="96" viewBox="0 0 16 15" shape-rendering="crispEdges"><path d="M5 0h1v1h-1zM10 0h1v1h-1zM4 1h1v1h-1zM6 1h1v1h-1zM9 1h1v1h-1zM11 1h1v1h-1zM5 2h1v1h-1zM7 2h2v1h-2zM10 2h1v1h-1zM6 3h1v1h-1zM9 3h1v1h-1zM5 4h6v1h-6zM4 5h1v1h-1zM11 5h1v1h-1zM3 6h1v1h-1zM12 6h1v1h-1zM2 7h1v1h-1zM13 7h1v1h-1zM1 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM14 9h1v1h-1zM1 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM14 11h1v1h-1zM1 12h1v1h-1zM14 12h1v1h-1zM2 13h1v1h-1zM13 13h1v1h-1zM3 14h10v1h-10z" fill="#2B2A5C"/><path d="M5 1h1v1h-1zM10 1h1v1h-1zM6 2h1v1h-1zM9 2h1v1h-1zM7 3h2v1h-2z" fill="#FF9DBD"/><path d="M5 5h6v1h-6zM4 6h8v1h-8zM3 7h10v1h-10zM2 8h5v1h-5zM8 8h6v1h-6zM2 9h4v1h-4zM9 9h5v1h-5zM2 10h5v1h-5zM8 10h5v1h-5zM2 11h11v1h-11zM2 12h10v1h-10zM3 13h8v1h-8z" fill="#E9B872"/><path d="M13 10h1v1h-1zM13 11h1v1h-1zM12 12h2v1h-2zM11 13h2v1h-2z" fill="#C98F48"/><path d="M7 8h1v1h-1zM6 9h3v1h-3zM7 10h1v1h-1z" fill="#FFD166"/></svg>';

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
      const bag = el('div', { class: 'loot-bag', 'aria-hidden': 'true' }, svg(BAG_SVG));
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
      type: 'button', class: 'toast-undo', text: 'Undo',
      onclick: async () => {
        undo.disabled = true;
        try { await sendClaim(it, -n); } catch (err) { console.error(err); undo.disabled = false; return; }
        applyClaims();
        render();
        hideToast();
        setSmudge($('#smudge').dataset.mood, 'Phew, un-looted! It is back on the shelf.');
      },
    });
    toast.replaceChildren(
      el('span', { class: 'toast-text', text: 'Looted! ' + (n > 1 ? n + ' × ' : '') + it.name + ' is marked as gifted.' }),
      undo,
      el('button', { type: 'button', class: 'toast-close', 'aria-label': 'Dismiss', text: '×', onclick: hideToast }),
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
      if (it.looted || Number.isNaN(it.price) || Math.ceil(it.price) > B) return;
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

  function setSmudge(mood, line) {
    $('#smudge').dataset.mood = mood;
    $('#smudge-line').textContent = line;
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
      setSmudge('idle', 'Psst! Tell me your budget and I will dig through the shop for the best loot.');
      box.replaceChildren(el('div', { class: 'plan-empty' }, [
        svg('<svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#2B2A5C" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z"/><path d="M12 7 L17.5 16 H6.5 Z" fill="#FFD166"/><path d="M12 2 V7 M3 7 L6.5 16 M21 7 L17.5 16 M12 22 L6.5 16 M12 22 L17.5 16" fill="none"/></svg>'),
        el('div', { class: 'plan-empty-title', text: 'No loot yet' }),
        el('p', { class: 'plan-empty-sub', text: (CLAIMS_ON
          ? 'Smudge only digs through items the shop filters are showing, and skips anything already looted.'
          : 'Smudge only digs through items the shop filters are showing.') +
          (buffer > 0 ? ' ' + Math.round(buffer * 100) + '% of your budget is saved for tax and shipping.' : '') }),
      ]));
      return;
    }

    if (plan.state === 'none') {
      setSmudge('sad', 'Eep! Nothing fits under ' + fmt(giftBudget) + ' once I save some for tax and shipping. More gold, or fewer filters?');
      box.replaceChildren(el('div', { class: 'plan-empty' }, [
        el('div', { class: 'plan-empty-title', text: 'Not enough gold' }),
        el('p', { class: 'plan-empty-sub', text: 'After setting aside ' + fmt(reserve) + ' for tax and shipping, nothing still available fits in ' + fmt(giftBudget) + '. Raise the budget or loosen the filters.' }),
      ]));
      return;
    }

    const anyGold = plan.picks.some((g) => g.item.starred);
    setSmudge('happy', (plan.units === 1 ? 'Found one! ' : 'Found ' + plan.units + '! ') +
      (anyGold ? 'Gold-star treasures went in first.' : 'Squeezed the most out of your gold.'));

    const rows = plan.picks.map(({ item, n }) => el('li', { class: 'plan-row' }, [
      el('span', item.starred
        ? { class: 'plan-dot is-gold', role: 'img', 'aria-label': 'Legendary' }
        : { class: 'plan-dot', 'aria-hidden': 'true' }, item.starred ? starSvg(15, '#2B2A5C') : null),
      el('span', { class: 'plan-name' }, [
        item.link
          ? el('a', { href: item.link, target: '_blank', rel: 'noopener noreferrer', text: item.name })
          : el('span', { text: item.name }),
        el('span', { class: 'plan-meta', text: item.vendor + (n > 1 ? ' · ×' + n : '') }),
      ]),
      el('span', { class: 'plan-price', text: fmt(item.price * n) }),
    ]));

    const children = [
      el('div', { class: 'plan-head' }, [el('strong', { text: "Smudge's picks" }), el('span', { text: plural(plan.units, 'gift', 'gifts') })]),
      el('ul', { class: 'plan-list' }, rows),
      el('div', { class: 'plan-totals' }, [
        el('span', { class: 'plan-total', text: 'Gifts ' + fmt(plan.total) }),
        reserve > 0 && el('span', { class: 'plan-left', text: '+ ~' + fmt(reserve) + ' est. tax & shipping' }),
        el('span', { class: 'plan-left', text: fmt(Math.max(0, giftBudget - plan.total)) + ' spare' }),
      ]),
    ];
    if (reserve > 0) {
      children.push(el('p', { class: 'plan-hint', text: 'Smudge sets aside about ' + Math.round(buffer * 100) + '% of your budget as a rough guess for tax and shipping. Real costs vary by shop and location, so check the total at checkout.' }));
    }
    if (want > 0 && plan.units < want) {
      children.push(el('p', { class: 'plan-note', text: 'Only ' + plan.units + ' of ' + want + ' gifts fit this budget with the current filters.' }));
    }
    if (giftBudget > CONFIG.maxPlannerBudget) {
      children.push(el('p', { class: 'plan-note', text: 'Smudge can only count up to ' + fmt(CONFIG.maxPlannerBudget) + ' at a time.' }));
    }
    if (CLAIMS_ON) {
      children.push(el('p', { class: 'plan-hint', text: 'Bought one? Hit Loot on its card so nobody doubles up.' }));
    }
    box.replaceChildren(...children);
  }

  /* ---------- render ---------- */

  function render() {
    const list = filtered();
    const sorted = list.slice().sort(sortWith(SORTS[state.sort] || SORTS.wanted));
    $('#grid').replaceChildren(...sorted.map(card));
    const looted = list.filter((it) => it.looted).length;
    $('#count').textContent = (list.length - looted) + ' / ' + state.items.length + ' in stock' + (looted ? ' · ' + looted + ' looted' : '');

    const status = $('#status');
    if (!list.length) {
      status.hidden = false;
      status.replaceChildren(
        el('div', { class: 'status-title', text: 'The shelves are empty' }),
        el('p', { text: 'No items match those filters. Loosen one or reset them.' }),
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
      el('span', { text: 'Psst! Sizes & notes in here' }),
      el('button', {
        type: 'button', 'aria-label': 'Dismiss tip', text: '×',
        onclick: (e) => { e.stopPropagation(); dismissHint(); },
      }),
    ]));
  }

  function renderStats() {
    const items = state.items;
    $('#stat-items').textContent = plural(items.length, 'item', 'items');
    $('#stat-starred').textContent = items.filter((it) => it.starred).length + ' legendary';
    $('#stat-shops').textContent = plural(new Set(items.map((it) => it.vendor)).size, 'merchant', 'merchants');
  }

  function renderModeBadge() {
    const badge = $('#mode-badge');
    if (TEST) {
      badge.hidden = false;
      badge.className = 'mode-badge is-test';
      badge.replaceChildren(el('span', { text: 'Test mode: fake purchases, nothing is sent' }));
    } else if (SHIELD) {
      badge.hidden = false;
      badge.className = 'mode-badge is-shield';
      badge.replaceChildren(
        svg('<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z"/></svg>'),
        el('span', { text: 'Spoiler shield on' }),
      );
      badge.title = 'Purchases are hidden in this browser. Visit with ?shield=off to turn this off.';
    }
  }

  function showError() {
    setSmudge('sad', 'Eep! I could not reach the spreadsheet. Try refreshing in a minute?');
    $('#gp-result').replaceChildren();
    $('#count').textContent = '';
    $('#stat-items').textContent = '? items';
    const status = $('#status');
    status.hidden = false;
    status.replaceChildren(
      el('div', { class: 'status-title', text: 'The shop is closed' }),
      el('p', { text: 'The wishlist could not be loaded right now. Please refresh the page in a little while.' }),
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

  async function init() {
    wire();
    renderModeBadge();
    const claimsPromise = CLAIMS_ON && !TEST ? fetchText(c.csvUrl).catch((err) => err) : null;
    try {
      state.items = toItems(parseCSV(await fetchText(CONFIG.dataUrl)));
      if (!state.items.length) throw new Error('No rows');
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
    applyClaims();
    renderStats();
    buildFilters();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

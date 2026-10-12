/* Wishlist Item Shop
 * Reads a published Google Sheet (CSV) and renders it as a filterable storefront.
 * No build step and no dependencies: edit CONFIG below and push to GitHub Pages.
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
  };

  const PRICE_BANDS = [
    { id: 'all', label: 'Any', min: -Infinity, max: Infinity },
    { id: 'a', label: 'Under $25', min: 0, max: 25 },
    { id: 'b', label: '$25-50', min: 25, max: 50 },
    { id: 'c', label: '$50-100', min: 50, max: 100 },
    { id: 'd', label: '$100+', min: 100, max: Infinity },
  ];

  const STAR_PATH = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z';

  const state = {
    items: [],
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
    for (const c of [].concat(children || [])) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
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

  const fmt = (v) => '$' + (Math.round(v * 100) % 100 === 0 ? String(Math.round(v)) : v.toFixed(2));
  const titleCase = (s) => s.toLowerCase().replace(/(^|[\s/-])(\w)/g, (m, a, b) => a + b.toUpperCase());
  const truthy = (v) => /^(true|yes|y|1|x|✓)$/i.test(String(v).trim());
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : null);

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
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
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
      return {
        id: n,
        name: get(r, 'item_name'),
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

  /* ---------- filter controls ---------- */

  function buildFilters() {
    // Item types: alphabetical, "Other" always last
    const types = [...new Set(state.items.flatMap((it) => it.tags))].filter((t) => t !== 'Other').sort();
    types.push('Other');
    const typeBox = $('#type-chips');
    typeBox.replaceChildren(...types.map((t) => el('button', {
      type: 'button', class: 'chip chip-pill', 'aria-pressed': 'false', 'data-type': t, text: t,
      onclick: (e) => {
        state.types.has(t) ? state.types.delete(t) : state.types.add(t);
        e.currentTarget.setAttribute('aria-pressed', String(state.types.has(t)));
        render();
      },
    })));

    // Merchants with counts
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

    // Price bands
    $('#price-chips').replaceChildren(...PRICE_BANDS.map((b) => el('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(b.id === state.band), 'data-band': b.id, text: b.label,
      onclick: () => {
        state.band = b.id;
        document.querySelectorAll('#price-chips .chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.band === b.id)));
        render();
      },
    })));
  }

  function resetFilters() {
    state.q = ''; state.starOnly = false; state.vendorsOff.clear(); state.types.clear(); state.band = 'all';
    $('#q').value = '';
    $('#star-only').checked = false;
    document.querySelectorAll('#vendor-list input').forEach((i) => { i.checked = true; });
    document.querySelectorAll('#type-chips .chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    document.querySelectorAll('#price-chips .chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.band === 'all')));
    render();
  }

  /* ---------- cards ---------- */

  function photo(it) {
    const box = el('div', { class: 'photo' });
    const placeholder = () => el('div', { class: 'photo-empty' }, [
      svg('<svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/></svg>'),
      'no photo yet',
    ]);
    if (!it.image) { box.append(placeholder()); return box; }

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

  function card(it) {
    const legendary = it.starred;
    const tags = [
      legendary && el('span', { class: 'tag tag-legend', text: 'Legendary' }),
      el('span', { class: 'tag' + (legendary ? ' tag-vendor-on-gold' : ''), text: it.vendor }),
      el('span', { class: 'tag tag-type', text: it.tags.join(' + ') }),
      it.qty > 1 && el('span', { class: 'tag tag-qty', title: 'Quantity wanted', text: '×' + it.qty }),
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

    return el('article', { class: 'card' + (legendary ? ' is-legendary' : '') }, [
      legendary && el('div', { class: 'star-badge', role: 'img', 'aria-label': 'Legendary: most wanted' }, starSvg(26, '#2B2A5C')),
      photo(it),
      details(it),
      el('div', { class: 'card-body' }, [
        el('div', { class: 'tags' }, tags),
        el('h2', { text: it.name }),
        el('div', { class: 'card-foot' }, [
          el('span', { class: 'price', text: Number.isNaN(it.price) ? 'price ?' : fmt(it.price) }),
          view,
        ]),
      ]),
    ]);
  }

  /* ---------- gift planner ---------- */

  // Chooses units (an item wanted ×3 can be picked up to 3 times) so that:
  // legendary units come first, then as much of the budget as possible is used.
  // 0/1 knapsack on whole dollars (prices rounded up, so the real total never exceeds the budget).
  function planGifts(list, budget, want) {
    if (!(budget > 0)) return { state: 'idle' };
    const B = Math.min(Math.floor(budget + 1e-9), CONFIG.maxPlannerBudget);
    const W = B + 1;
    const pool = [];
    list.forEach((it) => {
      if (Number.isNaN(it.price) || Math.ceil(it.price) > B) return;
      for (let k = 0; k < it.qty; k++) pool.push(it);
    });
    const n = pool.length;
    if (!n) return { state: 'none' };
    const cost = pool.map((it) => Math.max(0, Math.ceil(it.price)));
    const val = pool.map((it, i) => (it.starred ? W : 0) + cost[i] + 1e-3);
    const chosen = [];

    if (want > 0) {
      const K = Math.min(want, n);
      const dp = [];
      for (let c = 0; c <= K; c++) { const row = new Float64Array(W); row.fill(c === 0 ? 0 : -1); dp.push(row); }
      const keep = new Uint8Array(n * (K + 1) * W);
      for (let i = 0; i < n; i++) {
        for (let c = K; c >= 1; c--) {
          const prev = dp[c - 1], cur = dp[c];
          for (let w = B; w >= cost[i]; w--) {
            const p = prev[w - cost[i]];
            if (p >= 0 && p + val[i] > cur[w]) { cur[w] = p + val[i]; keep[(i * (K + 1) + c) * W + w] = 1; }
          }
        }
      }
      let c = K;
      while (c > 0 && dp[c][B] < 0) c--;
      let w = B;
      for (let i = n - 1; i >= 0 && c > 0; i--) {
        if (keep[(i * (K + 1) + c) * W + w]) { chosen.push(i); c--; w -= cost[i]; }
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
    const plan = planGifts(list, budget, want > 0 ? want : 0);

    if (plan.state === 'idle') {
      setSmudge('idle', 'Psst! Tell me your budget and I will dig through the shop for the best loot.');
      box.replaceChildren(el('div', { class: 'plan-empty' }, [
        svg('<svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#2B2A5C" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z"/><path d="M12 7 L17.5 16 H6.5 Z" fill="#FFD166"/><path d="M12 2 V7 M3 7 L6.5 16 M21 7 L17.5 16 M12 22 L6.5 16 M12 22 L17.5 16" fill="none"/></svg>'),
        el('div', { class: 'plan-empty-title', text: 'No loot yet' }),
        el('p', { class: 'plan-empty-sub', text: 'Smudge only digs through items the shop filters are showing.' }),
      ]));
      return;
    }

    if (plan.state === 'none') {
      setSmudge('sad', 'Eep! Nothing fits under ' + fmt(budget) + '. More gold, or fewer filters?');
      box.replaceChildren(el('div', { class: 'plan-empty' }, [
        el('div', { class: 'plan-empty-title', text: 'Not enough gold' }),
        el('p', { class: 'plan-empty-sub', text: 'Nothing showing right now fits under ' + fmt(budget) + '. Raise the budget or loosen the filters.' }),
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
        el('span', { class: 'plan-total', text: 'Total ' + fmt(plan.total) }),
        el('span', { class: 'plan-left', text: fmt(Math.max(0, budget - plan.total)) + ' left' }),
      ]),
    ];
    if (want > 0 && plan.units < want) {
      children.push(el('p', { class: 'plan-note', text: 'Only ' + plan.units + ' of ' + want + ' gifts fit this budget with the current filters.' }));
    }
    if (budget > CONFIG.maxPlannerBudget) {
      children.push(el('p', { class: 'plan-note', text: 'Smudge can only count up to ' + fmt(CONFIG.maxPlannerBudget) + ' at a time.' }));
    }
    box.replaceChildren(...children);
  }

  /* ---------- render ---------- */

  function render() {
    const list = filtered();
    const sorted = list.slice().sort(SORTS[state.sort] || SORTS.wanted);
    $('#grid').replaceChildren(...sorted.map(card));
    $('#count').textContent = list.length + ' / ' + state.items.length + ' in stock';

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
  }

  function renderStats() {
    const items = state.items;
    $('#stat-items').textContent = plural(items.length, 'item', 'items');
    $('#stat-starred').textContent = items.filter((it) => it.starred).length + ' legendary';
    $('#stat-shops').textContent = plural(new Set(items.map((it) => it.vendor)).size, 'merchant', 'merchants');
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
    document.addEventListener('click', (e) => { if (!e.target.closest('.info')) closeAllDetails(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllDetails(); });
  }

  async function init() {
    wire();
    try {
      const res = await fetch(CONFIG.dataUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.items = toItems(parseCSV(await res.text()));
      if (!state.items.length) throw new Error('No rows');
    } catch (err) {
      console.error('[wishlist] could not load data:', err);
      showError();
      return;
    }
    renderStats();
    buildFilters();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ============================================================
   Triple 7 Holdings — Live Board
   ------------------------------------------------------------
   Filter groups are BUILT FROM THE DATA rather than hard-coded, so
   the board only ever offers a filter that returns something. A
   facet with fewer than two distinct values is dropped entirely —
   which is why "Origin" does not appear while only one lot states
   one. Nothing here invents a value to fill a gap.

   Filter state lives in the query string, so a refined board is a
   link the desk can send a buyer.
   ============================================================ */
(function () {
  const controls = document.getElementById('controls');
  const filterRow = document.getElementById('filter-row');
  const board     = document.getElementById('board');
  const countEl   = document.getElementById('board-count');
  const sortEl    = document.getElementById('sort');
  const searchEl  = document.getElementById('q');
  const resetBtn  = document.getElementById('reset');
  const toggle    = document.getElementById('filters-toggle');
  const statRow   = document.getElementById('stat-row');
  const deskCount = document.getElementById('desk-count');
  if (!board) return;

  const FACETS = ['commodity', 'type', 'origin', 'status'];
  const LABELS = { commodity: 'Commodity', type: 'Type', origin: 'Origin', status: 'Status' };
  const ORDER  = { commodity: ['diamond', 'gold'], type: ['rough', 'polished', 'refined', 'concentrate'] };

  let lots = [];
  let desks = [];
  let state = { sort: 'newest' };

  const titleCase = v => String(v).charAt(0).toUpperCase() + String(v).slice(1);

  /* ---------- URL <-> state ---------- */
  function readUrl() {
    const q = new URLSearchParams(location.search);
    const next = { sort: q.get('sort') || 'newest' };
    FACETS.forEach(f => {
      const raw = q.get(f);
      if (raw) next[f] = raw.split(',').filter(Boolean);
    });
    if (q.get('q')) next.q = q.get('q');
    return next;
  }

  function writeUrl() {
    const q = new URLSearchParams();
    FACETS.forEach(f => { if (state[f] && state[f].length) q.set(f, state[f].join(',')); });
    if (state.q) q.set('q', state.q);
    if (state.sort && state.sort !== 'newest') q.set('sort', state.sort);
    const qs = q.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    if (resetBtn) resetBtn.hidden = !qs;
  }

  /* ---------- Facets ---------- */
  function valuesFor(field) {
    const seen = [];
    lots.forEach(l => {
      const v = l[field];
      if (v && seen.indexOf(v) === -1) seen.push(v);
    });
    const order = ORDER[field];
    return seen.sort((a, b) => {
      if (order) {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
      }
      return a.localeCompare(b);
    });
  }

  function buildFilters() {
    const parts = [];
    FACETS.forEach(field => {
      const values = valuesFor(field);
      /* One option filters nothing. Don't show a control that cannot
         change the result. */
      if (values.length < 2) return;
      const chips = values.map(v => {
        const on = (state[field] || []).indexOf(v) !== -1;
        return '<label class="chip' + (on ? ' is-on' : '') + '">' +
                 '<input type="checkbox" name="' + field + '" value="' + T7.esc(v) + '"' + (on ? ' checked' : '') + '>' +
                 T7.esc(titleCase(v)) +
               '</label>';
      }).join('');
      parts.push('<fieldset class="filter-set"><legend>' + LABELS[field] + '</legend><div class="chips">' + chips + '</div></fieldset>');
    });
    filterRow.innerHTML = parts.join('');
  }

  /* ---------- Stats ---------- */
  function paintStats() {
    const byCommodity = {};
    lots.forEach(l => { byCommodity[l.commodity] = (byCommodity[l.commodity] || 0) + 1; });

    const cells = [
      { label: 'Listed lots', value: String(lots.length) },
      { label: 'Diamonds', value: String(byCommodity.diamond || 0), desk: deskFor('diamond') },
      { label: 'Gold', value: String(byCommodity.gold || 0), desk: deskFor('gold') },
      { label: 'Desk', value: 'Kimberley', word: true }
    ];

    statRow.innerHTML = cells.map(c =>
      '<div class="stat">' +
        '<p class="stat-label">' + T7.esc(c.label) +
          (c.desk && c.desk.status === 'closed' ? '<span class="tag">Closed</span>' : '') +
        '</p>' +
        '<p class="stat-value' + (c.word ? ' is-word' : '') + '">' + T7.esc(c.value) + '</p>' +
      '</div>').join('');

    if (deskCount) {
      deskCount.textContent = lots.length + ' listed';
    }
  }

  const deskFor = key => desks.find(d => d.key === key);

  /* ---------- Filtering ---------- */
  function apply() {
    const term = (state.q || '').trim().toLowerCase();

    let list = lots.filter(l => {
      for (let i = 0; i < FACETS.length; i++) {
        const f = FACETS[i];
        const picked = state[f];
        if (picked && picked.length && picked.indexOf(l[f]) === -1) return false;
      }
      if (term) {
        const hay = [l.lot_id, l.name, l.commodity, l.type, l.origin, l.description]
          .concat(l.descriptors || [])
          .filter(Boolean).join(' ').toLowerCase();
        if (hay.indexOf(term) === -1) return false;
      }
      return true;
    });

    const by = {
      newest:    (a, b) => (b.latest ? 1 : 0) - (a.latest ? 1 : 0) || a.lot_id.localeCompare(b.lot_id),
      oldest:    (a, b) => (a.latest ? 1 : 0) - (b.latest ? 1 : 0) || a.lot_id.localeCompare(b.lot_id),
      commodity: (a, b) => a.commodity.localeCompare(b.commodity) || a.lot_id.localeCompare(b.lot_id),
      lot:       (a, b) => a.lot_id.localeCompare(b.lot_id)
    };
    list.sort(by[state.sort] || by.newest);

    render(list);
    writeUrl();
  }

  /* ---------- Render ---------- */
  function lotCard(l) {
    const href = 'lot.html?id=' + encodeURIComponent(l.lot_id);
    return '<article class="lot-card">' +
             '<a href="' + href + '" aria-hidden="true" tabindex="-1">' + T7.lotMedia(l, { card: true }) + '</a>' +
             '<div class="lot-card-body">' +
               '<div class="lot-meta">' +
                 '<span class="lot-id">' + T7.esc(l.lot_id) + '</span>' +
                 '<span class="tag">' + T7.esc(T7.COMMODITY_LABEL[l.commodity] || l.commodity) + '</span>' +
                 (l.verification ? '<span class="tag is-verified">' + T7.esc(l.verification) + '</span>' : '') +
                 (l.latest ? '<span class="tag">Latest</span>' : '') +
               '</div>' +
               '<a class="lot-name textlink" href="' + href + '">' + T7.esc(l.name) + '</a>' +
               '<p class="lot-desc">' + T7.esc((l.descriptors || []).join(' · ')) + '</p>' +
               '<div class="lot-foot">' +
                 '<span class="lot-pricing">' + T7.esc(l.pricing || '') + '</span>' +
                 '<a class="lot-open" href="' + href + '">View lot <span aria-hidden="true">↗</span></a>' +
               '</div>' +
             '</div>' +
           '</article>';
  }

  function render(list) {
    countEl.textContent = list.length
      ? list.length + (list.length === 1 ? ' lot' : ' lots')
      : 'No lots match';

    if (!list.length) {
      board.innerHTML =
        '<div class="empty">' +
          '<h3>Nothing matches that</h3>' +
          '<p>Loosen a filter, or tell the desk what you are looking for — we hold stock that is not yet listed.</p>' +
          '<a href="contact.html" class="btn-desk">Contact The Desk</a>' +
        '</div>';
      return;
    }

    /* Group into market sections, mirroring how the desk presents
       itself: a market, its trading state, then its lots. */
    const order = ['diamond', 'gold'];
    const groups = order
      .map(key => ({ desk: deskFor(key), key: key, rows: list.filter(l => l.commodity === key) }))
      .filter(g => g.rows.length);

    board.innerHTML = groups.map(g => {
      const d = g.desk || {};
      return '<section class="market">' +
               '<header class="market-head">' +
                 '<div>' +
                   '<h2 class="market-name">' + T7.esc(d.label || T7.COMMODITY_LABEL[g.key] || g.key) +
                     (d.status === 'closed' ? '<span class="tag">Closed</span>' : '') +
                   '</h2>' +
                   (d.blurb ? '<p class="market-blurb">' + T7.esc(d.blurb) + '</p>' : '') +
                 '</div>' +
                 (d.status === 'closed'
                   ? '<span class="market-state">Desk closed — quotes still accepted</span>'
                   : '') +
               '</header>' +
               '<div class="board-grid">' + g.rows.map(lotCard).join('') + '</div>' +
             '</section>';
    }).join('');
  }

  /* ---------- Events ---------- */
  controls.addEventListener('change', e => {
    const el = e.target;
    if (el.type !== 'checkbox') return;
    const field = el.name;
    const set = state[field] || [];
    state[field] = el.checked ? set.concat([el.value]) : set.filter(v => v !== el.value);
    if (!state[field].length) delete state[field];
    el.closest('.chip').classList.toggle('is-on', el.checked);
    apply();
  });
  controls.addEventListener('submit', e => e.preventDefault());

  let searchTimer;
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = searchEl.value;
      if (!state.q) delete state.q;
      apply();
    }, 160);
  });

  sortEl.addEventListener('change', () => { state.sort = sortEl.value; apply(); });

  resetBtn.addEventListener('click', () => {
    state = { sort: state.sort };
    searchEl.value = '';
    buildFilters();
    apply();
  });

  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = !controls.classList.toggle('is-collapsed');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- Boot ---------- */
  state = readUrl();
  if (sortEl) sortEl.value = state.sort;
  if (searchEl && state.q) searchEl.value = state.q;

  board.innerHTML = '<div class="board-grid">' +
    '<div class="sk-card"><div class="skeleton sk-media"></div><div class="skeleton sk-line" style="width:40%"></div><div class="skeleton sk-line" style="width:75%"></div></div>'.repeat(3) +
  '</div>';

  Promise.all([T7.api.listLots(), T7.api.listDesks()])
    .then(([lotRows, deskRows]) => {
      lots = lotRows;
      desks = deskRows;
      paintStats();
      buildFilters();
      apply();
    })
    .catch(err => {
      console.error(err);
      countEl.textContent = 'The board could not be loaded';
      board.innerHTML =
        '<div class="empty">' +
          '<h3>We could not reach the desk</h3>' +
          '<p>Please try again in a moment, or call the Kimberley office on +27 73 569 4045.</p>' +
          '<a href="contact.html" class="btn-desk">Contact Us</a>' +
        '</div>';
    });
})();

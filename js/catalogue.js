/* ============================================================
   Triple 7 Holdings — catalogue page
   ------------------------------------------------------------
   Filter groups are BUILT FROM THE DATA rather than hard-coded, so
   when Person 2's real inventory replaces the demo seed the rail
   still offers exactly the shapes, colours, clarities and mines
   that are actually in stock — and never a filter that returns
   nothing.

   Filter state lives in the query string. A refined search is then
   a link somebody can send to a client, and the back button walks
   back through refinements instead of leaving the page.
   ============================================================ */
(function () {
  const form     = document.getElementById('filters');
  const results  = document.getElementById('results');
  const countEl  = document.getElementById('shop-count');
  const sortEl   = document.getElementById('sort');
  const resetBtn = document.getElementById('filter-reset');
  const toggle   = document.getElementById('filters-toggle');
  if (!form || !results) return;

  /* Grading scales are ordered, not alphabetical — D is the top colour
     and FL the top clarity, so the chips must run in that order. */
  const ORDER = {
    colour:  ['D','E','F','G','H','I','J','K','L','M'],
    clarity: ['FL','IF','VVS1','VVS2','VS1','VS2','SI1','SI2','I1','VS','SI'],
    shape:   ['round','princess','oval','emerald','pear','cushion','marquise','radiant','rough'],
    type:    ['polished','rough']
  };

  const LABELS = { type: 'Form', shape: 'Shape', colour: 'Colour', clarity: 'Clarity', origin_mine: 'Origin' };
  const FACETS = ['type', 'shape', 'colour', 'clarity', 'origin_mine'];

  let stones = [];
  let state = { sort: 'price-desc' };

  /* ---------- URL <-> state ---------- */
  function readUrl() {
    const q = new URLSearchParams(location.search);
    const next = { sort: q.get('sort') || 'price-desc' };
    FACETS.forEach(f => {
      const raw = q.get(f);
      if (raw) next[f] = raw.split(',').filter(Boolean);
    });
    if (q.get('carat_min')) next.carat_min = Number(q.get('carat_min'));
    if (q.get('price_max')) next.price_max = Number(q.get('price_max'));
    return next;
  }

  function writeUrl() {
    const q = new URLSearchParams();
    FACETS.forEach(f => { if (state[f] && state[f].length) q.set(f, state[f].join(',')); });
    if (state.carat_min) q.set('carat_min', String(state.carat_min));
    if (state.price_max != null && state.price_max < bounds.priceMax) q.set('price_max', String(state.price_max));
    if (state.sort && state.sort !== 'price-desc') q.set('sort', state.sort);
    const qs = q.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    resetBtn.hidden = !qs;
  }

  /* ---------- Facet building ---------- */
  let bounds = { caratMax: 1, priceMax: 1 };

  function valuesFor(field) {
    const seen = [];
    stones.forEach(s => {
      const v = s[field];
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

  function titleCase(v) {
    return String(v).charAt(0).toUpperCase() + String(v).slice(1);
  }

  function buildFilters() {
    bounds.caratMax = Math.ceil(Math.max.apply(null, stones.map(s => Number(s.carat) || 0)));
    bounds.priceMax = Math.max.apply(null, stones.map(s => Number(s.price_zar) || 0));
    if (state.price_max == null) state.price_max = bounds.priceMax;

    const parts = [];

    FACETS.forEach(field => {
      const values = valuesFor(field);
      if (values.length < 2) return; /* a filter with one option filters nothing */
      const chips = values.map(v => {
        const on = (state[field] || []).indexOf(v) !== -1;
        const label = field === 'origin_mine' ? v.replace(/ (Mine|Game Farm)$/, '') : titleCase(v);
        return '<label class="chip' + (on ? ' is-on' : '') + '">' +
                 '<input type="checkbox" name="' + field + '" value="' + T7.esc(v) + '"' + (on ? ' checked' : '') + '>' +
                 T7.esc(label) +
               '</label>';
      }).join('');
      parts.push(
        '<fieldset class="fgroup">' +
          '<legend>' + LABELS[field] + '</legend>' +
          '<div class="chips">' + chips + '</div>' +
        '</fieldset>'
      );
    });

    parts.push(
      '<fieldset class="fgroup">' +
        '<legend>Carat, from</legend>' +
        '<div class="frange">' +
          '<input type="range" name="carat_min" min="0" max="' + bounds.caratMax + '" step="0.1" value="' + (state.carat_min || 0) + '" aria-label="Minimum carat">' +
          '<output id="out-carat"></output>' +
        '</div>' +
      '</fieldset>'
    );

    parts.push(
      '<fieldset class="fgroup">' +
        '<legend>Price, up to</legend>' +
        '<div class="frange">' +
          '<input type="range" name="price_max" min="0" max="' + bounds.priceMax + '" step="10000" value="' + state.price_max + '" aria-label="Maximum price">' +
          '<output id="out-price"></output>' +
        '</div>' +
      '</fieldset>'
    );

    form.querySelectorAll('.fgroup').forEach(el => el.remove());
    form.insertAdjacentHTML('beforeend', parts.join(''));
    paintRanges();
  }

  function paintRanges() {
    const carat = form.querySelector('[name=carat_min]');
    const price = form.querySelector('[name=price_max]');
    const oc = document.getElementById('out-carat');
    const op = document.getElementById('out-price');
    if (carat && oc) oc.textContent = Number(carat.value) > 0 ? Number(carat.value).toFixed(2) + ' ct and above' : 'Any weight';
    if (price && op) op.textContent = Number(price.value) >= bounds.priceMax ? 'Any price' : 'Up to ' + T7.money(price.value);
  }

  /* ---------- Filtering ---------- */
  function apply() {
    let list = stones.filter(s => {
      for (let i = 0; i < FACETS.length; i++) {
        const f = FACETS[i];
        const picked = state[f];
        if (picked && picked.length && picked.indexOf(s[f]) === -1) return false;
      }
      if (state.carat_min && Number(s.carat) < state.carat_min) return false;
      if (state.price_max != null && Number(s.price_zar) > state.price_max) return false;
      return true;
    });

    const by = {
      'price-desc': (a, b) => b.price_zar - a.price_zar,
      'price-asc':  (a, b) => a.price_zar - b.price_zar,
      'carat-desc': (a, b) => b.carat - a.carat,
      'carat-asc':  (a, b) => a.carat - b.carat
    };
    list.sort(by[state.sort] || by['price-desc']);

    /* Reserved stones stay visible but sink below what can be bought —
       seeing what has just been taken is part of the pitch. */
    list.sort((a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1));

    render(list);
    writeUrl();
  }

  function render(list) {
    countEl.textContent = list.length
      ? list.length + (list.length === 1 ? ' stone' : ' stones')
      : 'No stones match';

    if (!list.length) {
      results.innerHTML =
        '<div class="shop-empty" style="grid-column:1/-1">' +
          '<h3>Nothing matches that</h3>' +
          '<p>Loosen a filter, or tell us what you are after and we will look through what is still being sorted.</p>' +
          '<a href="contact.html" class="btn btn-solid">Talk To Us</a>' +
        '</div>';
      return;
    }

    results.innerHTML = list.map(s => {
      const held = s.status !== 'available';
      const spec = s.type === 'rough'
        ? [Number(s.carat).toFixed(2) + ' ct', 'Rough', s.colour].filter(Boolean)
        : [Number(s.carat).toFixed(2) + ' ct', s.colour, s.clarity].filter(Boolean);
      return '<a class="stone-card' + (held ? ' is-held' : '') + '" href="diamond.html?sku=' + encodeURIComponent(s.sku) + '">' +
               T7.plate(s, { flag: held ? 'Reserved' : null }) +
               '<h3 class="stone-card-name">' + T7.esc(s.title) + '</h3>' +
               '<p class="stone-card-meta">' + T7.esc(spec.join(' · ')) + ' · ' + T7.esc(s.sku) + '</p>' +
               '<p class="stone-card-price">' + T7.money(s.price_zar) + '</p>' +
             '</a>';
    }).join('');
  }

  /* ---------- Events ---------- */
  form.addEventListener('change', e => {
    const el = e.target;
    if (el.type === 'checkbox') {
      const field = el.name;
      const set = state[field] || [];
      state[field] = el.checked
        ? set.concat([el.value])
        : set.filter(v => v !== el.value);
      if (!state[field].length) delete state[field];
      /* :has() does the styling on modern browsers; this keeps the
         chip readable on the ones that do not support it. */
      el.closest('.chip').classList.toggle('is-on', el.checked);
    }
    if (el.type === 'range') {
      if (el.name === 'carat_min') state.carat_min = Number(el.value) || 0;
      if (el.name === 'price_max') state.price_max = Number(el.value);
      paintRanges();
    }
    apply();
  });

  /* Ranges also fire while being dragged, so the readout tracks the thumb. */
  form.addEventListener('input', e => {
    if (e.target.type === 'range') {
      if (e.target.name === 'carat_min') state.carat_min = Number(e.target.value) || 0;
      if (e.target.name === 'price_max') state.price_max = Number(e.target.value);
      paintRanges();
    }
  });

  form.addEventListener('submit', e => e.preventDefault());

  sortEl.addEventListener('change', () => { state.sort = sortEl.value; apply(); });

  resetBtn.addEventListener('click', () => {
    state = { sort: state.sort, price_max: bounds.priceMax };
    buildFilters();
    apply();
  });

  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = form.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- Boot ---------- */
  state = readUrl();
  if (sortEl) sortEl.value = state.sort;

  T7.api.listDiamonds()
    .then(list => {
      stones = list;
      buildFilters();
      apply();
    })
    .catch(err => {
      countEl.textContent = 'The collection could not be loaded';
      results.innerHTML =
        '<div class="shop-empty" style="grid-column:1/-1">' +
          '<h3>We could not reach the collection</h3>' +
          '<p>Please try again in a moment, or call the Kimberley office on +27 73 569 4045.</p>' +
          '<a href="contact.html" class="btn btn-solid">Contact Us</a>' +
        '</div>';
      console.error(err);
    });
})();

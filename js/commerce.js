/* ============================================================
   Triple 7 Holdings — commerce shared layer
   ------------------------------------------------------------
   Loaded on every page. Provides:
     T7.money()      — ZAR formatting
     T7.stone()      — the SVG stone plate used in place of photography
     T7.cart         — the basket, in localStorage
     the nav cart button, injected rather than hand-added to 13 files

   The cart button is injected because it is useless without JS, so it
   has no business being in the markup. The "Diamonds" nav link IS in
   the markup — it is real navigation and must survive with JS off.
   ============================================================ */
window.T7 = window.T7 || {};

(function () {

  /* ---------- Money ---------- */
  const zar = new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0
  });
  T7.money = value => zar.format(Number(value) || 0);

  /* ---------- Stone plates ----------
     We have two stone photographs and twenty-four stones, so the
     catalogue draws each shape instead of faking a photo. `image_url`
     exists on the product row: the moment real studio shots arrive,
     the card falls back to the plate only when that field is empty. */
  const OUTLINES = {
    round:    'M50 10a40 40 0 1 1 0 80 40 40 0 0 1 0-80z',
    princess: 'M14 14h72v72H14z',
    oval:     'M50 8c17 0 30 19 30 42s-13 42-30 42-30-19-30-42S33 8 50 8z',
    emerald:  'M32 8h36l12 12v60L68 92H32L20 80V20z',
    pear:     'M50 6c14 14 30 30 30 50a30 30 0 0 1-60 0c0-16 12-30 30-50z',
    cushion:  'M28 12h44c9 0 16 7 16 16v44c0 9-7 16-16 16H28c-9 0-16-7-16-16V28c0-9 7-16 16-16z',
    marquise: 'M50 6c14 16 24 30 24 44S64 78 50 94C36 78 26 64 26 50S36 22 50 6z',
    radiant:  'M30 10h40l14 14v52L70 90H30L16 76V24z',
    rough:    'M44 8l30 10 14 26-8 32-30 16-28-14-10-30 12-28z'
  };

  const FACETS = {
    round: (function () {
      const pts = r => [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map(deg => {
        const rad = deg * Math.PI / 180;
        return [50 + r * Math.cos(rad), 50 - r * Math.sin(rad)];
      });
      const table = pts(17), girdle = pts(35);
      const poly = table.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      const rays = table.map((p, i) =>
        'M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) +
        'L' + girdle[i][0].toFixed(1) + ' ' + girdle[i][1].toFixed(1)).join('');
      return '<polygon points="' + poly + '"/><path d="' + rays + '"/>';
    })(),
    princess: '<rect x="34" y="34" width="32" height="32"/><path d="M14 14 34 34M86 14 66 34M86 86 66 66M14 86 34 66"/>',
    oval:     '<ellipse cx="50" cy="50" rx="17" ry="24"/><path d="M50 8v18M50 74v18M33 50h-13M67 50h13M38 26 30 18M62 26 70 18M38 74 30 82M62 74 70 82"/>',
    emerald:  '<path d="M28 18h44l6 6v52l-6 6H28l-6-6V24z"/><path d="M34 28h32v44H34z"/>',
    pear:     '<path d="M50 24c9 10 19 20 19 32a19 19 0 0 1-38 0c0-10 8-21 19-32z"/><path d="M50 6v18M31 56H20M69 56h11M36 74 26 84M64 74 74 84"/>',
    cushion:  '<rect x="30" y="30" width="40" height="40" rx="10"/><path d="M12 28 30 30M88 28 70 30M88 72 70 70M12 72 30 70"/>',
    marquise: '<path d="M50 22c8 10 14 20 14 28s-6 18-14 28c-8-10-14-20-14-28s6-18 14-28z"/><path d="M36 50H26M64 50h10"/>',
    radiant:  '<path d="M30 22h40l8 8v40l-8 8H30l-8-8V30z"/><path d="M16 24 30 22M84 24 70 22M84 76 70 78M16 76 30 78"/>',
    rough:    '<path d="M44 8 50 40 20 44M74 18 50 40 80 76M50 40 44 82"/>'
  };

  /* Returns the markup for one stone plate. `shape` falls back to a
     rough outline for anything the lapidary sends us that we don't
     have a drawing for yet. */
  T7.stone = function (shape) {
    const key = OUTLINES[shape] ? shape : 'rough';
    return '<svg class="stone" viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">' +
             '<g class="stone-facets">' + (FACETS[key] || '') + '</g>' +
             '<path class="stone-outline" d="' + OUTLINES[key] + '"/>' +
           '</svg>';
  };

  /* ---------- Photography ----------
     Two ways a stone gets a picture, in order of preference:

       1. products.image_url — a photograph of THIS stone. Always wins.
       2. a shape photograph — one picture per cut, shared by every
          stone of that cut. Illustrative, and labelled as such on the
          product page, because a buyer is entitled to assume a photo
          shows the diamond they are being sold.

     If neither exists, or the file is missing, the drawn plate below
     is what they get. Nothing 404s into a broken-image icon.

     Drop files into images/stones/ named after the cut and they appear
     with no code change. */
  T7.SHAPE_PHOTOS = {
    round:    'images/stones/round.jpg',
    princess: 'images/stones/princess.jpg',
    oval:     'images/stones/oval.jpg',
    emerald:  'images/stones/emerald.jpg',
    pear:     'images/stones/pear.jpg',
    cushion:  'images/stones/cushion.jpg',
    marquise: 'images/stones/marquise.jpg',
    radiant:  'images/stones/radiant.jpg',
    rough:    'images/stones/rough.jpg'
  };

  T7.photoFor = function (stone) {
    if (stone.image_url) return { src: stone.image_url, ofThisStone: true };
    const shape = T7.SHAPE_PHOTOS[stone.shape];
    return shape ? { src: shape, ofThisStone: false } : null;
  };

  const CUT_NAMES = {
    round: 'round brilliant', princess: 'princess cut', oval: 'oval cut',
    emerald: 'emerald cut', pear: 'pear cut', cushion: 'cushion cut',
    marquise: 'marquise cut', radiant: 'radiant cut', rough: 'uncut rough'
  };

  /* Renders the whole media block for a stone: photograph if we have
     one, drawing underneath as the fallback, plus any status flag. */
  T7.plate = function (stone, opts) {
    const o = opts || {};
    const photo = T7.photoFor(stone);
    const cut = CUT_NAMES[stone.shape] || 'diamond';

    const alt = photo && photo.ofThisStone
      ? stone.title + ', a ' + Number(stone.carat).toFixed(2) + ' carat ' + cut
      : cut.charAt(0).toUpperCase() + cut.slice(1) + ' — illustrative, not this stone';

    const img = photo
      ? '<img class="stone-photo" src="' + T7.esc(photo.src) + '" alt="' + T7.esc(alt) + '" loading="lazy" decoding="async">'
      : '';

    return '<div class="plate' + (o.wide ? ' is-wide' : '') + '">' +
             (o.flag ? '<span class="plate-flag is-held">' + T7.esc(o.flag) + '</span>' : '') +
             T7.stone(stone.shape) +
             img +
           '</div>';
  };

  /* A photograph that arrives is promoted over the drawing; one that
     fails to load is removed so the drawing stays. Delegated in the
     capture phase because load and error do not bubble. */
  document.addEventListener('load', e => {
    const img = e.target;
    if (img.classList && img.classList.contains('stone-photo')) {
      const plate = img.closest('.plate');
      if (plate) plate.classList.add('has-photo');
    }
  }, true);

  document.addEventListener('error', e => {
    const img = e.target;
    if (img.classList && img.classList.contains('stone-photo')) img.remove();
  }, true);

  /* Escapes anything that came from the database before it goes into
     innerHTML. Product titles are staff-entered, not trusted. */
  T7.esc = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ---------- Cart ----------
     One row per stone, always quantity one: these are unique physical
     items, so "2 × this diamond" is not a thing that can exist. */
  const KEY = 't7.cart';

  function read() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('t7:cart', { detail: list }));
  }

  T7.cart = {
    items: read,
    count: () => read().length,
    has: sku => read().some(i => i.sku === sku),
    subtotal: () => read().reduce((sum, i) => sum + Number(i.price_zar || 0), 0),

    add(stone) {
      const list = read();
      if (list.some(i => i.sku === stone.sku)) return false;
      list.push({
        sku: stone.sku,
        title: stone.title,
        price_zar: stone.price_zar,
        shape: stone.shape,
        carat: stone.carat,
        colour: stone.colour,
        clarity: stone.clarity,
        type: stone.type
      });
      write(list);
      return true;
    },

    remove(sku) { write(read().filter(i => i.sku !== sku)); },
    clear() { write([]); }
  };

  /* Fixed, because insured courier of a single small parcel costs the
     same whether it holds one stone or four. Person 2 can move this to
     a settings row later; the checkout reads it from one place. */
  T7.SHIPPING_ZAR = 850;

  /* South African standard rate. Export sales are zero-rated, which is a
     conversation the Kimberley office has with the buyer after the order
     lands — the site quotes the domestic price and the invoice corrects
     it, rather than guessing the buyer's tax position from a form. */
  T7.VAT_RATE = 0.15;

  /* One place computes the money, so the cart, the checkout, the
     serverless function's cross-check and the receipt cannot disagree. */
  T7.totals = function (subtotal) {
    const net = Math.round(Number(subtotal) || 0);
    const shipping = T7.SHIPPING_ZAR;
    const vat = Math.round((net + shipping) * T7.VAT_RATE);
    return { subtotal: net, shipping: shipping, vat: vat, total: net + shipping + vat };
  };

  /* ---------- Toast ----------
     One element, reused. Announced politely so a screen reader hears
     the confirmation without the focus being yanked out of the page. */
  let toastEl, toastTimer;
  T7.toast = function (message, action) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '<span>' + T7.esc(message) + '</span>' +
      (action ? '<a href="' + T7.esc(action.href) + '">' + T7.esc(action.label) + '</a>' : '');
    requestAnimationFrame(() => toastEl.classList.add('is-up'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-up'), 4600);
  };

  /* Which mine page a stone's origin belongs to. */
  T7.MINE_PAGES = {
    'Maxwill Mine':       'mine-maxwill.html',
    'Bucklands Mine':     'mine-bucklands.html',
    'Christiana Mine':    'mine-christiana.html',
    'Modican Mine':       'mine-modican.html',
    'Thaba Kholo':        'mine-thaba-kholo.html',
    'Sepelong Game Farm': 'mine-sepelong.html'
  };

  /* ---------- Nav cart button ---------- */
  function mountNavCart() {
    const links = document.querySelector('.nav-links');
    if (!links || links.querySelector('.nav-cart')) return;

    const a = document.createElement('a');
    a.className = 'nav-cart';
    a.href = 'cart.html';
    a.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M7 3h10l3.4 5.1-8.4 12.6L3.6 8.1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>' +
        '<path d="M3.6 8.1h16.8M12 20.7 8.6 8.1 11 3M12 20.7l3.4-12.6L13 3" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
      '</svg><span class="nav-cart-count"></span>';

    const cta = links.querySelector('.nav-cta');
    if (cta) links.insertBefore(a, cta); else links.appendChild(a);
    paint();
  }

  function paint() {
    const n = T7.cart.count();
    document.querySelectorAll('.nav-cart').forEach(el => {
      el.classList.toggle('has-items', n > 0);
      el.setAttribute('aria-label', n ? 'Selection — ' + n + ' stone' + (n === 1 ? '' : 's') : 'Selection — empty');
      const badge = el.querySelector('.nav-cart-count');
      if (badge) badge.textContent = n ? String(n) : '';
    });
  }

  document.addEventListener('t7:cart', paint);
  /* Another tab changed the basket. */
  window.addEventListener('storage', e => { if (e.key === KEY) paint(); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountNavCart);
  } else {
    mountNavCart();
  }
})();

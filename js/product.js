/* ============================================================
   Triple 7 Holdings — single stone page
   ------------------------------------------------------------
   Reads ?sku= and renders one product. The grading table is the
   whole pitch on a page like this: a buyer spending six figures
   wants the certificate number and the four Cs before they want a
   picture, so the specs sit above the fold and the "add" button
   comes after them, not before.
   ============================================================ */
(function () {
  const root      = document.getElementById('pdp-root');
  const titleEl   = document.getElementById('pdp-title');
  const eyebrowEl = document.getElementById('pdp-eyebrow');
  const crumbEl   = document.getElementById('pdp-crumb');
  if (!root) return;

  const sku = new URLSearchParams(location.search).get('sku');

  function notFound(heading, body) {
    titleEl.textContent = heading;
    eyebrowEl.textContent = 'Not available';
    crumbEl.textContent = 'Not found';
    document.title = heading + ' — Triple 7 Holdings';
    root.innerHTML =
      '<div class="shop-empty">' +
        '<h3>' + T7.esc(heading) + '</h3>' +
        '<p>' + T7.esc(body) + '</p>' +
        '<a href="diamonds.html" class="btn btn-solid">Back To The Collection</a>' +
      '</div>';
  }

  function specRows(s) {
    const rough = s.type === 'rough';
    const rows = [
      ['Stock no.',    s.sku],
      ['Form',         rough ? 'Rough' : 'Polished'],
      ['Shape',        rough ? 'Uncut' : s.shape.charAt(0).toUpperCase() + s.shape.slice(1)],
      ['Carat',        Number(s.carat).toFixed(2) + ' ct'],
      ['Colour',       s.colour],
      ['Clarity',      s.clarity],
      ['Cut',          s.cut],
      ['Polish',       s.polish],
      ['Symmetry',     s.symmetry],
      ['Fluorescence', s.fluorescence],
      ['Measurements', s.measurements],
      ['Origin',       s.origin_mine],
      ['Certificate',  s.certificate_lab && s.certificate_no ? s.certificate_lab + ' ' + s.certificate_no : null]
    ];
    /* Rough stones have no cut, polish or symmetry — drop the rows
       rather than printing a column of dashes. */
    return rows
      .filter(r => r[1] != null && r[1] !== '')
      .map(r => '<div><dt>' + T7.esc(r[0]) + '</dt><dd>' + T7.esc(r[1]) + '</dd></div>')
      .join('');
  }

  function render(s) {
    const held = s.status !== 'available';
    const inCart = T7.cart.has(s.sku);
    const grade = s.type === 'rough'
      ? Number(s.carat).toFixed(2) + ' ct rough · ' + s.origin_mine
      : Number(s.carat).toFixed(2) + ' ct · ' + s.colour + ' · ' + s.clarity + ' · ' + s.origin_mine;

    document.title = s.title + ' — Triple 7 Holdings';
    titleEl.textContent = s.title;
    eyebrowEl.textContent = s.type === 'rough' ? 'Rough Stone' : 'Polished Stone';
    crumbEl.textContent = s.sku;

    const minePage = T7.MINE_PAGES[s.origin_mine];
    const photo = T7.photoFor(s);

    root.innerHTML =
      '<div class="pdp reveal is-visible">' +
        '<div class="pdp-media">' +
          T7.plate(s, { wide: true, flag: held ? (s.status === 'sold' ? 'Sold' : 'Reserved') : null }) +
          (photo && !photo.ofThisStone
            ? '<p class="plate-caption">Photograph shows the cut, not this stone</p>'
            : '') +
        '</div>' +
        '<div class="pdp-text">' +
          '<p class="eyebrow">' + T7.esc(grade) + '</p>' +
          '<p class="pdp-price">' + T7.money(s.price_zar) + '</p>' +
          '<p class="pdp-vat">Price excludes VAT, insured courier and export paperwork</p>' +

          '<div class="pdp-actions" id="pdp-actions"></div>' +
          '<p class="pdp-note" id="pdp-note"></p>' +

          '<dl class="stone-spec">' + specRows(s) + '</dl>' +

          '<div class="provenance">' +
            '<p><strong>Provenance.</strong> Recovered at ' + T7.esc(s.origin_mine) +
              (minePage ? ' — <a class="textlink" href="' + minePage + '">see the site</a>' : '') + '. ' +
              'Natural and untreated. Sold with a Kimberley Process certificate.</p>' +
            (s.certificate_no
              ? '<p>Graded by ' + T7.esc(s.certificate_lab) + ', certificate ' + T7.esc(s.certificate_no) + '. The original document travels with the stone.</p>'
              : '<p>Rough stones are sold on our own sorting grade. Independent grading follows cutting.</p>') +
          '</div>' +
        '</div>' +
      '</div>';

    paintActions(s, inCart);
  }

  function paintActions(s, inCart) {
    const actions = document.getElementById('pdp-actions');
    const note = document.getElementById('pdp-note');
    const held = s.status !== 'available';

    if (held) {
      actions.innerHTML = '<a href="contact.html" class="btn btn-solid">Enquire About Similar</a>';
      note.textContent = s.status === 'sold'
        ? 'This stone has been sold. We usually have something close to it coming out of the same wash plant — ask us.'
        : 'This stone is on hold for another buyer. Ask us and we will tell you if the hold lapses.';
      return;
    }

    if (inCart) {
      actions.innerHTML =
        '<a href="cart.html" class="btn btn-solid">Go To Selection</a>' +
        '<button type="button" class="btn btn-ghost" id="pdp-remove" style="border-color:var(--line);color:var(--text-dark)">Remove</button>';
      note.textContent = 'Held in your selection on this device. Nothing is reserved until the order is paid.';
      document.getElementById('pdp-remove').addEventListener('click', () => {
        T7.cart.remove(s.sku);
        paintActions(s, false);
        T7.toast('Removed from your selection');
      });
      return;
    }

    actions.innerHTML =
      '<button type="button" class="btn btn-solid" id="pdp-add">Add To Selection</button>' +
      '<a href="contact.html" class="btn btn-ghost" style="border-color:var(--line);color:var(--text-dark)">Ask A Question</a>';
    note.textContent = 'One stone, one of a kind. Adding it here does not reserve it — the first paid order takes it.';
    document.getElementById('pdp-add').addEventListener('click', () => {
      T7.cart.add(s);
      paintActions(s, true);
      T7.toast('Added — ' + s.title, { href: 'cart.html', label: 'View selection' });
    });
  }

  if (!sku) {
    notFound('No stone selected', 'Pick a diamond from the collection to see its full grading detail.');
    return;
  }

  T7.api.getDiamond(sku)
    .then(stone => {
      if (!stone) {
        notFound('Stone not found', 'Stock number ' + sku + ' is not in the current collection. It may have been sold.');
        return;
      }
      render(stone);
    })
    .catch(err => {
      console.error(err);
      notFound('We could not load this stone', 'Please try again in a moment, or call the Kimberley office on +27 73 569 4045.');
    });
})();

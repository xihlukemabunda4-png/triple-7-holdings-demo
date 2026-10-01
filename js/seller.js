/* ============================================================
   Triple 7 Holdings — seller dashboard (SANDBOX)
   ------------------------------------------------------------
   Inventory and lot submission, demonstrated. The lots shown are
   the desk's own listed lots presented as if this seller had
   placed them — that is a demo convenience and the screen says
   so, because pretending a visitor owns somebody's inventory is
   exactly the sort of thing that misleads a client in a review.

   Submitted lots are kept in this browser only. No lot submitted
   here reaches the desk or appears on the public board.
   ============================================================ */
(function () {
  const root = document.getElementById('seller-root');
  if (!root) return;

  const session = T7.auth.requireRole('seller');
  if (!session) return;

  document.getElementById('desk-sub').textContent =
    'Signed in as ' + session.company + '. Sandbox session — nothing here reaches the desk.';

  const DRAFTS_KEY = 't7.sandbox.drafts';
  const drafts = () => { try { return JSON.parse(localStorage.getItem(DRAFTS_KEY)) || []; } catch (e) { return []; } };
  const saveDrafts = list => { try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(list)); } catch (e) {} };

  let lots = [];

  function stat(label, value) {
    return '<div class="stat"><p class="stat-label">' + T7.esc(label) + '</p>' +
           '<p class="stat-value">' + T7.esc(String(value)) + '</p></div>';
  }

  function invRow(l) {
    return '<div class="row-item">' +
             '<a href="lot.html?id=' + encodeURIComponent(l.lot_id) + '" aria-hidden="true" tabindex="-1">' +
               T7.lotMedia(l, { card: true, thumb: true }) + '</a>' +
             '<div>' +
               '<div class="lot-meta"><span class="lot-id">' + T7.esc(l.lot_id) + '</span>' +
                 '<span class="tag">' + T7.esc(T7.COMMODITY_LABEL[l.commodity] || l.commodity) + '</span></div>' +
               '<a class="lot-name textlink" style="font-size:19px" href="lot.html?id=' + encodeURIComponent(l.lot_id) + '">' + T7.esc(l.name) + '</a>' +
               '<p class="row-when">' + T7.esc((l.descriptors || []).join(' · ')) + '</p>' +
             '</div>' +
             '<span class="tag is-verified">Listed</span>' +
           '</div>';
  }

  function draftRow(d, i) {
    return '<div class="row-item">' +
             '<span class="lot-id">Draft</span>' +
             '<div>' +
               '<span class="lot-name" style="font-size:19px">' + T7.esc(d.name) + '</span>' +
               '<p class="row-when">' + T7.esc(T7.COMMODITY_LABEL[d.commodity] || d.commodity) +
                 (d.type ? ' · ' + T7.esc(d.type) : '') + ' · saved ' + T7.esc(T7.ago(d.created_at)) + '</p>' +
             '</div>' +
             '<div style="display:flex;gap:8px;align-items:center">' +
               '<span class="tag">' + T7.esc(d.status) + '</span>' +
               '<button type="button" class="btn-line" style="padding:9px 15px;font-size:10px" data-drop="' + i + '">Discard</button>' +
             '</div>' +
           '</div>';
  }

  function render() {
    const ds = drafts();

    root.innerHTML =
      '<div class="dash-head">' +
        '<div><p class="market-state">Account</p>' +
        '<p style="font-family:var(--f-display);font-weight:700;text-transform:uppercase;font-size:28px;line-height:1">' + T7.esc(session.company) + '</p>' +
        '<p class="row-when">' + T7.esc(session.email) + '</p></div>' +
        '<div class="action-row"><a class="btn-line" href="trade.html">View Public Board</a>' +
        '<button type="button" class="btn-line" id="signout">Sign Out</button></div>' +
      '</div>' +

      '<div class="dash-grid">' +
        stat('Listed lots', lots.length) +
        stat('Drafts', ds.length) +
        stat('Quote requests', 0) +
      '</div>' +

      '<section class="dash-section">' +
        '<h2>Submit a lot</h2>' +
        '<form class="form" id="lot-form" novalidate>' +
          '<div class="form-row">' +
            '<div class="field"><label for="name">Lot name</label><input id="name" name="name" type="text" placeholder="e.g. Kimberley rough parcel" required><p class="field-error" id="err-name"></p></div>' +
            '<div class="field"><label for="commodity">Commodity</label><select id="commodity" name="commodity"><option value="diamond">Diamond</option><option value="gold">Gold</option></select></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="field"><label for="type">Type <span class="opt">(optional)</span></label><input id="type" name="type" type="text" placeholder="rough, polished, refined…"></div>' +
            '<div class="field"><label for="origin">Origin <span class="opt">(optional)</span></label><input id="origin" name="origin" type="text" placeholder="Only if you can evidence it"></div>' +
          '</div>' +
          '<div class="field"><label for="description">Description</label><textarea id="description" name="description" placeholder="Describe the lot in the terms you can support. Do not state grades, weights or certification you cannot evidence."></textarea></div>' +
          '<div class="notice">' +
            '<strong>The desk reviews every lot before it lists.</strong> Do not state carat ' +
            'weights, purities, assays or certificate numbers unless documentation exists for ' +
            'them — the desk will ask for it.' +
          '</div>' +
          '<div class="action-row">' +
            '<button type="submit" class="btn-desk">Save Draft</button>' +
            '<a class="btn-line" href="contact.html">Talk To The Desk</a>' +
          '</div>' +
        '</form>' +
      '</section>' +

      '<section class="dash-section">' +
        '<h2>Drafts</h2>' +
        (ds.length
          ? '<div class="row-list">' + ds.map(draftRow).join('') + '</div>' +
            '<p class="desk-footnote">Drafts are held on this device. Submitting a lot to the desk for ' +
            'review needs the Trade Desk backend — for now, speak to the desk directly.</p>'
          : '<div class="empty"><h3>No drafts</h3><p>Lots you save appear here before they go to the desk for review.</p></div>') +
      '</section>' +

      '<section class="dash-section">' +
        '<h2>Listed lots</h2>' +
        '<div class="notice" style="margin-bottom:20px">' +
          '<strong>Demonstration data.</strong> These are the desk’s own listed lots, shown ' +
          'here to illustrate how a seller’s inventory would appear. They are not yours.' +
        '</div>' +
        (lots.length ? '<div class="row-list">' + lots.map(invRow).join('') + '</div>' : '') +
      '</section>';

    document.getElementById('signout').addEventListener('click', () => {
      T7.auth.signOut();
      location.href = 'trade.html';
    });

    const form = document.getElementById('lot-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = form.elements.name.value.trim();
      const err = document.getElementById('err-name');
      const wrap = form.elements.name.closest('.field');
      if (name.length < 2) {
        err.textContent = 'Give the lot a name.';
        wrap.classList.add('is-invalid');
        form.elements.name.focus();
        return;
      }
      err.textContent = '';
      wrap.classList.remove('is-invalid');

      const list = drafts();
      list.push({
        name: name,
        commodity: form.elements.commodity.value,
        type: form.elements.type.value.trim() || null,
        origin: form.elements.origin.value.trim() || null,
        description: form.elements.description.value.trim() || null,
        status: 'draft',
        created_at: new Date().toISOString()
      });
      saveDrafts(list);
      render();
      T7.toast('Draft saved on this device');
    });
  }

  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-drop]');
    if (!btn) return;
    const list = drafts();
    list.splice(Number(btn.getAttribute('data-drop')), 1);
    saveDrafts(list);
    render();
    T7.toast('Draft discarded');
  });

  T7.api.listLots()
    .then(rows => { lots = rows; render(); })
    .catch(err => { console.error(err); render(); });
})();

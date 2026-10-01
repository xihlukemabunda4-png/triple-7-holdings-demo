# Triple 7 — UI refresh

## Preview

Extract the ZIP, open a terminal in the extracted site folder, and run:

```sh
node serve.js
```

Open http://localhost:4180. Stop the server with Ctrl+C.

## Changes

- Homepage: photographic hero, direct Browse Diamonds & Gold action, category shortcuts and three dynamically loaded lot previews using the existing data source.
- Shared typography: bundled offline-ready Manrope and Cormorant Garamond fonts, larger navigation, clean body typography, editorial serif accents and a navy/blue/ivory palette.
- About: photographic introduction, stronger section hierarchy and a separate sustainability section.
- Trade: compact header; separate browsing, guidance and account navigation; persistent visible search; All/Diamonds/Gold buttons; expandable additional filters; clearer cards.
- How to Buy: all seven original steps retained in a numbered guide with a purchase shortcut.
- Provenance: original information retained in an editorial layout with clearly separated documentation sections.
- Locations, Investors and Jobs: existing layouts retained with shared typography improvements.
- Responsive navigation now collapses earlier so larger labels fit comfortably on tablets. The trade navigation sits below the main navbar.
- Reduced-motion preferences respected; no continuous hero zoom.
- Corrected a misleading demo image: D-1042 previously showed gold bars for a rough diamond parcel. It now uses the neutral diamond placeholder until a correct lot photo is supplied.

## Files

All HTML pages load `css/refresh.css`. Most styling changes are isolated there. Principal content changes are in `index.html`, `about.html`, `trade.html`, `how-to-buy.html` and `provenance.html`. Trade navigation is updated across supporting trade pages. `js/home.js` is new; `js/board.js`, `js/script.js` and the D-1042 demo image references in `js/t7-lots.js` were updated.

## Existing behaviour

The quote request process, server endpoints and backend configuration are retained. This is the supplied demo project: sign-in remains its existing sandbox demonstration and live backend credentials remain unconfigured. No production deployment or real quote submission was performed.

## Validation

Checked local links/assets, HTML nesting and JavaScript syntax. Checked layouts at 390, 768 and 1440 px, category filtering, search, the additional-filter toggle, lot navigation, the signed-out quote-request link and mobile-menu open/Escape behaviour. No horizontal overflow or JavaScript runtime errors were reported in these checks.

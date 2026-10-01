# Triple 7 — clean UI update

## Run locally

Extract this ZIP and run `node serve.js` inside the site folder. Open http://localhost:4180. No dependency installation is required for the static preview. Existing backend setup and deployment instructions still apply; the static preview server does not execute serverless API routes.

## Implemented

- Removed decorative arrows, diamond markers and list bullets. Kept functional search, menu, selection and form controls.
- Promoted small navigation links to clear CTA buttons, particularly View Lot and How to Buy.
- Standardised button sizes, spacing and corners; increased lot-title and description readability.
- Replaced the Home and About statistics blocks with a full-width navy-blue section, white numbers and subtle dividers. Original figures retained.
- Rebuilt What We Offer on Home and About as an interactive dark service panel. Select Mining, Processing, Sorting, Cut & Polish or Sales for its description. Mobile uses expandable sections. Buttons support keyboard operation and reduced motion.
- Restored the missing refresh stylesheet, homepage listing script and locally bundled fonts. Fonts work offline.
- Reconnected the All/Diamonds/Gold controls in the new ZIP to the board's existing filter state and URL parameters.
- Removed the incorrect gold-bar photo from rough-diamond demo lot D-1042; a neutral diamond placeholder displays until the correct photograph is provided.

## Preserved

The new ZIP was the base. Server API files, frontend API transport, authentication, configuration and deployment configuration were verified byte-for-byte against it. The quote workflow is retained. Changes in other scripts are limited to interface rendering, filter controls and decorative copy.

## Checked

HTML structure; local assets/links; JavaScript syntax; desktop, tablet and mobile page widths; service selection and mobile collapse; category filtering (4 total, 1 gold, 3 diamonds); lot-ID search; and the existing signed-out quote-request action. No JavaScript errors or horizontal page overflow were reported during these checks.

Live backend delivery and real quote submissions were not exercised. No production site was deployed.

Desktop and mobile screenshots of Home and Trade are included in `previews/`.

## Colour refinement

Statistics and service panels now use the site’s navy/blue palette, with pale-blue accents and white text. Green accents removed. The catalogue redesign described below is now implemented.

## Homepage and catalogue redesign

- Homepage: two large image tiles lead directly to diamond or gold listings, with a separate How to Buy button.
- Trade: compact introduction and one unified product grid, replacing the large banner and repeated commodity headings.
- Desktop: a filter sidebar and a single search/sort toolbar above the products.
- Mobile: category selection, search/sort, expandable filters and single-column listings.
- Consistent 4:3 product images, readable card details and full-width View Lot buttons.
- Desk status displayed once; buying guidance, origin documentation and contact links below listings.
- Buyer and seller access grouped into a keyboard-accessible Account menu. The existing session-aware link is reused without modifying authentication.
- Changing category clears incompatible detail filters. Clear filters resets search, categories and sort. Filtered URLs remain shareable.

Additional validation: category counts; type filtering; empty results; clearing filters; category switching; direct filtered URLs; sorting; account-menu opening and Escape; signed-out quote action. Layouts checked at 390, 768 and 1440 px. No runtime errors or horizontal page overflow in these checks. Live backend submissions were not made.

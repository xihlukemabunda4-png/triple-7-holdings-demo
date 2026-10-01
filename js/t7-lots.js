/* ============================================================
   Triple 7 Holdings — Trade Desk lots
   ------------------------------------------------------------
   EVERY FIELD BELOW IS TAKEN VERBATIM FROM THE LIVE DESK at
   triple7holdings.co.za/trade. Nothing here is invented: no
   prices, no carat weights, no purities, no certificates, no
   origins beyond what the desk itself states.

   Fields the live desk does NOT publish are left null on purpose
   — the UI hides them rather than filling them with plausible
   nonsense. They populate from Supabase when Person 2's tables
   are live; the column names match COMMERCE.md.

   This file is development data standing in for the `lots` table.
   Delete it once the real table is seeded.
   ============================================================ */
window.T7_LOTS = [
  {
    lot_id: 'D-1042',
    commodity: 'diamond',
    name: 'Kimberley Rough Parcel',
    type: 'rough',
    /* The desk states a Southern African source for this lot and for
       no other, so this is the only lot carrying an origin. */
    origin: 'Southern Africa',
    descriptors: ['Natural', 'Untreated', 'Mine origin'],
    pricing: 'Quote on request',
    status: 'live',
    verification: 'Desk verified',
    description: 'A carefully assembled rough diamond parcel from Triple 7 partnered production. Natural and untreated — ready for verified Trade Desk buyers who want stones with a clear Southern African source.',
    image: 'images/lots/D-1042.jpg',
    image_card: 'images/lots/D-1042-card.jpg',
    image_alt: 'Kimberley rough parcel',
    latest: true,
    /* Not published by the desk. Hidden until the backend supplies it. */
    quantity: null,
    unit: null,
    condition: null,
    treatment: null,
    last_updated: null
  },
  {
    lot_id: 'D-1048',
    commodity: 'diamond',
    name: 'Large Polished Diamond',
    type: 'polished',
    origin: null,
    descriptors: ['Cut & polished', 'Buyer-matched'],
    pricing: 'Quote on request',
    status: 'live',
    verification: 'Desk verified',
    description: 'A substantial polished diamond finished through our sorting and cutting process. Built for buyers who want size, presence and a clean path from mine to market.',
    image: 'images/lots/D-1048.jpg',
    image_card: 'images/lots/D-1048-card.jpg',
    image_alt: 'Large polished diamond',
    latest: false,
    quantity: null,
    unit: null,
    condition: null,
    treatment: null,
    last_updated: null
  },
  {
    lot_id: 'D-1055',
    commodity: 'diamond',
    name: 'Setting-Ready Diamond',
    type: 'polished',
    origin: null,
    descriptors: ['Polished', 'Jewellery pathway'],
    pricing: 'Quote on request',
    status: 'live',
    verification: 'Desk verified',
    description: 'A polished diamond prepared for jewellery — selected for cut quality and wearability. Ideal for rings and commissioned pieces that start with a Triple 7 stone.',
    image: 'images/lots/D-1055.jpg',
    image_card: 'images/lots/D-1055-card.jpg',
    image_alt: 'Setting-ready diamond',
    latest: false,
    quantity: null,
    unit: null,
    condition: null,
    treatment: null,
    last_updated: null
  },
  {
    lot_id: 'G-2201',
    commodity: 'gold',
    name: 'Refined Gold Lot',
    type: 'refined',
    origin: null,
    descriptors: ['Trade Desk', 'Verified buyers'],
    pricing: 'Market-linked',
    status: 'live',
    verification: 'Desk verified',
    description: 'Refined gold available alongside our diamond catalogue — for clients who consolidate precious metal and diamond purchases through one trusted desk.',
    image: 'images/lots/G-2201.jpg',
    image_card: 'images/lots/G-2201-card.jpg',
    image_alt: 'Refined gold lot',
    latest: true,
    quantity: null,
    unit: null,
    condition: null,
    treatment: null,
    last_updated: null
  }
];

/* The two market desks, and whether they are open for trading. The
   live desk shows both closed while their lots stay listed. */
window.T7_DESKS = [
  {
    key: 'diamond',
    label: 'Diamonds',
    status: 'closed',
    blurb: 'Natural stones with desk-verified Southern African provenance.',
    board_blurb: 'Rough & polished natural stones'
  },
  {
    key: 'gold',
    label: 'Gold',
    status: 'closed',
    blurb: 'Refined bars and mine-linked concentrate with assay notes.',
    board_blurb: 'Refined metal & concentrate'
  }
];

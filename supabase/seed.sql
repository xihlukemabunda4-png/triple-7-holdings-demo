-- =========================================================
-- Seed: the four real lots + two desks, copied verbatim from
-- js/t7-lots.js. Safe to re-run (upserts on lot_id / key).
-- Run once on the hosted project, then delete js/t7-lots.js.
-- =========================================================
insert into public.lots
  (lot_id, commodity, name, type, origin, descriptors, pricing, status, verification,
   description, image, image_card, image_alt, latest)
values
  ('D-1042','diamond','Kimberley Rough Parcel','rough','Southern Africa',
   array['Natural','Untreated','Mine origin'],'Quote on request','live','Desk verified',
   'A carefully assembled rough diamond parcel from Triple 7 partnered production. Natural and untreated — ready for verified Trade Desk buyers who want stones with a clear Southern African source.',
   'images/lots/D-1042.jpg','images/lots/D-1042-card.jpg','Kimberley rough parcel', true),

  ('D-1048','diamond','Large Polished Diamond','polished',null,
   array['Cut & polished','Buyer-matched'],'Quote on request','live','Desk verified',
   'A substantial polished diamond finished through our sorting and cutting process. Built for buyers who want size, presence and a clean path from mine to market.',
   'images/lots/D-1048.jpg','images/lots/D-1048-card.jpg','Large polished diamond', false),

  ('D-1055','diamond','Setting-Ready Diamond','polished',null,
   array['Polished','Jewellery pathway'],'Quote on request','live','Desk verified',
   'A polished diamond prepared for jewellery — selected for cut quality and wearability. Ideal for rings and commissioned pieces that start with a Triple 7 stone.',
   'images/lots/D-1055.jpg','images/lots/D-1055-card.jpg','Setting-ready diamond', false),

  ('G-2201','gold','Refined Gold Lot','refined',null,
   array['Trade Desk','Verified buyers'],'Market-linked','live','Desk verified',
   'Refined gold available alongside our diamond catalogue — for clients who consolidate precious metal and diamond purchases through one trusted desk.',
   'images/lots/G-2201.jpg','images/lots/G-2201-card.jpg','Refined gold lot', true)
on conflict (lot_id) do update set
  commodity = excluded.commodity, name = excluded.name, type = excluded.type,
  origin = excluded.origin, descriptors = excluded.descriptors, pricing = excluded.pricing,
  status = excluded.status, verification = excluded.verification,
  description = excluded.description, image = excluded.image,
  image_card = excluded.image_card, image_alt = excluded.image_alt, latest = excluded.latest;

insert into public.desks (key, label, status, blurb, board_blurb) values
  ('diamond','Diamonds','closed','Natural stones with desk-verified Southern African provenance.','Rough & polished natural stones'),
  ('gold','Gold','closed','Refined bars and mine-linked concentrate with assay notes.','Refined metal & concentrate')
on conflict (key) do update set
  label = excluded.label, status = excluded.status,
  blurb = excluded.blurb, board_blurb = excluded.board_blurb;

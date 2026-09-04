#!/usr/bin/env node
/* ============================================================
   Triple 7 Holdings — stone photo normaliser
   ------------------------------------------------------------
   Drop raw photographs into tools/incoming/ and run:

       cd tools && npm run stones

   Every file comes out as a square JPEG on a black backdrop in
   images/stones/, so a white-background supplier shot and a black
   studio sweep end up looking like one set.

   Name the incoming file after what it should become:

       incoming/round.jpg        -> images/stones/round.jpg
       incoming/T7-MX-1041.png   -> images/stones/T7-MX-1041.jpg

   WHAT THIS IS NOT: a background remover. There is no segmentation
   here. For a light-background shot it trims the uniform margin,
   centres what is left on black, and feathers the edges out — which
   rescues a usable image but leaves a soft halo where the backdrop
   used to be. A stone photographed on black needs none of that and
   will always look better. Shoot on black.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IN = path.join(__dirname, 'incoming');
const OUT = path.resolve(__dirname, '..', 'images', 'stones');

const SIZE = 1400;         // final square, px
const STONE_FRACTION = 0.82; // how much of the canvas the stone fills
const QUALITY = 82;
const LIGHT_THRESHOLD = 128; // mean corner luminance above this = light backdrop

const EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff'];

/* Average luminance of the four corners, which is the cheapest
   reliable read on "what colour is the backdrop". */
async function backdropLuminance(buffer) {
  const { data, info } = await sharp(buffer)
    .resize(9, 9, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = (x, y) => {
    const i = (y * info.width + x) * info.channels;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };
  const corners = [px(0, 0), px(8, 0), px(0, 8), px(8, 8)];
  return corners.reduce((a, b) => a + b, 0) / corners.length;
}

/* An alpha mask shaped like the stone, not like the frame.
   After the trim the crop box hugs the stone, so an ellipse inscribed
   in that box follows a round, oval, cushion or pear outline closely —
   which means the backdrop that survives in the CORNERS of the box,
   the part that reads as a bright halo, is what gets cut away.

   The gradient is in objectBoundingBox units, so it stretches with the
   crop: a tall pear gets a tall mask, a round stone a circular one,
   for free. */
function featherMask(w, h) {
  return Buffer.from(
    '<svg width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><radialGradient id="f" cx="50%" cy="50%" r="56%">' +
        '<stop offset="0%"  stop-color="#fff" stop-opacity="1"/>' +
        '<stop offset="74%" stop-color="#fff" stop-opacity="1"/>' +
        '<stop offset="88%" stop-color="#fff" stop-opacity="0.42"/>' +
        '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>' +
      '</radialGradient></defs>' +
      '<rect width="' + w + '" height="' + h + '" fill="url(#f)"/>' +
    '</svg>'
  );
}

async function normalise(file) {
  const raw = await fs.promises.readFile(path.join(IN, file));
  const name = path.parse(file).name.toLowerCase();

  const luminance = await backdropLuminance(raw);
  const isLight = luminance > LIGHT_THRESHOLD;

  const inner = Math.round(SIZE * STONE_FRACTION);
  let layer;

  if (isLight) {
    /* Cut the uniform margin off, then shrink the stone to sit inside
       the canvas with air around it. */
    let trimmed = sharp(raw).rotate();
    try {
      trimmed = trimmed.trim({ background: '#ffffff', threshold: 22 });
      await trimmed.clone().toBuffer(); // fails loudly here if trim ate everything
    } catch (e) {
      trimmed = sharp(raw).rotate();
    }

    const fitted = await trimmed
      .resize(inner, inner, { fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .toBuffer();

    const meta = await sharp(fitted).metadata();
    layer = await sharp(fitted)
      .composite([{ input: featherMask(meta.width, meta.height), blend: 'dest-in' }])
      .toBuffer();

  } else {
    /* Already on a dark backdrop: just square it off. Cover, not
       contain, so the stone stays big in the frame. */
    layer = await sharp(raw)
      .rotate()
      .resize(SIZE, SIZE, { fit: 'cover', position: 'attention' })
      .ensureAlpha()
      .toBuffer();
  }

  const out = path.join(OUT, name + '.jpg');
  await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: '#000000' }
  })
    .composite([{ input: layer, gravity: 'centre' }])
    .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
    .toFile(out);

  const { size } = await fs.promises.stat(out);
  return {
    file,
    backdrop: isLight ? 'light — trimmed and feathered' : 'dark — squared off',
    luminance: Math.round(luminance),
    out: path.relative(path.resolve(__dirname, '..'), out).replace(/\\/g, '/'),
    kb: Math.round(size / 1024)
  };
}

async function main() {
  if (!fs.existsSync(IN)) {
    console.error('No tools/incoming/ folder. Create it and put the raw photos in there.');
    process.exit(1);
  }
  await fs.promises.mkdir(OUT, { recursive: true });

  const files = (await fs.promises.readdir(IN))
    .filter(f => EXTS.includes(path.extname(f).toLowerCase()));

  if (!files.length) {
    console.log('Nothing in tools/incoming/. Drop the photos in and run this again.');
    return;
  }

  console.log('Normalising ' + files.length + ' photo' + (files.length === 1 ? '' : 's') +
              ' to ' + SIZE + '×' + SIZE + ' on black\n');

  let failed = 0;
  for (const file of files) {
    try {
      const r = await normalise(file);
      console.log('  ' + r.file.padEnd(24) + r.backdrop.padEnd(32) +
                  '-> ' + r.out + '  (' + r.kb + ' KB)');
    } catch (err) {
      failed++;
      console.error('  ' + file.padEnd(24) + 'FAILED  ' + err.message);
    }
  }

  console.log('\nDone.' + (failed ? '  ' + failed + ' failed.' : ''));
  console.log('A light backdrop is rescued, never truly removed. Reshoot on black where you can.');
}

main().catch(err => { console.error(err); process.exit(1); });

/**
 * generate-pwa-icons.mjs — rasterizes the site logo
 * (public/images/mtx-logo.svg) into the PWA icon set under public/pwa/.
 * Run once per logo change: `node scripts/generate-pwa-icons.mjs`.
 * Icons are committed; this script is not part of the site build.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'public/images/mtx-logo.svg';
mkdirSync('public/pwa', { recursive: true });

async function icon(size, out, { pad = 0 } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(SRC, { density: 300 })
    .resize(inner, inner, { fit: 'contain' })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 1, g: 3, b: 2, alpha: 1 } }
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out);
  console.log('✔', out, size + 'x' + size);
}

await icon(192, 'public/pwa/icon-192.png');
await icon(512, 'public/pwa/icon-512.png');
// Maskable: keep the mark inside the ~80% safe zone.
await icon(512, 'public/pwa/icon-maskable-512.png', { pad: 0.12 });
// iOS home-screen icon.
await icon(180, 'public/pwa/apple-touch-icon.png');

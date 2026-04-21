import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// SVG icon — teal location pin on dark background
const makeSvg = (size) => {
  const r = size * 0.18;
  const cx = size / 2;
  const pinTop = size * 0.22;
  const pinR = size * 0.20;
  const holeR = size * 0.09;
  const pinBottom = size * 0.74;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111118"/>
      <stop offset="100%" stop-color="#0d1520"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  <!-- outer glow ring -->
  <circle cx="${cx}" cy="${size*0.44}" r="${size*0.30}" fill="none" stroke="#0d9488" stroke-width="${size*0.018}" opacity="0.25"/>
  <!-- pin body -->
  <path d="M${cx},${pinBottom} C${cx},${pinBottom} ${cx-pinR*1.5},${size*0.57} ${cx-pinR*1.5},${size*0.44}
           C${cx-pinR*1.5},${size*0.44-pinR*1.5} ${cx-pinR},${pinTop} ${cx},${pinTop}
           C${cx+pinR},${pinTop} ${cx+pinR*1.5},${size*0.44-pinR*1.5} ${cx+pinR*1.5},${size*0.44}
           C${cx+pinR*1.5},${size*0.57} ${cx},${pinBottom} ${cx},${pinBottom} Z"
        fill="#0d9488"/>
  <!-- hole -->
  <circle cx="${cx}" cy="${size*0.44}" r="${holeR}" fill="#111118"/>
</svg>`);
};

for (const size of [192, 512]) {
  await sharp(makeSvg(size), { density: 144 })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, `icon-${size}.png`));
  console.log(`icon-${size}.png written`);
}

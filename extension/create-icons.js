/**
 * create-icons.js
 * Run once to generate PNG icons for the Chrome extension from the SVG source.
 * Usage: node create-icons.js
 * Requires: npm install sharp (run in the extension folder)
 */

const fs = require('fs');
const path = require('path');

// Inline the SVG as a buffer so we don't need the file to exist yet
const svgBuffer = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a0a2e"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </linearGradient>
    <linearGradient id="v" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e50914"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)"/>
  <path d="M24 32 L64 100 L104 32" stroke="url(#v)" stroke-width="16"
        stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
`);

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('Installing sharp...');
    require('child_process').execSync('npm install sharp', { stdio: 'inherit' });
    sharp = require('sharp');
  }

  const iconsDir = path.join(__dirname, 'icons');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

  const sizes = [16, 32, 48, 128];
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon${size}.png`));
    console.log(`✅  icon${size}.png`);
  }
  console.log('\nDone! Icons saved to icons/');
}

main().catch(console.error);

/**
 * Simple icon generator using Node.js
 * Run: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Simple base64 encoded icons (minimal calendar icon)
// For production, you might want to use a proper image library or design tool

function createIconSVG(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)" rx="${size * 0.1}"/>
  <rect x="${size * 0.15}" y="${size * 0.15}" width="${size * 0.7}" height="${size * 0.7}" 
        fill="rgba(255,255,255,0.1)" rx="${size * 0.05}"/>
  <rect x="${size * 0.15}" y="${size * 0.15}" width="${size * 0.7}" height="${size * 0.12}" 
        fill="rgba(100,150,255,0.3)" rx="${size * 0.05}"/>
  <circle cx="${size * 0.25}" cy="${size * 0.21}" r="${size * 0.02}" fill="rgba(18,18,20,0.8)"/>
  <circle cx="${size * 0.4}" cy="${size * 0.21}" r="${size * 0.02}" fill="rgba(18,18,20,0.8)"/>
  <circle cx="${size * 0.55}" cy="${size * 0.21}" r="${size * 0.02}" fill="rgba(18,18,20,0.8)"/>
  <text x="${size * 0.25}" y="${size * 0.4}" font-family="system-ui" font-size="${size * 0.08}" 
        font-weight="bold" fill="rgba(255,255,255,0.8)" text-anchor="middle">1</text>
  <text x="${size * 0.4}" y="${size * 0.4}" font-family="system-ui" font-size="${size * 0.08}" 
        font-weight="bold" fill="rgba(255,255,255,0.8)" text-anchor="middle">2</text>
  <text x="${size * 0.55}" y="${size * 0.4}" font-family="system-ui" font-size="${size * 0.08}" 
        font-weight="bold" fill="rgba(255,255,255,0.8)" text-anchor="middle">3</text>
  <line x1="${size * 0.25}" y1="${size * 0.5}" x2="${size * 0.7}" y2="${size * 0.5}" 
        stroke="rgba(100,150,255,0.5)" stroke-width="${size * 0.01}"/>
</svg>`;
}

// Note: This creates SVG files. For PNG, you'll need to:
// 1. Use a tool like Inkscape, ImageMagick, or online converter
// 2. Or open generate-icons.html in a browser and download the PNGs

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [16, 48, 128];
sizes.forEach(size => {
  const svg = createIconSVG(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.svg`), svg);
  console.log(`Created icon${size}.svg`);
});

console.log('\nSVG icons created!');
console.log('To convert to PNG:');
console.log('1. Open generate-icons.html in your browser and click the button, OR');
console.log('2. Use an online SVG to PNG converter, OR');
console.log('3. Use ImageMagick: convert icon16.svg icon16.png');


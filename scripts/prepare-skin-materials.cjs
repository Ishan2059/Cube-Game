const fs = require('node:fs/promises');
const sharp = require('sharp');
const manifest = require('../design-assets/runtime-materials/manifest.json');
async function main() {
  await fs.mkdir('public/game-art/materials', { recursive: true });
  for (const asset of manifest.assets) {
    const master = `design-assets/runtime-materials/${asset.id}.png`;
    try { await fs.access(master); } catch { await fs.copyFile(asset.source, master); }
    await sharp(master).resize(1024, 1024, { fit: 'fill' }).webp({ quality: 94 }).toFile(`public/game-art/materials/${asset.id}.webp`);
  }
  console.log('Prepared 9 runtime material maps');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

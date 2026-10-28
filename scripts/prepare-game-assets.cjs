// Reproducible web derivatives of the approved art and sound masters.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const contract = JSON.parse(await fs.readFile('design-assets/unified-v1/asset-contract.json', 'utf8'));
  for (const asset of contract.assets) {
    const dest = path.join('public/game-art', asset.group, `${asset.id}.webp`);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await sharp(asset.portrait).resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 100 }).toFile(dest);
  }
  const master = JSON.parse(await fs.readFile('Audio/manifest.json', 'utf8'));
  const unused = /xp_|login|logout|equip_aura|session.ready|slider_tick|tally_tick|tally_finish/;
  const bank = {};
  for (const cue of master.cues.filter(c => !unused.test(c.id))) {
    const files = [];
    for (const asset of cue.assets) {
      const stem = asset.ogg.replace(/^ogg\//, '').replace(/\.ogg$/, '');
      files.push(`/audio/${stem}`);
      for (const ext of ['ogg', 'wav']) {
        const dest = `public/audio/${stem}.${ext}`;
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(`Audio/${asset[ext]}`, dest);
      }
    }
    bank[cue.id] = { files, cooldownMs: cue.cooldownMs, maxVoices: cue.maxVoices, priority: cue.priority };
  }
  Object.assign(bank, JSON.parse(await fs.readFile('Audio/exploration-manifest.json', 'utf8')));
  await fs.writeFile('game/audio-bank.json', JSON.stringify(bank, null, 2) + '\n');
  console.log(`Prepared ${contract.assets.length} portraits and ${Object.keys(bank).length} audio cues.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

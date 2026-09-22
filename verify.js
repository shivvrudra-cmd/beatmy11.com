import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'src', 'data');

// Read source file
const sourceData = JSON.parse(fs.readFileSync(path.join(dataDir, '1970s.json'), 'utf8'));
// Read target file
const targetData = JSON.parse(fs.readFileSync(path.join(dataDir, '1980s.json'), 'utf8'));

// Find players in source that have era including 1980s
const sourcePlayersWith1980s = sourceData.filter(player => {
  const eras = Array.isArray(player.era) ? player.era : [player.era];
  return eras.includes('1980s');
});

console.log(`Players in 1970s.json with era including 1980s: ${sourcePlayersWith1980s.length}`);

// Check if each of these players is in targetData by id
const missing = sourcePlayersWith1980s.filter(sourcePlayer => {
  return !targetData.some(targetPlayer => targetPlayer.id === sourcePlayer.id);
});

if (missing.length > 0) {
  console.log('Missing players in 1980s.json:');
  missing.forEach(p => console.log(`  ${p.id} (${p.name})`));
} else {
  console.log('All players from 1970s.json with era including 1980s are present in 1980s.json.');
}

// Additionally, check that the stats match for each player
const mismatches = [];
sourcePlayersWith1980s.forEach(sourcePlayer => {
  const targetPlayer = targetData.find(tp => tp.id === sourcePlayer.id);
  if (targetPlayer) {
    // Compare stats
    const sourceStats = sourcePlayer.stats;
    const targetStats = targetPlayer.stats;
    const keys = Object.keys(sourceStats);
    for (const key of keys) {
      if (sourceStats[key] !== targetStats[key]) {
        mismatches.push({
          player: sourcePlayer.id,
          field: key,
          source: sourceStats[key],
          target: targetStats[key]
        });
      }
    }
  }
});

if (mismatches.length > 0) {
  console.log('Mismatched stats found:');
  mismatches.forEach(m => {
    console.log(`  ${m.player}.${m.field}: source=${m.source}, target=${m.target}`);
  });
} else {
  console.log('All stats match for players present in both files.');
}
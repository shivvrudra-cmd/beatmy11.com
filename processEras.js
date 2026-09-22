import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'src', 'data');

// Read ONLY 1970s.json as source (do not modify this file)
const sourceFile = path.join(dataDir, '1970s.json');
const sourceData = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));

// Get ALL target decade files (we'll write to all of them, but avoid modifying source)
const allFiles = fs.readdirSync(dataDir)
  .filter(f => /^\d{4}s\.json$/.test(f))
  .map(f => path.join(dataDir, f));

// Load each target file into memory
const targets = {};
for (const file of allFiles) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(content);
    targets[file] = data;
  } catch (error) {
    console.warn(`Could not read ${file}: ${error.message}`);
    targets[file] = []; // Start with empty array if file can't be read
  }
}

// Process each player from 1970s.json
for (const player of sourceData) {
  const eras = Array.isArray(player.era) ? player.era : [player.era];
  for (const era of eras) {
    const targetFile = path.join(dataDir, `${era}.json`);
    if (!targets[targetFile]) {
      console.warn(`Target file ${targetFile} not found, skipping`);
      continue;
    }
    const targetArray = targets[targetFile];
    // Remove any existing player with same id to avoid duplicates
    const index = targetArray.findIndex(p => p.id === player.id);
    if (index !== -1) {
      targetArray.splice(index, 1);
    }
    // Add the player from source
    targetArray.push(player);
    console.log(`Updated ${player.id} to ${era}.json`);
  }
}

// Write back ALL target files (including 1970s.json, but duplicates prevented by check above)
// Use custom replacer to preserve 0.0 format for specific fields
for (const [file, data] of Object.entries(targets)) {
  const jsonString = JSON.stringify(data, (key, value) => {
    // Preserve 0.0 format for rate/average fields that should show decimals when zero
    if (typeof value === 'number' && value === 0) {
      // Check if this is one of the fields that should be 0.0 instead of 0
      const zeroAsDecimalFields = [
        'testAverage',
        'testBowlingAverage',
        'battingStrikeRate',
        'bowlingStrikeRate'
      ];
      if (zeroAsDecimalFields.includes(key)) {
        return 0.0;
      }
    }
    return value;
  }, 2);
  fs.writeFileSync(file, jsonString);
  console.log(`Written ${file}`);
}
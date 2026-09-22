import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'src', 'data');

// Read ONLY 1970s.json as source (do not modify this file)
const sourceFile = path.join(dataDir, '1970s.json');
const sourceData = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));

// Get target decade files (EXCLUDE 1970s.json as we don't want to modify it)
const allFiles = fs.readdirSync(dataDir)
  .filter(f => /^\d{4}s\.json$/.test(f))
  .map(f => path.join(dataDir, f));

const targetFiles = allFiles.filter(f => !f.endsWith('1970s.json'));

// Load each target file into memory
const targets = {};
for (const file of targetFiles) {
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
    // Check if player already exists by id
    const exists = targetArray.some(p => p.id === player.id);
    if (!exists) {
      targetArray.push(player);
      console.log(`Added ${player.id} to ${era}.json`);
    }
  }
}

// Write back ONLY the target files (NOT 1970s.json)
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
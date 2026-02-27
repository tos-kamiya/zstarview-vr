import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const ROOT = process.cwd();
const inputPath = resolve(ROOT, 'data/cities1000.txt');
const outputPath = resolve(ROOT, 'public/data/cities-index.json');

const MIN_POPULATION = 5000;
const MAX_ENTRIES = 40000;

function parseIntSafe(text) {
  const n = Number.parseInt(text, 10);
  return Number.isFinite(n) ? n : 0;
}

function parseFloatSafe(text) {
  const n = Number.parseFloat(text);
  return Number.isFinite(n) ? n : null;
}

const lines = readFileSync(inputPath, 'utf-8').split(/\r?\n/);
const rows = [];

for (const line of lines) {
  if (!line) continue;
  const cols = line.split('\t');
  if (cols.length < 15) continue;

  const name = (cols[1] || '').trim();
  const ascii = (cols[2] || '').trim();
  const lat = parseFloatSafe(cols[4]);
  const lon = parseFloatSafe(cols[5]);
  const featClass = (cols[6] || '').trim();
  const featCode = (cols[7] || '').trim();
  const country = (cols[8] || '').trim();
  const admin1 = (cols[10] || '').trim();
  const pop = parseIntSafe(cols[14]);

  if (!name || lat == null || lon == null) continue;
  if (featClass !== 'P') continue;

  const isCapitalLike = featCode === 'PPLC' || featCode.startsWith('PPLA');
  if (!isCapitalLike && pop < MIN_POPULATION) continue;

  rows.push([name, ascii || name, lat, lon, country, admin1, pop]);
}

rows.sort((a, b) => b[6] - a[6]);
const limited = rows.slice(0, MAX_ENTRIES);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      min_population: MIN_POPULATION,
      source_rows: lines.length,
      entries: limited,
    },
    null,
    0,
  ),
  'utf-8',
);

console.log(`Generated ${outputPath} with ${limited.length} entries.`);

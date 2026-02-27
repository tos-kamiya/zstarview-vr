import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const inputPath = resolve(ROOT, 'public/data/cities-index-v2.json');
const outputPath = `${inputPath}.gz`;

const raw = readFileSync(inputPath);
const gz = gzipSync(raw, { level: 9 });
writeFileSync(outputPath, gz);

console.log(`Generated ${outputPath} (${raw.length} -> ${gz.length} bytes).`);

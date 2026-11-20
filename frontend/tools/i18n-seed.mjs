#!/usr/bin/env node
/**
 * Appends every key that a feature uses but its i18n.src.txt lacks, with an English label derived from the key's last
 * segment ("customerCode" -> "Customer code", "streetAr" -> "Street (Arabic)"). Review and override the sentences
 * afterwards by adding a later line for the same key. Usage: node tools/i18n-seed.mjs <featureDir> <prefix>
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const [dir, prefix] = process.argv.slice(2);
const out = execFileSync('node', [path.join(import.meta.dirname, 'i18n-keys.mjs'), dir, prefix], { encoding: 'utf8' }).split('\n').slice(1).filter(Boolean);
const human = key => {
  const last = key.split('.').pop();
  if (/^\d+$/.test(last)) return last;
  let w = last.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  const ar = / Ar$/.test(w);
  w = w.replace(/ Ar$/, '').toLowerCase();
  w = w.charAt(0).toUpperCase() + w.slice(1);
  return ar ? `${w} (Arabic)` : w;
};
const file = path.join(dir, 'src/lib/i18n/i18n.src.txt');
fs.mkdirSync(path.dirname(file), { recursive: true });
const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const add = out.map(k => `${k} = ${human(k)}`).join('\n');
fs.writeFileSync(file, existing + (existing && !existing.endsWith('\n') ? '\n' : '') + (add ? `# --- auto-seeded labels (override below) ---\n${add}\n` : ''));
console.log(`${out.length} keys seeded into ${file}`);

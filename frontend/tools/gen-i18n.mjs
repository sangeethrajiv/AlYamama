#!/usr/bin/env node
/**
 * Generates en.json / ar.json for every `i18n.src.txt` under libs/ and apps/.
 * Source format, one entry per line:   some.nested.key = English text | النص العربي
 * The Arabic part is optional: missing Arabic falls back to English at runtime (Transloco fallbackLang).
 * `#` starts a comment line. Keys nest on '.'. Use `\n` for a line break inside a value.
 * Run: node tools/gen-i18n.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const roots = ['libs', 'apps'];
const found = [];
const walk = dir => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'i18n.src.txt') found.push(p);
  }
};
roots.filter(fs.existsSync).forEach(walk);

const put = (obj, key, value, file, line) => {
  const parts = key.split('.');
  let o = obj;
  parts.forEach((p, i) => {
    const last = i === parts.length - 1;
    if (last) {
      if (typeof o[p] === 'object') throw new Error(`${file}:${line} key "${key}" collides with a group of the same name`);
      o[p] = value;
    } else {
      if (typeof o[p] === 'string') throw new Error(`${file}:${line} key "${key}" collides with leaf "${parts.slice(0, i + 1).join('.')}"`);
      o = o[p] ??= {};
    }
  });
};

let total = 0;
for (const file of found) {
  const en = {}, ar = {};
  fs.readFileSync(file, 'utf8').split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf(' = ');
    if (eq < 0) throw new Error(`${file}:${i + 1} expected "key = English | Arabic"`);
    const key = line.slice(0, eq).trim();
    const rest = line.slice(eq + 3);
    const bar = rest.lastIndexOf(' | ');
    const english = (bar < 0 ? rest : rest.slice(0, bar)).trim().replace(/\\n/g, '\n');
    const arabic = bar < 0 ? '' : rest.slice(bar + 3).trim().replace(/\\n/g, '\n');
    put(en, key, english, file, i + 1);
    if (arabic) put(ar, key, arabic, file, i + 1);
    total++;
  });
  const dir = path.dirname(file);
  fs.writeFileSync(path.join(dir, 'en.json'), JSON.stringify(en, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'ar.json'), JSON.stringify(ar, null, 2) + '\n');
  console.log(`${path.relative('.', dir)}: ${Object.keys(en).length} groups`);
}
console.log(`${total} entries from ${found.length} source files`);

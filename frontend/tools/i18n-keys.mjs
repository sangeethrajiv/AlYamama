#!/usr/bin/env node
/**
 * Lists translation keys used by a feature (`'prefix.some.key'` string literals in .ts files) and reports the ones that
 * are missing from its i18n.src.txt. Usage: node tools/i18n-keys.mjs libs/web/features/contacts contacts [--list]
 */
import fs from 'node:fs';
import path from 'node:path';
const [dir, prefix, flag] = process.argv.slice(2);
const files = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.ts$/.test(e.name) && !/\.spec\.ts$/.test(e.name)) files.push(p); } };
walk(dir);
const used = new Set();
const re = new RegExp(`['"\`](${prefix}\\.[A-Za-z0-9_.]*[A-Za-z0-9_])['"\`]`, 'g');
for (const f of files) { const s = fs.readFileSync(f, 'utf8'); let m; while ((m = re.exec(s))) used.add(m[1]); }
const srcFile = path.join(dir, 'src/lib/i18n/i18n.src.txt');
const have = new Set(fs.existsSync(srcFile) ? fs.readFileSync(srcFile, 'utf8').split('\n').filter(l => l.includes(' = ') && !l.startsWith('#')).map(l => l.slice(0, l.indexOf(' = ')).trim()) : []);
const missing = [...used].filter(k => !have.has(k)).sort();
if (flag === '--list') console.log([...used].sort().join('\n'));
else { console.log(`${used.size} keys used, ${have.size} defined, ${missing.length} missing`); console.log(missing.join('\n')); }

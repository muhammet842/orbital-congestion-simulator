import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/i18n/translations.ts'), 'utf8');
const langs = ['en', 'tr', 'de', 'ru', 'zh'];
const maps = {};
for (const lang of langs) {
  const m = src.match(new RegExp(`const ${lang}: Translations = \\{([\\s\\S]*?)\\n\\};`));
  if (!m) throw new Error(`missing ${lang}`);
  const keys = [...m[1].matchAll(/'([^']+)':/g)].map((x) => x[1]);
  maps[lang] = new Set(keys);
  console.log(lang, keys.length, 'dupes', keys.length - maps[lang].size);
}
for (const lang of langs.slice(1)) {
  const missing = [...maps.en].filter((k) => !maps[lang].has(k));
  const extra = [...maps[lang]].filter((k) => !maps.en.has(k));
  console.log(lang, 'missing vs en', missing.length, missing.slice(0, 10));
  console.log(lang, 'extra vs en', extra.length, extra.slice(0, 10));
}

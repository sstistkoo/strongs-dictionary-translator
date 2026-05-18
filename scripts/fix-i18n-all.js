import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const I18N_DIR = path.join(__dirname, '..', 'i18n');

const KEEP = new Set(['cs.json', 'en.json']);
const IGNORE = new Set(['missing_i18n_audit.json']);

const files = fs.readdirSync(I18N_DIR)
  .filter(f => f.endsWith('.json') && !IGNORE.has(f) && !f.startsWith('prompts.'));

for (const file of files) {
  const filePath = path.join(I18N_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const hasBOM = content.charCodeAt(0) === 0xFEFF;
  if (hasBOM) content = content.slice(1);

  if (KEEP.has(file)) {
    try {
      const data = JSON.parse(content);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`✓ ${file} — opraveno (BOM: ${hasBOM})`);
    } catch (e) {
      console.error(`✗ ${file} — chyba: ${e.message}`);
    }
  } else {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2) + '\n', 'utf8');
    console.log(`✓ ${file} — vymazáno (dosaženo ${Object.keys({}).length} klíčů)`);
  }
}

console.log('Hotovo.');

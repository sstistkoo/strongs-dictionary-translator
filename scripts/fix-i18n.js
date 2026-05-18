import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const I18N_DIR = path.join(__dirname, '..', 'i18n');

function readJson(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const startLen = content.length;
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
    console.log(`   [BOM] ${path.basename(filePath)}: removed BOM (${startLen} → ${content.length} chars)`);
  }
  return JSON.parse(content);
}

function main() {
  const enPath = path.join(I18N_DIR, 'en.json');
  const enData = readJson(enPath);
  const enKeys = Object.keys(enData);

  const files = fs.readdirSync(I18N_DIR)
    .filter(f => f.endsWith('.json') && f !== 'en.json' && !f.startsWith('prompts.') && f !== 'missing_i18n_audit.json');

  for (const file of files) {
    const filePath = path.join(I18N_DIR, file);
    try {
      const data = readJson(filePath);
      let changed = false;
      for (const key of enKeys) {
        if (!(key in data)) {
          data[key] = enData[key];
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
        console.log(`✓ ${file} — doplněno ${Object.keys(data).length} klíčů`);
      } else {
        console.log(`✓ ${file} — již kompletní`);
      }
    } catch (err) {
      console.error(`✗ ${file} — chyba parsování: ${err.message}`);
    }
  }
}

main();

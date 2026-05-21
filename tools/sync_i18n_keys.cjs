const fs = require('fs');
const path = require('path');

function readJsonSafe(filePath) {
  const bytes = fs.readFileSync(filePath);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let content = decoder.decode(bytes);
  // Remove BOM
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  // Odstranit ne-ASCII řídící znaky (C0 a C1 kontrolní znaky)
  content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]/g, '');
  // Oprava: dvě čárky vedle sebe
  content = content.replace(/,\s*,/g, ',');
  // Oprava: čárka před } nebo ]
  content = content.replace(/,\s*([}\]])/g, '$1');
  // Oprava: },, -> }
  content = content.replace(/}\s*,/g, '}');
  return JSON.parse(content);
}

const i18nDir = './i18n';
const enFile = path.join(i18nDir, 'en.json');
const otherFiles = fs.readdirSync(i18nDir).filter(f => f.endsWith('.json') && f !== 'en.json' && f !== 'missing_i18n_audit.json');

const enData = readJsonSafe(enFile);
const enKeys = Object.keys(enData);

let totalAdded = 0;

for (const file of otherFiles) {
  const filePath = path.join(i18nDir, file);
  try {
    const data = readJsonSafe(filePath);
    const existingKeys = Object.keys(data);
    const missingKeys = enKeys.filter(k => !existingKeys.includes(k));
    if (missingKeys.length === 0) {
      console.log(`✓ ${file} – all keys present`);
      continue;
    }
    for (const key of missingKeys) {
      data[key] = enData[key];
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✓ ${file} – added ${missingKeys.length} keys`);
    totalAdded += missingKeys.length;
  } catch (e) {
    console.error(`✗ ${file} – ERROR: ${e.message}`);
  }
}

console.log(`\nDone. Total keys added: ${totalAdded}`);

/**
 * Překlady AI promptů z i18n (klíče aiPrompts.*) s fallbackem na strong_prompts / core.
 */
import { t } from './i18n.js';
import { getPromptPack } from './i18n.js';
import core from '../strong_translator_core_new.js';
import prompts from '../strong_prompts.js';

const { FINAL_PROMPT, PROMPT_LIBRARY_BASE } = prompts;

function tp(key, fallback) {
  const v = t(key);
  return v !== key ? v : fallback;
}

// Načte překlad podle cílového jazyka překladu (strong_target_lang)
function tTargetLang(key, fallback) {
   const targetLang = (localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();

   // Zpracování personal promptu – načíst z localStorage jako JSON
   if (targetLang === 'personal') {
     const stored = localStorage.getItem('strong_personal_prompt_json');
     if (stored) {
       try {
         const pack = JSON.parse(stored);
         const v = pack[key];
         return v !== undefined ? v : fallback;
       } catch { /* fallback below */ }
     }
     return fallback;
   }

   // Načtěme prompty pro cílový jazyk z cache (přes getPromptPack)
   const pack = getPromptPack(targetLang);
   if (pack && Object.prototype.hasOwnProperty.call(pack, key)) {
     const v = pack[key];
     if (v !== undefined) return v;
   }

   // Fallback na cs a en balíčky
   const csPack = getPromptPack('cs');
   if (csPack && Object.prototype.hasOwnProperty.call(csPack, key)) {
     const v = csPack[key];
     if (v !== undefined) return v;
   }
   const enPack = getPromptPack('en');
   if (enPack && Object.prototype.hasOwnProperty.call(enPack, key)) {
     const v = enPack[key];
     if (v !== undefined) return v;
   }

   return fallback;
}

export function getResolvedSystemMessage() {
  return tTargetLang('aiPrompts.core.system', core.SYSTEM_MESSAGE);
}

export function getResolvedDefaultPrompt() {
  return tp('aiPrompts.core.userDefault', core.DEFAULT_PROMPT);
}

export function getResolvedFinalPrompt() {
   const commonBatchDefault = tp('aiPrompts.common.batchDefault', core.DEFAULT_PROMPT);
   return {
     name: tp('aiPrompts.final.name', FINAL_PROMPT.name),
     desc: tp('aiPrompts.final.desc', FINAL_PROMPT.desc),
     text: commonBatchDefault
   };
 }

export function getResolvedPromptLibraryBase() {
       const base = JSON.parse(JSON.stringify(PROMPT_LIBRARY_BASE));
       const defText = getResolvedDefaultPrompt();
       const sysText = getResolvedSystemMessage();
       const commonBatchDefault = tp('aiPrompts.common.batchDefault', core.DEFAULT_PROMPT);
      if (base.default?.[0]) {
          const o = base.default[0];
          o.name = tp('aiPrompts.lib.default.name', o.name);
          o.desc = tp('aiPrompts.lib.default.desc', o.desc);
          o.text = defText;
          o.system = sysText;
      }
      // Odstranit nepodporované kategorie
      const removeCategories = ["detailed", "concise", "literal", "library", "sekundarni"];
      removeCategories.forEach(cat => delete base[cat]);
      return base;
  }

export function getResolvedModelTestCatalog(fallbackCat) {
  const out = {};
  for (const [id, v] of Object.entries(fallbackCat || {})) {
    const label = tp(`aiPrompts.mt.${id}.label`, v.label);
    const template = tp(`aiPrompts.mt.${id}.template`, v.template);
    const entry = { label, template };
    if (v.topicLabel != null) {
      entry.topicLabel = tp(`aiPrompts.mt.${id}.topicLabel`, v.topicLabel);
    }
    out[id] = entry;
  }
  return out;
}

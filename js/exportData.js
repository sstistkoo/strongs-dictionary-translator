export function createExportApi({ state, t, showToast }) {
  function getUiTag() {
    const ui = String(localStorage.getItem('strong_ui_lang') || 'cs').toLowerCase();
    if (ui === 'en') return 'EN';
    if (ui === 'sk') return 'SK';
    if (ui === 'pl') return 'PL';
    return 'CZ';
  }

  // Vrátí kód cílového jazyka pro název souboru (např. "cz", "sk", "pl", "en", "bg"...)
  function getTargetLangCode() {
    return String(localStorage.getItem('strong_target_lang') || 'cz')
      .toLowerCase()
      .replace(/^cs$/, 'cz');   // normalizace cs → cz
  }

  // Vrátí kód zdrojového jazyka pro název souboru (např. "gr", "he", "both")
  function getSourceLangCode() {
    return String(localStorage.getItem('strong_source_lang') || 'gr').toLowerCase();
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }

  function exportTXT() {
    const done = state.entries.filter(e => {
      const tr = state.translated[e.key];
      return tr && tr.vyznam && tr.vyznam !== '—' && !tr.skipped;
    });
    if (!done.length) {
      showToast(t('toast.noTranslatedEntry'));
      return;
    }

    const lines = done.map(e => {
      const tr = state.translated[e.key];
      const langTag = getUiTag();
      return [
        `${e.key} | ${e.greek}`,
        `${t('export.field.grammar')}: ${e.tvaroslovi || '—'}`,
        `${t('export.field.meaning', { lang: langTag })}: ${tr.vyznam || '—'}`,
        `${t('export.field.definitionEn')}: ${e.definice || e.def || '—'}`,
        `${t('export.field.definition', { lang: langTag })}: ${tr.definice || '—'}`,
        `${t('export.field.kjv', { lang: langTag })}: ${tr.kjv || e.kjv || '—'}`,
        `${t('export.field.origin')}: ${tr.puvod || '—'}`,
        `${t('export.field.specialist')}: ${tr.specialista || '—'}`,
        ''
      ].join('\n');
    });

    download(`strong_${getSourceLangCode()}_${getTargetLangCode()}_v2.txt`, lines.join('\n'), 'text/plain');
    showToast(t('toast.exported.count', { count: done.length }));
  }

  function exportJSON() {
    const out = {};
    for (const e of state.entries) {
      if (!state.translated[e.key]) continue;
      out[e.key] = { greek: e.greek, ...state.translated[e.key] };
    }
    download(`strong_${getSourceLangCode()}_${getTargetLangCode()}_v2.json`, JSON.stringify(out, null, 2), 'application/json');
    showToast(t('toast.exported.count', { count: Object.keys(out).length }));
  }

  function exportRange() {
    const from = parseInt(prompt(t('prompt.range.from'), '1') || '1', 10);
    const to = parseInt(prompt(t('prompt.range.to'), '100') || '100', 10);
    if (Number.isNaN(from) || Number.isNaN(to)) return;

    const done = state.entries.filter(e => {
      const n = parseInt(e.key.slice(1), 10);
      const tr = state.translated[e.key];
      return n >= from && n <= to && tr && tr.vyznam && tr.vyznam !== '—' && !tr.skipped;
    });
    if (!done.length) {
      showToast(t('toast.noTranslatedInRange', { from: `G${from}`, to: `G${to}` }));
      return;
    }

    const lines = done.map(e => {
      const tr = state.translated[e.key];
      const langTag = getUiTag();
      return [
        `${e.key} | ${e.greek}`,
        `${t('export.field.meaning', { lang: langTag })}: ${tr.vyznam || '—'}`,
        `${t('export.field.definition', { lang: langTag })}: ${tr.definice || '—'}`,
        `${t('export.field.origin')}: ${tr.puvod || '—'}`,
        ''
      ].join('\n');
    });

    download(`strong_${getSourceLangCode()}_${getTargetLangCode()}_G${from}-G${to}.txt`, lines.join('\n'), 'text/plain');
    showToast(t('toast.exported.range', { count: done.length, from: `G${from}`, to: `G${to}` }));
  }

async function exportAllLocalStorage() {
      function deduplicateText(text) {
        if (!text) return text;
        // Odstraní KJV/Původ/Specialista uvnitř definice (ty se načtou jako samostatná pole)
        return text
          .replace(/\s*KJV překlady \(CZ\):[^\n]*(?=Původ:|Specialista:|$)/gi, '')
          .replace(/\s*Původ:[^\n]*(?=Specialista:|KJV překlady|Původ:|Specialista:|$)/gi, '')
          .replace(/\s*Specialista:[^\n]*(?=KJV překlady|Původ:|Specialista:|$)/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
      }
      
      // Exportuje všechna přeložená hesla z aktuálně načteného souboru (state.entries + state.translated)
      const langTag = getUiTag();
      
      // DEBUG: Analýza state.translated vs state.entries
      const translatedKeys = Object.keys(state.translated);
      const entryKeys = state.entries.map(e => e.key);
      const withTranslation = entryKeys.filter(k => {
        const tr = state.translated[k];
        return tr && !tr.skipped && (tr.vyznam || tr.definice || tr.def || tr.kjv || tr.puvod);
      });
      const withoutTranslation = entryKeys.filter(k => {
        const tr = state.translated[k];
        return !tr || tr.skipped || !tr.vyznam && !tr.definice && !tr.def && !tr.kjv && !tr.puvod;
      });
      const orphanKeys = translatedKeys.filter(k => !entryKeys.includes(k));
      
      console.group('exportAllLocalStorage DEBUG');
      console.log(`Entries: ${entryKeys.length} | Translated keys: ${translatedKeys.length}`);
      console.log(`S překladem: ${withTranslation.length} | Bez překladu: ${withoutTranslation.length}`);
      console.log(`Orphan klíče (v translated, ne v entries): ${orphanKeys.length}`);
      
      // Detail: ukázat prvních 3 importované klíče a jejich obsah
      const sampleKeys = translatedKeys.slice(0, 3);
      sampleKeys.forEach(k => {
        const tr = state.translated[k];
        const existsInEntries = entryKeys.includes(k);
        console.log(`  ${k}: existsInEntries=${existsInEntries} vyznam="${tr?.vyznam}" definice="${tr?.definice}" def="${tr?.def}" hasAnyContent=${!!(tr?.vyznam || tr?.definice || tr?.def || tr?.kjv || tr?.puvod)}`);
      });
      
      // Kontrola: existují importované klíče ve entries?
      const firstImportedKey = translatedKeys[0];
      const entryForFirst = state.entries.find(e => e.key === firstImportedKey);
      console.log(`Kontrola prvního importovaného klíče (${firstImportedKey}): entry nalezen=${!!entryForFirst}`);
      if (entryForFirst) {
        console.log(`  entry key="${entryForFirst.key}" greek="${entryForFirst.greek}"`);
      }
      
      if (withoutTranslation.length > 0 && withoutTranslation.length < 10) {
        console.log('VŠECHNY bez překladu:', withoutTranslation.slice(0, 10));
      }
      
      console.groupEnd();
      
      const done = state.entries.filter(e => {
        const tr = state.translated[e.key];
        // Přijmi jako přeložený pokud existuje záznam a není přeskořen
        // (vyznam může být prázdný při importu z TXT)
        return tr && !tr.skipped && (tr.vyznam || tr.definice || tr.def || tr.kjv || tr.puvod);
      });

     if (done.length === 0) {
       showToast(t('toast.noTranslatedEntry'));
       return;
     }

const lines = done.map(e => {
        const tr = state.translated[e.key];
        return [
          `${e.key} | ${e.greek}`,
          `${t('export.field.meaning', { lang: langTag })}: ${tr.vyznam || '—'}`,
          `${t('export.field.definitionEn')}: ${tr.def || '—'}`,
          `${t('export.field.definition', { lang: langTag })}: ${deduplicateText(tr.definice) || '—'}`,
          `${t('export.field.kjv', { lang: langTag })}: ${deduplicateText(tr.kjv) || '—'}`,
          `${t('export.field.origin')}: ${deduplicateText(tr.puvod) || '—'}`,
          `${t('export.field.specialist')}: ${deduplicateText(tr.specialista) || '—'}`,
          ''
        ].join('\n');
      });

     download(`strong_${getSourceLangCode()}_${getTargetLangCode()}_all_translations.txt`, lines.join('\n'), 'text/plain');
     showToast(t('toast.exported.count', { count: done.length }));
   }

  return { download, exportTXT, exportJSON, exportRange, exportAllLocalStorage };
}

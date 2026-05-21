/**
 * Seznam anglických slov, která jsou často špatně přeložena do češtiny,
 * spolu s doporučenými českými ekvivalenty a vysvětlením.
 *
 * Tento seznam slouží jako reference pro překladatele a může být
 * integrován do AI promptů pro zlepšení kvality překladu.
 */

export const BAD_TRANSLATIONS = [
  // ├── Základní hodnotové pojmy (teologické / etické)
  { en: "sin",        cs: "hřích",        note: "Ne 'hriech' (sk) ani 'grzech' (pl)" },
  { en: "grace",      cs: "milost",       note: "Teologický pojem, ne 'grâce' (fr) ani 'Gnad' (de)" },
  { en: "faith",      cs: "víra",         note: "Nepřekládat jako 'dôvera' (sk) či 'fede' (it)" },
  { en: "righteousness", cs: "spravedlnost", note: "Ne 'pravost' (vague), v biblickém kontextu 'spravedlnost'" },
  { en: "salvation",  cs: "spasení",      note: "Ne 'salvation' jako 'zachránění' ve smyslu fyzickém" },

  // ├── Původní slova s negativním nádechem
  { en: "wrong",      cs: "špatný / špatně / křivda", note: "Podle kontextu: adj./adv./noun. Nepoužívat 'zlý' (příliš silné)" },
  { en: "bad",        cs: "špatný",        note: "Méně silné než 'zlý', v češtině obvykle 'špatný' nebo 'nedobrý'" },
  { en: "incorrect",  cs: "nesprávný",     note: "Formální, ne 'špatný' v každodenní mluvě" },
  { en: "false",      cs: "nepravdivý / falešný", note: "false witness = křivé svědectví; false god = falešný bůh" },
  { en: "evil",       cs: "zlý",          note: "Silnější než 'bad', morální zlo, ďábel, zlý čin" },

  // ├── Biblické termíny (KJV / EN → CZ)
  { en: "iniquity",   cs: "nevěra / nepravost / bezpráví", note: "KJV: 'iniquity' = nepravost, zkaženost. NEPřekládat 'nepravda'" },
  { en: "transgression", cs: "přestoupení / vpád", note: "Přestoupení zákona, ne 'transcendence'" },
  { en: "trespass",   cs: " přestupek / provinění", note: "V NT často 'provinění' nebo 'přestupek'" },
  { en: "blasphemy",  cs: "rouhání",       note: "Ne 'blasfémie' (přímo z fr.) ani 'blasfemie'" },
  { en: "fornication", cs: "smilstvo",      note: "Sexuální hřích, ne 'fornication' jako 'prostituce' (to je 'harlotry')" },
  { en: "adultery",   cs: "cizoložství",   note: "Rozlišit od 'fornication' (smilstvo)" },
  { en: "idolatry",   cs: "modlářství",    note: "Ne 'idololatria' (lat.)" },
  { en: "sorcery",    cs: "čarování / kouzelnictví", note: "V NT 'kouzelnictví' (Gal 5:20), ne 'witchcraft' (to je české 'čarodějnictví')" },
  { en: "witchcraft", cs: "čarodějnictví", note: "Rozlišit od 'sorcery' –witchcraft je čarodějnictví, sorcery je kouzelnictví" },
  { en: "repentance", cs: "kajícné smýšlení / obrácení", note: "V NT 'kajícné smýšlení' nebo 'obrácení' (Gr. metanoia). Ne 'lítost'" },
  { en: "remission",  cs: "odpuštění / remission", note: "Remission of sins = odpuštění hříchů, ne 'remise'" },
  { en: "justified",  cs: "ospravedlněn",  note: "Justified by faith = ospravedlněn vírou" },
  { en: "sanctified", cs: "posvěcen",      note: "Ne 'sanctified' jako 'posvěcený' ve významu 'svatý', ale 'posvěcen (Bůh)'" },
  { en: "holy",       cs: "svatý",        note: "Holy Spirit = Duch svatý, ne 'sacred' (to je 'posvěcený' předmět)" },
  { en: "sacred",     cs: "posvěcený",    note: "Sacred thing = posvěcená věc, např. chléb; 'svatý' je 'holy'" },

  // ├── Časově dependence / chování
  { en: "immediately", cs: "ihned / okamžitě", note: "V NT často 'ihned' (Mark 1:20), ne 'okamžitě' (výsledek)" },
  { en: "straightway", cs: "ihned",         note: "KJV slovo, překládat jako 'ihned', ne 'přímo cestou'" },
  { en: "anon",       cs: "ihned",         note: "Archaismus z KJV, překládat 'ihned'" },
  { en: "by and by",  cs: "brzy / časem",  note: "KJV idiomatické, překládat podle kontextu" },
  { en: "anon",       cs: "ihned",         note: "KJV 'anon' = 'ihned', ne 'anonymous'" },

  // ├── Členy, zájmena, spojky
  { en: "the",        cs: "ten/ta/to",    note: "Nepřekládat vždy, ale podle kontextu; v biblickém češtině člen často vynechán" },
  { en: "a/an",       cs: "jeden/jedna/jedno", note: "Nepřidávat člen, pokud čeština nevyžaduje" },
  { en: "and",        cs: "a",            note: "Spjovka 'a', ne 'a jaký'/'a tak'" },
  { en: "but",        cs: "ale",          note: "Spjovka 'ale', ne 'but' (přímo z EN)" },
  { en: "or",         cs: "nebo",         note: "Nepoužívat 'or' v cestovní situaci" },
  { en: "for",        cs: "neboť / protože", note: "KJV 'for' = 'neboť' (důvod), ne 'pro' (příčina)" },

  // ├── Slovesa často chybně překládaná
  { en: "to know",    cs: "vědět / poznat", note: "Know the Lord = poznat Pána; know someone = znát (osobu)" },
  { en: "to heed",    cs: "dát si pozor / dbát", note: "Heed the warning = dbát na varování" },
  { en: "to tarry",   cs: "pozdržet se / zůstat", note: "KJV 'tarry' = 'pozdržet se', ne 'tarry' jako 'náklad'" },
  { en: "to wit",     cs: "totiž / jmenovitě", note: "KJV 'to wit' = 'jmenovitě', 'totiž', ne 'witness'" },
  { en: "to suffer",  cs: "trpět / dopustit", note: "Suffer the little children = dopusťte dítky; suffer evil = trpět zlom" },
  { en: "to let",     cs: "dovolit / nechť", note: "Let there be light = Buď svět! (příkazy), ne 'nechat'" },

  // ├── Přeložené přídavné jména
  { en: "elect",      cs: "vyvolený",     note: "The elect = vyvolení (ne 'voliči')" },
  { en: "chosen",     cs: "vybraný / vyvolený", note: "Nepřekládat vždy stejně, podle kontextu" },
  { en: "quick",      cs: "živý",         note: "Quickened = prožitý, 'živý' (ne 'rychlé')" },
  { en: "carnal",     cs: "telesný / tělesný", note: "Carnal mind = myšlení tělesné, ne 'k父母 (cars/care)'" },
  { en: "spiritual",  cs: "duchovní",    note: "Nepřekládat jako 'spirituální' (zmatek se 'spirits')" },
  { en: "natural",    cs: "přirozený / přírodní", note: "Natural man = přirozený člověk, ne 'normální'" },
  { en: "spoil",      cs: "kořist / zkazit", note: "Spoil the Egyptians = kořist z Egypťanů; spoil a child = zkazit dítě" },

  // ├── Podstatná jména
  { en: "iniquity",   cs: "nepravost",    note: "Iniquity = nepravost, zkaženost (nie in 'quality')" },
  { en: "presumption", cs: "důvěra / troufalost", note: "Presumption of God = důvěra v Boha, ne 'předpoklad'" },
  { en: "presume",    cs: "odvažovat se / předpokládat", note: "I presume = Confidentielně předpokládám, ale 'I presume' = troufám si" },

  // ├── Příslovce & spojky
  { en: "wherefore",  cs: "proč / proto",  note: "Wherefore? = proč? Wherefore = proto (důsledek)" },
  { en: "therefore",  cs: "proto",        note: "Nepoušít 'therefore' jako 'protože' (bez) –protože = because" },
  { en: "verily",     cs: "pravděpodobně / věru", note: "KJV 'verily' = 'pravděpodobně' nebo 'věru' (ámen)" },
  { en: "behold",     cs: "hle / jestliže", note: "Behold! = Hle!; behold I say = hle, pravím. Nemaže 'hold'!" },
  { en: "lo",         cs: "hle",          note: "KJV archaismus: 'lo' = 'hle', ne 'low' (nízký)" },

  // ├── Číslovky / kvantifikátory
  { en: "twofold",    cs: "dvojí / dvakrát", note: "Twofold = dvojí (charakter), ne 'dvojnásobný'" },
  { en: "threefold",  cs: "trojí",        note: "Trojí = třímocný, ne 'trojnásobný'" },

  // ├── Výrazné fráze
  { en: "to be born again", cs: "zrodit se znovu / znovuzrodit", note: "Born again = znovuzrozený, ne 'zrození znovu'" },
  { en: "to arise",   cs: "povstat / vstát", note: "Arise, shine = povstaň, svítí; ne 'vstát' jako 'stand up'" },
  { en: "to flesh",   cs: "ztělesnit /迈向 tělesné", note: "Made flesh = učiněn tělem (Jan 1:14), ne 'maso'" },
  { en: "the flesh",  cs: "tělo / tělesnost", note: "The flesh = tělo (vzhůru k hříchu), ne 'maso' jako jídlo" },
  { en: "to fulfill", cs: "naplnit / splnit", note: "Fulfill the law = naplnit zákon, ne 'vyplnit' (nepřesné)" },
  { en: "to establish", cs: "zřídit / upevnit", note: "Establish the throne = zřídit trůn, ne 'založit' (found)" },

  // ├── Chybné přímé převody z EN
  { en: "to access",  cs: "přistupovat / přístup", note: "Access = přístup, ne 'access' (přímo převzaté)" },
  { en: "to challenge", cs: "vyslovit výzvu / napadnout", note: "Challenge ≠ 'chalenge' (chybné), překládat 'vyslovit výzvu'" },
  { en: "to manifest", cs: "projevit / zjeviti", note: "Manifest = projevit, zjeviti. NEPř. 'manifest' (přímo)" },
  { en: "to project", cs: "promítat / předpokládat", note: "Project = projekt, plán. V relig. kontextu 'promítat'" },
  { en: "to resent",  cs: "trpět / mstít se", note: "Resent = mstít se, trpět (negativní pocity), ne 'resign'" },

  // ├── Ezoterické / New Age
  { en: "energy",     cs: "energie / síla", note: "Nepřekládat 'energy' jako 'energie' v nadpřirozeném smyslu, ale 'síla' nebo 'energie' (pokud fyz.)" },
  { en: "vibration",  cs: "vibrace / chvění", note: "New Age pojem, preferovat 'chvění' nebo 'vzetí'" },
  { en: "chakra",     cs: "čakra",        note: "Převzato z sanskrtu; v biblickém kontextu nepoužívat" },
  { en: "karma",      cs: "karma",        note: "Převzato z hinduismu; nepoužívat v křesťanském kontextu" },
  { en: "nirvana",    cs: "nirvána",      note: "Buddhistický termín, nepřidávat do překladu Bible" }
];

/**
 * Vytvoří a stáhne JSON soubor se seznamem špatných překladů.
 */
export function exportBadTranslationsJSON() {
  const data = {
    version: '1.0',
    generated: new Date().toISOString(),
    count: BAD_TRANSLATIONS.length,
    bad_translations: BAD_TRANSLATIONS
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bad_translations_cs.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Vrátí seznam špatně přeložených slov včetně českých ekvivalentů.
 * Použijte tuto konstantu v AI promptech nebo UI komponentách.
 */
export function getBadTranslations() {
  return BAD_TRANSLATIONS;
}

/**
 * Najde český překlad pro dané anglické slovo (pokud existuje).
 * @param {string} enWord - Anglické slovo
 * @returns {{cs: string, note?: string}|null}
 */
export function findBadTranslation(enWord) {
  const normalized = enWord.toLowerCase().trim();
  const found = BAD_TRANSLATIONS.find(item =>
    item.en.toLowerCase() === normalized
  );
  return found ? { cs: found.cs, note: found.note } : null;
}

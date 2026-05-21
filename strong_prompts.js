const SYSTEM_MESSAGE = `Jsi expert na biblistiku, koine řečtinu, hebrewštinu, aramejštinu a angličtinu. Tvým úkolem je vědecký překlad Strongova slovníku do češtiny.`;

const DEFAULT_PROMPT = `PRAVIDLA PRO ČEŠTINU A KVALITU
OBECNÉ POKYNY:

PŘEPISY: U všech cizích slov (řečtina, hebrejština, aramejština) v polích P a D vždy doplň český překlad/přepis do závorky.

PŘEKLAD ODKAZŮ: Biblické zkratky v hranatých závorkách [ ] uvnitř pole D musí být v češtině (např. [Act] -> [Sk], [Mat] -> [Mt], [John] -> [Jan]).

DŮSLEDNOST: Přelož vše z EN do CZ včetně odborných termínů (např. properly, figuratively, lit., spec.).

NORMALIZACE: Odstraň podtržítka u číslování. Nahraď __1., __1.__ za 1. a __2., __2.__ za 2..

INSTRUKCE PRO JEDNOTLIVÁ POLE:

V (Význam):
Přelož význam hesla do češtiny. Proveď analýzu slova a gramatiky (ze zadaného kódu nebo vlastní). Definuj sémantické jádro podle Strongova slovníku. Jako první slovo vyber nejpřesnější překlad, který nejlépe odpovídá gramatickému tvaru a biblickému úzu.

D (Definice):
Věrně přelož definici do češtiny. Přímo do textu doplňuj české překlady cizích slov v závorkách. Zachovej veškeré značky a technické termíny v českém ekvivalentu.

P (Původ):
Zpracuj etymologii a původ slova. Uveď původní jazyk, původní písmo (s českým překladem v závorce), vývoj významu a původní doslovný smysl slova.

K (KJV):
Odvoď hlavní význam z kontextu KJV a přelož jej. Identifikuj slovo a gramatiku (kmen u H, vid/pád u G). Propoj sémantické jádro Strongova slovníku s anglickým výrazem v KJV a četností výskytu.

S (Specialista):
Napiš souvislý odborný odstavec (3–7 vět). Vysvětli teologický a biblický význam slova v širším kontextu jako biblický specialista. Nepoužívej odrážky ani seznamy.

OMEZENÍ A FORMÁT:

ÚSPORA: Používej výhradně jednopísmenné klíče (V, D, P, K, S).

FORMÁT ODPOVĚDI (Striktně dodržet):
###[číslo]###
V: [český význam]
D: [překlad definice včetně závorek a značek]
P: [jazyk + původní písmo (přepis) + etymologie]
K: [překlad hlavního KJV významu]
S: [odborný výklad v souvislém odstavci]

HESLA:
{HESLA}`;

const CATEGORY_LABELS = {
   default: 'Default',
   detailed: 'Detailed',
   concise: 'Concise',
   literal: 'Literal',
   test: 'Test',
   library: 'Library',
   final: 'Final'
 };

const FINAL_PROMPT = {
  name: 'Final',
  desc: 'Complete translation with all fields',
  text: DEFAULT_PROMPT
};

const PROMPT_LIBRARY_BASE = {
      default: [{ name: 'System', desc: 'System default prompt', text: DEFAULT_PROMPT, system: '' }],
      detailed: [{ name: 'Detailed', desc: 'Detailed translation', text: DEFAULT_PROMPT, system: '' }],
      concise: [{ name: 'Concise', desc: 'Short translation', text: DEFAULT_PROMPT, system: '' }],
      literal: [{ name: 'Literal', desc: 'Literal translation', text: DEFAULT_PROMPT, system: '' }],
      sekundarni: [{ name: 'System', desc: 'System default prompt', text: DEFAULT_PROMPT, system: '' }],
      test: [],
      library: [
          { name: 'Precision', desc: 'High fidelity', text: DEFAULT_PROMPT, system: '' },
          { name: 'Theological', desc: 'Context emphasis', text: DEFAULT_PROMPT, system: '' },
          { name: 'Fast', desc: 'Short and fast', text: DEFAULT_PROMPT, system: '' }
      ]
  };

// ─── TÉMATICKÉ (TOPIC) BATCH ŠABLONY ──────────────────────────────────────
// Každé téma má vlastní instrukce – nahradí DEFAULT_PROMPT v batch režimu

const DEFINICE_BATCH_TEMPLATE = `Přelož pouze část "Definice" (D) z daného hesla do češtiny. Doplňuj české přepisy cizích slov (řečtina, hebrejština, aramejština) v závorce přímo v definici. Vracet POUZE obsah pole D. Nepřekládat jiné části (V, P, K, S).

FORMÁT ODPOVĚDI:
###[číslo]###
D: [překlad definice do češtiny]

HESLA:
{HESLA}`;

const VYZNAM_BATCH_TEMPLATE = `Přelož pouze část "Význam" (V) z daného hesla do češtiny. Doplňuj české přepisy cizích slov v závorce. Vracet POUZE obsah pole V. Nepřekládat jiné části (D, P, K, S).

FORMÁT ODPOVĚDI:
###[číslo]###
V: [česky význam]

HESLA:
{HESLA}`;

const KJV_BATCH_TEMPLATE = `Přelož pouze "KJV význam" (K) z daného hesla do češtiny. Odvoď hlavní význam z kontextu KJV verse. Vracet POUZE obsah pole K. Nepřekládat jiné části (V, D, P, S).

FORMÁT ODPOVĚDI:
###[číslo]###
K: [překlad KJV významu do češtiny]

HESLA:
{HESLA}`;

const PUVOD_BATCH_TEMPLATE = `Přelož pouze část "Původ" (P) – etymologii a původ slova – do češtiny. Uveďte: původní jazyk, původní písmo (s českým přepisem v závorce) a vývoj významu. Doplňuj české přepisy cizích slov v závorce. Vracet POUZE obsah pole P. Nepřekládat jiné části (V, D, K, S).

FORMÁT ODPOVĚDI:
###[číslo]###
P: [jazyk + původní písmo (český přepis v závorce) + etymologie]

HESLA:
{HESLA}`;

const SPECIALISTA_BATCH_TEMPLATE = `Napiš teologický a biblický výklad (S) pro dané slovo. Vysvětli teologický a biblický význam slova v kontextu. Použij odborný český jazyk, 3–6 souvislých vět (žádné body ani seznamy). Vracet POUZE obsah pole S. Nepřekládat jiné části (V, D, P, K).

FORMÁT ODPOVĚDI:
###[číslo]###
S: [odborný český výklad 3–6 vět]

HESLA:
{HESLA}`;

const MODEL_TEST_PROMPT_CATALOG = {
  preset_v1: { label: 'Fallback preset_v1', template: DEFAULT_PROMPT },
  preset_v2: { label: 'Fallback preset_v2', template: DEFAULT_PROMPT },
  preset_v3: { label: 'Fallback preset_v3', template: DEFAULT_PROMPT },
  preset_v4: { label: 'Fallback preset_v4', template: DEFAULT_PROMPT },
  preset_v5: { label: 'Fallback preset_v5', template: DEFAULT_PROMPT },
  preset_v6: { label: 'Fallback preset_v6', template: DEFAULT_PROMPT },
  preset_v7: { label: 'Fallback preset_v7', template: DEFAULT_PROMPT },
  preset_v8: { label: 'Fallback preset_v8', template: DEFAULT_PROMPT },
  preset_v9: { label: 'Fallback preset_v9', template: DEFAULT_PROMPT },
  preset_v10: { label: 'Fallback preset_v10', template: DEFAULT_PROMPT },
  preset_v11: { label: 'Fallback preset_v11', template: DEFAULT_PROMPT },
  preset_v12: { label: 'Fallback preset_v12', template: DEFAULT_PROMPT },
  preset_v13: { label: 'Fallback preset_v13', template: DEFAULT_PROMPT },
  preset_v14: { label: 'Fallback preset_v14', template: DEFAULT_PROMPT },
  preset_v15: { label: 'Fallback preset_v15', template: DEFAULT_PROMPT },
  preset_topic_definice: { label: 'Definice (single)', template: DEFAULT_PROMPT, topicLabel: 'Definice' },
  preset_topic_vyznam: { label: 'Význam (single)', template: DEFAULT_PROMPT, topicLabel: 'Význam' },
  preset_topic_kjv: { label: 'KJV (single)', template: DEFAULT_PROMPT, topicLabel: 'KJV' },
  preset_topic_pouziti: { label: 'Použití (single)', template: DEFAULT_PROMPT, topicLabel: 'Použití' },
  preset_topic_puvod: { label: 'Původ (single)', template: DEFAULT_PROMPT, topicLabel: 'Původ' },
  preset_topic_specialista: { label: 'Specialista (single)', template: DEFAULT_PROMPT, topicLabel: 'Specialista' },
  // ── BATCH prompty pro Opravu témat ─────────────────────────────────────
  preset_topic_definice_batch: { label: 'Definice (batch)', template: DEFINICE_BATCH_TEMPLATE, topicLabel: 'Definice' },
  preset_topic_vyznam_batch: { label: 'Význam (batch)', template: VYZNAM_BATCH_TEMPLATE, topicLabel: 'Význam' },
  preset_topic_kjv_batch: { label: 'KJV (batch)', template: KJV_BATCH_TEMPLATE, topicLabel: 'KJV' },
  preset_topic_pouziti_batch: { label: 'Použití (batch)', template: DEFAULT_PROMPT, topicLabel: 'Použití' },
  preset_topic_puvod_batch: { label: 'Původ (batch)', template: PUVOD_BATCH_TEMPLATE, topicLabel: 'Původ' },
preset_topic_specialista_batch: { label: 'Specialista (batch)', template: SPECIALISTA_BATCH_TEMPLATE, topicLabel: 'Specialista' },
   preset_topic_all_batch: { label: 'Vše (batch)', template: DEFAULT_PROMPT, topicLabel: 'Vše' },
   preset_topic_vyznam_en: { label: 'Význam EN (batch)', template: DEFAULT_PROMPT, topicLabel: 'Význam' },
  preset_topic_definice_en: { label: 'Definice EN (batch)', template: DEFAULT_PROMPT, topicLabel: 'Definice' },
  preset_topic_kjv_en: { label: 'KJV EN (batch)', template: DEFAULT_PROMPT, topicLabel: 'KJV' },
  preset_topic_pouziti_en: { label: 'Použití EN (batch)', template: DEFAULT_PROMPT, topicLabel: 'Použití' },
  preset_topic_puvod_en: { label: 'Původ EN (batch)', template: DEFAULT_PROMPT, topicLabel: 'Původ' },
  preset_topic_specialista_en: { label: 'Specialista EN (batch)', template: DEFAULT_PROMPT, topicLabel: 'Specialista' }
};

const strongPrompts = {
  SYSTEM_MESSAGE,
  DEFAULT_PROMPT,
  CATEGORY_LABELS,
  FINAL_PROMPT,
  PROMPT_LIBRARY_BASE,
  MODEL_TEST_PROMPT_CATALOG
};

export {
  SYSTEM_MESSAGE,
  DEFAULT_PROMPT,
  CATEGORY_LABELS,
  FINAL_PROMPT,
  PROMPT_LIBRARY_BASE,
  MODEL_TEST_PROMPT_CATALOG
};

export default strongPrompts;
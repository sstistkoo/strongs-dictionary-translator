// Biblical book abbreviations: English Strong's → target languages
// Used for converting EN-style refs like [Isa.18:2] to target language like [Iz 18:2]

// EN Strong's abbreviations → canonical book key
const EN_TO_BOOK = {
  // Genesis
  Gen: 'gen', Ge: 'gen',
  // Exodus
  Exo: 'exo', Ex: 'exo', Exod: 'exo',
  // Leviticus
  Lev: 'lev', Le: 'lev',
  // Numbers
  Num: 'num', Nu: 'num', Nm: 'num', Nb: 'num',
  // Deuteronomy
  Deu: 'deu', Dt: 'deu', Deut: 'deu',
  // Joshua
  Jos: 'jos', Josh: 'jos',
  // Judges
  Jdg: 'jdg', Judg: 'jdg',
  // Ruth
  Rut: 'rut', Ruth: 'rut',
  // 1 Samuel
  '1Sa': '1sa', '1Sam': '1sa', '1Sm': '1sa',
  // 2 Samuel
  '2Sa': '2sa', '2Sam': '2sa', '2Sm': '2sa',
  // 1 Kings
  '1Ki': '1ki', '1Kgs': '1ki',
  // 2 Kings
  '2Ki': '2ki', '2Kgs': '2ki',
  // 1 Chronicles
  '1Ch': '1ch', '1Chr': '1ch', '1Chron': '1ch',
  // 2 Chronicles
  '2Ch': '2ch', '2Chr': '2ch', '2Chron': '2ch',
  // Ezra
  Ezr: 'ezr', Ezra: 'ezr',
  // Nehemiah
  Neh: 'neh',
  // Esther
  Est: 'est', Esth: 'est',
  // Job
  Job: 'job',
  // Psalms
  Psa: 'psa', Ps: 'psa', Psalm: 'psa',
  // Proverbs
  Pro: 'pro', Prov: 'pro', Prv: 'pro',
  // Ecclesiastes
  Ecc: 'ecc', Eccl: 'ecc', Qoh: 'ecc',
  // Song of Songs
  Sng: 'sng', Song: 'sng', Cant: 'sng', Sol: 'sng',
  // Isaiah
  Isa: 'isa',
  // Jeremiah
  Jer: 'jer',
  // Lamentations
  Lam: 'lam',
  // Ezekiel
  Eze: 'eze', Ezek: 'eze',
  // Daniel
  Dan: 'dan',
  // Hosea
  Hos: 'hos',
  // Joel
  Joe: 'joe', Joel: 'joe',
  // Amos
  Amo: 'amo',
  // Obadiah
  Oba: 'oba', Obad: 'oba',
  // Jonah
  Jon: 'jon', Jona: 'jon',
  // Micah
  Mic: 'mic',
  // Nahum
  Nah: 'nah',
  // Habakkuk
  Hab: 'hab',
  // Zephaniah
  Zep: 'zep', Zeph: 'zep',
  // Haggai
  Hag: 'hag',
  // Zechariah
  Zec: 'zec', Zech: 'zec',
  // Malachi
  Mal: 'mal',
  // Matthew
  Mat: 'mat', Matt: 'mat', Mt: 'mat',
  // Mark
  Mrk: 'mrk', Mark: 'mrk', Mk: 'mrk', Mar: 'mrk',
  // Luke
  Luk: 'luk', Luke: 'luk', Lk: 'luk',
  // John
  Joh: 'joh', John: 'joh', Jn: 'joh',
  // Acts
  Act: 'act', Acts: 'act',
  // Romans
  Rom: 'rom',
  // 1 Corinthians
  '1Co': '1co', '1Cor': '1co',
  // 2 Corinthians
  '2Co': '2co', '2Cor': '2co',
  // Galatians
  Gal: 'gal',
  // Ephesians
  Eph: 'eph',
  // Philippians
  Phi: 'phi', Phil: 'phi', Php: 'phi',
  // Colossians
  Col: 'col',
  // 1 Thessalonians
  '1Th': '1th', '1Thes': '1th', '1Thess': '1th',
  // 2 Thessalonians
  '2Th': '2th', '2Thes': '2th', '2Thess': '2th',
  // 1 Timothy
  '1Ti': '1ti', '1Tim': '1ti',
  // 2 Timothy
  '2Ti': '2ti', '2Tim': '2ti',
  // Titus
  Tit: 'tit',
  // Philemon
  Phm: 'phm', Phlm: 'phm',
  // Hebrews
  Heb: 'heb',
  // James
  Jas: 'jas', Jam: 'jas',
  // 1 Peter
  '1Pe': '1pe', '1Pet': '1pe', '1Petr': '1pe',
  // 2 Peter
  '2Pe': '2pe', '2Pet': '2pe', '2Petr': '2pe',
  // 1 John
  '1Jo': '1jo', '1Joh': '1jo', '1Jn': '1jo',
  // 2 John
  '2Jo': '2jo', '2Joh': '2jo', '2Jn': '2jo',
  // 3 John
  '3Jo': '3jo', '3Joh': '3jo', '3Jn': '3jo',
  // Jude
  Jde: 'jde', Jud: 'jde',
  // Revelation
  Rev: 'rev', Apoc: 'rev',
  // Deuterocanon (LXX)
  Tob: 'tob',
  Jdt: 'jdt', Jdth: 'jdt',
  '1Mac': '1ma', '1Macc': '1ma',
  '2Mac': '2ma', '2Macc': '2ma',
  Wis: 'wis', Wisd: 'wis',
  Sir: 'sir', Ecclus: 'sir',
  Bar: 'bar',
  PrMan: 'prman',
  Bel: 'bel',
};

// book key → abbreviation per language
// Columns: en, cs, sk, pl, de, fr, es, it, pt, ru, uk, bg, ro, da, fi, hu, nl, no, sv, ar, el, tr, zh-CN, ja, ko, he
const BOOK_ABBR = {
  //        en        cs     sk       pl      de      fr      es      it    pt      ru        uk        bg       ro       da        fi          hu        nl       no        sv      ar       el       tr      zh-CN  ja      ko    he
  gen:  { en:'Gen',  cs:'Gn',  sk:'Gn',   pl:'Rdz',  de:'1Mo',  fr:'Gn',   es:'Gn',   it:'Gen',  pt:'Gn',   ru:'Быт',  uk:'Бут',  bg:'Бит',  ro:'Gen',  da:'1Mo',  fi:'1Moos', hu:'1Móz',  nl:'Gen',  no:'1Mo',  sv:'1Mos', ar:'تك',    el:'Γεν',   tr:'Yar',  'zh-CN':'创',  ja:'創',    ko:'창',   he:'בר' },
  exo:  { en:'Exo',  cs:'Ex',  sk:'Ex',   pl:'Wj',   de:'2Mo',  fr:'Ex',   es:'Éx',   it:'Es',   pt:'Êx',   ru:'Исх',  uk:'Вих',  bg:'Изх',  ro:'Ex',   da:'2Mo',  fi:'2Moos', hu:'2Móz',  nl:'Ex',   no:'2Mo',  sv:'2Mos', ar:'خر',    el:'Εξ',    tr:'Çık',  'zh-CN':'出',  ja:'出',    ko:'출',   he:'שמ' },
  lev:  { en:'Lev',  cs:'Lv',  sk:'Lv',   pl:'Kpł',  de:'3Mo',  fr:'Lv',   es:'Lv',   it:'Lv',   pt:'Lv',   ru:'Лев',  uk:'Лев',  bg:'Лев',  ro:'Lev',  da:'3Mo',  fi:'3Moos', hu:'3Móz',  nl:'Lev',  no:'3Mo',  sv:'3Mos', ar:'لا',    el:'Λευ',   tr:'Lev',  'zh-CN':'利',  ja:'レビ',  ko:'레',   he:'וי' },
  num:  { en:'Num',  cs:'Nu',  sk:'Nm',   pl:'Lb',   de:'4Mo',  fr:'Nb',   es:'Nm',   it:'Nm',   pt:'Nm',   ru:'Чис',  uk:'Чис',  bg:'Чис',  ro:'Num',  da:'4Mo',  fi:'4Moos', hu:'4Móz',  nl:'Num',  no:'4Mo',  sv:'4Mos', ar:'عد',    el:'Αρ',    tr:'Say',  'zh-CN':'民',  ja:'民',    ko:'민',   he:'במ' },
  deu:  { en:'Deu',  cs:'Dt',  sk:'Dt',   pl:'Pwt',  de:'5Mo',  fr:'Dt',   es:'Dt',   it:'Dt',   pt:'Dt',   ru:'Втор', uk:'Втор', bg:'Вт',   ro:'Dt',   da:'5Mo',  fi:'5Moos', hu:'5Móz',  nl:'Deut', no:'5Mo',  sv:'5Mos', ar:'تث',    el:'Δευτ',  tr:'Tes',  'zh-CN':'申',  ja:'申',    ko:'신',   he:'דב' },
  jos:  { en:'Jos',  cs:'Joz', sk:'Joz',  pl:'Joz',  de:'Jos',  fr:'Jos',  es:'Jos',  it:'Gs',   pt:'Js',   ru:'Нав',  uk:'Єс',   bg:'Нав',  ro:'Ios',  da:'Jos',  fi:'Joos',  hu:'Józs',  nl:'Joz',  no:'Jos',  sv:'Jos',  ar:'يش',    el:'Ιησ',   tr:'Yşu',  'zh-CN':'书',  ja:'ヨシュ', ko:'수',  he:'יה' },
  jdg:  { en:'Jdg',  cs:'Sd',  sk:'Sud',  pl:'Sdz',  de:'Ri',   fr:'Jg',   es:'Jue',  it:'Gdc',  pt:'Jz',   ru:'Суд',  uk:'Суд',  bg:'Съд',  ro:'Jud',  da:'Dom',  fi:'Tuom',  hu:'Bír',   nl:'Richt',no:'Dom',  sv:'Dom',  ar:'قض',    el:'Κρι',   tr:'Hak',  'zh-CN':'士',  ja:'士',    ko:'삿',   he:'שפ' },
  rut:  { en:'Rut',  cs:'Rt',  sk:'Rút',  pl:'Rt',   de:'Rut',  fr:'Rt',   es:'Rt',   it:'Rt',   pt:'Rt',   ru:'Руф',  uk:'Рут',  bg:'Рут',  ro:'Rut',  da:'Ruth', fi:'Ruut',  hu:'Ruth',  nl:'Ruth', no:'Rut',  sv:'Rut',  ar:'را',    el:'Ρουθ',  tr:'Rut',  'zh-CN':'得',  ja:'ルツ',  ko:'룻',   he:'רות' },
  '1sa':{ en:'1Sa',  cs:'1S',  sk:'1Sam', pl:'1Sm',  de:'1Sam', fr:'1S',   es:'1S',   it:'1Sam', pt:'1Sm',  ru:'1Цар', uk:'1Сам', bg:'1Цар', ro:'1Sam', da:'1Sam', fi:'1Sam',  hu:'1Sám',  nl:'1Sam', no:'1Sam', sv:'1Sam', ar:'1صم',   el:'Αʹ Βασ', tr:'1Sa', 'zh-CN':'撒上', ja:'サム上', ko:'삼상', he:'שמא' },
  '2sa':{ en:'2Sa',  cs:'2S',  sk:'2Sam', pl:'2Sm',  de:'2Sam', fr:'2S',   es:'2S',   it:'2Sam', pt:'2Sm',  ru:'2Цар', uk:'2Сам', bg:'2Цар', ro:'2Sam', da:'2Sam', fi:'2Sam',  hu:'2Sám',  nl:'2Sam', no:'2Sam', sv:'2Sam', ar:'2صم',   el:'Βʹ Βασ', tr:'2Sa', 'zh-CN':'撒下', ja:'サム下', ko:'삼하', he:'שמב' },
  '1ki':{ en:'1Ki',  cs:'1Kr', sk:'1Kr',  pl:'1Krl', de:'1Kön', fr:'1R',   es:'1Re',  it:'1Re',  pt:'1Rs',  ru:'3Цар', uk:'1Цар', bg:'3Цар', ro:'1Împ', da:'1Kong',fi:'1Kun',  hu:'1Kir',  nl:'1Kon', no:'1Kong',sv:'1Kung',ar:'1مل',   el:'Γʹ Βασ', tr:'1Kr', 'zh-CN':'王上', ja:'列上',  ko:'왕상', he:'מלא' },
  '2ki':{ en:'2Ki',  cs:'2Kr', sk:'2Kr',  pl:'2Krl', de:'2Kön', fr:'2R',   es:'2Re',  it:'2Re',  pt:'2Rs',  ru:'4Цар', uk:'2Цар', bg:'4Цар', ro:'2Împ', da:'2Kong',fi:'2Kun',  hu:'2Kir',  nl:'2Kon', no:'2Kong',sv:'2Kung',ar:'2مل',   el:'Δʹ Βασ', tr:'2Kr', 'zh-CN':'王下', ja:'列下',  ko:'왕하', he:'מלב' },
  '1ch':{ en:'1Ch',  cs:'1Pa', sk:'1Krn', pl:'1Krn', de:'1Chr', fr:'1Ch',  es:'1Cr',  it:'1Cr',  pt:'1Cr',  ru:'1Пар', uk:'1Хр',  bg:'1Лет', ro:'1Cron',da:'1Krøn',fi:'1Aik',  hu:'1Krón', nl:'1Kron',no:'1Krøn',sv:'1Krön',ar:'1أي',   el:'Αʹ Παρ', tr:'1Tar','zh-CN':'代上', ja:'歴上',  ko:'대상', he:'דהא' },
  '2ch':{ en:'2Ch',  cs:'2Pa', sk:'2Krn', pl:'2Krn', de:'2Chr', fr:'2Ch',  es:'2Cr',  it:'2Cr',  pt:'2Cr',  ru:'2Пар', uk:'2Хр',  bg:'2Лет', ro:'2Cron',da:'2Krøn',fi:'2Aik',  hu:'2Krón', nl:'2Kron',no:'2Krøn',sv:'2Krön',ar:'2أي',   el:'Βʹ Παρ', tr:'2Tar','zh-CN':'代下', ja:'歴下',  ko:'대하', he:'דהב' },
  ezr:  { en:'Ezr',  cs:'Ezd', sk:'Ezd',  pl:'Ezd',  de:'Esra', fr:'Esd',  es:'Esd',  it:'Esd',  pt:'Ed',   ru:'Езд',  uk:'Езд',  bg:'Езд',  ro:'Ezra', da:'Ezra', fi:'Esra',  hu:'Ezsdr', nl:'Ezra', no:'Esra', sv:'Esra', ar:'عز',    el:'Εσδ',   tr:'Ezr',  'zh-CN':'拉',  ja:'エズ',  ko:'스',   he:'עז' },
  neh:  { en:'Neh',  cs:'Neh', sk:'Neh',  pl:'Ne',   de:'Neh',  fr:'Ne',   es:'Ne',   it:'Ne',   pt:'Ne',   ru:'Неем', uk:'Нех',  bg:'Неем', ro:'Neh',  da:'Neh',  fi:'Neh',   hu:'Neh',   nl:'Neh',  no:'Neh',  sv:'Neh',  ar:'نح',    el:'Νεεμ',  tr:'Neh',  'zh-CN':'尼',  ja:'ネへ',  ko:'느',   he:'נח' },
  est:  { en:'Est',  cs:'Est', sk:'Est',  pl:'Est',  de:'Est',  fr:'Est',  es:'Est',  it:'Est',  pt:'Et',   ru:'Есф',  uk:'Ест',  bg:'Ест',  ro:'Est',  da:'Est',  fi:'Est',   hu:'Eszt',  nl:'Est',  no:'Est',  sv:'Est',  ar:'أس',    el:'Εσθ',   tr:'Est',  'zh-CN':'斯',  ja:'エス',  ko:'에',   he:'אס' },
  job:  { en:'Job',  cs:'Jb',  sk:'Jób',  pl:'Hi',   de:'Hiob', fr:'Jb',   es:'Jb',   it:'Gb',   pt:'Jó',   ru:'Иов',  uk:'Іов',  bg:'Йов',  ro:'Iov',  da:'Job',  fi:'Job',   hu:'Jób',   nl:'Job',  no:'Job',  sv:'Job',  ar:'أي',    el:'Ιωβ',   tr:'Eyü',  'zh-CN':'伯',  ja:'ヨブ',  ko:'욥',   he:'איוב' },
  psa:  { en:'Psa',  cs:'Ž',   sk:'Ž',    pl:'Ps',   de:'Ps',   fr:'Ps',   es:'Sal',  it:'Sal',  pt:'Sl',   ru:'Пс',   uk:'Пс',   bg:'Пс',   ro:'Ps',   da:'Sl',   fi:'Ps',    hu:'Zsolt', nl:'Ps',   no:'Sl',   sv:'Ps',   ar:'مز',    el:'Ψαλμ',  tr:'Mzm',  'zh-CN':'诗',  ja:'詩',    ko:'시',   he:'תה' },
  pro:  { en:'Pro',  cs:'Př',  sk:'Prís', pl:'Prz',  de:'Spr',  fr:'Pr',   es:'Pr',   it:'Pr',   pt:'Pv',   ru:'Прит', uk:'Прип', bg:'Прит', ro:'Prov', da:'Ordsp',fi:'Sananl',hu:'Péld',  nl:'Spr',  no:'Ordsp',sv:'Ords',  ar:'أم',    el:'Παρ',   tr:'Süz',  'zh-CN':'箴',  ja:'箴',    ko:'잠',   he:'מש' },
  ecc:  { en:'Ecc',  cs:'Kaz', sk:'Kaz',  pl:'Koh',  de:'Pred', fr:'Qo',   es:'Qo',   it:'Qo',   pt:'Ec',   ru:'Еккл', uk:'Еккл', bg:'Еклис',ro:'Ecl',  da:'Præd', fi:'Saarn', hu:'Préd',  nl:'Pred', no:'Fork',  sv:'Pred',  ar:'جا',    el:'Εκκλ',  tr:'Vaa',  'zh-CN':'传',  ja:'伝',    ko:'전',   he:'קה' },
  sng:  { en:'Sng',  cs:'Pís', sk:'Pies', pl:'Pnp',  de:'Hld',  fr:'Ct',   es:'Ct',   it:'Ct',   pt:'Ct',   ru:'Песн', uk:'Пісн', bg:'Пес',  ro:'Cânt', da:'Højs', fi:'Laul',  hu:'Énekek',nl:'Hoogl',no:'Høys', sv:'Högs',  ar:'نش',    el:'Ασμ',   tr:'Ezg',  'zh-CN':'歌',  ja:'雅',    ko:'아',   he:'שהש' },
  isa:  { en:'Isa',  cs:'Iz',  sk:'Iz',   pl:'Iz',   de:'Jes',  fr:'Is',   es:'Is',   it:'Is',   pt:'Is',   ru:'Ис',   uk:'Іс',   bg:'Ис',   ro:'Isa',  da:'Es',   fi:'Jes',   hu:'Ésa',   nl:'Jes',  no:'Jes',  sv:'Jes',   ar:'إش',    el:'Ησ',    tr:'Yşa',  'zh-CN':'赛',  ja:'イザ',  ko:'사',   he:'יש' },
  jer:  { en:'Jer',  cs:'Jr',  sk:'Jer',  pl:'Jr',   de:'Jer',  fr:'Jr',   es:'Jr',   it:'Ger',  pt:'Jr',   ru:'Иер',  uk:'Єр',   bg:'Иер',  ro:'Ier',  da:'Jer',  fi:'Jer',   hu:'Jer',   nl:'Jer',  no:'Jer',  sv:'Jer',   ar:'إر',    el:'Ιερ',   tr:'Yer',  'zh-CN':'耶',  ja:'エレ',  ko:'렘',   he:'יר' },
  lam:  { en:'Lam',  cs:'Pl',  sk:'Nár',  pl:'Lm',   de:'Klgl', fr:'Lm',   es:'Lm',   it:'Lam',  pt:'Lm',   ru:'Плач', uk:'Плач', bg:'Плач', ro:'Plâng',da:'Klg',  fi:'Valitusv',hu:'Siralm',nl:'Klaagl',no:'Klage',sv:'Klag',ar:'مر',   el:'Θρην',  tr:'Mer',  'zh-CN':'哀',  ja:'哀',    ko:'애',   he:'אי' },
  eze:  { en:'Eze',  cs:'Ez',  sk:'Ez',   pl:'Ez',   de:'Hes',  fr:'Ez',   es:'Ez',   it:'Ez',   pt:'Ez',   ru:'Иез',  uk:'Єз',   bg:'Иез',  ro:'Eze',  da:'Ez',   fi:'Hes',   hu:'Ez',    nl:'Ez',   no:'Esek', sv:'Hes',   ar:'حز',    el:'Ιεζ',   tr:'Hez',  'zh-CN':'结',  ja:'エゼ',  ko:'겔',   he:'יח' },
  dan:  { en:'Dan',  cs:'Da',  sk:'Dan',  pl:'Dn',   de:'Dan',  fr:'Dn',   es:'Dn',   it:'Dn',   pt:'Dn',   ru:'Дан',  uk:'Дан',  bg:'Дан',  ro:'Dan',  da:'Dan',  fi:'Dan',   hu:'Dán',   nl:'Dan',  no:'Dan',  sv:'Dan',   ar:'دا',    el:'Δαν',   tr:'Dan',  'zh-CN':'但',  ja:'ダニ',  ko:'단',   he:'דנ' },
  hos:  { en:'Hos',  cs:'Oz',  sk:'Oz',   pl:'Oz',   de:'Hos',  fr:'Os',   es:'Os',   it:'Os',   pt:'Os',   ru:'Ос',   uk:'Ос',   bg:'Ос',   ro:'Osea', da:'Hos',  fi:'Hoos',  hu:'Hós',   nl:'Hos',  no:'Hos',  sv:'Hos',   ar:'هو',    el:'Ωσ',    tr:'Hoş',  'zh-CN':'何',  ja:'ホセ',  ko:'호',   he:'הו' },
  joe:  { en:'Joe',  cs:'Jl',  sk:'Joel', pl:'Jl',   de:'Joel', fr:'Jl',   es:'Jl',   it:'Gl',   pt:'Jl',   ru:'Иоил', uk:'Йоіл', bg:'Йоел', ro:'Ioel', da:'Joel', fi:'Joel',  hu:'Jóel',  nl:'Joël', no:'Joel', sv:'Joel',  ar:'يؤ',    el:'Ιωηλ',  tr:'Yoe',  'zh-CN':'珥',  ja:'ヨエ',  ko:'욜',   he:'יואל' },
  amo:  { en:'Amo',  cs:'Am',  sk:'Am',   pl:'Am',   de:'Am',   fr:'Am',   es:'Am',   it:'Am',   pt:'Am',   ru:'Ам',   uk:'Ам',   bg:'Ам',   ro:'Amos', da:'Am',   fi:'Am',    hu:'Ám',    nl:'Am',   no:'Am',   sv:'Am',    ar:'عا',    el:'Αμ',    tr:'Amo',  'zh-CN':'摩',  ja:'アモ',  ko:'암',   he:'עמ' },
  oba:  { en:'Oba',  cs:'Abd', sk:'Abd',  pl:'Ab',   de:'Ob',   fr:'Ab',   es:'Abd',  it:'Abd',  pt:'Ob',   ru:'Авд',  uk:'Авд',  bg:'Авд',  ro:'Obad', da:'Obad', fi:'Obad',  hu:'Abd',   nl:'Obad', no:'Obad', sv:'Obad',  ar:'عو',    el:'Αβδ',   tr:'Abd',  'zh-CN':'俄',  ja:'オバ',  ko:'옵',   he:'עוב' },
  jon:  { en:'Jon',  cs:'Jon', sk:'Jon',  pl:'Jon',  de:'Jona', fr:'Jon',  es:'Jon',  it:'Gio',  pt:'Jn',   ru:'Ион',  uk:'Йон',  bg:'Йона', ro:'Iona', da:'Jon',  fi:'Joon',  hu:'Jón',   nl:'Jon',  no:'Jon',  sv:'Jon',   ar:'يو',    el:'Ιων',   tr:'Yun',  'zh-CN':'拿',  ja:'ヨナ',  ko:'욘',   he:'יונ' },
  mic:  { en:'Mic',  cs:'Mi',  sk:'Mich', pl:'Mi',   de:'Mi',   fr:'Mi',   es:'Miq',  it:'Mi',   pt:'Mq',   ru:'Мих',  uk:'Мих',  bg:'Мих',  ro:'Mica', da:'Mika', fi:'Miika', hu:'Mik',   nl:'Mich', no:'Mika', sv:'Mik',   ar:'مي',    el:'Μιχ',   tr:'Mik',  'zh-CN':'弥',  ja:'ミカ',  ko:'미',   he:'מי' },
  nah:  { en:'Nah',  cs:'Na',  sk:'Nah',  pl:'Na',   de:'Nah',  fr:'Na',   es:'Na',   it:'Na',   pt:'Na',   ru:'Наум', uk:'Наум', bg:'Наум', ro:'Naum', da:'Nah',  fi:'Naah',  hu:'Náh',   nl:'Nah',  no:'Nah',  sv:'Nah',   ar:'نا',    el:'Ναουμ', tr:'Nah',  'zh-CN':'鸿',  ja:'ナホ',  ko:'나',   he:'נחו' },
  hab:  { en:'Hab',  cs:'Hab', sk:'Hab',  pl:'Ha',   de:'Hab',  fr:'Ha',   es:'Ha',   it:'Ab',   pt:'Hc',   ru:'Авв',  uk:'Авв',  bg:'Авв',  ro:'Hab',  da:'Hab',  fi:'Hab',   hu:'Hab',   nl:'Hab',  no:'Hab',  sv:'Hab',   ar:'حب',    el:'Αμβ',   tr:'Hab',  'zh-CN':'哈',  ja:'ハバ',  ko:'합',   he:'חב' },
  zep:  { en:'Zep',  cs:'Sf',  sk:'Sof',  pl:'So',   de:'Zef',  fr:'So',   es:'Sof',  it:'Sof',  pt:'Sf',   ru:'Соф',  uk:'Соф',  bg:'Соф',  ro:'Ţef',  da:'Sef',  fi:'Sef',   hu:'Sof',   nl:'Sef',  no:'Sef',  sv:'Sef',   ar:'صف',    el:'Σοφ',   tr:'Sef',  'zh-CN':'番',  ja:'ゼパ',  ko:'습',   he:'צפ' },
  hag:  { en:'Hag',  cs:'Ag',  sk:'Ag',   pl:'Ag',   de:'Hag',  fr:'Ag',   es:'Ag',   it:'Ag',   pt:'Ag',   ru:'Агг',  uk:'Аг',   bg:'Аг',   ro:'Hag',  da:'Hag',  fi:'Hagg',  hu:'Hag',   nl:'Hag',  no:'Hag',  sv:'Hag',   ar:'حج',    el:'Αγγ',   tr:'Hag',  'zh-CN':'该',  ja:'ハガ',  ko:'학',   he:'חג' },
  zec:  { en:'Zec',  cs:'Za',  sk:'Zach', pl:'Za',   de:'Sach', fr:'Za',   es:'Za',   it:'Za',   pt:'Zc',   ru:'Зах',  uk:'Зах',  bg:'Зах',  ro:'Zah',  da:'Zak',  fi:'Sak',   hu:'Zak',   nl:'Zach', no:'Sak',  sv:'Sak',   ar:'زك',    el:'Ζαχ',   tr:'Zek',  'zh-CN':'亚',  ja:'ゼカ',  ko:'슥',   he:'זכ' },
  mal:  { en:'Mal',  cs:'Mal', sk:'Mal',  pl:'Ml',   de:'Mal',  fr:'Ml',   es:'Ml',   it:'Ml',   pt:'Ml',   ru:'Мал',  uk:'Мал',  bg:'Мал',  ro:'Mal',  da:'Mal',  fi:'Mal',   hu:'Mal',   nl:'Mal',  no:'Mal',  sv:'Mal',   ar:'ملا',   el:'Μαλ',   tr:'Mal',  'zh-CN':'玛',  ja:'マラ',  ko:'말',   he:'מל' },
  // NT
  mat:  { en:'Mat',  cs:'Mt',  sk:'Mt',   pl:'Mt',   de:'Mt',   fr:'Mt',   es:'Mt',   it:'Mt',   pt:'Mt',   ru:'Мф',   uk:'Мт',   bg:'Мт',   ro:'Mat',  da:'Matt', fi:'Matt',  hu:'Mt',    nl:'Matt', no:'Matt', sv:'Matt',  ar:'مت',    el:'Ματθ',  tr:'Mat',  'zh-CN':'太',  ja:'マタ',  ko:'마',   he:'מת' },
  mrk:  { en:'Mrk',  cs:'Mk',  sk:'Mk',   pl:'Mk',   de:'Mk',   fr:'Mc',   es:'Mc',   it:'Mc',   pt:'Mc',   ru:'Мк',   uk:'Мк',   bg:'Мк',   ro:'Mar',  da:'Mark', fi:'Mark',  hu:'Mk',    nl:'Mark', no:'Mark', sv:'Mark',  ar:'مر',    el:'Μαρκ',  tr:'Mar',  'zh-CN':'可',  ja:'マコ',  ko:'막',   he:'מר' },
  luk:  { en:'Luk',  cs:'Lk',  sk:'Lk',   pl:'Łk',   de:'Lk',   fr:'Lc',   es:'Lc',   it:'Lc',   pt:'Lc',   ru:'Лк',   uk:'Лк',   bg:'Лк',   ro:'Luc',  da:'Luk',  fi:'Luuk',  hu:'Lk',    nl:'Luk',  no:'Luk',  sv:'Luk',   ar:'لو',    el:'Λουκ',  tr:'Luk',  'zh-CN':'路',  ja:'ルカ',  ko:'눅',   he:'לוק' },
  joh:  { en:'Joh',  cs:'J',   sk:'Jn',   pl:'J',    de:'Joh',  fr:'Jn',   es:'Jn',   it:'Gv',   pt:'Jo',   ru:'Ин',   uk:'Ін',   bg:'Йн',   ro:'Ioan', da:'Joh',  fi:'Joh',   hu:'Jn',    nl:'Joh',  no:'Joh',  sv:'Joh',   ar:'يو',    el:'Ιωαν',  tr:'Yuh',  'zh-CN':'约',  ja:'ヨハ',  ko:'요',   he:'יוח' },
  act:  { en:'Act',  cs:'Sk',  sk:'Sk',   pl:'Dz',   de:'Apg',  fr:'Ac',   es:'Hch',  it:'At',   pt:'At',   ru:'Деян', uk:'Дії',  bg:'Деян', ro:'Fap',  da:'ApG',  fi:'Apt',   hu:'Csel',  nl:'Hand', no:'Apg',  sv:'Apg',   ar:'أع',    el:'Πρξ',   tr:'El',   'zh-CN':'徒',  ja:'使',    ko:'행',   he:'מע' },
  rom:  { en:'Rom',  cs:'Ř',   sk:'Rim',  pl:'Rz',   de:'Röm',  fr:'Rm',   es:'Rm',   it:'Rm',   pt:'Rm',   ru:'Рим',  uk:'Рим',  bg:'Рим',  ro:'Rom',  da:'Rom',  fi:'Room',  hu:'Róm',   nl:'Rom',  no:'Rom',  sv:'Rom',   ar:'رو',    el:'Ρωμ',   tr:'Rom',  'zh-CN':'罗',  ja:'ロマ',  ko:'롬',   he:'רו' },
  '1co':{ en:'1Co',  cs:'1K',  sk:'1Kor', pl:'1Kor', de:'1Kor', fr:'1Co',  es:'1Co',  it:'1Cor', pt:'1Co',  ru:'1Кор', uk:'1Кор', bg:'1Кор', ro:'1Cor', da:'1Kor', fi:'1Kor',  hu:'1Kor',  nl:'1Kor', no:'1Kor', sv:'1Kor',  ar:'1كو',   el:'Αʹ Κορ', tr:'1Ko', 'zh-CN':'林前', ja:'コリ一', ko:'고전', he:'קורא' },
  '2co':{ en:'2Co',  cs:'2K',  sk:'2Kor', pl:'2Kor', de:'2Kor', fr:'2Co',  es:'2Co',  it:'2Cor', pt:'2Co',  ru:'2Кор', uk:'2Кор', bg:'2Кор', ro:'2Cor', da:'2Kor', fi:'2Kor',  hu:'2Kor',  nl:'2Kor', no:'2Kor', sv:'2Kor',  ar:'2كو',   el:'Βʹ Κορ', tr:'2Ko', 'zh-CN':'林后', ja:'コリ二', ko:'고후', he:'קורב' },
  gal:  { en:'Gal',  cs:'Ga',  sk:'Gal',  pl:'Ga',   de:'Gal',  fr:'Ga',   es:'Ga',   it:'Gal',  pt:'Gl',   ru:'Гал',  uk:'Гал',  bg:'Гал',  ro:'Gal',  da:'Gal',  fi:'Gal',   hu:'Gal',   nl:'Gal',  no:'Gal',  sv:'Gal',   ar:'غل',    el:'Γαλ',   tr:'Gal',  'zh-CN':'加',  ja:'ガラ',  ko:'갈',   he:'גל' },
  eph:  { en:'Eph',  cs:'Ef',  sk:'Ef',   pl:'Ef',   de:'Eph',  fr:'Ep',   es:'Ef',   it:'Ef',   pt:'Ef',   ru:'Еф',   uk:'Еф',   bg:'Еф',   ro:'Ef',   da:'Ef',   fi:'Ef',    hu:'Ef',    nl:'Ef',   no:'Ef',   sv:'Ef',    ar:'أف',    el:'Εφ',    tr:'Ef',   'zh-CN':'弗',  ja:'エペ',  ko:'엡',   he:'אפ' },
  phi:  { en:'Phi',  cs:'Fp',  sk:'Fil',  pl:'Flp',  de:'Phil', fr:'Ph',   es:'Flp',  it:'Fil',  pt:'Fp',   ru:'Флп',  uk:'Флп',  bg:'Фил',  ro:'Filip',da:'Fil',  fi:'Fil',   hu:'Fil',   nl:'Fil',  no:'Fil',  sv:'Fil',   ar:'في',    el:'Φιλ',   tr:'Fil',  'zh-CN':'腓',  ja:'ピリ',  ko:'빌',   he:'פיל' },
  col:  { en:'Col',  cs:'Ko',  sk:'Kol',  pl:'Kol',  de:'Kol',  fr:'Col',  es:'Col',  it:'Col',  pt:'Cl',   ru:'Кол',  uk:'Кол',  bg:'Кол',  ro:'Col',  da:'Kol',  fi:'Kol',   hu:'Kol',   nl:'Kol',  no:'Kol',  sv:'Kol',   ar:'كو',    el:'Κολ',   tr:'Kol',  'zh-CN':'西',  ja:'コロ',  ko:'골',   he:'קו' },
  '1th':{ en:'1Th',  cs:'1Te', sk:'1Sol', pl:'1Tes', de:'1Thess',fr:'1Th', es:'1Ts',  it:'1Ts',  pt:'1Ts',  ru:'1Фес', uk:'1Сол', bg:'1Сол', ro:'1Tes', da:'1Tess',fi:'1Tess', hu:'1Thessz',nl:'1Tess',no:'1Tess',sv:'1Thess',ar:'1تس',  el:'Αʹ Θεσ', tr:'1Se', 'zh-CN':'帖前', ja:'テサ一', ko:'살전', he:'תסא' },
  '2th':{ en:'2Th',  cs:'2Te', sk:'2Sol', pl:'2Tes', de:'2Thess',fr:'2Th', es:'2Ts',  it:'2Ts',  pt:'2Ts',  ru:'2Фес', uk:'2Сол', bg:'2Сол', ro:'2Tes', da:'2Tess',fi:'2Tess', hu:'2Thessz',nl:'2Tess',no:'2Tess',sv:'2Thess',ar:'2تس',  el:'Βʹ Θεσ', tr:'2Se', 'zh-CN':'帖后', ja:'テサ二', ko:'살후', he:'תסב' },
  '1ti':{ en:'1Ti',  cs:'1Tm', sk:'1Tim', pl:'1Tm',  de:'1Tim', fr:'1Tm',  es:'1Tim', it:'1Tm',  pt:'1Tm',  ru:'1Тим', uk:'1Тим', bg:'1Тим', ro:'1Tim', da:'1Tim', fi:'1Tim',  hu:'1Tim',  nl:'1Tim', no:'1Tim', sv:'1Tim',  ar:'1تي',   el:'Αʹ Τιμ', tr:'1Ti', 'zh-CN':'提前', ja:'テモ一', ko:'딤전', he:'טימא' },
  '2ti':{ en:'2Ti',  cs:'2Tm', sk:'2Tim', pl:'2Tm',  de:'2Tim', fr:'2Tm',  es:'2Tim', it:'2Tm',  pt:'2Tm',  ru:'2Тим', uk:'2Тим', bg:'2Тим', ro:'2Tim', da:'2Tim', fi:'2Tim',  hu:'2Tim',  nl:'2Tim', no:'2Tim', sv:'2Tim',  ar:'2تي',   el:'Βʹ Τιμ', tr:'2Ti', 'zh-CN':'提后', ja:'テモ二', ko:'딤후', he:'טימב' },
  tit:  { en:'Tit',  cs:'Tt',  sk:'Tít',  pl:'Tt',   de:'Tit',  fr:'Tt',   es:'Tit',  it:'Tt',   pt:'Tt',   ru:'Тит',  uk:'Тит',  bg:'Тит',  ro:'Tit',  da:'Tit',  fi:'Tit',   hu:'Tit',   nl:'Tit',  no:'Tit',  sv:'Tit',   ar:'تي',    el:'Τιτ',   tr:'Tit',  'zh-CN':'多',  ja:'テト',  ko:'딛',   he:'טיט' },
  phm:  { en:'Phm',  cs:'Fm',  sk:'Flm',  pl:'Flm',  de:'Phlm', fr:'Phm',  es:'Flm',  it:'Flm',  pt:'Fm',   ru:'Флм',  uk:'Флм',  bg:'Флм',  ro:'Filimon',da:'Filem',fi:'Filem',hu:'Filem', nl:'Filem',no:'Filem',sv:'Filem', ar:'في',    el:'Φλμ',   tr:'Flm',  'zh-CN':'门',  ja:'ピレ',  ko:'몬',   he:'פיל' },
  heb:  { en:'Heb',  cs:'Žd',  sk:'Hebr', pl:'Hbr',  de:'Hebr', fr:'He',   es:'Heb',  it:'Eb',   pt:'Hb',   ru:'Евр',  uk:'Євр',  bg:'Евр',  ro:'Evr',  da:'Hebr', fi:'Hebr',  hu:'Zsid',  nl:'Hebr', no:'Hebr', sv:'Hebr',  ar:'عب',    el:'Εβρ',   tr:'İbr',  'zh-CN':'来',  ja:'ヘブ',  ko:'히',   he:'עב' },
  jas:  { en:'Jas',  cs:'Jk',  sk:'Jak',  pl:'Jk',   de:'Jak',  fr:'Jc',   es:'Sant', it:'Gc',   pt:'Tg',   ru:'Иак',  uk:'Як',   bg:'Як',   ro:'Iac',  da:'Jak',  fi:'Jaak',  hu:'Jak',   nl:'Jak',  no:'Jak',  sv:'Jak',   ar:'يع',    el:'Ιακ',   tr:'Yak',  'zh-CN':'雅',  ja:'ヤコ',  ko:'약',   he:'יע' },
  '1pe':{ en:'1Pe',  cs:'1Pt', sk:'1Pt',  pl:'1P',   de:'1Petr',fr:'1P',   es:'1Pe',  it:'1Pt',  pt:'1Pe',  ru:'1Пет', uk:'1Пет', bg:'1Пет', ro:'1Pet', da:'1Pet', fi:'1Piet', hu:'1Pét',  nl:'1Pet', no:'1Pet', sv:'1Pet',  ar:'1بط',   el:'Αʹ Πετ', tr:'1Pe', 'zh-CN':'彼前', ja:'ペテ一', ko:'벧전', he:'פטא' },
  '2pe':{ en:'2Pe',  cs:'2Pt', sk:'2Pt',  pl:'2P',   de:'2Petr',fr:'2P',   es:'2Pe',  it:'2Pt',  pt:'2Pe',  ru:'2Пет', uk:'2Пет', bg:'2Пет', ro:'2Pet', da:'2Pet', fi:'2Piet', hu:'2Pét',  nl:'2Pet', no:'2Pet', sv:'2Pet',  ar:'2بط',   el:'Βʹ Πετ', tr:'2Pe', 'zh-CN':'彼后', ja:'ペテ二', ko:'벧후', he:'פטב' },
  '1jo':{ en:'1Jo',  cs:'1J',  sk:'1Jn',  pl:'1J',   de:'1Joh', fr:'1Jn',  es:'1Jn',  it:'1Gv',  pt:'1Jo',  ru:'1Ин',  uk:'1Ін',  bg:'1Йн',  ro:'1Ioan',da:'1Joh', fi:'1Joh',  hu:'1Jn',   nl:'1Joh', no:'1Joh', sv:'1Joh',  ar:'1يو',   el:'Αʹ Ιω', tr:'1Yu',  'zh-CN':'约壹', ja:'ヨハ一', ko:'요일', he:'יוחא' },
  '2jo':{ en:'2Jo',  cs:'2J',  sk:'2Jn',  pl:'2J',   de:'2Joh', fr:'2Jn',  es:'2Jn',  it:'2Gv',  pt:'2Jo',  ru:'2Ин',  uk:'2Ін',  bg:'2Йн',  ro:'2Ioan',da:'2Joh', fi:'2Joh',  hu:'2Jn',   nl:'2Joh', no:'2Joh', sv:'2Joh',  ar:'2يو',   el:'Βʹ Ιω', tr:'2Yu',  'zh-CN':'约贰', ja:'ヨハ二', ko:'요이', he:'יוחב' },
  '3jo':{ en:'3Jo',  cs:'3J',  sk:'3Jn',  pl:'3J',   de:'3Joh', fr:'3Jn',  es:'3Jn',  it:'3Gv',  pt:'3Jo',  ru:'3Ин',  uk:'3Ін',  bg:'3Йн',  ro:'3Ioan',da:'3Joh', fi:'3Joh',  hu:'3Jn',   nl:'3Joh', no:'3Joh', sv:'3Joh',  ar:'3يو',   el:'Γʹ Ιω', tr:'3Yu',  'zh-CN':'约叁', ja:'ヨハ三', ko:'요삼', he:'יוחג' },
  jde:  { en:'Jde',  cs:'Ju',  sk:'Júd',  pl:'Jud',  de:'Jud',  fr:'Jude', es:'Jds',  it:'Gd',   pt:'Jd',   ru:'Иуд',  uk:'Юд',   bg:'Юд',   ro:'Iuda', da:'Judas',fi:'Juud',  hu:'Júd',   nl:'Judas',no:'Judas',sv:'Judas', ar:'يهو',   el:'Ιουδ',  tr:'Yud',  'zh-CN':'犹',  ja:'ユダ',  ko:'유',   he:'יהו' },
  rev:  { en:'Rev',  cs:'Zj',  sk:'Zjav', pl:'Ap',   de:'Offb', fr:'Ap',   es:'Ap',   it:'Ap',   pt:'Ap',   ru:'Откр', uk:'Одкр', bg:'Откр', ro:'Apoc', da:'Åb',   fi:'Ilm',   hu:'Jel',   nl:'Openb',no:'Åp',   sv:'Upp',   ar:'رؤ',    el:'Αποκ',  tr:'Vah',  'zh-CN':'启',  ja:'啓',    ko:'계',   he:'חז' },
  // Deuterocanon
  tob:  { en:'Tob',  cs:'Tob', sk:'Tob',  pl:'Tb',   de:'Tob',  fr:'Tb',   es:'Tob',  it:'Tb',   pt:'Tb',   ru:'Тов',  uk:'Тов',  bg:'Тов',  ro:'Tob',  da:'Tob',  fi:'Tob',   hu:'Tób',   nl:'Tob',  no:'Tob',  sv:'Tob',   ar:'طو',    el:'Τωβ',   tr:'Tob',  'zh-CN':'多比', ja:'トビ',  ko:'토빗', he:'טוב' },
  jdt:  { en:'Jdt',  cs:'Jdt', sk:'Jdt',  pl:'Jdt',  de:'Jdt',  fr:'Jdt',  es:'Jdt',  it:'Gdt',  pt:'Jt',   ru:'Иудф', uk:'Юд',   bg:'Иуд',  ro:'Iud',  da:'Jdt',  fi:'Jdt',   hu:'Jud',   nl:'Jdt',  no:'Jdt',  sv:'Jdt',   ar:'جدث',   el:'Ιδθ',   tr:'Jdt',  'zh-CN':'友弟德', ja:'ユデ', ko:'유딧', he:'יהופ' },
  '1ma':{ en:'1Mac', cs:'1Mak',sk:'1Mak', pl:'1Mch', de:'1Makk',fr:'1M',   es:'1Mac', it:'1Mac', pt:'1Mac', ru:'1Мак', uk:'1Мак', bg:'1Мак', ro:'1Mac', da:'1Makk',fi:'1Makk', hu:'1Mak',  nl:'1Makk',no:'1Makk',sv:'1Makk', ar:'1مك',   el:'Αʹ Μακκ',tr:'1Ma', 'zh-CN':'马加伯上', ja:'マカ一', ko:'마카1', he:'מכא' },
  '2ma':{ en:'2Mac', cs:'2Mak',sk:'2Mak', pl:'2Mch', de:'2Makk',fr:'2M',   es:'2Mac', it:'2Mac', pt:'2Mac', ru:'2Мак', uk:'2Мак', bg:'2Мак', ro:'2Mac', da:'2Makk',fi:'2Makk', hu:'2Mak',  nl:'2Makk',no:'2Makk',sv:'2Makk', ar:'2مك',   el:'Βʹ Μακκ',tr:'2Ma', 'zh-CN':'马加伯下', ja:'マカ二', ko:'마카2', he:'מכב' },
  wis:  { en:'Wis',  cs:'Mdr', sk:'Múdr', pl:'Mdr',  de:'Weish',fr:'Sg',   es:'Sab',  it:'Sap',  pt:'Sb',   ru:'Прем', uk:'Прм',  bg:'Прем', ro:'Înţ',  da:'Visd', fi:'Viis',  hu:'Bölcs', nl:'Wijsh',no:'Visd', sv:'Visd',  ar:'حك',    el:'Σοφ',   tr:'Bİlk', 'zh-CN':'智慧篇', ja:'知恵', ko:'지혜', he:'חכ' },
  sir:  { en:'Sir',  cs:'Sír', sk:'Sír',  pl:'Syr',  de:'Sir',  fr:'Si',   es:'Eclo', it:'Sir',  pt:'Sir',  ru:'Сир',  uk:'Сір',  bg:'Сир',  ro:'Sir',  da:'Sir',  fi:'Sir',   hu:'Sír',   nl:'Sir',  no:'Sir',  sv:'Sir',   ar:'سير',   el:'Σειρ',  tr:'Sir',  'zh-CN':'德训篇', ja:'シラ', ko:'집회', he:'בנס' },
  bar:  { en:'Bar',  cs:'Bar', sk:'Bar',  pl:'Ba',   de:'Bar',  fr:'Ba',   es:'Bar',  it:'Bar',  pt:'Bar',  ru:'Вар',  uk:'Вар',  bg:'Вар',  ro:'Bar',  da:'Bar',  fi:'Bar',   hu:'Bár',   nl:'Bar',  no:'Bar',  sv:'Bar',   ar:'با',    el:'Βαρ',   tr:'Bar',  'zh-CN':'巴录', ja:'バル',  ko:'바룩', he:'בר' },
};

function normalizeLang(lang) {
  const l = String(lang || 'cs').toLowerCase().replace('_', '-');
  return l === 'cz' ? 'cs' : l;
}

/**
 * Convert all EN Strong's style biblical abbreviations in text to target language.
 * Matches patterns like [Isa.18:2], [1Co.3:5-6], [Ps.94(95):10] and replaces book abbreviation.
 * Does NOT touch refs that don't start with a recognized EN abbreviation.
 */
export function convertBiblicalAbbreviations(text, targetLang) {
  const lang = normalizeLang(targetLang);
  return text.replace(/\[([1-4]?[A-Za-z]+)\.([^\[\]]+)\]/g, (match, abbr, refs) => {
    const bookKey = EN_TO_BOOK[abbr];
    if (!bookKey) return match;
    const abbrs = BOOK_ABBR[bookKey];
    if (!abbrs) return match;
    const targetAbbr = abbrs[lang] || abbrs['en'];
    if (!targetAbbr || targetAbbr === abbr) return match;
    return `[${targetAbbr} ${refs.trim()}]`;
  });
}

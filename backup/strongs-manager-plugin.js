/* ================================================================
   Strong's Manager Plugin v2.1
   Zasuvný modul pro strong_translator.html
   Použití: <script src="strongs-manager-plugin.js"></script>
            SM.open()   // otevře Manager
            SM.close()  // zavře Manager
            SM.onSelect(cb)  // callback kdy uživatel klikne "← Vložit"
   ================================================================ */

(function() {
'use strict';

// ── Inicializace: inject CSS + HTML ───────────────────────
function injectPlugin() {
  if (document.getElementById('sm-overlay')) return; // už vloženo

  // CSS
  const style = document.createElement('style');
  style.id = 'sm-plugin-style';
  style.textContent = SM_CSS;
  document.head.appendChild(style);

  // HTML
  const tmp = document.createElement('div');
  tmp.innerHTML = SM_HTML;
  document.body.appendChild(tmp.firstElementChild);

  // Init JS
  SM_INIT();
}

// ── Veřejné API ───────────────────────────────────────────
window.SM = {
  open() {
    injectPlugin();
    document.getElementById('sm-overlay').classList.remove('h');
    document.getElementById('sm-overlay').style.display = 'flex';
  },
  close() {
    const el = document.getElementById('sm-overlay');
    if (el) { el.classList.add('h'); el.style.display = 'none'; }
  },
  _selectCallback: null,
  onSelect(cb) { this._selectCallback = cb; },
  triggerSelect(entry) {
    if (this._selectCallback) this._selectCallback(entry);
    this.close();
  }
};

// ── CSS ───────────────────────────────────────────────────
const SM_CSS = "\n\n\n#sm-overlay {\n  /* SM Plugin vars */\n  --bg:      #0d0f12;\n  --bg2:     #13161b;\n  --bg3:     #1a1e26;\n  --bg4:     #222733;\n  --border:  #2a3040;\n  --border2: #3a4560;\n  --text:    #c8d0e0;\n  --text2:   #7a8899;\n  --text3:   #4a5566;\n  --accent:  #4a90d9;\n  --accent2: #2a6aad;\n  --gold:    #c9a84c;\n  --gold2:   #7a6020;\n  --green:   #4a9e6a;\n  --red:     #c04a4a;\n  --cyan:    #3ab0c0;\n  --mono:    'Consolas', 'Cascadia Code', 'Courier New', monospace;\n  --serif:   'Palatino Linotype', 'Palatino', 'Book Antiqua', Georgia, serif;\n  --list-w:  280px;\n  --right-w: 290px;\n}\n* { box-sizing: border-box; margin: 0; padding: 0; }\n#sm-overlay { background: var(--bg); color: var(--text); font-family: var(--mono); font-size: 13px; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }\n\n/* HEADER */\n#sm-overlay header { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 0 14px; display: flex; align-items: center; gap: 16px; height: 46px; flex-shrink: 0; }\n#sm-overlay .logo { font-family: var(--serif); font-size: 19px; font-weight: 600; color: var(--gold); white-space: nowrap; }\n#sm-overlay .logo em { font-style: normal; color: var(--text3); font-size: 12px; margin-left: 6px; font-family: var(--mono); }\n#sm-overlay .hdr-stats { display: flex; gap: 14px; font-size: 11px; color: var(--text3); }\n#sm-overlay .hdr-stat b { color: var(--accent); font-weight: 600; }\n#sm-overlay .hdr-stat.gold b { color: var(--gold); }\n#sm-overlay .hdr-stat.green b { color: var(--green); }\n\n/* TOOLBAR */\n#sm-overlay .toolbar { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 6px 14px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }\n#sm-overlay .tg { display: flex; gap: 4px; align-items: center; padding-right: 10px; border-right: 1px solid var(--border); }\n#sm-overlay .tg:last-child { border-right: none; }\n#sm-overlay .tg-lbl { font-size: 10px; color: var(--text3); text-transform: uppercase; letter-spacing: .07em; margin-right: 2px; }\n\n/* BUTTONS */\n#sm-overlay button { background: var(--bg3); border: 1px solid var(--border); color: var(--text); padding: 4px 9px; border-radius: 4px; cursor: pointer; font-family: var(--mono); font-size: 11px; display: inline-flex; align-items: center; gap: 4px; transition: background .12s, border-color .12s, color .12s; white-space: nowrap; line-height: 1.4; }\n#sm-overlay button:hover { background: var(--bg4); border-color: var(--border2); color: #fff; }\n#sm-overlay .bp { background: var(--accent2); border-color: var(--accent); color: #fff; }\n#sm-overlay .bp:hover { background: var(--accent) !important; }\n#sm-overlay .bs { background: #153a25; border-color: var(--green); color: var(--green); }\n#sm-overlay .bs:hover { background: var(--green) !important; color: #fff !important; }\n#sm-overlay .bd { background: #3a1515; border-color: var(--red); color: var(--red); }\n#sm-overlay .bd:hover { background: var(--red) !important; color: #fff !important; }\n#sm-overlay .bg { background: #2a2010; border-color: var(--gold2); color: var(--gold); }\n#sm-overlay .bg:hover { background: var(--gold2) !important; color: #fff !important; }\n#sm-overlay .bi { background: none; border: none; cursor: pointer; color: var(--text3); padding: 2px 5px; border-radius: 3px; font-size: 13px; }\n#sm-overlay .bi:hover { color: #fff !important; background: var(--bg4) !important; border: none !important; }\n#sm-overlay button:disabled { opacity: .35; cursor: not-allowed; }\n\n/* INPUTS */\n#sm-overlay input[type=text], #sm-overlay input[type=search], #sm-overlay input[type=number], #sm-overlay select, #sm-overlay textarea { background: var(--bg3); border: 1px solid var(--border); color: var(--text); padding: 4px 7px; border-radius: 4px; font-family: var(--mono); font-size: 12px; outline: none; transition: border-color .12s; }\n#sm-overlay input:focus, #sm-overlay select:focus, #sm-overlay textarea:focus { border-color: var(--accent); }\n#sm-overlay select { cursor: pointer; }\n#sm-overlay textarea { resize: vertical; }\n\n/* LAYOUT */\n#sm-overlay .main { display: flex; flex: 1; min-height: 0; overflow: hidden; }\n\n/* LEFT PANEL */\n#sm-overlay .panel-list { width: var(--list-w); flex-shrink: 0; background: var(--bg2); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }\n#sm-overlay .list-hdr { padding: 8px 10px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 5px; }\n#sm-overlay .ltabs { display: flex; gap: 3px; }\n#sm-overlay .ltab { flex: 1; padding: 3px 0; text-align: center; background: var(--bg3); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; font-size: 11px; color: var(--text2); transition: all .12s; }\n#sm-overlay .ltab.a-all { background: #1a2a4a; border-color: var(--accent); color: var(--accent); }\n#sm-overlay .ltab.a-G { background: #1a2a4a; border-color: #4a80c9; color: #6ab0ff; }\n#sm-overlay .ltab.a-H { background: #2a1f0a; border-color: var(--gold2); color: var(--gold); }\n#sm-overlay .ltab.a-Gs { background: #1a2a4a; border-color: #4a80c9; color: #6ab0ff; }\n\n/* Dropdown pro řecké podskupiny */\n#sm-overlay .ltab-wrap { position: relative; flex: 1; }\n#sm-overlay .ltab-wrap .ltab { width: 100%; }\n#sm-overlay .ltab-drop {\n  display: block;\n  position: absolute;\n  top: 100%; left: 0; right: 0;\n  margin-top: 3px;\n  background: var(--bg2);\n  border: 1px solid var(--border2);\n  border-radius: 5px;\n  overflow: hidden;\n  z-index: 50;\n  box-shadow: 0 4px 12px rgba(0,0,0,.5);\n  min-width: 140px;\n}\n#sm-overlay .ltab-drop.h { display: none !important; }\n#sm-overlay .ltab-drop-item {\n  padding: 6px 10px;\n  font-size: 11px;\n  cursor: pointer;\n  color: var(--text2);\n  border-bottom: 1px solid var(--border);\n  transition: background .1s;\n  display: flex; justify-content: space-between; align-items: center;\n}\n#sm-overlay .ltab-drop-item:last-child { border-bottom: none; }\n#sm-overlay .ltab-drop-item:hover { background: var(--bg4); color: #fff; }\n#sm-overlay .ltab-drop-item.active { background: #1a2a4a; color: var(--accent); }\n#sm-overlay .ltab-drop-item .di-cnt { font-size: 10px; color: var(--text3); }\n#sm-overlay .lsrow { display: flex; gap: 4px; }\n#sm-overlay .lsrow input { flex: 1; width: 0; }\n#sm-overlay .lcnt { font-size: 10px; color: var(--text3); }\n#sm-overlay .lscroll { flex: 1; overflow-y: auto; position: relative; }\n#sm-overlay .lscroll::-webkit-scrollbar { width: 5px; }\n#sm-overlay .lscroll::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }\n#sm-overlay .vsp { position: relative; }\n#sm-overlay .vit { position: absolute; top: 0; left: 0; right: 0; }\n#sm-overlay .litem { padding: 6px 10px; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; gap: 7px; align-items: flex-start; transition: background .09s; user-select: none; }\n#sm-overlay .litem:hover { background: var(--bg3); }\n#sm-overlay .litem.sel { background: var(--bg4); border-left: 2px solid var(--accent); padding-left: 8px; }\n#sm-overlay .litem.cust { border-left: 2px solid var(--gold2); padding-left: 8px; }\n#sm-overlay .litem.sel.cust { border-left: 2px solid var(--gold); }\n#sm-overlay .lid { font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 3px; flex-shrink: 0; margin-top: 2px; }\n#sm-overlay .lid.G { background: #1a2a4a; color: var(--accent); }\n#sm-overlay .lid.H { background: #2a1f0a; color: var(--gold); }\n#sm-overlay .lbody { flex: 1; min-width: 0; }\n#sm-overlay .lword { font-family: var(--serif); font-size: 15px; line-height: 1.2; }\n#sm-overlay .ltrans { font-size: 10px; color: var(--text2); }\n#sm-overlay .lcz { font-size: 11px; color: var(--text3); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n\n/* RESIZER */\n#sm-overlay .resizer { width: 4px; flex-shrink: 0; background: var(--border); cursor: col-resize; transition: background .15s; z-index: 10; }\n#sm-overlay .resizer:hover, #sm-overlay .resizer.drag { background: var(--accent); }\n\n/* CENTER PANEL */\n#sm-overlay .panel-center { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }\n#sm-overlay .det-hdr { padding: 10px 18px; border-bottom: 1px solid var(--border); background: var(--bg2); display: flex; gap: 14px; align-items: flex-start; flex-shrink: 0; }\n#sm-overlay .det-word { font-family: var(--serif); font-size: 34px; line-height: 1; color: #fff; margin-right: 4px; }\n#sm-overlay .det-meta { flex: 1; min-width: 0; }\n#sm-overlay .det-badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 4px; margin-bottom: 4px; }\n#sm-overlay .det-badge.G { background: #1a2a4a; color: var(--accent); border: 1px solid var(--accent2); }\n#sm-overlay .det-badge.H { background: #2a1f0a; color: var(--gold); border: 1px solid var(--gold2); }\n#sm-overlay .det-translit { color: var(--text2); font-size: 13px; }\n#sm-overlay .det-gram { font-size: 10px; color: var(--text3); margin-top: 3px; }\n#sm-overlay .det-nav { display: flex; gap: 6px; align-items: center; margin-left: auto; flex-shrink: 0; }\n#sm-overlay .det-body { flex: 1; overflow-y: auto; padding: 14px 18px; }\n#sm-overlay .det-body::-webkit-scrollbar { width: 5px; }\n#sm-overlay .det-body::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }\n\n#sm-overlay .fb { margin-bottom: 10px; padding: 9px 12px; background: var(--bg2); border: 1px solid var(--border); border-radius: 5px; }\n#sm-overlay .fl { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: var(--text3); margin-bottom: 5px; font-weight: 600; }\n#sm-overlay .fv { font-family: var(--serif); font-size: 15px; line-height: 1.55; white-space: pre-wrap; }\n#sm-overlay .fv.cz { color: var(--cyan); }\n#sm-overlay .fv.kjv { color: var(--green); }\n#sm-overlay .fv.sm { font-size: 13px; }\n#sm-overlay .fv.mn { font-family: var(--mono); font-size: 11px; color: var(--text2); }\n#sm-overlay .fgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }\n\n/* Custom fields */\n#sm-overlay .cshdr { display: flex; align-items: center; gap: 8px; margin: 12px 0 8px; padding-top: 12px; border-top: 1px solid var(--border); }\n#sm-overlay .cstitle { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--gold); font-weight: 600; flex: 1; }\n#sm-overlay .cfield { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 7px; padding: 8px 11px; background: #181510; border: 1px solid var(--gold2); border-radius: 5px; }\n#sm-overlay .cfname { font-size: 10px; color: var(--gold2); text-transform: uppercase; letter-spacing: .05em; min-width: 90px; padding-top: 2px; flex-shrink: 0; word-break: break-all; }\n#sm-overlay .cfval { flex: 1; font-family: var(--serif); font-size: 14px; line-height: 1.5; white-space: pre-wrap; }\n#sm-overlay .cfbtns { display: flex; gap: 2px; }\n#sm-overlay .nocf { font-size: 11px; color: var(--text3); padding: 6px 0; font-style: italic; }\n\n/* RIGHT PANEL */\n#sm-overlay .panel-right { width: var(--right-w); flex-shrink: 0; background: var(--bg2); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }\n#sm-overlay .rtabs { display: flex; border-bottom: 1px solid var(--border); flex-shrink: 0; }\n#sm-overlay .rtab { flex: 1; padding: 8px 4px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; cursor: pointer; color: var(--text3); background: none; border: none; border-bottom: 2px solid transparent; transition: all .12s; font-family: var(--mono); }\n#sm-overlay .rtab.active { color: var(--accent); border-bottom-color: var(--accent); }\n#sm-overlay .rtab:hover:not(.active) { color: var(--text); background: var(--bg3); }\n#sm-overlay .rpanel { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }\n#sm-overlay .rpanel::-webkit-scrollbar { width: 5px; }\n#sm-overlay .rpanel::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }\n#sm-overlay .rsec { display: none; flex-direction: column; gap: 8px; }\n#sm-overlay .rsec.active { display: flex; }\n#sm-overlay .rshdr { font-size: 10px; text-transform: uppercase; letter-spacing: .09em; color: var(--text3); padding-bottom: 6px; border-bottom: 1px solid var(--border); }\n\n/* File item */\n#sm-overlay .fitem { padding: 8px 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 5px; display: flex; gap: 7px; align-items: center; }\n#sm-overlay .fitem-ico { font-size: 15px; flex-shrink: 0; }\n#sm-overlay .fitem-inf { flex: 1; min-width: 0; }\n#sm-overlay .fitem-n { font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n#sm-overlay .fitem-m { font-size: 10px; color: var(--text3); }\n#sm-overlay .fitem-b { display: flex; gap: 3px; }\n\n/* Drop zone */\n#sm-overlay .dz { border: 2px dashed var(--border2); border-radius: 6px; padding: 18px 12px; text-align: center; color: var(--text3); font-size: 11px; cursor: pointer; transition: all .15s; }\n#sm-overlay .dz:hover, #sm-overlay .dz.over { border-color: var(--accent); background: rgba(74,144,217,.05); color: var(--accent); }\n#sm-overlay .dz-ico { font-size: 26px; margin-bottom: 6px; }\n\n/* Export card */\n#sm-overlay .ec { padding: 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 5px; }\n#sm-overlay .ec-t { font-size: 11px; font-weight: 600; margin-bottom: 5px; }\n#sm-overlay .ec p { font-size: 10px; color: var(--text2); margin-bottom: 7px; line-height: 1.5; }\n#sm-overlay .er { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }\n#sm-overlay .er label { font-size: 10px; color: var(--text2); }\n#sm-overlay .er input[type=number] { width: 70px; }\n\n/* Stats */\n#sm-overlay .sg { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }\n#sm-overlay .sc { padding: 10px 8px; background: var(--bg3); border: 1px solid var(--border); border-radius: 5px; text-align: center; }\n#sm-overlay .sc-v { font-size: 18px; font-weight: 600; color: var(--accent); }\n#sm-overlay .sc-l { font-size: 9px; color: var(--text3); margin-top: 2px; text-transform: uppercase; letter-spacing: .05em; }\n#sm-overlay .pb { height: 3px; background: var(--bg4); border-radius: 2px; overflow: hidden; margin: 6px 0; }\n#sm-overlay .pf { height: 100%; background: var(--accent); border-radius: 2px; transition: width .3s; }\n\n/* Empty state */\n#sm-overlay .empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text3); gap: 10px; padding: 40px; text-align: center; }\n#sm-overlay .empty-ico { font-size: 44px; }\n#sm-overlay .empty-t { font-family: var(--serif); font-size: 22px; color: var(--text2); }\n#sm-overlay .empty-s { font-size: 12px; line-height: 1.7; max-width: 340px; }\n\n/* Loading */\n#sm-overlay #ov { position: fixed; inset: 0; background: rgba(13,15,18,.92); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 500; gap: 14px; }\n#sm-overlay #ov.h { display: none; }\n#sm-overlay .spin { width: 38px; height: 38px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .75s linear infinite; }\n@keyframes spin { to { transform: rotate(360deg); } }\n#ov-t { font-size: 13px; color: var(--text2); }\n#ov-s { font-size: 11px; color: var(--text3); }\n#ov-p { width: 260px; height: 3px; background: var(--bg4); border-radius: 2px; overflow: hidden; }\n#ov-pf { height: 100%; background: var(--accent); border-radius: 2px; transition: width .1s; }\n\n/* Modal */\n.mbg { position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 200; display: flex; align-items: center; justify-content: center; }\n.mbg.h { display: none; }\n.modal { background: var(--bg2); border: 1px solid var(--border2); border-radius: 8px; padding: 20px; width: 480px; max-width: 94vw; max-height: 85vh; overflow-y: auto; }\n.modal h3 { font-family: var(--serif); font-size: 18px; margin-bottom: 14px; }\n.fr { margin-bottom: 11px; }\n.fr label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: var(--text3); margin-bottom: 4px; }\n.fr input, .fr textarea, .fr select { width: 100%; }\n.fr textarea { min-height: 90px; font-family: var(--serif); font-size: 14px; }\n.mact { display: flex; gap: 7px; justify-content: flex-end; margin-top: 14px; }\n\n/* Toast */\n#toasts { position: fixed; bottom: 18px; right: 18px; display: flex; flex-direction: column; gap: 7px; z-index: 1000; pointer-events: none; }\n.toast { background: var(--bg4); border: 1px solid var(--border2); padding: 9px 14px; border-radius: 5px; font-size: 12px; pointer-events: all; animation: tin .18s ease; max-width: 310px; line-height: 1.4; }\n.tok { border-color: var(--green); color: var(--green); }\n.ter { border-color: var(--red);   color: var(--red);   }\n.tin { border-color: var(--accent); color: var(--accent); }\n@keyframes tin { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; } }\n\n.h { display: none !important; }\n::-webkit-scrollbar { width: 5px; }\n::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }\n\n/* Field coverage */\n.fcov-item { margin-bottom:6px; padding:8px 10px; background:var(--bg3); border:1px solid var(--border); border-radius:5px; cursor:pointer; transition:border-color .12s; }\n.fcov-item:hover { border-color:var(--accent); }\n.fcov-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }\n.fcov-name { font-size:11px; font-weight:600; }\n.fcov-pct { font-size:11px; font-weight:600; }\n.fcov-pct.full { color:var(--green); } .fcov-pct.high { color:var(--accent); } .fcov-pct.low { color:var(--gold); } .fcov-pct.zero { color:var(--text3); }\n.fcov-bar { height:3px; background:var(--bg4); border-radius:2px; overflow:hidden; margin-bottom:3px; }\n.fcov-fill { height:100%; border-radius:2px; }\n.fcov-detail { font-size:10px; color:var(--text3); display:flex; gap:8px; flex-wrap:wrap; }\n.tracked-item { display:flex; align-items:center; gap:6px; padding:6px 8px; margin-bottom:5px; background:#1a180a; border:1px solid var(--gold2); border-radius:5px; }\n.tracked-name { font-size:11px; color:var(--gold); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n.tracked-cnt  { font-size:10px; color:var(--text3); white-space:nowrap; }\n.tracked-pct  { font-size:11px; font-weight:600; color:var(--gold2); white-space:nowrap; }\n.tracked-del  { font-size:12px; cursor:pointer; color:var(--text3); background:none; border:none; padding:0 2px; }\n.tracked-del:hover { color:var(--red); }\n\n/* ── EXTRACTION MODE ── */\n.xbar { background: #151f10; border-bottom: 2px solid var(--green); padding: 6px 14px; display: flex; gap: 8px; align-items: center; flex-shrink: 0; flex-wrap: wrap; }\n.xbar-title { font-size: 11px; color: var(--green); font-weight: 600; }\n.xbar-count { font-size: 11px; color: var(--text2); margin-left: 4px; }\n.xmode .litem { cursor: pointer; }\n.xmode .litem.xsel { background: #1a2f12 !important; border-left: 3px solid var(--green) !important; padding-left: 7px !important; }\n.xmode .litem.xsel .lid { background: #2a4a1a !important; }\n/* Field checkboxes in detail */\n.xfields-bar { background: #151f10; border: 1px solid var(--green); border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; }\n.xfields-title { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--green); margin-bottom: 8px; font-weight: 600; }\n.xfields-grid { display: flex; flex-wrap: wrap; gap: 6px; }\n.xchk { display: flex; align-items: center; gap: 5px; padding: 3px 8px; background: var(--bg3); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; font-size: 11px; user-select: none; transition: all .1s; }\n.xchk:hover { border-color: var(--green); }\n.xchk.on   { background: #1a3010; border-color: var(--green); color: var(--green); }\n.xchk.part { background: #1a2a10; border-color: #5a8a3a; color: #8aba6a; }\n.xchk input { display: none; }\n/* add-to-selection button on list items in xmode */\n.xadd-btn { display: none; }\n.xmode .xadd-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 3px; background: none; border: 1px solid var(--border); color: var(--text3); font-size: 14px; flex-shrink: 0; transition: all .1s; cursor: pointer; padding: 0; margin-top: 2px; }\n.xmode .litem.xsel .xadd-btn { background: var(--green); border-color: var(--green); color: #fff; }\n.xmode .xadd-btn:hover { border-color: var(--green); color: var(--green); }\n";

// ── HTML ──────────────────────────────────────────────────
const SM_HTML = '<div id="sm-overlay" class="h" style="position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;overflow:hidden;">\n  <div style="position:absolute;top:10px;right:14px;z-index:10000;display:flex;gap:8px">\n    <button onclick="SM.close()" style="background:#c04a4a;border:1px solid #e06060;color:#fff;padding:5px 12px;border-radius:4px;cursor:pointer;font-family:monospace;font-size:12px;font-weight:600">✕ Zavřít</button>\n  </div>\n<!-- OVERLAY -->\n<div id="ov" class="h">\n  <div class="spin"></div>\n  <div id="ov-t">Zpracovávám…</div>\n  <div id="ov-s"></div>\n  <div id="ov-p"><div id="ov-pf" style="width:0%"></div></div>\n</div>\n\n<!-- TOASTS -->\n<div id="toasts"></div>\n\n<!-- MODAL: Add field -->\n<div class="mbg h" id="mAdd">\n  <div class="modal">\n    <h3>Přidat vlastní pole</h3>\n    <div class="fr"><label>Název pole</label><input type="text" id="mAN" placeholder="např. Kabalah, Poznámka, Etymol CZ…"></div>\n    <div class="fr"><label>Obsah pole</label><textarea id="mAV" placeholder="Text hodnoty…"></textarea></div>\n    <div class="mact">\n      <button onclick="cModal(\'mAdd\')">Zrušit</button>\n      <button class="bg" onclick="doAddField()">💾 Uložit (Ctrl+Enter)</button>\n    </div>\n  </div>\n</div>\n\n<!-- MODAL: Edit field -->\n<div class="mbg h" id="mEdit">\n  <div class="modal">\n    <h3>Upravit vlastní pole</h3>\n    <div class="fr"><label>Název pole</label><input type="text" id="mEN"></div>\n    <div class="fr"><label>Obsah pole</label><textarea id="mEV"></textarea></div>\n    <div class="mact">\n      <button onclick="cModal(\'mEdit\')">Zrušit</button>\n      <button class="bg" onclick="doEditField()">💾 Uložit (Ctrl+Enter)</button>\n    </div>\n  </div>\n</div>\n\n<!-- MODAL: Merge -->\n<div class="mbg h" id="mMerge">\n  <div class="modal">\n    <h3>Sloučit soubory</h3>\n    <p style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.6" id="mMT"></p>\n    <div class="fr">\n      <label>Strategie při konfliktu ID</label>\n      <select id="mMS">\n        <option value="keep">Ponechat stávající záznam</option>\n        <option value="overwrite">Přepsat záznamem z nového souboru</option>\n        <option value="merge">Doplnit chybějící pole z nového souboru</option>\n      </select>\n    </div>\n    <div class="mact">\n      <button onclick="cModal(\'mMerge\')">Zrušit</button>\n      <button class="bp" onclick="doMerge()">🔀 Potvrdit sloučení</button>\n    </div>\n  </div>\n</div>\n\n<!-- HEADER -->\n<header>\n  <div class="logo">Strong\'s Manager <em>v2.1</em></div>\n  <div class="hdr-stats">\n    <span class="hdr-stat">Řecky: <b id="hG">0</b></span>\n    <span class="hdr-stat gold">Hebrejsky: <b id="hH">0</b></span>\n    <span class="hdr-stat">Celkem: <b id="hT">0</b></span>\n    <span class="hdr-stat green">Vl. pole u: <b id="hC">0</b></span>\n    <span class="hdr-stat">Soubory: <b id="hF">0</b></span>\n  </div>\n</header>\n\n<!-- TOOLBAR -->\n<div class="toolbar">\n  <div class="tg">\n    <span class="tg-lbl">Import</span>\n    <button class="bp" onclick="Q(\'fi\').click()">📂 Načíst soubor</button>\n    <button onclick="Q(\'fim\').click()">📂+ Přidat soubory</button>\n    <button class="bg" onclick="Q(\'fiTrans\').click()" title="Načíst překladový soubor a sloučit s aktuálními daty">🔀 Merge překladu</button>\n    <input type="file" id="fi"      accept=".txt,.tsv,.csv" style="display:none" onchange="importFiles(event,false)">\n    <input type="file" id="fim"     accept=".txt,.tsv,.csv" multiple style="display:none" onchange="importFiles(event,true)">\n    <input type="file" id="fiTrans" accept=".txt" style="display:none" onchange="importTranslation(event)">\n  </div>\n  <div class="tg">\n    <span class="tg-lbl">Hledání</span>\n    <input type="search" id="qS" placeholder="Slovo, ID, definice…" oninput="doSearch()" style="width:190px">\n    <select id="qL" onchange="doSearch()">\n      <option value="all">G + H</option>\n      <option value="G">Řečtina (G)</option>\n      <option value="H">Hebrejština (H)</option>\n    </select>\n    <select id="qF" onchange="doSearch()">\n      <option value="all">Všechna pole</option>\n      <option value="id">ID</option>\n      <option value="word">Slovo / znak</option>\n      <option value="prepis">Přepis</option>\n      <option value="definice">Definice</option>\n      <option value="cz">Česky</option>\n      <option value="kjv">KJV</option>\n      <option value="custom">Vlastní pole</option>\n    </select>\n    <select id="qO" onchange="doSearch()">\n      <option value="id">ID</option>\n      <option value="word">Slovo</option>\n      <option value="cz">Česky</option>\n    </select>\n    <select id="qX" onchange="doSearch()" title="Speciální filtry">\n      <option value="all">— Speciální filtr —</option>\n      <optgroup label="Překlad">\n        <option value="no_cz">❌ Bez českého překladu</option>\n        <option value="has_cz">✓ Má český překlad</option>\n      </optgroup>\n      <optgroup label="Vlastní pole">\n        <option value="has_custom">⭐ Má vlastní pole</option>\n        <option value="no_custom">○ Bez vlastních polí</option>\n        <option value="no_cz_has_custom">❌+⭐ Bez Cz, ale s vlastními poli</option>\n      </optgroup>\n      <optgroup label="Pole">\n        <option value="no_kjv">Bez KJV</option>\n        <option value="no_def">Bez definice</option>\n        <option value="bad_translation">⚠ Podezřelý překlad (EN zůstal)</option>\n        <option value="no_custom_field" style="display:none">Bez vlastního pole</option>\n      </optgroup>\n    </select>\n    <button onclick="clearQ()">✕</button>\n  </div>\n  <div class="tg">\n    <span class="tg-lbl">Export</span>\n    <button class="bs" onclick="exportAll()">💾 Vše</button>\n    <button class="bs" onclick="exportFiltered()">💾 Výběr</button>\n    <button class="bs" onclick="mergeAndExport()" title="Spojit všechny načtené soubory do jednoho a stáhnout">🔗 Spojit</button>\n    <button class="bg" onclick="showRT(\'export\')">✂️ Rozdělit…</button>\n    <button style="background:#153a25;border-color:#3a9e5a;color:#5abe7a" onclick="xModeOn()">🔲 Výběr polí…</button>\n  </div>\n  <div class="tg">\n    <span class="tg-lbl">Stav</span>\n    <button onclick="saveLS()" title="Uložit do úložiště prohlížeče (file://→localStorage, http://→IndexedDB)">💿 Uložit</button>\n    <button onclick="loadLS()">📥 Načíst z DB</button>\n    <button onclick="exportJSON()" title="Exportovat JSON zálohu na disk">📦 Export JSON</button>\n    <button onclick="triggerImportJSON()" title="Importovat JSON zálohu z disku">📦 Import JSON</button>\n    <input type="file" id="fiJSON" accept=".json" style="display:none" onchange="importJSON(event)">\n    <button class="bd" onclick="clearAll()">🗑️ Vymazat</button>\n  </div>\n</div>\n\n<!-- EXTRACTION BAR (shown only in xmode) -->\n<div class="xbar h" id="xbar">\n  <span class="xbar-title">✂️ Mód extrakce</span>\n  <span class="xbar-count" id="xbarCount">0 záznamů vybráno</span>\n  <button class="bs" onclick="xSelAll()">☑ Vybrat vše (filtr)</button>\n  <button onclick="xSelNone()">☐ Zrušit výběr</button>\n  <button class="bg" onclick="xInvert()">⇄ Invertovat</button>\n  <span style="flex:1"></span>\n  <button class="bs" onclick="xExport()">💾 Exportovat výběr</button>\n  <button class="bd" onclick="xModeOff()">✕ Ukončit mód extrakce</button>\n</div>\n\n<!-- MAIN -->\n<div class="main">\n\n  <!-- LEFT -->\n  <div class="panel-list" id="panelList">\n    <div class="list-hdr">\n      <div class="ltabs">\n        <div class="ltab a-all" id="lt-all" onclick="setLang(\'all\')">Vše</div>\n        <div class="ltab-wrap">\n          <div class="ltab" id="lt-G" onclick="toggleGDrop(event)">Řecky ▾</div>\n          <div class="ltab-drop h" id="lt-G-drop">\n            <div class="ltab-drop-item" id="ldi-G"  onclick="setLang(\'G\')">\n              <span>Vše řecky</span><span class="di-cnt" id="cnt-G"></span>\n            </div>\n            <div class="ltab-drop-item" id="ldi-G1" onclick="setLang(\'G1\')">\n              <span>G1–G5624</span><span class="di-cnt" id="cnt-G1"></span>\n            </div>\n            <div class="ltab-drop-item" id="ldi-G6" onclick="setLang(\'G6\')">\n              <span>G6000+</span><span class="di-cnt" id="cnt-G6"></span>\n            </div>\n          </div>\n        </div>\n        <div class="ltab" id="lt-H" onclick="setLang(\'H\')">Hebrejsky</div>\n      </div>\n      <div class="lsrow">\n        <input type="search" id="sQ" placeholder="Rychlé hledání…" oninput="sideSearch(this.value)">\n      </div>\n      <div class="lcnt" id="lcnt">0 záznamů</div>\n      <div id="czprog" class="h" style="margin-top:4px">\n        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-bottom:3px">\n          <span>Pokrytí Cz</span><span id="czprog-pct">0%</span>\n        </div>\n        <div class="pb"><div class="pf" id="czprog-bar" style="width:0%"></div></div>\n        <div style="font-size:10px;color:var(--text3);margin-top:2px" id="czprog-detail"></div>\n      </div>\n    </div>\n    <div class="lscroll" id="lscroll" onscroll="onLS()">\n      <div class="vsp" id="vsp"><div class="vit" id="vit"></div></div>\n    </div>\n  </div>\n\n  <div class="resizer" id="rz1" onmousedown="startRz(event,\'rz1\',\'panelList\',\'--list-w\',false)"></div>\n\n  <!-- CENTER -->\n  <div class="panel-center">\n    <div class="empty" id="emptyState">\n      <div class="empty-ico">📖</div>\n      <div class="empty-t">Strong\'s Manager</div>\n      <div class="empty-s">Načtěte .txt soubor slovníku kliknutím na tlačítko nebo přetažením souboru na pravý panel.<br>Podporuje řecké (G) i hebrejské (H) záznamy.</div>\n      <div style="display:flex;gap:8px;margin-top:6px">\n        <button class="bp" onclick="Q(\'fi\').click()">📂 Načíst soubor</button>\n        <button onclick="loadLS()">📥 Obnovit uložený stav</button>\n      </div>\n    </div>\n    <div id="dw" class="h" style="display:flex;flex-direction:column;height:100%;overflow:hidden;">\n      <div class="det-hdr">\n        <div class="det-word" id="dW"></div>\n        <div class="det-meta">\n          <div class="det-badge G" id="dB">G1</div>\n          <div class="det-translit" id="dT"></div>\n          <div class="det-gram" id="dG"></div>\n        </div>\n        <div class="det-nav">
          <button class="bs" id="sm-insert-btn" onclick="smInsertEntry()" title="Vložit heslo do překladače" style="display:none">← Vložit</button>\n          <button class="bg" onclick="oModal(\'mAdd\')">＋ Vlastní pole</button>\n          <button onclick="navP()" title="Předchozí (↑)">◀</button>\n          <button onclick="navN()" title="Následující (↓)">▶</button>\n        </div>\n      </div>\n      <div class="det-body" id="detBody"></div>\n    </div>\n  </div>\n\n  <div class="resizer" id="rz2" onmousedown="startRz(event,\'rz2\',\'panelRight\',\'--right-w\',true)"></div>\n\n  <!-- RIGHT -->\n  <div class="panel-right" id="panelRight">\n    <div class="rtabs">\n      <button class="rtab active" id="rt-files"  onclick="showRT(\'files\')">Soubory</button>\n      <button class="rtab"        id="rt-export" onclick="showRT(\'export\')">Export</button>\n      <button class="rtab"        id="rt-stats"  onclick="showRT(\'stats\')">Statistiky</button>\n      <button class="rtab"        id="rt-fields" onclick="showRT(\'fields\')">Pole</button>\n    </div>\n    <div class="rpanel">\n\n      <!-- FILES -->\n      <div class="rsec active" id="rs-files">\n        <div class="rshdr">Načtené soubory</div>\n        <div class="dz" id="dropzone"\n             ondragover="dzOv(event)" ondragleave="dzLv()" ondrop="dzDr(event)"\n             onclick="Q(\'fim\').click()">\n          <div class="dz-ico">📁</div>\n          Přetáhni .txt soubory nebo klikni pro výběr\n        </div>\n        <div id="flist"></div>\n        <button id="btnMrg" class="bp h" onclick="oMergeModal()">🔀 Sloučit všechny soubory</button>\n        <div style="margin-top:8px;padding:8px 10px;background:var(--bg3);border:1px solid var(--gold2);border-radius:5px;font-size:10px;color:var(--text2);line-height:1.6">\n          <b style="color:var(--gold)">🔀 Merge překladu</b> (v toolbaru)<br>\n          Načte překladový soubor ve formátu:<br>\n          <code style="color:var(--text3);font-size:9px">G5 | slovo<br>Význam (CZ): …<br>Definice (CZ): …<br>KJV překlady (CZ): …<br>Původ: …<br>Specialista: …</code><br>\n          Pole se <b>doplní</b> — stávající data se nepřepíšou.\n        </div>\n      </div>\n\n      <!-- EXPORT -->\n      <div class="rsec" id="rs-export">\n        <div class="rshdr">Exportní možnosti</div>\n        <div class="ec"><div class="ec-t">📄 Celý slovník</div><p>Všechny záznamy včetně vlastních polí.</p><div class="er"><button class="bs" onclick="exportAll()">💾 Exportovat vše</button></div></div>\n        <div class="ec"><div class="ec-t">🔤 Podle jazyka</div><p>Řecká a hebrejská sekce do oddělených souborů.</p><div class="er"><button class="bs" onclick="exportLang(\'G\')">G Řečtina</button><button class="bs" onclick="exportLang(\'H\')">H Hebrejština</button></div></div>\n        <div class="ec">\n          <div class="ec-t">✂️ Rozdělit na N souborů</div>\n          <p>Rovnoměrně rozdělí záznamy do N souborů.</p>\n          <div class="er"><label>Počet:</label><input type="number" id="expN" value="10" min="2" max="200"><button class="bg" onclick="exportSplitN()">✂️ Rozdělit</button></div>\n        </div>\n        <div class="ec">\n          <div class="ec-t">🔢 Max. záznamů na soubor</div>\n          <p>Každý soubor max. N záznamů.</p>\n          <div class="er"><label>Záznamů:</label><input type="number" id="expSz" value="1000" min="10" max="50000"><button class="bg" onclick="exportSplitSz()">✂️ Rozdělit</button></div>\n        </div>\n        <div class="ec"><div class="ec-t">⭐ Jen vlastní pole</div><p>Záznamy s přidanými vlastními daty.</p><div class="er"><button class="bg" onclick="exportCustom()">💾 Exportovat</button></div></div>\n        <div class="ec"><div class="ec-t">🔍 Aktuální filtr</div><p>Výsledky aktuálního hledání.</p><div class="er"><button class="bs" onclick="exportFiltered()">💾 Exportovat výběr</button></div></div>\n      </div>\n\n      <!-- STATS -->\n      <div class="rsec" id="rs-stats">\n        <div class="rshdr">Přehled dat</div>\n        <div class="sg" id="sg"></div>\n        <div id="sd" style="margin-top:8px"></div>\n      </div>\n\n      <!-- POLE -->\n      <div class="rsec" id="rs-fields">\n        <div class="rshdr">Pokrytí polí</div>\n        <div style="font-size:10px;color:var(--text3);margin-bottom:8px;line-height:1.5">\n          Kliknutím na pole spustíš filtr. Přidej vlastní pole pro sledování doplnění.\n        </div>\n        <div id="fieldcov-list"></div>\n        <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">\n          <div class="rshdr" style="margin-bottom:8px">Sledovaná vlastní pole</div>\n          <div style="font-size:10px;color:var(--text3);margin-bottom:6px;line-height:1.5">\n            Přidej název vlastního pole které chceš sledovat — uvidíš kolik záznamů ho má.\n          </div>\n          <div style="display:flex;gap:5px;margin-bottom:8px">\n            <input type="text" id="newTrackField" placeholder="Název pole…" style="flex:1;font-size:11px">\n            <button class="bg" onclick="addTrackedField()">＋</button>\n          </div>\n          <div id="tracked-list"></div>\n        </div>\n      </div>\n\n    </div>\n  </div>\n</div>\n</div>';

// ── JS (scopovaný) ───────────────────────────────────────
function SM_INIT() {

'use strict';
// Bezpečnostní guard — některá prostředí nemají console
if (typeof console === 'undefined') window.console = { log:function(){}, warn:function(){}, error:function(){} };
['log','warn','error','info'].forEach(m => { if (typeof console[m] !== 'function') console[m] = console.log || function(){}; });
// ═══════════════════════ STATE ═══════════════════════
const S = {
  entries: new Map(),   // id → entry
  custom:  new Map(),   // id → { name: value }
  files:   [],          // { name, size, count, ids[] }
  filtered:[],
  sel:     null,
  lang:    'all',
  search:  '',
  field:   'all',
  sort:    'id',
  special: 'all',   // speciální filtr
  _customFieldFilter: '', // pro no_custom_field filtr
  _ek:     null,        // editing field key
};
const IH = 63; // item height px
let vlTop = 0;

// ═══════════════════════ UTILS ═══════════════════════
const Q  = id => (document.getElementById('sm-overlay') || document).querySelector('#' + id);
const esc = s => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';

function toast(msg, type='tin', dur=3200) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  Q('toasts').appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .25s'; setTimeout(()=>el.remove(),270); }, dur);
}
function showOv(t,s='',p=0) { Q('ov').classList.remove('h'); Q('ov-t').textContent=t; Q('ov-s').textContent=s; Q('ov-pf').style.width=p+'%'; }
function hideOv() { Q('ov').classList.add('h'); }
function oModal(id) { Q(id).classList.remove('h'); }
function cModal(id) { Q(id).classList.add('h'); }
['mAdd','mEdit','mMerge'].forEach(id => Q(id).addEventListener('click', e => { if(e.target.id===id) cModal(id); }));

// ═══════════════════════ PARSER ═══════════════════════
function parseFile(rawText, fname) {
  const text = rawText.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  const blocks = text.split(/\n(?=[GH]\d+\s*\|)/);
  const out = [];

  for (const block of blocks) {
    const t = block.trim();
    if (!t) continue;
    const nl = t.indexOf('\n');
    const fl = nl < 0 ? t : t.slice(0, nl);
    const m  = fl.match(/^([GH]\d+)\s*\|\s*(.*)$/);
    if (!m) continue;

    const id   = m[1].trim();
    const lang = id[0];
    const word = m[2].trim();

    const e = { id, lang, word, src: fname||'',
      beta:'', prepis:'', tvaroslovi:'', definice:'', kjv:'', cz:'',
      vokalizace:'', vyslovnost:'', twot:'', poznamky:'', vyznam:'', kategorie:'', grefs:'',
      preklad:'', vysvetleni:'', etymol:'',
      extra:{} };

    const lines = t.split('\n').slice(1);
    let i = 0;
    while (i < lines.length) {
      const ln = lines[i];
      if (!ln.trim()) { i++; continue; }
      const ci = ln.indexOf(':');
      if (ci < 0) { i++; continue; }
      const rk = ln.slice(0, ci).trim();
      let   val= ln.slice(ci+1).trim();
      // gather indented continuations
      while (i+1 < lines.length && /^\s{2}/.test(lines[i+1])) { i++; val += '\n' + lines[i].trimEnd(); }
      // normalize key
      const k = rk.toLowerCase().replace(/\s+/g,' ')
        .replace(/[áčďéěíňóřšťúůýž]/g, c => ({á:'a',č:'c',ď:'d',é:'e',ě:'e',í:'i',ň:'n',ó:'o',ř:'r',š:'s',ť:'t',ú:'u',ů:'u',ý:'y',ž:'z'})[c]||c);
      switch(k) {
        case 'beta':          e.beta       = val; break;
        case 'prepis':        e.prepis     = val; break;
        case 'tvaroslovi':    e.tvaroslovi = val; break;
        case 'definice':      e.definice   = val; break;
        case 'kjv vyznam':
        case 'kjv vyznamy':
        case 'kjv_vyznam':    e.kjv        = val; break;
        case 'cz':            e.cz         = val; break;
        case 'vokalizace':    e.vokalizace = val; break;
        case 'vyslovnost':    e.vyslovnost = val; break;
        case 'twot':          e.twot       = val; break;
        case 'poznamky': {
          const subLines = val.split('\n');
          const leftover = [];
          for (const sl of subLines) {
            const trimSl = sl.trim();
            if (!trimSl) continue;
            const sci = trimSl.indexOf(':');
            if (sci > 0) {
              const sk = trimSl.slice(0, sci).trim().toLowerCase()
                .replace(/\s+/g,' ')
                .replace(/[áčďéěíňóřšťúůýž]/g, c => ({á:'a',č:'c',ď:'d',é:'e',ě:'e',í:'i',ň:'n',ó:'o',ř:'r',š:'s',ť:'t',ú:'u',ů:'u',ý:'y',ž:'z'})[c]||c);
              const sv = trimSl.slice(sci + 1).trim();
              if (sk === 'preklad')    { e.preklad    = sv; continue; }
              if (sk === 'vysvetleni') { e.vysvetleni = sv; continue; }
              if (sk === 'etymol')     { e.etymol     = sv; continue; }
            }
            leftover.push(trimSl);
          }
          if (leftover.length) e.poznamky = leftover.join('\n');
          break;
        }
        case 'vyznam':
        case 'vyznam_cz':     e.vyznam     = val; break;
        case 'kategorie':     e.kategorie  = val; break;
        case 'recke refs':    e.grefs      = val; break;
        case 'preklad':       e.preklad    = val; break;
        case 'vysvetleni':    e.vysvetleni = val; break;
        case 'etymol':        e.etymol     = val; break;
        default:
          if (rk.length < 40 && rk.length > 0) e.extra[rk] = val;
      }
      i++;
    }
    out.push(e);
  }
  return out;
}

// ═══════════════════════ IMPORT ═══════════════════════
async function importFiles(ev, isAdd) {
  const files = Array.from(ev.target.files);
  ev.target.value = '';
  if (!files.length) return;
  if (!isAdd) { S.entries.clear(); S.custom.clear(); S.files=[]; S.sel=null; }
  for (let fi=0; fi<files.length; fi++) {
    showOv(`Načítám: ${files[fi].name}`, `${fi+1}/${files.length}`, Math.round(fi/files.length*85));
    await new Promise(r=>setTimeout(r,20));
    await readFileInto(files[fi]);
  }
  hideOv(); rebuild(); renderList(); updHdr(); updFiles(); updStats();
  rebuildAllFields(); updLangCounts();
  toast(`${files.length} soubor(ů) načten — celkem ${S.entries.size.toLocaleString('cs')} záznamů`, 'tok');
}

function readFileInto(f) {
  return new Promise((res) => {
    // Diagnostika — zobraz info o souboru
    console.log('Načítám soubor:', f.name, 'velikost:', f.size, 'B, typ:', f.type);
    if (f.size === 0) {
      toast(`Soubor "${f.name}" je prázdný (0 B)`, 'ter', 6000);
      res(); return;
    }
    const r = new FileReader();
    r.onload = ev => {
      try {
        const raw = ev.target.result;
        console.log('Přečteno znaků:', raw.length, '| Začátek:', JSON.stringify(raw.slice(0,80)));
        if (!raw || raw.length < 10) {
          toast(`Soubor "${f.name}" nelze přečíst (prázdný obsah)`, 'ter', 6000);
          res(); return;
        }
        const entries = parseFile(raw, f.name);
        console.log('Parsováno záznamů:', entries.length);
        if (entries.length === 0) {
          toast(`Soubor "${f.name}" — žádné záznamy nenalezeny. Zkontroluj formát (očekává se G1 | slovo nebo H1 | slovo).`, 'ter', 8000);
          res(); return;
        }
        const ids = [];
        for (const e of entries) {
          if (!S.entries.has(e.id)) S.entries.set(e.id, e);
          else {
            const ex = S.entries.get(e.id);
            ex.src = ex.src ? ex.src + ', ' + e.src : e.src;
          }
          ids.push(e.id);
        }
        S.files.push({ name:f.name, size:f.size, count:entries.length, ids });
        res();
      } catch(err) {
        console.log('Chyba parsování:', err);
        toast(`Chyba parsování "${f.name}": ${err.message}`, 'ter', 6000);
        res();
      }
    };
    r.onerror = (ev) => {
      console.log('FileReader chyba:', ev);
      toast(`Nelze číst soubor "${f.name}" — zkus jiný prohlížeč nebo přejmenuj soubor (bez diakritiky)`, 'ter', 7000);
      res();
    };
    r.onabort = () => {
      toast(`Čtení souboru "${f.name}" bylo přerušeno`, 'ter', 5000);
      res();
    };
    r.readAsText(f, 'UTF-8');
  });
}

// Drag&drop
function dzOv(e) { e.preventDefault(); Q('dropzone').classList.add('over'); }
function dzLv()  { Q('dropzone').classList.remove('over'); }
async function dzDr(e) {
  e.preventDefault(); dzLv();
  const files = Array.from(e.dataTransfer.files).filter(f=>/\.(txt|tsv|csv)$/i.test(f.name));
  if (!files.length) { toast('Přetáhni .txt soubor slovníku', 'ter'); return; }
  for (const f of files) { showOv(`Načítám: ${f.name}`,'',0); await new Promise(r=>setTimeout(r,20)); await readFileInto(f); }
  hideOv(); rebuild(); renderList(); updHdr(); updFiles(); updStats();
  rebuildAllFields(); updLangCounts();
  toast(`${files.length} soubor(ů) přidán — celkem ${S.entries.size.toLocaleString('cs')} záznamů`, 'tok');
}

// Drag&drop na celou stránku (záloha pokud uživatel netrefí dropzone)
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', async e => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files).filter(f => /\.(txt|tsv|csv|json)$/i.test(f.name));
  if (!files.length) return;
  const txts  = files.filter(f => /\.(txt|tsv|csv)$/i.test(f.name));
  const jsons = files.filter(f => /\.json$/i.test(f.name));
  if (jsons.length) {
    // JSON záloha
    const fj = jsons[0];
    showOv('Načítám JSON zálohu…', fj.name, 10);
    const r = new FileReader();
    r.onload = async ev2 => {
      try {
        const ts = deserializeState(ev2.target.result);
        hideOv();
        rebuild(); renderList(); updHdr(); updFiles(); updStats(); rebuildAllFields(); updLangCounts();
        toast(`JSON záloha načtena — ${S.entries.size.toLocaleString('cs')} záznamů`, 'tok');
      } catch(err) { hideOv(); toast('Chyba JSON: ' + err.message, 'ter', 6000); }
    };
    r.onerror = () => { hideOv(); toast('Nelze číst JSON soubor', 'ter'); };
    r.readAsText(fj, 'UTF-8');
  }
  if (txts.length) {
    for (const f of txts) { showOv(`Načítám: ${f.name}`,'',0); await new Promise(r=>setTimeout(r,20)); await readFileInto(f); }
    hideOv(); rebuild(); renderList(); updHdr(); updFiles(); updStats(); rebuildAllFields(); updLangCounts();
    toast(`${txts.length} soubor(ů) načten — ${S.entries.size.toLocaleString('cs')} záznamů`, 'tok');
  }
});

// ═══════════════════════ MERGE ═══════════════════════
function oMergeModal() {
  let dupes=0;
  const seen = new Map();
  S.files.forEach(f=>f.ids.forEach(id=>seen.set(id,(seen.get(id)||0)+1)));
  seen.forEach(c=>{ if(c>1) dupes++; });
  Q('mMT').textContent = `${S.files.length} souborů, ${S.entries.size.toLocaleString('cs')} unikátních ID, ${dupes} konfliktů (duplicitní ID).`;
  oModal('mMerge');
}
function doMerge() {
  cModal('mMerge');
  toast(`Sloučeno: ${S.entries.size.toLocaleString('cs')} záznamů`, 'tok');
  rebuild(); renderList(); updHdr(); updFiles(); updStats();
  rebuildAllFields(); updLangCounts();
}

// ═══════════════════════ SEARCH ═══════════════════════
function doSearch() {
  S.search  = Q('qS').value.trim().toLowerCase();
  S.lang    = Q('qL').value;
  S.field   = Q('qF').value;
  S.sort    = Q('qO').value;
  S.special = Q('qX').value;
  rebuild(); renderList(); updHdr();
}
function sideSearch(v) { Q('qS').value=v; doSearch(); }
function toggleGDrop(ev) {
  ev.stopPropagation();
  Q('lt-G-drop').classList.toggle('h');
}
document.addEventListener('click', () => { const d=Q('lt-G-drop'); if(d) d.classList.add('h'); });

function setLang(l) {
  S.lang = l;
  // Toolbar select — G1/G6 mapujeme na G
  Q('qL').value = (l==='G1'||l==='G6') ? 'G' : l;
  // Tab highlighting
  ['all','G','H'].forEach(x => {
    const el = Q('lt-'+x); if (!el) return;
    const active = (l==='all'&&x==='all') || ((l==='G'||l==='G1'||l==='G6')&&x==='G') || (l==='H'&&x==='H');
    el.className = 'ltab' + (active ? ' a-'+x : '');
  });
  // Dropdown items
  ['G','G1','G6'].forEach(x => Q('ldi-'+x)?.classList.toggle('active', l===x));
  Q('lt-G-drop').classList.add('h');
  rebuild(); renderList(); updHdr();
}

function clearQ() {
  Q('qS').value=''; Q('sQ').value=''; Q('qL').value='all'; Q('qF').value='all';
  Q('qO').value='id'; Q('qX').value='all';
  S.search=''; S.lang='all'; S.field='all'; S.sort='id'; S.special='all';
  setLang('all');
}

function updLangCounts() {
  let cG=0, cG1=0, cG6=0;
  for (const id of S.entries.keys()) {
    if (!id.startsWith('G')) continue;
    const n = parseInt(id.slice(1));
    cG++;
    if (n >= 1 && n <= 5624) cG1++; else cG6++;
  }
  const set = (id, v) => { const el=Q(id); if(el) el.textContent=v?v.toLocaleString('cs'):''; };
  set('cnt-G', cG); set('cnt-G1', cG1); set('cnt-G6', cG6);
}

function matches(e, term, field) {
  if (!term) return true;
  const cf = S.custom.get(e.id);
  const cv = cf ? Object.values(cf).join(' ').toLowerCase() : '';
  const pool = {
    id: e.id.toLowerCase(), word:(e.word||'').toLowerCase(), prepis:(e.prepis||'').toLowerCase(),
    definice:(e.definice||'').toLowerCase(), cz:(e.cz||'').toLowerCase(), kjv:(e.kjv||'').toLowerCase(),
    custom: cv,
    all: [e.id,e.word,e.prepis,e.definice,e.cz,e.kjv,cv].join(' ').toLowerCase()
  };
  return (pool[field]||pool.all).includes(term);
}

// ═══════════════════════ DETEKCE ŠPATNÉHO PŘEKLADU ═══════════════════════
// Porovná Definice_CZ (nebo extra['Definice_CZ']) s originálem (definice).
// Pokud je word-overlap >= 0.35, překlad pravděpodobně neproběhl.
function stripForCompare(text) {
  if (!text) return '';
  return text
    .replace(/\[[^\]]*\]/g, ' ')   // odstraň [biblické ref]
    .replace(/\([^)]*\)/g, ' ')    // odstraň (citace, zkratky)
    .replace(/[^a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ\s]/g, ' ');
}

function wordSet(text) {
  return new Set(stripForCompare(text).toLowerCase().split(/\s+/).filter(w => w.length >= 4));
}

function isBadTranslation(entry) {
  // Pokud uživatel označil jako OK → přeskočit
  const cf = S.custom.get(entry.id);
  if (cf && cf['Překlad_OK']) return false;

  // Vezmi českou definici z Definice_CZ (extra) nebo Cz nebo Vyznam
  const czDef = (entry.extra && entry.extra['Definice_CZ']) || entry.cz || entry.vyznam || '';
  const enDef = entry.definice || '';

  if (!czDef || !enDef) return false;

  // Pokud obsahuje POZN. anotaci → explicitně označeno jako špatné
  if (czDef.includes('[POZN.:') || czDef.includes('text je v angličtině')) return true;

  // Word-overlap analýza
  const czWords = wordSet(czDef);
  const enWords = wordSet(enDef);
  if (enWords.size === 0) return false;

  const shared = new Set([...czWords].filter(w => enWords.has(w)));
  const overlap = shared.size / enWords.size;
  return overlap >= 0.35;
}

function rebuild() {
  let ids=[];
  for (const [id,e] of S.entries) {
    // ── Jazykový filtr ──
    const lang = S.lang;
    if (lang === 'G1') {
      if (e.lang !== 'G') continue;
      if (parseInt(id.slice(1)) > 5624) continue;
    } else if (lang === 'G6') {
      if (e.lang !== 'G') continue;
      if (parseInt(id.slice(1)) <= 5624) continue;
    } else if (lang !== 'all') {
      if (e.lang !== lang) continue;
    }

    // ── Speciální filtr ──
    const sp = S.special;
    if (sp !== 'all') {
      const hasCz     = !!(e.cz || e.vyznam);
      const hasCf     = S.custom.has(id) && Object.keys(S.custom.get(id)).length > 0;
      if (sp === 'no_cz'            && hasCz)           continue;
      if (sp === 'has_cz'           && !hasCz)          continue;
      if (sp === 'has_custom'       && !hasCf)          continue;
      if (sp === 'no_custom'        && hasCf)           continue;
      if (sp === 'no_cz_has_custom' && (hasCz || !hasCf)) continue;
      if (sp === 'no_kjv'           && e.kjv)           continue;
      if (sp === 'no_def'           && e.definice)      continue;
      if (sp === 'bad_translation'  && !isBadTranslation(e)) continue;
      if (sp === 'no_custom_field') {
        const cf = S.custom.get(id);
        const fn = S._customFieldFilter;
        const has = cf && cf[fn] !== undefined && String(cf[fn]).trim();
        if (has) continue; // má pole → přeskoč
      }
    }

    // ── Textové hledání ──
    if (S.search && !matches(e,S.search,S.field)) continue;
    ids.push(id);
  }

  const { sort } = S;
  if (sort==='id') {
    ids.sort((a,b)=>{ if(a[0]!==b[0]) return a[0]<b[0]?-1:1; return parseInt(a.slice(1))-parseInt(b.slice(1)); });
  } else if (sort==='word') {
    ids.sort((a,b)=>((S.entries.get(a)?.prepis||'').localeCompare(S.entries.get(b)?.prepis||'','cs')));
  } else {
    ids.sort((a,b)=>((S.entries.get(a)?.cz||'').localeCompare(S.entries.get(b)?.cz||'','cs')));
  }
  S.filtered=ids;

  // Aktualizuj počítadlo + info o speciálním filtru
  const sp = S.special;
  const spLabel = sp === 'all' ? '' : ` · ${Q('qX').options[Q('qX').selectedIndex]?.text || ''}`;
  Q('lcnt').textContent = ids.length.toLocaleString('cs') + ' záznamů' + spLabel;

  // Progress bar překladu
  updCzProgress(ids);
}

function updCzProgress(ids) {
  const prog = Q('czprog');
  if (!ids || ids.length === 0) { prog?.classList.add('h'); return; }

  let hasCz = 0;
  for (const id of ids) {
    const e = S.entries.get(id);
    if (e && (e.cz || e.vyznam)) hasCz++;
  }
  const pct = Math.round(hasCz / ids.length * 100);
  const missing = ids.length - hasCz;

  prog?.classList.remove('h');
  const bar = Q('czprog-bar');
  const pctEl = Q('czprog-pct');
  const det = Q('czprog-detail');
  if (bar)   bar.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  if (det)   det.textContent = missing > 0
    ? `${hasCz.toLocaleString('cs')} má Cz · ${missing.toLocaleString('cs')} chybí`
    : `✓ Všechny záznamy mají Cz`;

  // Barva baru podle pokrytí
  if (bar) {
    bar.style.background = pct >= 90 ? 'var(--green)' : pct >= 50 ? 'var(--accent)' : 'var(--gold)';
  }
}

// ═══════════════════════ VIRTUAL LIST ═══════════════════════
function onLS() { vlTop=Math.floor(Q('lscroll').scrollTop/IH); renderVL(); }
function renderList() { Q('vsp').style.height=(S.filtered.length*IH)+'px'; vlTop=0; Q('lscroll').scrollTop=0; renderVL(); }

function renderVL() {
  const sc=Q('lscroll');
  const vis=Math.ceil(sc.clientHeight/IH)+6;
  const start=Math.max(0,vlTop-2), end=Math.min(S.filtered.length,start+vis);
  Q('vit').style.top=(start*IH)+'px';
  let html='';
  for (let i=start;i<end;i++) {
    const id=S.filtered[i]; const e=S.entries.get(id); if(!e) continue;
    const sel=id===S.sel;
    const cust=S.custom.has(id)&&Object.keys(S.custom.get(id)).length>0;
    const cz=e.cz?(e.cz.length>46?e.cz.slice(0,46)+'…':e.cz):'';
    const xsel = X.sel.has(id);
    html+=`<div class="litem${sel?' sel':''}${cust?' cust':''}${xsel?' xsel':''}" style="height:${IH}px" onclick="litemClick('${esc(id)}')">
      <button class="xadd-btn" onclick="xToggle(event,'${esc(id)}')" title="Přidat/odebrat z výběru">${xsel?'✓':'+'}</button>
      <span class="lid ${e.lang}">${esc(id)}</span>
      <div class="lbody">
        <div class="lword">${esc(e.word)}</div>
        <div class="ltrans">${esc(e.prepis)}</div>
        <div class="lcz">${esc(cz)}</div>
      </div>
    </div>`;
  }
  Q('vit').innerHTML=html;
}

function scrollToSel() {
  const idx=S.filtered.indexOf(S.sel); if(idx<0) return;
  const sc=Q('lscroll');
  const top=idx*IH, bot=top+IH;
  if(top<sc.scrollTop) sc.scrollTop=top-20;
  else if(bot>sc.scrollTop+sc.clientHeight) sc.scrollTop=bot-sc.clientHeight+20;
  vlTop=Math.floor(sc.scrollTop/IH); renderVL();
}

// ═══════════════════════ DETAIL VIEW ═══════════════════════
function selEntry(id) { S.sel=id; scrollToSel(); showDetail(id); }

function showDetail(id) {
  const e=S.entries.get(id); if(!e) return;
  Q('emptyState').classList.add('h');
  const dw=Q('dw'); dw.classList.remove('h'); dw.style.display='flex';
  Q('dW').textContent=e.word||'—';
  const b=Q('dB'); b.textContent=id; b.className='det-badge '+e.lang;
  Q('dT').textContent=e.prepis||'';
  Q('dG').textContent=e.tvaroslovi||'';

  let html='';

  // Extraction mode: field checkboxes
  if (X.on) {
    const allOn  = ALL_FIELDS.every(([k]) => X.fields.has(k));
    const anyOn  = ALL_FIELDS.some(([k])  => X.fields.has(k));
    const inSel  = X.sel.has(e.id);
    html+=`<div class="xfields-bar">
      <div class="xfields-title">✂️ Vyber pole pro export:</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:7px;border-bottom:1px solid #2a4020">
        <div class="xchk${allOn?' on':anyOn?' part':''}" id="xchkAll" onclick="xFieldsAll(this)" title="Vybrat / zrušit všechna pole">
          <span>${allOn?'☑ Vše':anyOn?'⊟ Vše':'☐ Vše'}</span>
        </div>
        <span style="font-size:10px;color:var(--text3)">${X.fields.size} / ${ALL_FIELDS.length} polí vybráno</span>
        <span style="margin-left:auto;font-size:10px;color:var(--text3)">Pole platí pro celý export</span>
      </div>
      <div class="xfields-grid">
        ${ALL_FIELDS.map(([k,l])=>`<div class="xchk${X.fields.has(k)?' on':''}" onclick="xToggleField('${k}',this)"><span>${l}</span></div>`).join('')}
      </div>
      <div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button class="bs" onclick="xAddEntry('${esc(e.id)}')">${inSel?'☑ V&nbsp;výběru — odebrat':'☐ Přidat do výběru'}</button>
        <button onclick="xSelAll()" style="font-size:11px">☑ Vybrat vše z filtru (${S.filtered.length})</button>
        <span style="font-size:10px;color:var(--text3);margin-left:4px">Celkem vybráno: <b style="color:var(--green)">${X.sel.size}</b> záznamů</span>
      </div>
    </div>`;
  }

  // Czech — top priority
  const czTxt=[e.cz,e.vyznam].filter(Boolean).join('\n');

  // Definice_CZ z extra (přidaná mergeTranslation)
  const defCZ = e.extra && e.extra['Definice_CZ'];
  const kjvCZ = e.extra && e.extra['KJV_CZ'];
  const puvod = e.extra && e.extra['Původ'];
  const spec   = e.extra && e.extra['Specialista'];

  // Detekce špatného překladu
  const badTrans = isBadTranslation(e);
  if (badTrans) {
    html+=`<div style="background:#2a1010;border:1px solid var(--red);border-radius:5px;padding:9px 12px;margin-bottom:10px;display:flex;gap:10px;align-items:flex-start">
      <span style="font-size:16px;flex-shrink:0">⚠️</span>
      <div style="flex:1">
        <div style="font-size:11px;font-weight:600;color:var(--red);margin-bottom:3px">Podezřelý překlad — definice zřejmě zůstala v angličtině</div>
        <div style="font-size:10px;color:var(--text2);line-height:1.5">Český text je příliš podobný anglickému originálu. Zkontroluj a případně oprav v vlastních polích.</div>
        <div style="margin-top:6px;display:flex;gap:6px">
          <button class="bs" onclick="markTranslationOK('${esc(id)}')" style="font-size:10px;padding:2px 8px">✓ Označit jako OK</button>
          <button onclick="openTranslationEdit('${esc(id)}')" style="font-size:10px;padding:2px 8px">✏️ Opravit překlad</button>
        </div>
      </div>
    </div>`;
  }

  if(czTxt) html+=fb('🇨🇿 České znění',czTxt,'cz');
  if(defCZ) html+=fb('🇨🇿 Definice CZ',defCZ,'cz');

  if(e.definice) html+=fb('📖 Definice (EN)',e.definice,'sm');
  if(e.kjv)      html+=fb('📜 KJV překlady (EN)',e.kjv,'kjv');
  if(kjvCZ)      html+=fb('📜 KJV překlady (CZ)',kjvCZ,'kjv');
  if(puvod)      html+=fb('🌱 Původ',puvod,'sm');
  if(spec)       html+=fb('🔬 Specialista',spec,'sm');
  if(e.kategorie) html+=fb('🏷️ Kategorie',e.kategorie,'sm');

  // Technical grid
  const tech=[];
  if(e.beta)       tech.push(['BETA kód',e.beta,'mn']);
  if(e.vokalizace) tech.push(['Vokalizace',e.vokalizace,'mn']);
  if(e.vyslovnost) tech.push(['Výslovnost',e.vyslovnost,'mn']);
  if(e.prepis)     tech.push(['Přepis',e.prepis,'mn']);
  if(e.tvaroslovi) tech.push(['Tvarosloví',e.tvaroslovi,'mn']);
  if(e.twot)       tech.push(['TWOT ref.',e.twot,'mn']);
  if(e.grefs)      tech.push(['Řecké ref.',e.grefs,'sm']);
  if(e.preklad)    tech.push(['Překlad',e.preklad,'sm']);
  if(e.vysvetleni) tech.push(['Vysvětlení',e.vysvetleni,'sm']);
  if(e.etymol)     tech.push(['Etymol',e.etymol,'sm']);
  if(e.src)        tech.push(['Zdroj',e.src,'mn']);
  if(tech.length) {
    html+='<div class="fgrid">';
    tech.forEach(([l,v,c])=>html+=fb(l,v,c));
    html+='</div>';
  }

  if(e.poznamky) html+=fb('📝 Poznámky',e.poznamky,'sm');

  for(const [k,v] of Object.entries(e.extra||{})) if(v&&v.length<1000) html+=fb(k,v,'sm');

  html+=`<div class="cshdr">
    <div class="cstitle">⭐ Vlastní pole</div>
    <button class="bg" onclick="oModal('mAdd')">＋ Přidat pole</button>
  </div><div id="cflist"></div>`;

  Q('detBody').innerHTML=html;
  renderCF(id);
  smUpdateInsertBtn();
}

function fb(label,val,cls='') {
  return `<div class="fb"><div class="fl">${esc(label)}</div><div class="fv ${esc(cls)}">${esc(val)}</div></div>`;
}

// ═══════════════════════ CUSTOM FIELDS ═══════════════════════
// ── Oprava špatného překladu ─────────────────────────────
function markTranslationOK(id) {
  // Přidá custom pole 'Překlad_OK: 1' které přehlasuje detekci
  if (!S.custom.has(id)) S.custom.set(id, {});
  S.custom.get(id)['Překlad_OK'] = '1';
  dbSaveCustom();
  showDetail(id); renderVL();
  toast(`Záznam ${id} označen jako přeložený`, 'tok');
}

function openTranslationEdit(id) {
  const e = S.entries.get(id); if (!e) return;
  // Předvyplň modal překladu s anglickým textem jako vodítkem
  Q('mAN').value = 'Definice_CZ';
  Q('mAV').value = e.extra?.['Definice_CZ'] || '';
  Q('mAV').placeholder = 'Vlož správný český překlad…';
  oModal('mAdd');
  setTimeout(() => { Q('mAV').focus(); Q('mAV').select(); }, 100);
}

function renderCF(id) {
  const el=Q('cflist'); if(!el) return;
  const cf=S.custom.get(id)||{};
  const keys=Object.keys(cf);
  if(!keys.length) { el.innerHTML='<div class="nocf">Žádná vlastní pole — klikni „＋ Přidat pole".</div>'; return; }
  el.innerHTML=keys.map(k=>`
    <div class="cfield">
      <div class="cfname">${esc(k)}</div>
      <div class="cfval">${esc(cf[k])}</div>
      <div class="cfbtns">
        <button class="bi" onclick="oEditField('${esc(id)}','${esc(k)}')" title="Upravit">✏️</button>
        <button class="bi" onclick="delField('${esc(id)}','${esc(k)}')" title="Smazat">🗑️</button>
      </div>
    </div>`).join('');
}

function doAddField() {
  const name=Q('mAN').value.trim(), val=Q('mAV').value.trim();
  if(!name||!val) { toast('Vyplň název i obsah','ter'); return; }
  const id=S.sel; if(!S.custom.has(id)) S.custom.set(id,{});
  S.custom.get(id)[name]=val;
  cModal('mAdd'); Q('mAN').value=''; Q('mAV').value='';
  renderCF(id); updHdr(); renderVL(); dbSaveCustom();
  toast(`Pole „${name}" přidáno`,'tok');
}

function oEditField(id,key) {
  S._ek={id,key};
  const cf=S.custom.get(id)||{};
  Q('mEN').value=key; Q('mEV').value=cf[key]||'';
  oModal('mEdit');
  setTimeout(()=>Q('mEV').focus(),80);
}
function doEditField() {
  const {id,key}=S._ek||{}; if(!id) return;
  const nn=Q('mEN').value.trim(), nv=Q('mEV').value.trim();
  if(!nn||!nv) { toast('Vyplň název i obsah','ter'); return; }
  const cf=S.custom.get(id)||{};
  if(nn!==key) delete cf[key];
  cf[nn]=nv; S.custom.set(id,cf);
  cModal('mEdit'); S._ek=null; renderCF(id); dbSaveCustom();
  toast('Pole aktualizováno','tok');
}
function delField(id,key) {
  if(!confirm(`Smazat pole „${key}"?`)) return;
  const cf=S.custom.get(id);
  if(cf) { delete cf[key]; if(!Object.keys(cf).length) S.custom.delete(id); }
  renderCF(id); updHdr(); renderVL(); dbSaveCustom();
  toast(`Pole „${key}" smazáno`,'tin');
}

// ═══════════════════════ KEYBOARD ═══════════════════════
function navP() { const i=S.filtered.indexOf(S.sel); if(i>0) selEntry(S.filtered[i-1]); }
function navN() { const i=S.filtered.indexOf(S.sel); if(i<S.filtered.length-1) selEntry(S.filtered[i+1]); }
document.addEventListener('keydown', e=>{
  const tag=document.activeElement?.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') {
    if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)) {
      if(!Q('mAdd').classList.contains('h')) doAddField();
      if(!Q('mEdit').classList.contains('h')) doEditField();
    }
    return;
  }
  if(e.key==='ArrowDown') { e.preventDefault(); navN(); }
  if(e.key==='ArrowUp')   { e.preventDefault(); navP(); }
  if(e.key==='Escape')    clearQ();
  if(e.key==='f'&&(e.ctrlKey||e.metaKey)) { e.preventDefault(); Q('qS').focus(); }
});

// ═══════════════════════ EXPORT ═══════════════════════
function e2txt(e) {
  const L=[];
  const a=(k,v)=>{ if(v) L.push(`${k}: ${v}`); };
  L.push(`${e.id} | ${e.word}`);
  a('BETA',e.beta); a('Vokalizace',e.vokalizace); a('Vyslovnost',e.vyslovnost);
  a('Prepis',e.prepis); a('Tvaroslovi',e.tvaroslovi); a('Definice',e.definice);
  a('TWOT',e.twot); a('Kategorie',e.kategorie);
  if(e.poznamky) L.push('Poznámky:\n'+e.poznamky);
  a('Překlad',e.preklad); a('Vysvětlení',e.vysvetleni); a('Etymol',e.etymol);
  a('Vyznam_Cz',e.vyznam); a('KJV Vyznam',e.kjv); a('Recke refs',e.grefs); a('Cz',e.cz);
  for(const [k,v] of Object.entries(e.extra||{})) if(v) a(k,v);
  const cf=S.custom.get(e.id);
  if(cf) for(const [k,v] of Object.entries(cf)) a(k,v);
  return L.join('\n');
}
function ids2blob(ids) {
  return new Blob([ids.map(id=>{ const e=S.entries.get(id); return e?e2txt(e):''; }).filter(Boolean).join('\n\n')], {type:'text/plain;charset=utf-8'});
}
function dl(blob,name) {
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}
function sortedIds() {
  return [...S.entries.keys()].sort((a,b)=>{ if(a[0]!==b[0]) return a[0]<b[0]?-1:1; return parseInt(a.slice(1))-parseInt(b.slice(1)); });
}
function exportAll() {
  if(!S.entries.size){toast('Žádná data','ter');return;}
  dl(ids2blob(sortedIds()),'strongs_kompletni.txt');
  toast(`Exportováno ${S.entries.size.toLocaleString('cs')} záznamů`,'tok');
}
function exportLang(lang) {
  const ids=sortedIds().filter(id=>S.entries.get(id)?.lang===lang);
  if(!ids.length){toast(`Žádné ${lang} záznamy`,'ter');return;}
  dl(ids2blob(ids),`strongs_${lang==='G'?'recky':'hebresky'}.txt`);
  toast(`Exportováno ${ids.length.toLocaleString('cs')} (${lang})`,'tok');
}
function exportFiltered() {
  if(!S.filtered.length){toast('Prázdný filtr','ter');return;}
  dl(ids2blob(S.filtered),'strongs_vybер.txt');
  toast(`Exportováno ${S.filtered.length.toLocaleString('cs')} záznamů`,'tok');
}

function mergeAndExport() {
  if (!S.entries.size) { toast('Žádná data ke spojení', 'ter'); return; }
  if (S.files.length < 2) {
    // Jen jeden soubor — stáhni ho rovnou
    exportAll();
    return;
  }
  // Sestav název z načtených souborů
  const names = S.files.map(f => f.name.replace(/\.[^.]+$/, '')).join('+');
  const safeName = names.length > 60 ? names.slice(0, 60) + '…' : names;
  const ids = [...S.entries.keys()].sort((a,b) => {
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
    return parseInt(a.slice(1)) - parseInt(b.slice(1));
  });
  showOv('Spojuji soubory…', `${S.files.length} souborů → ${ids.length.toLocaleString('cs')} záznamů`, 30);
  setTimeout(() => {
    const blob = ids2blob(ids);
    hideOv();
    dl(blob, `strongs_spojeny_${new Date().toISOString().slice(0,10)}.txt`);
    toast(`Spojeno ${S.files.length} souborů → ${ids.length.toLocaleString('cs')} záznamů`, 'tok');
  }, 50);
}
function exportCustom() {
  const ids=[...S.custom.keys()].filter(id=>Object.keys(S.custom.get(id)||{}).length>0&&S.entries.has(id));
  if(!ids.length){toast('Žádné záznamy s vlastními poli','ter');return;}
  dl(ids2blob(ids),'strongs_vlastni.txt');
  toast(`Exportováno ${ids.length} záznamů`,'tok');
}
function exportSplitN() {
  const n=Math.max(2,parseInt(Q('expN').value)||10);
  const all=sortedIds(); if(!all.length){toast('Žádná data','ter');return;}
  const sz=Math.ceil(all.length/n), pad=String(n).length;
  for(let i=0;i<n;i++) { const ch=all.slice(i*sz,(i+1)*sz); if(!ch.length) break; dl(ids2blob(ch),`strongs_cast_${String(i+1).padStart(pad,'0')}z${n}.txt`); }
  toast(`Rozděleno do ${n} souborů`,'tok');
}
function exportSplitSz() {
  const sz=Math.max(10,parseInt(Q('expSz').value)||1000);
  const all=sortedIds(); if(!all.length){toast('Žádná data','ter');return;}
  const parts=Math.ceil(all.length/sz);
  for(let i=0;i<parts;i++) { const ch=all.slice(i*sz,(i+1)*sz); dl(ids2blob(ch),`strongs_${ch[0]}-${ch[ch.length-1]}.txt`); }
  toast(`Rozděleno do ${parts} souborů`,'tok');
}
function exportFileE(idx) {
  const f=S.files[idx]; if(!f) return;
  const ids=f.ids.filter(id=>S.entries.has(id));
  dl(ids2blob(ids),f.name.replace(/\.[^.]+$/,'')+'_export.txt');
  toast(`Exportováno ${ids.length.toLocaleString('cs')} záznamů ze „${f.name}"`,'tok');
}

// ═══════════════════════ STORAGE ═══════════════════════
// Strategie:
//   file://  → IndexedDB není spolehlivé, localStorage blokováno Chrome
//              → Jediné spolehlivé: JSON soubor na disku (export/import)
//              → Při 💿 Uložit se automaticky stáhne JSON záloha
//   http(s):// → IndexedDB (bez limitu, automatická obnova při startu)
//   📦 Export/Import JSON funguje vždy v obou módech

const IS_FILE = location.protocol === 'file:';

// ── IndexedDB (pro http/https) ─────────────────────────────
const DB_NAME    = 'strongs_manager';
const DB_VERSION = 1;
const ST_ENTRIES = 'entries';
const ST_META    = 'meta';
let _db = null;

function dbOpen() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = ev => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(ST_ENTRIES))
        db.createObjectStore(ST_ENTRIES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(ST_META))
        db.createObjectStore(ST_META);
    };
    req.onsuccess = ev => { _db = ev.target.result; res(_db); };
    req.onerror   = ev => rej(ev.target.error);
  });
}

// ── Serializace ────────────────────────────────────────────
function serializeState() {
  return JSON.stringify({
    v: 4,
    entries: [...S.entries.entries()],
    custom:  [...S.custom.entries()],
    files:   S.files,
    ts:      new Date().toISOString(),
  });
}

function deserializeState(json) {
  const d = JSON.parse(json);
  S.entries = new Map(d.entries || []);
  S.custom  = new Map(d.custom  || []);
  S.files   = d.files || [];
  S.sel     = null;
  return d.ts || '?';
}

// ── SAVE ──────────────────────────────────────────────────
async function saveLS() {
  if (IS_FILE) {
    // file://: browser storage nedostupný → automaticky stáhni JSON zálohu
    exportJSON();
    toast('file:// režim — data uložena jako JSON soubor na disk. Při příštím otevření použij 📦 Import JSON.', 'tin', 7000);
  } else {
    await saveIDB();
  }
}

async function saveIDB() {
  showOv('Ukládám do IndexedDB…', 'Záznamy…', 5);
  try {
    const db = await dbOpen();
    await new Promise((res, rej) => {
      const tx = db.transaction(ST_ENTRIES, 'readwrite');
      const st = tx.objectStore(ST_ENTRIES);
      st.clear();
      for (const e of S.entries.values()) st.put(e);
      tx.oncomplete = () => res();
      tx.onerror    = ev => rej(ev.target.error);
      tx.onabort    = ev => rej(ev.target.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction(ST_META, 'readwrite');
      const st = tx.objectStore(ST_META);
      st.put([...S.custom.entries()], 'custom');
      st.put(S.files,                  'files');
      st.put(new Date().toISOString(), 'ts');
      tx.oncomplete = () => res();
      tx.onerror    = ev => rej(ev.target.error);
    });
    hideOv();
    toast(`Uloženo do IndexedDB — ${S.entries.size.toLocaleString('cs')} záznamů`, 'tok');
  } catch(err) {
    hideOv();
    toast('Chyba ukládání: ' + err.message, 'ter', 6000);
  }
}

// ── LOAD ──────────────────────────────────────────────────
async function loadLS() {
  if (IS_FILE) {
    // file://: navigator ke JSON souboru
    toast('file:// režim — použij 📦 Import JSON pro načtení zálohy', 'tin', 5000);
    triggerImportJSON();
  } else {
    await loadIDB();
  }
}

async function loadIDB() {
  showOv('Načítám z IndexedDB…', 'Záznamy…', 5);
  try {
    const db = await dbOpen();
    const count = await new Promise(res => {
      const r = db.transaction(ST_ENTRIES,'readonly').objectStore(ST_ENTRIES).count();
      r.onsuccess = () => res(r.result); r.onerror = () => res(0);
    });
    if (!count) {
      hideOv();
      toast('IndexedDB prázdná — načti .txt soubor nebo importuj JSON zálohu', 'ter', 5000);
      return;
    }
    const entries = await new Promise((res, rej) => {
      const r = db.transaction(ST_ENTRIES,'readonly').objectStore(ST_ENTRIES).getAll();
      r.onsuccess = () => res(r.result); r.onerror = ev => rej(ev.target.error);
    });
    showOv('Načítám…', 'Meta…', 85);
    const meta = await new Promise(res => {
      const tx = db.transaction(ST_META,'readonly'), st = tx.objectStore(ST_META), out = {};
      const keys = ['custom','files','ts']; let n = keys.length;
      keys.forEach(k => {
        const r = st.get(k);
        r.onsuccess = () => { out[k]=r.result; if(--n===0) res(out); };
        r.onerror   = () => { if(--n===0) res(out); };
      });
    });
    S.entries = new Map(entries.map(e=>[e.id,e]));
    S.custom  = new Map(meta.custom||[]);
    S.files   = meta.files||[];
    S.sel     = null;
    hideOv();
    rebuild(); renderList(); updHdr(); updFiles(); updStats(); rebuildAllFields(); updLangCounts();
    toast(`Načteno z IndexedDB — ${S.entries.size.toLocaleString('cs')} záznamů (${(meta.ts||'').slice(0,10)})`, 'tok');
  } catch(err) {
    hideOv(); toast('Chyba IndexedDB: ' + err.message, 'ter', 6000);
  }
}

// ── dbSaveCustom — po změně vlastních polí (jen IDB) ──────
async function dbSaveCustom() {
  if (IS_FILE) return; // file://: uložení jen přes JSON export
  try {
    const db = await dbOpen();
    await new Promise((res, rej) => {
      const tx = db.transaction(ST_META, 'readwrite');
      tx.objectStore(ST_META).put([...S.custom.entries()], 'custom');
      tx.oncomplete = () => res();
      tx.onerror    = ev => rej(ev.target.error);
    });
  } catch(err) { console.log('dbSaveCustom:', err); }
}

// ── dbClear ───────────────────────────────────────────────
async function dbClear() {
  if (IS_FILE) return;
  try {
    const db = await dbOpen();
    await new Promise((res,rej) => {
      const tx = db.transaction([ST_ENTRIES, ST_META], 'readwrite');
      tx.objectStore(ST_ENTRIES).clear();
      tx.objectStore(ST_META).clear();
      tx.oncomplete = () => res();
      tx.onerror    = ev => rej(ev.target.error);
    });
  } catch(err) { console.log('dbClear:', err); }
}

// ── JSON export/import záloha ──────────────────────────────
function exportJSON() {
  if (!S.entries.size) { toast('Žádná data k exportu', 'ter'); return; }
  showOv('Exportuji JSON zálohu…', 'Serializace…', 20);
  setTimeout(() => {
    try {
      const json = serializeState();
      hideOv();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      dl(blob, `strongs_zaloha_${new Date().toISOString().slice(0,10)}.json`);
      toast(`JSON záloha stažena — ${S.entries.size.toLocaleString('cs')} záznamů, ${(json.length/1024/1024).toFixed(1)} MB`, 'tok');
    } catch(err) { hideOv(); toast('Chyba exportu: ' + err.message, 'ter', 5000); }
  }, 50);
}

function triggerImportJSON() { Q('fiJSON').click(); }

function importJSON(ev) {
  const f = ev.target.files[0]; ev.target.value = '';
  if (!f) return;
  showOv('Načítám JSON zálohu…', f.name, 10);
  const r = new FileReader();
  r.onload = async ev2 => {
    try {
      showOv('Načítám…', 'Deserializace…', 60);
      await new Promise(r => setTimeout(r, 20));
      const ts = deserializeState(ev2.target.result);
      hideOv();
      rebuild(); renderList(); updHdr(); updFiles(); updStats(); rebuildAllFields(); updLangCounts();
      toast(`JSON záloha načtena — ${S.entries.size.toLocaleString('cs')} záznamů (${ts.slice(0,10)})`, 'tok');
    } catch(err) {
      hideOv(); toast('Chyba JSON: ' + err.message, 'ter', 6000);
    }
  };
  r.onerror = () => { hideOv(); toast('Nelze číst soubor', 'ter'); };
  r.readAsText(f, 'UTF-8');
}

// ── MERGE PŘEKLADU ────────────────────────────────────────
// Podporovaný formát:
//   G1 | slovo
//   Význam (CZ): ...
//   Definice (CZ): ...
//   KJV překlady (CZ): ...
//   Původ: ...
//   Specialista: ...
//   [prázdný řádek]
//
// Pole se mapují na:
//   Vyznam_Cz, Definice_CZ, KJV_CZ, Původ, Specialista
// Stávající pole se nepřepisují — nová se doplní.

function importTranslation(ev) {
  const f = ev.target.files[0]; ev.target.value = '';
  if (!f) return;

  if (!S.entries.size) {
    toast('Nejprve načti hlavní slovník (.txt), pak teprve překlad', 'ter', 5000);
    return;
  }

  showOv('Načítám překladový soubor…', f.name, 5);
  const r = new FileReader();
  r.onload = async ev2 => {
    try {
      showOv('Parsuju překlad…', '', 20);
      await new Promise(r => setTimeout(r, 20));
      const raw = ev2.target.result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const result = mergeTranslation(raw);
      hideOv();

      // Refresh UI
      rebuild(); renderList(); updHdr(); updFiles(); updStats();
      rebuildAllFields(); updLangCounts();
      if (Q('rs-fields')?.classList.contains('active')) updFieldCoverage();

      toast(
        `Překlad sloučen — obohaceno ${result.merged.toLocaleString('cs')} záznamů z ${result.total.toLocaleString('cs')}\n` +
        `Přidána pole: ${result.addedFields.join(', ')}`,
        'tok', 6000
      );
    } catch(err) {
      hideOv();
      toast('Chyba mergu: ' + err.message, 'ter', 7000);
      console.log('Merge error:', err);
    }
  };
  r.onerror = () => { hideOv(); toast('Nelze číst soubor', 'ter'); };
  r.readAsText(f, 'UTF-8');
}

function mergeTranslation(txt) {
  // Detekuj formát — oddělení bloků prázdným řádkem
  const blocks = txt.split(/\n\n+/);

  // Mapování klíčů překladu → interní klíče entry objektu
  // Hodnota: [interní_klíč, export_label]
  // null interní klíč = přidat jako extra pole s daným labelem
  const KEY_MAP = {
    'vyznam (cz)':        ['vyznam',     null],
    'definice (cz)':      [null,         'Definice_CZ'],
    'kjv překlady (cz)':  [null,         'KJV_CZ'],
    'kjv preklady (cz)':  [null,         'KJV_CZ'],
    'původ':              [null,         'Původ'],
    'puvod':              [null,         'Původ'],
    'specialista':        [null,         'Specialista'],
    'vyznam_cz':          ['vyznam',     null],
    'definice_cz':        [null,         'Definice_CZ'],
    'kjv_cz':             [null,         'KJV_CZ'],
  };

  // Diacritics normalize pro klíče
  const dmap = {á:'a',č:'c',ď:'d',é:'e',ě:'e',í:'i',ň:'n',ó:'o',ř:'r',š:'s',ť:'t',ú:'u',ů:'u',ý:'y',ž:'z'};
  const normKey = k => k.toLowerCase().replace(/[áčďéěíňóřšťúůýž]/g, c => dmap[c]||c).replace(/\s+/g,' ').trim();

  let total = 0, merged = 0;
  const addedFieldSet = new Set();

  for (const block of blocks) {
    const t = block.trim();
    if (!t) continue;

    const lines = t.split('\n');
    const firstLine = lines[0];
    const idMatch = firstLine.match(/^([GH]\d+)\s*\|/);
    if (!idMatch) continue;

    const id = idMatch[1];
    const entry = S.entries.get(id);
    if (!entry) continue; // ID není v načteném slovníku

    total++;
    let entryMerged = false;

    for (let i = 1; i < lines.length; i++) {
      const ln = lines[i];
      const ci = ln.indexOf(':');
      if (ci <= 0) continue;

      const rawKey = ln.slice(0, ci).trim();
      const val    = ln.slice(ci + 1).trim();
      if (!val || val === '—') continue;

      // Přeskoč poznámky o špatném překladu
      if (val.includes('[POZN.:')) continue;

      const nk = normKey(rawKey);
      const mapping = KEY_MAP[nk];

      if (mapping) {
        const [internalKey, exportLabel] = mapping;

        if (internalKey) {
          // Mapuje na pojmenované pole entry objektu
          if (!entry[internalKey]) {
            entry[internalKey] = val;
            addedFieldSet.add(internalKey);
            entryMerged = true;
          }
        } else if (exportLabel) {
          // Přidat jako extra pole
          if (!entry.extra) entry.extra = {};
          if (!entry.extra[exportLabel]) {
            entry.extra[exportLabel] = val;
            addedFieldSet.add(exportLabel);
            entryMerged = true;
          }
        }
      }
      // Neznámé klíče ignorujeme — nepřidáváme šum
    }

    if (entryMerged) merged++;
  }

  return {
    total,
    merged,
    addedFields: [...addedFieldSet],
  };
}

function clearAll() {
  if(!confirm('Vymazat vše z paměti' + (IS_FILE ? '?' : ' a z IndexedDB?'))) return;
  S.entries.clear(); S.custom.clear(); S.files=[]; S.sel=null; S.filtered=[];
  Q('emptyState').classList.remove('h'); Q('dw').style.display='none';
  rebuild(); renderList(); updHdr(); updFiles(); updStats();
  if (!IS_FILE) dbClear();
  toast('Paměť vymazána', 'tin');
}

// ═══════════════════════ FILE UI ═══════════════════════
function removeFile(idx) {
  const f=S.files[idx]; if(!f||!confirm(`Odebrat „${f.name}"?`)) return;
  const otherIds=new Set(S.files.filter((_,i)=>i!==idx).flatMap(ff=>ff.ids));
  f.ids.forEach(id=>{ if(!otherIds.has(id)) S.entries.delete(id); });
  S.files.splice(idx,1);
  rebuild(); renderList(); updHdr(); updFiles(); updStats();
  rebuildAllFields(); updLangCounts();
  toast(`Soubor „${f.name}" odebrán`,'tin');
}
function updFiles() {
  const list=Q('flist'), btn=Q('btnMrg');
  if(!S.files.length){list.innerHTML='';btn.classList.add('h');return;}
  btn.classList.toggle('h',S.files.length<2);
  list.innerHTML=S.files.map((f,i)=>`
    <div class="fitem" style="margin-top:6px">
      <div class="fitem-ico">📄</div>
      <div class="fitem-inf">
        <div class="fitem-n" title="${esc(f.name)}">${esc(f.name)}</div>
        <div class="fitem-m">${f.count.toLocaleString('cs')} zázn. · ${Math.round(f.size/1024)} KB</div>
      </div>
      <div class="fitem-b">
        <button class="bi" onclick="exportFileE(${i})" title="Exportovat">💾</button>
        <button class="bi" onclick="removeFile(${i})" title="Odebrat">✕</button>
      </div>
    </div>`).join('');
}

// ═══════════════════════ HEADER & STATS ═══════════════════════
function updHdr() {
  let gk=0,hb=0;
  for(const e of S.entries.values()){if(e.lang==='G')gk++;else hb++;}
  const cust=[...S.custom.values()].filter(cf=>Object.keys(cf).length>0).length;
  Q('hG').textContent=gk.toLocaleString('cs'); Q('hH').textContent=hb.toLocaleString('cs');
  Q('hT').textContent=S.entries.size.toLocaleString('cs'); Q('hC').textContent=cust; Q('hF').textContent=S.files.length;
  updLangCounts();
}
function updStats() {
  let gk=0,hb=0,wc=0;
  for(const e of S.entries.values()){if(e.lang==='G')gk++;else hb++;if(e.cz||e.vyznam)wc++;}
  const cust=[...S.custom.values()].filter(cf=>Object.keys(cf).length>0).length;
  const tcf=[...S.custom.values()].reduce((s,cf)=>s+Object.keys(cf).length,0);
  const pct=S.entries.size?Math.round(wc/S.entries.size*100):0;
  Q('sg').innerHTML=[
    ['Celkem',S.entries.size.toLocaleString('cs')],['Řecky G',gk.toLocaleString('cs')],
    ['Hebrejsky H',hb.toLocaleString('cs')],['S česky',wc.toLocaleString('cs')],
    ['Záznamy+vl.pole',cust],['Vl. polí',tcf],
  ].map(([l,v])=>`<div class="sc"><div class="sc-v">${v}</div><div class="sc-l">${l}</div></div>`).join('');
  Q('sd').innerHTML=`<div style="font-size:10px;color:var(--text3);margin-bottom:4px">Pokrytí češtinou: ${pct}%</div>
    <div class="pb"><div class="pf" style="width:${pct}%"></div></div>
    <div style="margin-top:10px;font-size:10px;color:var(--text3)">Soubory:</div>
    ${S.files.map(f=>`<div style="font-size:10px;color:var(--text2);padding:2px 0">· ${esc(f.name)} (${f.count.toLocaleString('cs')} zázn.)</div>`).join('')}
    ${!S.files.length?'<div style="font-size:10px;color:var(--text3);font-style:italic">Žádné načtené soubory</div>':''}`;
}
function showRT(tab) {
  ['files','export','stats','fields'].forEach(t=>{ Q('rs-'+t)?.classList.remove('active'); Q('rt-'+t)?.classList.remove('active'); });
  Q('rs-'+tab)?.classList.add('active'); Q('rt-'+tab)?.classList.add('active');
  if (tab==='stats')  updStats();
  if (tab==='fields') updFieldCoverage();
}

// ═══════════════════════ FIELD COVERAGE PANEL ═══════════════════════

// Pojmenovaná pole — klíč v entry objektu → display label + filter key
const FIELD_DEFS = [
  { key:'cz',         label:'Cz (česky)',       filter:'no_cz',  langs:'GH' },
  { key:'vyznam',     label:'Vyznam_Cz',         filter:null,     langs:'H'  },
  { key:'definice',   label:'Definice',           filter:'no_def', langs:'GH' },
  { key:'kjv',        label:'KJV překlady',       filter:'no_kjv', langs:'GH' },
  { key:'preklad',    label:'Překlad (H)',        filter:null,     langs:'H'  },
  { key:'vysvetleni', label:'Vysvětlení (H)',     filter:null,     langs:'H'  },
  { key:'etymol',     label:'Etymol (H)',         filter:null,     langs:'H'  },
  { key:'prepis',     label:'Přepis',             filter:null,     langs:'GH' },
  { key:'tvaroslovi', label:'Tvarosloví',         filter:null,     langs:'GH' },
  { key:'beta',       label:'BETA kód (G)',       filter:null,     langs:'G'  },
  { key:'vokalizace', label:'Vokalizace (H)',     filter:null,     langs:'H'  },
  { key:'vyslovnost', label:'Výslovnost (H)',     filter:null,     langs:'H'  },
  { key:'twot',       label:'TWOT (H)',           filter:null,     langs:'H'  },
  { key:'grefs',      label:'Řecké reference',   filter:null,     langs:'H'  },
  { key:'poznamky',   label:'Poznámky',           filter:null,     langs:'GH' },
];

// Sledovaná vlastní pole uložená v paměti (+ IndexedDB přes meta)
let trackedFields = [];  // pole stringů — názvy vlastních polí ke sledování

function updFieldCoverage() {
  if (!S.entries.size) {
    Q('fieldcov-list').innerHTML = '<div style="font-size:11px;color:var(--text3);font-style:italic">Žádná data — nejprve načti soubor.</div>';
    renderTrackedFields();
    return;
  }

  // Spočítej pokrytí pro každé pojmenované pole
  const counts = {}; // key → { g: cnt, h: cnt }
  let gTot = 0, hTot = 0;
  for (const [id, e] of S.entries) {
    if (e.lang === 'G') gTot++; else hTot++;
    for (const fd of FIELD_DEFS) {
      if (!counts[fd.key]) counts[fd.key] = { g:0, h:0 };
      const v = e[fd.key];
      if (v && String(v).trim()) {
        if (e.lang === 'G') counts[fd.key].g++;
        else                counts[fd.key].h++;
      }
    }
  }

  // Vyfiltruj pole relevantní pro aktuální jazykový filtr
  const langView = S.lang; // 'all','G','G1','G6','H'
  const showG = langView !== 'H';
  const showH = langView !== 'G' && langView !== 'G1' && langView !== 'G6';

  let html = '';
  for (const fd of FIELD_DEFS) {
    // Přeskoč pole která nedávají smysl pro aktuální jazyk
    if (!showG && fd.langs === 'G')  continue;
    if (!showH && fd.langs === 'H')  continue;

    const c   = counts[fd.key] || { g:0, h:0 };
    let cnt   = 0, tot = 0;
    if (showG && showH) { cnt = c.g + c.h; tot = gTot + hTot; }
    else if (showG)     { cnt = c.g; tot = gTot; }
    else                { cnt = c.h; tot = hTot; }

    if (tot === 0) continue;
    const pct     = Math.round(cnt / tot * 100);
    const missing = tot - cnt;
    const pctCls  = pct === 100 ? 'full' : pct >= 70 ? 'high' : pct >= 20 ? 'low' : 'zero';
    const fillClr = pct === 100 ? 'var(--green)' : pct >= 70 ? 'var(--accent)' : pct >= 20 ? 'var(--gold)' : 'var(--red)';

    // Filtr tlačítko jen pro pole s filtrem a s chybějícími záznamy
    const filterBtn = (fd.filter && missing > 0)
      ? `<button class="fcov-filter-btn" onclick="applyFieldFilter('${fd.filter}')" title="Filtrovat záznamy bez tohoto pole">filtrovat</button>`
      : '';

    html += `<div class="fcov-item" onclick="applyFieldFilter('${fd.filter||''}','${fd.key}')">
      <div class="fcov-row">
        <span class="fcov-name">${esc(fd.label)}</span>
        <span class="fcov-pct ${pctCls}">${pct}%</span>
      </div>
      <div class="fcov-bar"><div class="fcov-fill" style="width:${pct}%;background:${fillClr}"></div></div>
      <div class="fcov-detail">
        <span>${cnt.toLocaleString('cs')} / ${tot.toLocaleString('cs')}</span>
        ${missing > 0 ? `<span style="color:var(--red)">chybí ${missing.toLocaleString('cs')}</span>` : '<span style="color:var(--green)">✓ kompletní</span>'}
        ${filterBtn}
      </div>
    </div>`;
  }

  Q('fieldcov-list').innerHTML = html || '<div style="font-size:11px;color:var(--text3)">Žádná pole k zobrazení.</div>';
  renderTrackedFields();
}

function applyFieldFilter(filterKey, fieldKey) {
  if (!filterKey) return; // pole bez filtru (klik nic nedělá)
  Q('qX').value = filterKey;
  S.special = filterKey;
  rebuild(); renderList(); updHdr();
  showRT('files'); // přepni zpět na soubory aby byl seznam vidět
  toast(`Filtr: ${Q('qX').options[Q('qX').selectedIndex]?.text || filterKey}`, 'tin', 2500);
}

// ── Sledovaná vlastní pole ────────────────────────────────
function addTrackedField() {
  const name = Q('newTrackField').value.trim();
  if (!name) return;
  if (trackedFields.includes(name)) { toast(`Pole "${name}" už sledujete`, 'ter'); return; }
  trackedFields.push(name);
  Q('newTrackField').value = '';
  renderTrackedFields();
  saveTrackedFields();
  toast(`Pole "${name}" přidáno ke sledování`, 'tok');
}

function removeTrackedField(name) {
  trackedFields = trackedFields.filter(f => f !== name);
  renderTrackedFields();
  saveTrackedFields();
}

function renderTrackedFields() {
  const container = Q('tracked-list');
  if (!container) return;

  if (!trackedFields.length) {
    container.innerHTML = '<div style="font-size:10px;color:var(--text3);font-style:italic">Žádná sledovaná pole.</div>';
    return;
  }

  let html = '';
  const tot = S.entries.size;
  for (const name of trackedFields) {
    let cnt = 0;
    for (const [id] of S.entries) {
      const cf = S.custom.get(id);
      if (cf && cf[name] !== undefined && String(cf[name]).trim()) cnt++;
    }
    const pct = tot ? Math.round(cnt / tot * 100) : 0;
    const pctClr = pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--accent)' : 'var(--gold)';
    const missing = tot - cnt;

    html += `<div class="tracked-item">
      <span class="tracked-name" title="${esc(name)}">${esc(name)}</span>
      <span class="tracked-cnt">${cnt.toLocaleString('cs')} / ${tot.toLocaleString('cs')}</span>
      <span class="tracked-pct" style="color:${pctClr}">${pct}%</span>
      ${missing > 0
        ? `<button class="fcov-filter-btn" onclick="applyCustomFilter('${esc(name)}')" title="Filtrovat záznamy bez tohoto pole" style="margin-left:0">filtr</button>`
        : '<span style="font-size:10px;color:var(--green)">✓</span>'}
      <button class="tracked-del" onclick="removeTrackedField('${esc(name)}')" title="Odebrat ze sledování">✕</button>
    </div>`;
  }
  container.innerHTML = html;
}

function applyCustomFilter(fieldName) {
  // Filtrovat záznamy kde chybí konkrétní vlastní pole
  Q('qX').value = 'has_custom';
  // Přidáme do search pole název
  Q('qS').value = '';
  // Použijeme speciální mini-filtr: záznamy kde custom[fieldName] je prázdné
  S._customFieldFilter = fieldName;
  S.special = 'no_custom_field';
  rebuild(); renderList(); updHdr();
  showRT('files');
  toast(`Filtr: záznamy bez pole "${fieldName}"`, 'tin', 3000);
}

function saveTrackedFields() {
  try { localStorage.setItem('sm_tracked', JSON.stringify(trackedFields)); } catch(_) {}
}
function loadTrackedFields() {
  try {
    const raw = localStorage.getItem('sm_tracked');
    if (raw) trackedFields = JSON.parse(raw);
  } catch(_) {}
}

// ═══════════════════════ RESIZABLE PANELS ═══════════════════════
function startRz(e,rzId,panelId,cssVar,isRight) {
  e.preventDefault();
  const rz=Q(rzId), panel=Q(panelId), sx=e.clientX, sw=panel.offsetWidth;
  rz.classList.add('drag');
  function mv(ev) {
    const delta=isRight?sx-ev.clientX:ev.clientX-sx;
    document.documentElement.style.setProperty(cssVar, Math.max(180,Math.min(620,sw+delta))+'px');
    renderVL();
  }
  function up() { rz.classList.remove('drag'); document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); }
  document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
}

// ═══════════════════════ EXTRACTION MODE ═══════════════════════
// Pevná mapování pojmenovaných polí: interní klíč → label
const NAMED_FIELDS = {
  cz:         '🇨🇿 Česky',
  vyznam:     'Vyznam_Cz',
  definice:   'Definice',
  kjv:        'KJV překlady',
  preklad:    'Překlad',
  vysvetleni: 'Vysvětlení',
  etymol:     'Etymol',
  beta:       'BETA',
  prepis:     'Přepis',
  tvaroslovi: 'Tvarosloví',
  vokalizace: 'Vokalizace',
  vyslovnost: 'Výslovnost',
  twot:       'TWOT',
  kategorie:  'Kategorie',
  grefs:      'Řecké ref.',
  poznamky:   'Poznámky',
  custom:     '⭐ Vlastní pole',
};

// Dynamický seznam polí — sestaví se po importu ze skutečných dat
let ALL_FIELDS = [];  // [ [key, label, isExtra], ... ]

function rebuildAllFields() {
  // 1) Pojmenovaná pole — jen ta která mají alespoň 1 neprázdnou hodnotu
  const named = Object.entries(NAMED_FIELDS).filter(([k]) => {
    if (k === 'custom') return S.custom.size > 0;
    return [...S.entries.values()].some(e => e[k]);
  });

  // 2) Extra pole — sesbírej všechny unikátní klíče z e.extra
  const extraKeys = new Map(); // key → count
  for (const e of S.entries.values()) {
    for (const k of Object.keys(e.extra || {})) {
      if (e.extra[k]) extraKeys.set(k, (extraKeys.get(k) || 0) + 1);
    }
  }
  // Seřaď extra pole podle četnosti (nejčastější nahoře), ignoruj klíče pod 3 výskyty (šum)
  const extraSorted = [...extraKeys.entries()]
    .filter(([,c]) => c >= 3)
    .sort((a,b) => b[1] - a[1])
    .map(([k]) => [k, k, true]); // [key, label, isExtra]

  ALL_FIELDS = [
    ...named.map(([k,l]) => [k, l, false]),
    ...extraSorted,
  ];

  // Smaž z X.fields klíče které už v datech nejsou
  for (const k of [...X.fields]) {
    if (!ALL_FIELDS.some(([fk]) => fk === k)) X.fields.delete(k);
  }
}

const X = {
  on:     false,
  sel:    new Set(),
  fields: new Set(['cz','vyznam','definice','kjv']),
};

function litemClick(id) {
  selEntry(id); // always show detail; in xmode + button handles selection
}

function xModeOn() {
  X.on = true; X.sel.clear();
  Q('xbar').classList.remove('h');
  Q('lscroll').closest('.panel-list').classList.add('xmode');
  updXbar(); renderVL();
  toast('Mód extrakce aktivní — klikej na hesla v levém panelu', 'tin', 4000);
  // If detail is open, re-render to show field checkboxes
  if (S.sel) showDetail(S.sel);
}

function xModeOff() {
  X.on = false; X.sel.clear();
  Q('xbar').classList.add('h');
  Q('lscroll').closest('.panel-list').classList.remove('xmode');
  renderVL();
  if (S.sel) showDetail(S.sel);
  toast('Mód extrakce ukončen', 'tin');
}

function xToggle(ev, id) {
  ev.stopPropagation();
  xToggleDirect(id);
  renderVL();
  if (S.sel === id) showDetail(id);
}

function xToggleDirect(id) {
  if (X.sel.has(id)) X.sel.delete(id); else X.sel.add(id);
  updXbar();
}

function xAddEntry(id) {
  xToggleDirect(id);
  renderVL();
  showDetail(id); // refresh button state
}

function xToggleField(key, el) {
  if (X.fields.has(key)) X.fields.delete(key); else X.fields.add(key);
  el.classList.toggle('on', X.fields.has(key));
  // Refresh the "Vše" button and counter without re-rendering whole detail
  if (S.sel) _refreshXBar();
}

function xFieldsAll(el) {
  const allOn = ALL_FIELDS.every(([k]) => X.fields.has(k));
  if (allOn) {
    // Vše zapnuto → vše vypni
    X.fields.clear();
  } else {
    // Cokoliv jiného → vše zapni
    ALL_FIELDS.forEach(([k]) => X.fields.add(k));
  }
  // Re-render celý detail aby se checkboxy překreslily
  if (S.sel) showDetail(S.sel);
}

function _refreshXBar() {
  // Lightweight refresh — jen přepočítá stavy bez full re-render
  const allOn = ALL_FIELDS.every(([k]) => X.fields.has(k));
  const anyOn = ALL_FIELDS.some(([k])  => X.fields.has(k));
  const btn = document.getElementById('xchkAll');
  if (btn) {
    btn.className = 'xchk' + (allOn?' on':anyOn?' part':'');
    btn.querySelector('span').textContent = allOn?'☑ Vše':anyOn?'⊟ Vše':'☐ Vše';
  }
  // Update counter
  const bars = document.querySelectorAll('.xfields-bar span');
  bars.forEach(s => {
    if (s.textContent.includes('polí vybráno')) {
      s.textContent = `${X.fields.size} / ${ALL_FIELDS.length} polí vybráno`;
    }
  });
}

function xSelAll() {
  S.filtered.forEach(id => X.sel.add(id));
  updXbar(); renderVL();
  if (S.sel) showDetail(S.sel);
  toast(`Vybráno ${X.sel.size.toLocaleString('cs')} záznamů`, 'tin');
}
function xSelNone() {
  X.sel.clear(); updXbar(); renderVL();
  if (S.sel) showDetail(S.sel);
}
function xInvert() {
  S.filtered.forEach(id => { if(X.sel.has(id)) X.sel.delete(id); else X.sel.add(id); });
  updXbar(); renderVL();
  if (S.sel) showDetail(S.sel);
}

function updXbar() {
  Q('xbarCount').textContent = `${X.sel.size.toLocaleString('cs')} záznamů vybráno`;
}

function xExport() {
  if (!X.sel.size) { toast('Žádné záznamy vybrány', 'ter'); return; }
  if (!X.fields.size) { toast('Žádné pole vybráno — zaškrtni aspoň jedno pole v detailu hesla', 'ter', 4000); return; }

  // Mapa: interní klíč → export label (pro pojmenovaná pole)
  const NAMED_EXPORT = {
    cz: 'Cz', vyznam: 'Vyznam_Cz', definice: 'Definice', kjv: 'KJV Vyznam',
    preklad: 'Překlad', vysvetleni: 'Vysvětlení', etymol: 'Etymol',
    beta: 'BETA', prepis: 'Prepis', tvaroslovi: 'Tvaroslovi',
    vokalizace: 'Vokalizace', vyslovnost: 'Vyslovnost', twot: 'TWOT',
    kategorie: 'Kategorie', grefs: 'Recke refs',
    poznamky: 'Poznámky',  // special — multiline
  };

  const ids = [...X.sel].sort((a,b)=>{ if(a[0]!==b[0]) return a[0]<b[0]?-1:1; return parseInt(a.slice(1))-parseInt(b.slice(1)); });
  const lines = [];

  for (const id of ids) {
    const e = S.entries.get(id); if(!e) continue;
    const parts = [`${id} | ${e.word}`];

    for (const [fk,, isExtra] of ALL_FIELDS) {
      if (!X.fields.has(fk)) continue;

      if (fk === 'custom') {
        const cf = S.custom.get(id);
        if (cf) for (const [k,v] of Object.entries(cf)) if(v) parts.push(`${k}: ${v}`);
        continue;
      }

      if (isExtra) {
        // Extra pole — z e.extra
        const v = e.extra?.[fk];
        if (v) parts.push(`${fk}: ${v}`);
      } else {
        // Pojmenované pole
        const exportKey = NAMED_EXPORT[fk] || fk;
        const v = e[fk];
        if (v) {
          if (fk === 'poznamky') parts.push(`Poznámky:\n${v}`);
          else parts.push(`${exportKey}: ${v}`);
        }
      }
    }
    if (parts.length > 1) lines.push(parts.join('\n'));
  }

  const blob = new Blob([lines.join('\n\n')], {type:'text/plain;charset=utf-8'});
  const fieldNames = [...X.fields].slice(0,4).join('-');
  dl(blob, `strongs_extrakce_${ids.length}zaz_${fieldNames}.txt`);
  toast(`Exportováno ${ids.length.toLocaleString('cs')} záznamů, pole: ${[...X.fields].join(', ')}`, 'tok', 5000);
}

// ── Plugin API: vložit do překladače ──────────────────────
function smInsertEntry() {
  if (!S.sel) return;
  const e = S.entries.get(S.sel);
  if (!e) return;
  if (window.SM && window.SM.triggerSelect) {
    window.SM.triggerSelect({
      id:        e.id,
      lang:      e.lang,
      word:      e.word,
      prepis:    e.prepis,
      cz:        e.cz || e.vyznam || '',
      definice:  e.definice || '',
      kjv:       e.kjv || '',
      preklad:   e.preklad || '',
      vysvetleni:e.vysvetleni || '',
      etymol:    e.etymol || '',
      kjvCZ:     (e.extra && e.extra['KJV_CZ']) || '',
      defCZ:     (e.extra && e.extra['Definice_CZ']) || '',
      puvod:     (e.extra && e.extra['Původ']) || '',
      spec:      (e.extra && e.extra['Specialista']) || '',
    });
  }
}

// Ukaž/skryj "← Vložit" tlačítko podle toho zda je callback registrován
function smUpdateInsertBtn() {
  const btn = Q('sm-insert-btn');
  if (btn) btn.style.display = (window.SM && window.SM._selectCallback) ? '' : 'none';
}

// ═══════════════════════ INIT ═══════════════════════
updHdr(); updStats(); loadTrackedFields();
console.log('Strong\'s Manager:', IS_FILE ? 'file:// → záloha přes JSON soubor' : 'http(s):// → IndexedDB');

if (!IS_FILE) {
  // Auto-restore z IndexedDB (jen pro http/https)
  (async () => {
    try {
      const db = await dbOpen();
      const count = await new Promise(res => {
        const r = db.transaction(ST_ENTRIES,'readonly').objectStore(ST_ENTRIES).count();
        r.onsuccess = () => res(r.result); r.onerror = () => res(0);
      });
      if (!count) return;
      showOv('Obnova ze zálohy…', `${count.toLocaleString('cs')} záznamů`, 10);
      const entries = await new Promise((res, rej) => {
        const r = db.transaction(ST_ENTRIES,'readonly').objectStore(ST_ENTRIES).getAll();
        r.onsuccess = () => res(r.result); r.onerror = ev => rej(ev.target.error);
      });
      const meta = await new Promise(res => {
        const tx = db.transaction(ST_META,'readonly'), st = tx.objectStore(ST_META), out = {};
        const keys = ['custom','files','ts']; let n = keys.length;
        keys.forEach(k => {
          const r = st.get(k);
          r.onsuccess = () => { out[k]=r.result; if(--n===0) res(out); };
          r.onerror   = () => { if(--n===0) res(out); };
        });
      });
      S.entries = new Map(entries.map(e=>[e.id,e]));
      S.custom  = new Map(meta.custom||[]);
      S.files   = meta.files||[];
      hideOv();
      rebuild(); renderList(); updHdr(); updFiles(); updStats(); rebuildAllFields(); updLangCounts();
      toast(`Načteno z IndexedDB — ${S.entries.size.toLocaleString('cs')} záznamů (${(meta.ts||'').slice(0,10)})`, 'tin', 4000);
    } catch(err) {
      hideOv();
      console.log('Auto-restore error:', err);
    }
  })();
} else {
  // file:// — žádné auto-restore, zobraz nápovědu
  setTimeout(() => {
    toast('file:// režim: načti .txt slovník nebo importuj 📦 JSON zálohu. Uložení dat = stažení JSON souboru.', 'tin', 7000);
  }, 800);
}

}

})(); // konec IIFE

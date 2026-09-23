/* Crash Composer: one active game for the whole workspace.
   Layout, Math and Sound effects all work on the game chosen here, so switching a tab
   never means picking the same game again. This module also owns the shared studio/catalog
   snapshot, which Sound effects reads: the manifests belong to the game, not to one tab. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
// live: has a web export to run in Layout. math: has a model in math-baseline.json.
const TARGETS=[
 {id:'kit',title:'Shared · UI kit',live:false,math:false},
 {id:'road',title:'Goat Road',live:true,math:true},
 {id:'fish',title:'Fish Master',live:true,math:true},
 {id:'gold',title:'Goat Gold',live:true,math:true},
 {id:'fruits',title:'Explosive Fruits',live:true,math:true},
 {id:'catch',title:'Catch Clash',live:true,math:true},
 {id:'market_stack',title:'Market Stack',live:true,math:false},
 {id:'fuel',title:'Fuel Run',live:true,math:true}
];
// Off, the list keeps the shared kit, the two featured games and whatever is selected.
const FEATURED=['kit','road','fruits'];
const KEYS={target:'crash-composer-target',all:'crash-composer-show-all-games',engine:'crash-composer-engine'};
// The same game exists once per engine. Which engines a game actually has comes from the
// catalog, so a game that has not been ported yet simply never offers the choice.
// PixiJS is the product; the Godot games are frozen and Composer no longer offers them.
const ENGINES=[{id:'pixi',title:'PixiJS'}];
const DEFAULT_ENGINE='pixi';
const select=$('#target'),showAll=$('#show-all-games');
const engineRow=$('#engine-row'),engineSelect=$('#engine');
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const known=id=>TARGETS.some(t=>t.id===id);
const entry=(id)=>TARGETS.find(t=>t.id===(id===undefined?value:id))||TARGETS[0];
const source=(id)=>catalog?.sources.find(s=>s.id===(id===undefined?value:id))||null;
const guards=[];
let value='kit',engine=DEFAULT_ENGINE,workspace='layout',catalog=null;

// Catalog trouble is a setup problem, not something a control can fix: it goes to the console.
function say(text,error){if(error)console.warn('Composer:',text)}

// The address bar carries the whole position, so a reload — or a link to a colleague — reopens it.
function hash(){return Object.fromEntries(new URLSearchParams(location.hash.slice(1)))}
function writeHash(){
 const params=new URLSearchParams({game:value,tab:workspace});
 // Only worth carrying when it is not the default, so ordinary links stay short.
 if(engine!==DEFAULT_ENGINE)params.set('engine',engine);
 history.replaceState(null,'','#'+params);
}
// Engines this game has at all, and whether each has something to run.
function availableEngines(id){
 const found=(source(id)?.engines)||[];
 return ENGINES.filter(e=>found.some(f=>f.id===e.id)).map(e=>({...e,built:!!found.find(f=>f.id===e.id).built}));
}
function engineOptions(){
 const list=availableEngines();
 // One engine is not a choice; the row stays out of the way until a port exists.
 if(!engineRow||!engineSelect)return;
 engineRow.hidden=list.length<2;
 if(!list.length){engineSelect.replaceChildren();return}
 engineSelect.replaceChildren(...list.map(e=>new Option(e.built?e.title:e.title+' · no build',e.id)));
 if(!list.some(e=>e.id===engine))engine=list.find(e=>e.id===DEFAULT_ENGINE)?.id||list[0].id;
 engineSelect.value=engine;
}
function options(){
 select.replaceChildren(...TARGETS.filter(t=>window.ComposerAuth?.canRead(t.id)).filter(t=>showAll.checked||FEATURED.includes(t.id)||t.id===value)
  .map(t=>new Option(workspace==='math'&&!t.math?t.title+' · no model':t.title,t.id)));
 select.value=value;
}

async function request(path,options){
 const response=await fetch(path,Object.assign({cache:'no-store'},options||{}));
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.message||('Request failed ('+response.status+')'));
 return data;
}
async function refresh(){
 catalog=await request('studio/catalog?engine='+encodeURIComponent(engine));
 engineOptions();
 window.dispatchEvent(new CustomEvent('composer-catalog',{detail:catalog}));
 return catalog;
}
// A workspace with unsaved work registers a guard; it returns false to keep the current game or build.
function allowed(reason){return guards.every(guard=>guard(reason)!==false)}
function set(id){
 if(!known(id)||id===value||!window.ComposerAuth?.canRead(id))return false;
 if(!allowed('switch'))return false;
 value=id;store.set(KEYS.target,id);
 options();engineOptions();writeHash();
 window.dispatchEvent(new CustomEvent('composer-target',{detail:id}));
 refresh().catch(error=>say(error.message,true));
 return true;
}
function setEngine(id){
 if(id===engine)return false;
 if(!availableEngines().some(e=>e.id===id))return false;
 if(!allowed('switch'))return false;
 engine=id;store.set(KEYS.engine,id);
 writeHash();
 // Everything downstream — the running build, the sound manifest, the build freshness —
 // belongs to the engine, so the tabs reload against the new one.
 window.dispatchEvent(new CustomEvent('composer-engine',{detail:id}));
 window.dispatchEvent(new CustomEvent('composer-target',{detail:value}));
 refresh().catch(error=>say(error.message,true));
 return true;
}

showAll.checked=store.get(KEYS.all)!=='0';
const opening=hash();
value=known(opening.game)?opening.game:known(store.get(KEYS.target))?store.get(KEYS.target):'kit';
const wantedEngine=opening.engine||store.get(KEYS.engine);
if(ENGINES.some(e=>e.id===wantedEngine))engine=wantedEngine;
options();engineOptions();
select.onchange=()=>{const wanted=select.value;if(!set(wanted))select.value=value};
if(engineSelect)engineSelect.onchange=()=>{const wanted=engineSelect.value;if(!setEngine(wanted))engineSelect.value=engine};
showAll.onchange=()=>{store.set(KEYS.all,showAll.checked?'1':'0');options()};
window.addEventListener('composer-workspace',event=>{workspace=event.detail;$('#workspace-title').textContent=({layout:'Game',look:'Brands',library:'Library',math:'Math',sound:'Sound effects',translates:'Translates'})[workspace]||'Game';options();writeHash()});
window.addEventListener('hashchange',()=>{
 const opened=hash();
 if(opened.game)set(opened.game);
 if(opened.engine)setEngine(opened.engine);
 if(['layout','look','library','math','sound'].includes(opened.tab)&&opened.tab!==workspace)$('#'+opened.tab+'-tab').click();
 writeHash();
});
// Manifests edited outside Composer, and finished builds, appear when the window regains focus.
window.addEventListener('focus',()=>{if(catalog)refresh().catch(()=>{})});

window.ComposerTarget={
 get value(){return value},get catalog(){return catalog},get workspace(){return workspace},
 // The engine the workspace is pointed at. Layout runs its build, Sound effects edits its
 // manifest and the Math snapshots it, so every tab asks for it rather than assuming.
 get engine(){return engine},get engines(){return availableEngines()},
 engineTitle(id){return (ENGINES.find(e=>e.id===(id||engine))||{}).title||id||engine},
 setEngine,
 targets:TARGETS,entry,source,set,refresh,guard(fn){guards.push(fn)}
};

// Restore the workspace only once every tab module has subscribed.
window.addEventListener('DOMContentLoaded',()=>{
 if(['look','library','math','sound'].includes(opening.tab))$('#'+opening.tab+'-tab').click();else writeHash();
 refresh().catch(error=>say(error.message+' — start Composer with tools/preview.py so studio/ routes are available.',true));
});
window.ComposerAuth.ready.then(()=>{const permitted=TARGETS.filter(t=>window.ComposerAuth.canRead(t.id));if(permitted.length&&!window.ComposerAuth.canRead(value))set(permitted[0].id);options()});
})();

/* A game's texts as a spreadsheet: the Excel file Composer hands out and takes back, and the
   UTF-8 CSV it used before, which it still takes back. */
(function(root){
'use strict';
const langs=['en','fr','ht'],headers=['game','preset','key','area','section','source','EN','FR','CR'];
const context=(entry,game)=>({...entry,usage:entry.usageByGame?.[game]||entry.usage,group:entry.groupByGame?.[game]||entry.group,presets:entry.presetsByGame?.[game]||entry.presets,previewWindow:entry.previewWindowByGame?.[game]??entry.previewWindow});
// Goat Road lands every win as the kit's toast ("Cashed out · 2.04×"), never the win window, so
// that window and its "NICE WIN!" are not Goat Road's texts.
const roadWindows=new Set(['','menu','account','rules','topbets','mybets','betDetails','topBetDetails','stake','notice:funds','notice:offline','notice:error','notice:wallet']);
// The games that build their own bet panel: the windows each one has, and the kit's shared texts
// it never shows (crash-game panels, records, the round-history strip), so neither is listed.
const crashOnly=['Your best','Top','Live Wins','See all ›','by','Round history','{value} ONLINE','Cashed out · {value}×','NICE WIN!','Well played!','No wins yet.','Player and records','LVL {value}','RESULT'];
const ownWindows={
 candy_cascade:new Set([...roadWindows].concat(['autoSpin','candyPays'])),
 mopyon_cascades:new Set(['','menu','account','rules','topbets','mybets','betDetails','topBetDetails','notice:wallet','autoSpin','stake','linePays','award','summary']),
 plinko:new Set(['','menu','account','rules','topbets','mybets','betDetails','topBetDetails','stake','plinkoRows'])
};
const ownExcluded={
 candy_cascade:new Set(['Bet panels','Your best','Top','Live Wins','See all ›','Round history','{value} ONLINE','Cashed out · {value}×']),
 mopyon_cascades:new Set([...crashOnly,'← Back to menu','Settings','Menu','Your account']),
 plinko:new Set([...crashOnly,'ONLINE','Reduce motion','Back','Cancel','Collect','Ready','steps','slices','sec','{value} growth','Settings'])
};
const windowAllowed=(game,kind)=>ownWindows[game]?ownWindows[game].has(kind||''):game!=='road'||roadWindows.has(kind||'');
const obsoleteRoadText=new Set(['Normal','Expert','Extreme','Insane','Reduce motion']);
const applicable=(entry,game,preset)=>{
 const scoped=context(entry,game),activePreset=(game==='road'||Object.hasOwn(ownWindows,game))&&preset!=='menu-drawer-v1'?'tabbed-shell-v1':preset;
 return !ownExcluded[game]?.has(entry.source)&&!scoped.excludedPresets?.includes(activePreset)&&windowAllowed(game,entry.previewWindow)&&(game!=='road'||!obsoleteRoadText.has(entry.source))&&!entry.developerOnly&&entry.previewWindow!=='dev'&&(activePreset==='all'||!scoped.presets||scoped.presets.includes(activePreset)||(activePreset==='menu-drawer-v1'&&scoped.presets.includes('tabbed-shell-v1')))&&!scoped.usage?.includes('unused')&&(!entry.games?.length||game==='kit'||entry.games.includes(game));
};
// What the table shows: the game's own text, else the text every game shares, else the catalog's.
const effective=(data,key)=>({...data.catalog.entries[key],...data.shared?.[key],...data.overrides[key]});
// An apostrophe prevents spreadsheet formula execution and is removed on import.
const protect=value=>/^[\s]*[=+\-@]|^[\t\r\n']/.test(value)?"'"+value:value;
const unprotect=value=>value.startsWith("'")&&protect(value.slice(1))===value?value.slice(1):value;
function encode(data,game,preset='all'){
 const rows=[headers,...Object.entries(data.catalog.entries).filter(([,e])=>applicable(e,game,preset)).map(([key,e])=>{e=context(e,game);const v=effective(data,key);return [game,preset,key,e.group==='Scene'?'Scene':'UI',e.group,e.source,...langs.map(l=>v[l]??'')]})];
 return '\ufeff'+rows.map(row=>row.map(v=>'"'+protect(String(v)).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
}
function parse(text){
 if(text.length>2_000_000)throw Error('The CSV is too large (maximum 2 MB).');
 text=text.replace(/^\ufeff/,'');let rows=[],row=[],value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++}else{quoted=false;closed=true}}else value+=c;continue}
  if(c==='"'){if(value||closed)throw Error('Invalid CSV quotes.');quoted=true}
  else if(c===','||c==='\n'||c==='\r'){row.push(unprotect(value));value='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(x=>x!==''))rows.push(row);row=[]}}
  else{if(closed)throw Error('Unexpected text after a quoted CSV cell.');value+=c}
 }
 if(quoted)throw Error('Unclosed quote in CSV.');if(value||row.length||closed){row.push(unprotect(value));rows.push(row)}return rows;
}
function validate(source,value){if(value.length>8000||/[<>]/.test(value))throw Error('Use plain text of at most 8,000 characters.');const vars=s=>(s.match(/\{\w+\}/g)||[]).sort().join('|');if(value&&vars(value)!==vars(source))throw Error('Keep all variables from the source text.');}
function review(text,data,game,preset='all'){
 const rows=parse(text);if(JSON.stringify(rows.shift())!==JSON.stringify(headers))throw Error('Use the downloaded template with its original columns.');
 const seen=new Set(),changes=[];
 for(const [i,row] of rows.entries()){
  if(row.length!==headers.length)throw Error('Wrong number of columns on row '+(i+2)+'.');
  const [id,filePreset,key,area,section,source,...values]=row,raw=data.catalog.entries[key],e=raw&&context(raw,game);
  if(filePreset!==preset)throw Error('This template belongs to another UI preset. Download a template for the current preset.');
  if(id!==game)throw Error('This template belongs to another game. Select that game first.');
  if(!e||!applicable(e,game,preset))throw Error('Unknown text key on row '+(i+2)+'.');
  if(seen.has(key))throw Error('Duplicate key: '+key);seen.add(key);
  if(source!==e.source||section!==e.group||area!==(e.group==='Scene'?'Scene':'UI'))throw Error('Do not change the key, source, area or section columns.');
  change(changes,data,key,source,Object.fromEntries(langs.map((l,j)=>[l,values[j]])),i+2);
 }
 return changes;
}
function change(changes,data,key,source,after,row){
 const before=effective(data,key);
 for(const l of langs)try{validate(source,after[l])}catch(error){throw Error('Row '+row+' ('+(l==='ht'?'CR':l.toUpperCase())+'): '+error.message)}
 if(langs.some(l=>after[l]!==(before[l]??'')))changes.push({key,source,before:Object.fromEntries(langs.map(l=>[l,before[l]??''])),after});
}
// The Excel file: columns are found by their titles, so a translator may reorder or add columns;
// rows may be sorted or filtered, and only the language columns are read back.
const SHEET={en:'English',fr:'Français',ht:'Kreyòl ayisyen',key:'Key',game:'Game',preset:'Preset'};
function reviewSheet(rows,data,game,preset='all'){
 const head=(rows[0]||[]).map(x=>String(x).trim()),at=Object.fromEntries(Object.entries(SHEET).map(([id,title])=>[id,head.indexOf(title)]));
 if(Object.values(at).some(i=>i<0))throw Error('Use the Excel file downloaded from Composer: it needs the columns '+Object.values(SHEET).join(', ')+'.');
 const seen=new Set(),changes=[];
 for(const [i,row] of rows.slice(1).entries()){
  const get=id=>String(row[at[id]]??'');if(!row.some(x=>String(x).trim()))continue;
  const key=get('key').trim(),raw=data.catalog.entries[key],e=raw&&context(raw,game);
  if(get('game')!==game)throw Error('This file belongs to another game. Select that game first.');
  if(get('preset')!==preset)throw Error('This file belongs to another UI preset. Download one for the current preset.');
  if(!e||!applicable(e,game,preset))throw Error('Unknown text key on row '+(i+2)+'.');
  if(seen.has(key))throw Error('Duplicate key: '+key);seen.add(key);
  change(changes,data,key,e.source,Object.fromEntries(langs.map(l=>[l,get(l).replace(/\r\n?/g,'\n')])),i+2);
 }
 if(!seen.size)throw Error('The file has no texts.');
 return changes;
}
root.TranslationTable={encode,parse,review,reviewSheet,SHEET,effective,applicable,context,windowAllowed};
})(globalThis);

/* UTF-8 CSV interchange for a single game's translation catalog. */
(function(root){
'use strict';
const langs=['en','fr','ht'],headers=['game','preset','key','area','section','source','EN','FR','CR'];
const context=(entry,game)=>({...entry,usage:entry.usageByGame?.[game]||entry.usage,group:entry.groupByGame?.[game]||entry.group,presets:entry.presetsByGame?.[game]||entry.presets});
const roadWindows=new Set(['','menu','account','rules','topbets','mybets','betDetails','topBetDetails','win','notice:funds','notice:offline','notice:error']);
const windowAllowed=(game,kind)=>game!=='road'||roadWindows.has(kind||'');
const obsoleteRoadText=new Set(['Normal','Expert','Extreme','Insane','Reduce motion']);
const applicable=(entry,game,preset)=>{
 const scoped=context(entry,game),activePreset=game==='road'&&preset!=='menu-drawer-v1'?'tabbed-shell-v1':preset;
 return !scoped.excludedPresets?.includes(activePreset)&&windowAllowed(game,entry.previewWindow)&&(game!=='road'||!obsoleteRoadText.has(entry.source))&&!entry.developerOnly&&entry.previewWindow!=='dev'&&(activePreset==='all'||!scoped.presets||scoped.presets.includes(activePreset)||(activePreset==='menu-drawer-v1'&&scoped.presets.includes('tabbed-shell-v1')))&&!scoped.usage?.includes('unused')&&(!entry.games?.length||game==='kit'||entry.games.includes(game));
};
const effective=(data,key)=>({...data.catalog.entries[key],...data.overrides[key]});
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
  const before=effective(data,key),after=Object.fromEntries(langs.map((l,j)=>[l,values[j]]));
  for(const l of langs)try{validate(source,after[l])}catch(error){throw Error('Row '+(i+2)+' ('+l.toUpperCase()+'): '+error.message)}
  if(langs.some(l=>after[l]!== (before[l]??'')))changes.push({key,source,before:Object.fromEntries(langs.map(l=>[l,before[l]??''])),after});
 }
 return changes;
}
root.TranslationTable={encode,parse,review,applicable,context,windowAllowed};
})(globalThis);

/* UI library: what the kit actually offers, in the brand and theme you are looking at.
   Type shows every family in the font library as a live specimen at each weight it carries,
   Colour resolves the roles and every token derived from them with their contrast, Scales
   draws the spacing, radius, type, stroke, alpha, elevation and motion steps, and Icons
   shows the shared artwork. Nothing here is a mock: the values come from crash-ui/tokens.js
   and the same catalogue the Brands tab edits. */
(()=>{
'use strict';
const $=s=>document.querySelector(s);
const report=$('#library-report'),panel=$('#library-controls');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nice=k=>k.toLowerCase().replace(/_/g,' ');
const cssName=k=>'--'+k.toLowerCase().replace(/_/g,'-');
const WEIGHT_TITLES={100:'Thin',200:'Extra light',300:'Light',400:'Regular',500:'Medium',600:'Semibold',700:'Bold',800:'Extra bold',900:'Black'};
const SPECIMEN='Balance $1,234.56 · 2.15× · CASH OUT';
let catalog=null,section='typography',query='',brand='default',theme='';

// --- contrast, the same rules the brand editor audits with -------------------------------
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const luminance=hex=>{const [r,g,b]=rgb(hex).map(c=>c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4);return 0.2126*r+0.7152*g+0.0722*b};
const contrast=(a,b)=>{const l1=luminance(a),l2=luminance(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)};
const PAIRS=[['TEXT','SURFACE',4.5,'body text on panels'],['TEXT_MUTED','SURFACE',4.5,'muted text on panels'],['TEXT','SURFACE_RAISED',4.5,'text in modals'],['TEXT','SURFACE_INSET',4.5,'text in the record card'],['ON_BUTTON','BUTTON',4.5,'button labels'],['ON_GO','ACTION_GO',3,'PLAY label'],['ON_CASH','ACTION_CASH',3,'CASH OUT label'],['ON_SUCCESS','SWITCH_ON',4.5,'Auto label when on'],['GOLD','SURFACE_INSET',4.5,'amounts'],['SUCCESS','SURFACE',4.5,'wins'],['DANGER','SURFACE',4.5,'errors'],['CYAN','SURFACE',4.5,'history pills'],['DISABLED','BUTTON_DISABLED',3,'labels on a disabled control'],['BUTTON_DISABLED','SURFACE',1.4,'a disabled control against the panel'],['FOCUS','SURFACE',3,'focus ring'],['BORDER','SURFACE',1.3,'panel outlines']];

// Reading a token means reading it in the brand and theme on show, so the root carries them.
function withLook(fn){
 const root=document.documentElement,hadBrand=root.dataset.brand,hadTheme=root.dataset.theme;
 if(brand==='default')delete root.dataset.brand;else root.dataset.brand=brand;
 if(theme)root.dataset.theme=theme;else delete root.dataset.theme;
 const value=fn(getComputedStyle(root));
 if(hadBrand===undefined)delete root.dataset.brand;else root.dataset.brand=hadBrand;
 if(hadTheme===undefined)delete root.dataset.theme;else root.dataset.theme=hadTheme;
 return value;
}
const readTokens=keys=>withLook(cs=>Object.fromEntries(keys.map(k=>[k,cs.getPropertyValue(cssName(k)).trim()])));

// --- sections -------------------------------------------------------------------------------
const bare=f=>String(f||'').split('/').pop();
const familyOf=file=>{const id=bare(file).replace(/\.[^.]+$/,'').split('-')[0];return catalog.families.find(f=>f.id===id)||catalog.families.find(f=>Object.values(f.files).some(v=>bare(v)===bare(file)))};
let faces=[],faceSeq=0;
// Declaring a face here lets a specimen show exactly the file a brand names, whatever the
// generated tokens happen to carry.
function declare(fam,weight,style){
 const path=fam.files[weight+'|'+style]||fam.files[weight+'|normal']||Object.values(fam.files)[0];
 const name='Lib-'+fam.id+'-'+weight+'-'+style+'-'+(++faceSeq);
 faces.push(`@font-face{font-family:'${name}';src:url('crash-ui/assets/fonts/${path}');font-weight:${weight};font-style:${style}}`);
 return name;
}
function flushFaces(){
 let sheet=document.getElementById('library-faces');
 if(!sheet){sheet=document.createElement('style');sheet.id='library-faces';document.head.append(sheet)}
 sheet.textContent=faces.join('\n');
}
const head=(title,about,aside='')=>`<div class="lib-head"><div><h2>${title}</h2><p>${about}</p></div>${aside}</div>`;
const card=(title,body,sub='')=>`<article class="lib-card">${title?`<h3>${title}</h3>`:''}${sub}${body}</article>`;
const ORIGIN={google:'Google Fonts',kit:'Kit artwork',uploaded:'Uploaded'};
const TYPE_ROLES={12:'Secondary labels · compact mobile tables',14:'Compact tables · navigation · supporting text',16:'Body · settings · controls · compact values',20:'Emphasized values · profile · balance',24:'Panel and dialog headings',32:'Prominent headings · compact win totals',48:'Win totals',64:'Large totals · spacious layouts',72:'Largest totals · spacious layouts'};
function typographySection(){
 faces=[];
 const t=CrashTokens,steps=Object.keys(t).filter(k=>/^TYPE_\d+$/.test(k)&&Number(k.slice(5))===t[k]).map(k=>t[k]).sort((a,b)=>a-b);
 const brandFonts=catalog.brands[brand].fonts;
 const applied={};
 const cards=['body','numbers'].map(role=>{
  const face=brandFonts[role];if(!face)return '';
  const fam=familyOf(face.file);
  if(!fam)return card(role,'<p class="lib-note">'+esc(face.file)+' is not in the library.</p>');
  applied[fam.id]=(applied[fam.id]||[]).concat(role);
  const name=declare(fam,face.weight,face.style||'normal');
  const sample=role==='numbers'?'1 234.56 · 2.15× · 0987':'Balance · CASH OUT · Live wins';
  const rows=steps.map(px=>`<div class="specimen-row"><span class="specimen-weight">${px} px</span><span class="specimen" style="font-family:'${name}';font-size:${px}px">${esc(sample)}</span></div>`).join('');
  return card((role==='body'?'Body':'Numbers')+' · '+esc(fam.title),rows,`<p class="lib-sub">${WEIGHT_TITLES[face.weight]||''} ${face.weight}${face.style==='italic'?' · italic':''} · ${ORIGIN[fam.origin]}</p>`);
 }).join('');

 const inUse={};
 for(const b of Object.values(catalog.brands))for(const [role,face] of Object.entries(b.fonts)){
  const fam=familyOf(face.file);if(fam)(inUse[fam.id]=inUse[fam.id]||[]).push(b.title+' · '+role);
 }
 const families=catalog.families.filter(f=>!query||f.title.toLowerCase().includes(query)||ORIGIN[f.origin].toLowerCase().includes(query));
 const ordered=families.slice().sort((a,b)=>(applied[b.id]?1:0)-(applied[a.id]?1:0));
 const rows=ordered.map(fam=>{
  const weight=applied[fam.id]?brandFonts[applied[fam.id][0]].weight:(fam.weights.includes(500)?500:fam.weights.includes(400)?400:fam.weights[0]);
  const name=declare(fam,fam.weights.includes(weight)?weight:fam.weights[0],'normal');
  const used=inUse[fam.id],here=applied[fam.id];
  const bin=icon('remove');
  const remove=fam.origin==='uploaded'
   ?`<button type="button" class="lib-remove" data-remove="${fam.id}" aria-label="Remove ${esc(fam.title)}"${used?' disabled title="In use by '+esc(used.join(', '))+'"':' title="Remove every weight and format of it"'}>${bin}</button>`
   :'<span class="lib-remove-space" aria-hidden="true"></span>';
  return `<div class="font-row${here?' is-current':''}"><span class="font-name"><b>${esc(fam.title)}</b><small><i class="origin ${fam.origin}">${ORIGIN[fam.origin]}</i> · ${fam.variable?'variable '+fam.range[0]+'–'+fam.range[1]:fam.weights.length+' weight'+(fam.weights.length===1?'':'s')}${fam.italic?' · italic':''}</small></span>
<span class="specimen" style="font-family:'${name}';font-weight:${weight}">${esc(SPECIMEN)}</span>
<span class="specimen-use"><select class="use-select" data-family="${fam.id}" data-weight="${weight}" aria-label="Where ${esc(fam.title)} is used">
<option value=""${here?'':' selected'} disabled hidden>Use as…</option>
<option value="body"${here&&here.length===1&&here[0]==='body'?' selected':''}>Body</option>
<option value="numbers"${here&&here.length===1&&here[0]==='numbers'?' selected':''}>Numbers</option>
<option value="both"${here&&here.length>1?' selected':''}>Body and numbers</option>
</select>${remove}</span></div>`;
 }).join('');
 flushFaces();
 return head('Typography','Choose body and number fonts. The size scale is shared by every brand and both navigation presets.')
+card('UI type scale',`<p class="lib-sub">${steps.map(px=>px+' px').join(' · ')}</p><details><summary>Size roles & responsive rules</summary><table class="lib-table"><thead><tr><th>Size</th><th>Use</th></tr></thead><tbody>${steps.map(px=>`<tr><th scope="row">${px} px</th><td>${TYPE_ROLES[px]||''}</td></tr>`).join('')}</tbody></table><p class="lib-note">Use the same size for the same content in both presets. On smaller screens, switch between scale steps; keep text at least 12 px. All highlighted values in a card group use the same size.</p></details>`)
+card('Font library',`<div class="font-list">${rows||'<p class="lib-note">Nothing matches.</p>'}</div>`,`<p class="lib-sub">Body is every label; numbers is amounts, multipliers and the action totals. Use as body, Use as numbers and Use for both write to ${esc(catalog.brands[brand].title)}. A family a brand holds cannot be removed.</p>`)
+'<details class="asset-management" open><summary>Manage library · add fonts</summary>'+card('Add a font',`<div class="add-font">
 <div class="add-way"><b>From Google Fonts</b><p>Open the family on fonts.google.com and paste the link. Its latin cut and licence land in the kit.</p>
  <div class="add-row"><input id="library-google" type="text" placeholder="https://fonts.google.com/specimen/Inter" autocomplete="off" spellcheck="false"><button id="library-google-add" type="button" class="wb-button">Add</button></div></div>
 <div class="add-way"><b>From files</b><p>A .ttf, .otf, .woff or .woff2 for each weight, or one .zip of the whole family with its licence.</p>
  <div class="add-row"><button id="library-upload" type="button" class="wb-button">Choose files…</button><input id="library-file" type="file" accept=".ttf,.otf,.woff,.woff2,.zip" multiple hidden></div></div>
</div>`)+'</details>'
+card('In use',cards,'<p class="lib-sub">The two faces '+esc(catalog.brands[brand].title)+' is set in, at every step of the type scale.</p>');
}

function colourSection(){
 const roleKeys=catalog.colorRoles.map(r=>r.key);
 const brandRoles={...catalog.brands[brand].roles,...(theme?catalog.brands[brand].themes[theme].roles:{})};
 const tokens=readTokens(Object.keys(window.CrashTokens).filter(k=>typeof CrashTokens[k]==='string'&&CrashTokens[k].startsWith('#')));
 const swatch=(name,value,about)=>`<button class="swatch" type="button" data-copy="${value}" title="Copy ${value}"><i style="background:${value}"></i><span><b>${esc(name)}</b><em>${value}</em>${about?'<small>'+esc(about)+'</small>':''}</span></button>`;
 const roles=catalog.colorRoles.filter(r=>!query||r.title.toLowerCase().includes(query)).map(r=>swatch(r.title,brandRoles[r.key],r.about)).join('');
 // A derived token is never set by hand, so the Library is where it gets explained.
 const about=catalog.derivedTokens||{};
 const derived=Object.entries(tokens).filter(([k,v])=>v&&(!query||nice(k).includes(query)||(about[k]||'').includes(query))).map(([k,v])=>swatch(nice(k),v,about[k])).join('');
 const rows=PAIRS.map(([ink,surface,min,where])=>{
  const a=tokens[ink],b=tokens[surface];if(!a||!b)return '';
  const ratio=contrast(a,b),ok=ratio>=min;
  return `<tr class="${ok?'':'bad'}"><td>${esc(where)}</td><td><i class="chip" style="background:${b};color:${a}">Aa</i></td><td>${ratio.toFixed(1)}:1</td><td>${min}:1</td><td>${ok?'passes':'fails'}</td></tr>`;
 }).join('');
 return head('Colour',esc(catalog.brands[brand].title)+(theme?' · '+esc(catalog.brands[brand].themes[theme].title):'')+'. The dozen roles a brand is described with, everything they derive, and how every pair a player reads holds up against WCAG AA.')
+card('Roles',`<div class="swatches">${roles}</div>`,'<p class="lib-sub">Click a swatch to copy its value.</p>')
+card('Derived tokens',`<div class="swatches">${derived}</div>`,'<p class="lib-sub">Every token the roles above produce, and where a player meets it. None of these is set by hand; Brands · Advanced can override one.</p>')
+card('Contrast',`<table class="lib-table"><thead><tr><th>Where</th><th>Sample</th><th>Ratio</th><th>Needs</th><th></th></tr></thead><tbody>${rows}</tbody></table>`);
}

function scaleBlocks(){
 const t=CrashTokens,pick=re=>Object.keys(t).filter(k=>re.test(k)&&!isNaN(t[k])).sort((a,b)=>t[a]-t[b]);
 const bar=(k,v,style)=>`<div class="scale-row"><span class="scale-name">${esc(nice(k))}</span><span class="scale-draw">${style}</span><span class="scale-value">${v}</span></div>`;
 const space=pick(/^SPACE_\d/).map(k=>bar(k,t[k]+'px',`<i style="width:${t[k]}px;height:var(--space-16);background:var(--inspector-accent)"></i>`)).join('');
 const radius=pick(/^RADIUS_\d/).concat('RADIUS_PILL').map(k=>bar(k,t[k]+'px',`<i style="width:var(--space-48);height:var(--space-32);border-radius:${t[k]}px;background:var(--inspector-surface-hover)"></i>`)).join('');
 const type=pick(/^TYPE_\d/).filter(k=>Number(k.slice(5))===t[k]).map(k=>bar(k,t[k]+'px',`<i class="scale-type" style="font-size:${t[k]}px">Ag 123</i>`)).join('');
 const stroke=pick(/^STROKE_\d/).map(k=>bar(k,t[k]+'px',`<i style="width:var(--space-48);height:${t[k]}px;background:var(--inspector-text)"></i>`)).join('');
 const alpha=Object.keys(t).filter(k=>/^ALPHA_/.test(k)).map(k=>bar(k,t[k],`<i style="width:var(--space-48);height:var(--space-24);background:color-mix(in srgb,var(--inspector-text) ${t[k]*100}%,transparent)"></i>`)).join('');
 const elevation=['panel','sheet','modal'].map(n=>bar('elevation '+n,t['WEB_ELEVATION_'+n.toUpperCase()+'_Y']+'px / '+t['WEB_ELEVATION_'+n.toUpperCase()+'_BLUR']+'px',`<i style="width:var(--space-48);height:var(--space-32);border-radius:var(--inspector-radius);background:var(--inspector-card);box-shadow:var(--elevation-${n})"></i>`)).join('');
 const motion=Object.keys(t).filter(k=>/^MOTION_/.test(k)).map(k=>bar(k,t[k]+'ms',`<i class="scale-motion" style="animation-duration:${t[k]}ms"></i>`)).join('');
 const shown=set=>set.filter(([title,body])=>body&&(!query||title.toLowerCase().includes(query)));
 const measures=shown([['Spacing',space],['Radius',radius],['Type',type],['Stroke',stroke]]);
 const effects=shown([['Alpha',alpha],['Elevation',elevation],['Motion',motion]]);
  return {measures,effects};
}
function scalesSection(){
 const {measures}=scaleBlocks();
 return head('Scales','The measurements every panel and control is laid out on. They belong to the kit, not to a brand: a brand changes colour and type, never geometry, so the seven games keep one layout.')
 +measures.map(([title,body])=>card(title,body)).join('');
}
function effectsSection(){
 const {effects}=scaleBlocks();
 return head('Effects','How the interface layers and moves: the translucency behind a scrim, the shadow each surface casts, and how long a transition lasts. Like the scales, these are the kit\'s and the same in every game.')
 +effects.map(([title,body])=>card(title,body)).join('');
}
function iconsSection(){
 const all=catalog.icons||[];
 const list=all.filter(i=>!query||i.name.includes(query));
 const tile=i=>`<figure class="${i.used?'':'is-spare'}"><img src="crash-ui/assets/icons/${i.name}?v=${iconSeq}" alt="">
<figcaption>${esc(i.name)}<small>${i.bytes>102400?Math.round(i.bytes/1024)+' KB · heavy':i.used?'drawn by the UI':'spare'}</small></figcaption>
<span class="icon-actions"><button type="button" data-replace="${i.name}">Replace…</button>${i.used?'':`<button type="button" class="lib-remove" data-drop="${i.name}">Delete</button>`}</span></figure>`;
 return head('Icons','The shared artwork every game draws from. Replacing one keeps its name, so every game picks it up; the ones nothing names can go.')
 +card('',`<div class="icon-grid">${list.map(tile).join('')||'<p class="lib-note">Nothing matches.</p>'}</div>`)
 +card('Add an icon',`<div class="add-way"><b>A new name</b><p>An .svg or .png under 512 KB. Only a game that draws it by name will show it.</p>
 <div class="add-row"><button id="icon-add" type="button" class="wb-button">Choose a file…</button><input id="icon-file" type="file" accept=".svg,.png" hidden></div></div>`);
}
let iconSeq=0;
async function putIcon(name,file){
 note('Uploading '+name+'…');
 const response=await fetch('brands/icons/'+encodeURIComponent(name),{method:'POST',body:await file.arrayBuffer()});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)return note(data.message||('HTTP '+response.status),true);
 iconSeq++;catalog=await (await fetch('brands/')).json();draw();
 note(data.icon.replaced?name+' replaced. Every game draws the new one.':name+' added.');
}
async function dropIcon(name){
 if(!confirm('Remove '+name+' from the kit?'))return;
 const response=await fetch('brands/icons/'+encodeURIComponent(name),{method:'DELETE'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)return note(data.message||('HTTP '+response.status),true);
 catalog=await (await fetch('brands/')).json();draw();note(name+' removed.');
}

// --- shell -------------------------------------------------------------------------------------
const LOOKED_AT={typography:1,colour:1};
const SECTIONS={typography:typographySection,colour:colourSection,scales:scalesSection,effects:effectsSection,icons:iconsSection};
function draw(){
 report.innerHTML=SECTIONS[section]();
 report.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{navigator.clipboard?.writeText(b.dataset.copy);b.classList.add('copied');setTimeout(()=>b.classList.remove('copied'),900)});
 report.querySelectorAll('.use-select').forEach(n=>n.onchange=()=>{if(n.value)use(n.value,n.dataset.family,Number(n.dataset.weight)).catch(e=>note(e.message,true))});
 report.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeFamily(catalog.families.find(f=>f.id===b.dataset.remove)));
 report.querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>pickFile(f=>putIcon(b.dataset.replace,f),'.svg,.png'));
 report.querySelectorAll('[data-drop]').forEach(b=>b.onclick=()=>dropIcon(b.dataset.drop));
 const iconAdd=$('#icon-add');
 if(iconAdd){iconAdd.onclick=()=>$('#icon-file').click();$('#icon-file').onchange=e=>{const f=e.target.files[0];if(f)putIcon(f.name,f);e.target.value=''}}
 const upload=$('#library-upload');
 if(upload){upload.onclick=()=>$('#library-file').click();$('#library-file').onchange=addFonts}
 const google=$('#library-google-add');
 if(google){google.onclick=addGoogle;$('#library-google').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addGoogle()}}}
 panel.querySelectorAll('[data-section]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.section===section)));
 const lookBlock=$('#library-look-block');if(lookBlock){lookBlock.hidden=!LOOKED_AT[section];buildLook()}
}
async function use(role,family,weight){
 if(!confirm('Apply this font to '+(window.ComposerTarget?.entry()?.title||'selected game')+' · '+catalog.brands[brand].title+'? It will be saved to this game’s design draft.')){draw();return}
 const roles=role==='both'?['body','numbers']:[role];
 const fam=catalog.families.find(f=>f.id===family);
 const file=(fam.files[weight+'|normal']||Object.values(fam.files)[0]).split('/').pop();
 const current=catalog.brands[brand];
 const fonts=Object.fromEntries(Object.entries(current.fonts).map(([k,f])=>[k,{file:f.file,weight:f.weight,style:f.style||'normal'}]));
 for(const r of roles)fonts[r]={file,weight,style:'normal'};
 const response=await fetch('brands/'+brand,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:brand,title:current.title,roles:current.roles,overrides:current.overrides,fonts})});
 if(!response.ok){const d=await response.json().catch(()=>({}));return note(d.message||('HTTP '+response.status),true)}
 catalog=await (await fetch('brands/')).json();draw();
 note(fam.title+' '+weight+' is now the '+roles.join(' and ')+' face of '+current.title+'.');
}
// A family straight from Google Fonts: the latin cut of its whole weight axis.
async function addGoogle(){
 const field=$('#library-google'),title=field.value.trim();
 if(!title)return note('Paste the link to the family on fonts.google.com, or type its name',true);
 note('Fetching '+title+' from Google Fonts…');
 const response=await fetch('brands/google/'+encodeURIComponent(title),{method:'POST'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)return note(data.message||('HTTP '+response.status),true);
 field.value='';catalog=await (await fetch('brands/')).json();draw();
 const w=data.added.weights;
 note(data.added.title+' added'+(w.length===2?' with weights '+w[0]+' to '+w[1]:' at weight '+w[0])+'.');
}
async function addFonts(){
 const input=$('#library-file');const added=[];
 for(const file of input.files){
  note('Uploading '+file.name+'…');
  const response=await fetch('brands/fonts/'+encodeURIComponent(file.name),{method:'POST',body:await file.arrayBuffer()});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){input.value='';return note(data.message||('HTTP '+response.status),true)}
  added.push(...[].concat(data.font));
 }
 input.value='';catalog=await (await fetch('brands/')).json();draw();
 note(added.length+' file'+(added.length===1?'':'s')+' added to the library.');
}
async function removeFamily(fam){
 if(!fam||!confirm('Remove '+fam.title+' from the kit? Every weight and format of it goes.'))return;
 const response=await fetch('brands/fonts/'+encodeURIComponent(fam.id),{method:'DELETE'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)return note(data.message||('HTTP '+response.status),true);
 catalog=await (await fetch('brands/')).json();draw();note(fam.title+' removed from the kit.');
}
// One-off file chooser for replacing a single icon in place.
function pickFile(then,accept){
 const input=document.createElement('input');input.type='file';input.accept=accept;
 input.onchange=()=>{if(input.files[0])then(input.files[0])};input.click();
}
function note(text,error){const n=$('#library-note');n.textContent=text;n.classList.toggle('sound-error',!!error)}
function controls(){
 panel.innerHTML=`<section class="wb-section"><h2>Library</h2>
<div class="look-row" role="group" aria-label="Section">${Object.keys(SECTIONS).map(k=>`<button type="button" class="wb-button" data-section="${k}">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div>
<small>What the kit offers.</small></section>
<section class="wb-section" id="library-look-block"><h2>Look</h2><div id="library-look"></div><small></small></section>
<section class="wb-section"><h2>Find</h2><label class="property">Search <input id="library-find" type="search" placeholder="gold, radius, coin"></label>
<small id="library-note" role="status"></small></section>`;
 panel.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{section=b.dataset.section;draw()});
 $('#library-find').oninput=e=>{query=e.target.value.trim().toLowerCase();draw()};
 const picker=window.ComposerLookPicker;
 brand=picker?.brand||'default';theme=picker?.theme||'';
 buildLook();
}
// Typography is about a brand's faces, Colour about a brand and its season: the picker
// offers exactly what the section reads.
function buildLook(){
 const box=$('#library-look');if(!box)return;
 const wantThemes=section==='colour';
 if(!wantThemes)theme='';
 Workbench.lookPicker({container:box,brand,theme,themes:wantThemes,onChange:v=>{
  brand=v.brand;theme=wantThemes?v.theme:'';
  const p=window.ComposerLookPicker;if(p){p.brand=brand;if(wantThemes)p.theme=theme}
  draw();
 }});
 const note=box.parentElement.querySelector('small');
 if(note)note.textContent=wantThemes?'Colour shows the brand and season you pick here.':'Typography shows the faces this brand is set in.';
}
async function open(){
 if(!catalog){catalog=await (await fetch('brands/')).json();controls()}
 else{const picker=window.ComposerLookPicker;brand=picker?.brand||brand;theme=picker?.theme||''}
 draw();
}
window.addEventListener('composer-workspace',e=>{if(e.detail==='library')open().catch(err=>{report.innerHTML='<p class="sound-error">'+esc(err.message)+'</p>'})});
})();

/* Look workspace. The brand and theme pickers are the Game tab's; the sidebar shows the
   chosen brand's twelve role colours, and only Edit (or New brand) makes them editable.
   Every kit token derives from the roles exactly as kit/web/brand_roles.py does, so the
   live preview on the stage matches what Save writes; Advanced lets a single derived
   token be overridden. Save posts roles and overrides to the preview server. */
(()=>{
'use strict';
const $=s=>document.querySelector(s);
const frame=$('#frame'),panel=$('#look-controls');let sheet=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cssName=k=>'--'+k.toLowerCase().replace(/_/g,'-');
const nice=k=>k.toLowerCase().replace(/_/g,' ');
// --- colour maths, mirroring brand_roles.py ---------------------------------------------
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const toHex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('');
function rgbToHls([r,g,b]){const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;if(max===min)return [0,l,0];const d=max-min,s=l>0.5?d/(2-max-min):d/(max+min);let h=max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4;return [h/6,l,s]}
function hlsToRgb([h,l,s]){if(!s)return [l,l,l];const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;const f=t=>{t=(t+1)%1;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p};return [f(h+1/3),f(h),f(h-1/3)]}
const lighten=(hex,a)=>{const [h,l,s]=rgbToHls(rgb(hex));return toHex(hlsToRgb([h,Math.min(1,l+a),Math.max(0,s-a*1.35)]))};
const darken=(hex,a)=>{const [h,l,s]=rgbToHls(rgb(hex));return toHex(hlsToRgb([h,Math.max(0,l-a),s]))};
const mix=(a,b,w)=>toHex(rgb(a).map((x,i)=>x*w+rgb(b)[i]*(1-w)));
const readableHsl=(hex,surface,min)=>{let [h,l,s]=rgbToHls(rgb(hex));const up=luminance(surface)<0.5;for(let i=0;i<40&&contrast(toHex(hlsToRgb([h,l,s])),surface)<min;i++)l=up?Math.min(1,l+0.02):Math.max(0,l-0.02);return toHex(hlsToRgb([h,l,s]))};
function derive(r){return {SURFACE:r.surface,SURFACE_RAISED:lighten(r.surface,0.09),SURFACE_INSET:lighten(r.surface,0.04),SURFACE_PRESSED:darken(r.surface,0.02),SURFACE_HOVER:lighten(r.surface,0.14),BORDER:lighten(r.surface,0.19),BUTTON:r.secondary,ON_BUTTON:r.onSecondary,BUTTON_DISABLED:readableHsl(mix(r.secondary,r.surface,0.7),r.surface,1.5),DISABLED:readableHsl(mix(r.onSurface,r.surface,0.45),readableHsl(mix(r.secondary,r.surface,0.7),r.surface,1.5),3),TEXT:r.onSurface,TEXT_MUTED:mix(r.onSurface,r.surface,0.70),KNOB:lighten(r.onSurface,0.30),ACTION_GO:r.primary,ON_GO:r.onPrimary,GOLD:readableHsl(r.primary,lighten(r.surface,0.04),4.5),GLOSS:lighten(r.primary,0.40),ACTION_CASH:r.success,ON_CASH:r.onSuccess,CASH_SHADOW:darken(r.success,0.28),SUCCESS:r.success,SWITCH_ON:r.success,ON_SUCCESS:r.onSuccess,DANGER:r.danger,AVATAR_CORAL:r.danger,WARNING:r.warning,FOCUS:r.info,CYAN:r.info,PURPLE:r.tertiary,PILL_CYAN:readableHsl(r.info,lighten(r.surface,0.09),4.5),PILL_SUCCESS:readableHsl(r.success,lighten(r.surface,0.09),4.5),PILL_PURPLE:readableHsl(r.tertiary,lighten(r.surface,0.09),4.5),PILL_GOLD:readableHsl(r.primary,lighten(r.surface,0.09),4.5),SWITCH_OFF:lighten(r.secondary,0.06),SWITCH_BORDER:lighten(r.secondary,0.18),SHADOW:'#000000',HIGHLIGHT:'#ffffff'}}
// the generator's button shading and overlays, for the preview
const shade=(hex,amount)=>toHex(rgb(hex).map(c=>amount>=0?c+(1-c)*amount:c*(1+amount)));
const alphaHex=(hex,a)=>hex+Math.round(a*255).toString(16).padStart(2,'0');
function derivedVars(colors){
 const out={};
 for(const token of ['BUTTON','ACTION_GO','ACTION_CASH']){const face=colors[token];const [r,g]=rgb(face);const vivid=(r>0.8&&g>0.5)||g>0.7;for(const [suffix,amount] of [['top',vivid?0.2:0.08],['bottom',vivid?-0.14:-0.09],['edge',0.45],['shadow',-0.55]])out[cssName(token)+'-'+suffix]=shade(face,amount)}
 const A=CrashTokens;
 Object.assign(out,{'--shadow-soft':alphaHex(colors.SHADOW,A.ALPHA_SOFT),'--shadow-medium':alphaHex(colors.SHADOW,A.ALPHA_MEDIUM),'--shadow-strong':alphaHex(colors.SHADOW,A.ALPHA_STRONG),'--scrim':alphaHex(colors.SHADOW,A.ALPHA_SCRIM),'--surface-scrim':alphaHex(colors.SURFACE,A.ALPHA_SCRIM),'--gloss-ink':alphaHex(colors.GLOSS,A.ALPHA_STRONG),'--surface-hover-soft':alphaHex(colors.SURFACE_HOVER,A.ALPHA_SOFT),'--surface-hover-medium':alphaHex(colors.SURFACE_HOVER,A.ALPHA_MEDIUM)});
 return out;
}
// --- a whole palette from one primary, the Material 3 way ---------------------------------
// Tones are CIELAB lightness (0–100) and chroma is Lab chroma, close to Material's HCT. The
// neutral palette takes the primary's hue at chroma 4 (neutral variant 8): surfaces sit on
// tone 6, text on tone 90. Accents keep their own hues at tone 80 (buttons a little lower)
// and the tertiary is the primary's hue turned by 60°, at chroma 24, as Material does.
const srgbToLin=c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;
const linToSrgb=c=>c<=0.0031308?12.92*c:1.055*c**(1/2.4)-0.055;
function labOf(hex){const [r,g,b]=rgb(hex).map(srgbToLin);const x=(0.4124564*r+0.3575761*g+0.1804375*b)/0.95047,y=0.2126729*r+0.7151522*g+0.0721750*b,z=(0.0193339*r+0.1191920*g+0.9503041*b)/1.08883;const f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;const fx=f(x),fy=f(y),fz=f(z);return [116*fy-16,500*(fx-fy),200*(fy-fz)]}
function hexOfLab(L,a,b){const fy=(L+16)/116,fx=fy+a/500,fz=fy-b/200;const fi=t=>t**3>0.008856?t**3:(t-16/116)/7.787;const x=fi(fx)*0.95047,y=fi(fy),z=fi(fz)*1.08883;const r=3.2404542*x-1.5371385*y-0.4985314*z,g=-0.9692660*x+1.8760108*y+0.0415560*z,bb=0.0556434*x-0.2040259*y+1.0572252*z;return toHex([r,g,bb].map(linToSrgb))}
const lch=hex=>{const [L,a,b]=labOf(hex);return [L,Math.hypot(a,b),(Math.atan2(b,a)*180/Math.PI+360)%360]};
const tone=(hue,chroma,T)=>{const h=hue*Math.PI/180;return hexOfLab(T,chroma*Math.cos(h),chroma*Math.sin(h))};
function readableTone(hue,chroma,T,surface,min){let t=T;for(let i=0;i<40&&contrastOf(tone(hue,chroma,t),surface)<min;i++)t+=luminance(surface)<0.5?1.5:-1.5;return tone(hue,chroma,Math.max(0,Math.min(100,t)))}
function contrastOf(a,b){const l1=luminance(a),l2=luminance(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)}
function inkFor(hex){const dark='#0f1720',light='#ffffff';return contrastOf(dark,hex)>=contrastOf(light,hex)?dark:light}
// How much of the primary the neutrals carry: Lab chroma of the surface and of the text on it,
// and `accent` the chroma of the tertiary. Plain keeps both greys at chroma 0, so the brand
// shows only where it acts: the PLAY button, the amounts and the cash-out.
const STYLES={plain:{title:'Plain',about:'grey surfaces, the brand only on the buttons',surface:0,button:0,ink:0,tone:7,accent:12},neutral:{title:'Neutral',about:'Material: near-grey surfaces with a hint of the brand',surface:4,button:10,ink:4,tone:6},tinted:{title:'Tinted',about:'surfaces lean towards the brand',surface:14,button:18,ink:8,tone:8},branded:{title:'Branded',about:'surfaces are the brand colour, deep and dark',surface:30,button:30,ink:10,tone:10}};
function fromPrimary(primary,style='neutral'){
 const st=STYLES[style]||STYLES.neutral;
 const [,,hue]=lch(primary);
 const surface=tone(hue,st.surface,st.tone),onSurface=tone(hue,st.ink,90);
 // Cash out is the brightest thing on the panel: the win green sits high on the tone scale.
 const success=readableTone(145,70,74,surface,4.5),danger=readableTone(25,60,80,surface,4.5),warning=readableTone(75,70,80,surface,4.5),info=readableTone(240,50,80,surface,4.5),tertiary=readableTone(hue+60,st.accent??24,80,surface,4.5);
 const secondary=tone(hue,st.button,st.tone+11),onSecondary=onSurface;
 return repair({surface,onSurface,primary:readableTone(hue,lch(primary)[1],lch(primary)[0],surface,3),onPrimary:inkFor(primary),secondary,onSecondary,success,onSuccess:inkFor(success),danger,warning,info,tertiary});
}
// --- seasonal presets for themes ---------------------------------------------------------
// A theme keeps the brand's surfaces and text; a season sets the two action colours (play and
// cash-out) and a matching accent pair, each lifted until it reads on the brand's surface.
const SEASONS={
 christmas:{title:'Christmas',primary:'#d7263d',success:'#1f8a3b',info:'#9fe3ff',tertiary:'#ffd88a'},
 newyear:{title:'New Year',primary:'#ffd166',success:'#2a9d8f',info:'#c8e7ff',tertiary:'#e0b3ff'},
 valentine:{title:'Valentine',primary:'#ff4d8d',success:'#c2185b',info:'#ffb3c6',tertiary:'#ffd6e0'},
 easter:{title:'Easter',primary:'#b39ddb',success:'#7ed957',info:'#80deea',tertiary:'#ffe082'},
 halloween:{title:'Halloween',primary:'#ff7a00',success:'#8e24aa',info:'#b2ff59',tertiary:'#ffab40'},
 carnival:{title:'Carnival',primary:'#ff9f1c',success:'#c026a8',info:'#5ce1ff',tertiary:'#8dff5a'},
 summer:{title:'Summer',primary:'#ffe600',success:'#00bfa5',info:'#40c4ff',tertiary:'#ff8a65'},
 blackfriday:{title:'Black Friday',primary:'#ffd400',success:'#ffffff',info:'#bdbdbd',tertiary:'#ff5252'},
 ramadan:{title:'Ramadan',primary:'#c9a227',success:'#1b7f5a',info:'#8ecae6',tertiary:'#f2e9c9'},
};
function fromSeason(season,brand){
 const sn=SEASONS[season];const surface=brand.surface;
 const lift=(hex,min)=>{const [L,C,H]=lch(hex);return readableTone(H,C,L,surface,min)};
 // A season's cash-out colour is lifted to the same brightness the generated one carries.
 const brighten=(hex,floor,min)=>{const [L,C,H]=lch(hex);return readableTone(H,C,Math.max(L,floor),surface,min)};
 const primary=lift(sn.primary,3),success=brighten(sn.success,74,4.5);
 const accents={primary,onPrimary:inkFor(primary),success,onSuccess:inkFor(success),info:lift(sn.info,4.5),tertiary:lift(sn.tertiary,4.5)};
 // The season only carries what it changes, once the whole palette over the brand is sound.
 const whole=repair({...brand,...accents});
 return Object.fromEntries(Object.keys(whole).filter(k=>whole[k]!==brand[k]).map(k=>[k,whole[k]]));
}
// --- WCAG contrast -----------------------------------------------------------------------
const PAIRS=[['onSurface','surface',4.5,'text on panels'],['onPrimary','primary',3,'PLAY label (large text)'],['onSecondary','secondary',4.5,'labels on the secondary controls'],['onSuccess','success',3,'CASH OUT and Auto labels (large text)'],['primary','surface',3,'amounts and the play button against panels'],['success','surface',4.5,'wins on panels'],['danger','surface',4.5,'errors on panels'],['warning','surface',4.5,'cautions on panels'],['info','surface',4.5,'multiplier and history pills'],['tertiary','surface',4.5,'the second accent on panels']];
// The same check on the derived tokens the modals, cards, pills and switches actually use;
// each token points back at the role that drives it, so the row that lights up is the right one.
const DERIVED_PAIRS=[
 ['TEXT','SURFACE_RAISED',4.5,'modal and menu text on raised surfaces'],['TEXT','SURFACE_INSET',4.5,'record and stake text on inset surfaces'],['TEXT_MUTED','SURFACE_INSET',4.5,'captions in the record card'],['TEXT_MUTED','SURFACE_RAISED',4.5,'notes in modals'],['ON_BUTTON','BUTTON',4.5,'labels on MIN, MAX, presets and difficulty'],['SECONDARY_ON_SURFACE','SURFACE',1.3,'secondary controls against the panel (visible)'],
 ['GOLD','SURFACE_INSET',4.5,'amounts in the record card'],['SUCCESS','SURFACE_INSET',4.5,'your best in the record card'],['PILL_CYAN','SURFACE_RAISED',4.5,'history pills under 2×'],['PILL_SUCCESS','SURFACE_RAISED',4.5,'history pills from 2×'],['PILL_PURPLE','SURFACE_RAISED',4.5,'history pills from 5×'],['PILL_GOLD','SURFACE_RAISED',4.5,'history pills from 10×'],['DANGER','SURFACE_RAISED',4.5,'errors in modals'],
 ['ON_SUCCESS','SWITCH_ON',4.5,'Auto label when on'],['KNOB','SWITCH_OFF',3,'switch knob when off'],['DISABLED','BUTTON_DISABLED',3,'labels on a disabled control'],['BUTTON_DISABLED','SURFACE',1.4,'a disabled control against the panel'],['FOCUS','SURFACE',3,'focus ring'],['BORDER','SURFACE',1.3,'panel outlines (visible)'],['ACTION_GO','SURFACE',3,'PLAY against the panel'],['ACTION_CASH','SURFACE',3,'CASH OUT against the panel'],
];
const ROLE_OF={BUTTON_DISABLED:'secondary',ON_BUTTON:'onSecondary',SECONDARY_ON_SURFACE:'secondary',TEXT:'onSurface',TEXT_MUTED:'onSurface',KNOB:'onSurface',DISABLED:'onSurface',SURFACE:'surface',SURFACE_RAISED:'surface',SURFACE_INSET:'surface',BUTTON:'surface',BORDER:'surface',SWITCH_OFF:'surface',GOLD:'primary',ACTION_GO:'primary',ACTION_CASH:'success',SUCCESS:'success',SWITCH_ON:'success',ON_SUCCESS:'onSuccess',CYAN:'info',PURPLE:'tertiary',PILL_CYAN:'info',PILL_SUCCESS:'success',PILL_PURPLE:'tertiary',PILL_GOLD:'primary',FOCUS:'info',DANGER:'danger'};
const luminance=hex=>{const [r,g,b]=rgb(hex).map(c=>c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4);return 0.2126*r+0.7152*g+0.0722*b};
const contrast=(a,b)=>{const l1=luminance(a),l2=luminance(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)};
// --- state --------------------------------------------------------------------------------
let catalog=null,brandId='default',themeId='',roles={},overrides={},fonts={},editing=false,creating=false,editingTheme=false,staged=false,dirty=false;
// Brands are shared by every game. What can be a game's own: a season it adds to a brand
// (themeScope) and the faces it sets for itself (fontsGame). Both apply only once the shared
// scope exists in the cloud (catalog.scope); before that a brand is saved as it always was.
let themeScope='shared',fontsGame=false;
const layered=()=>!!catalog?.scope?.shared;
const gameTitle=()=>window.ComposerTarget?.entry()?.title||'this game';
const sameJSON=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const strip=f=>Object.fromEntries(Object.entries(f||{}).map(([r,x])=>[r,{file:String(x.file).split('/').pop(),weight:x.weight,style:x.style||'normal'}]));
const brandRoles=()=>catalog.brands[brandId].roles;
const colors=()=>({...derive(roles),...overrides});
const label=k=>catalog.colorRoles.find(r=>r.key===k)?.title||k;
const WEIGHT_TITLES={100:'Thin',200:'Extra light',300:'Light',400:'Regular',500:'Medium',600:'Semibold',700:'Bold',800:'Extra bold',900:'Black'};
const bare=f=>String(f||'').split('/').pop();
// Which family a stored file belongs to, and the file a family/weight/style resolves to.
const familyOf=file=>{const id=bare(file).replace(/\.[^.]+$/,'').split('-')[0];return catalog.families.find(f=>f.id===id)||catalog.families.find(f=>Object.values(f.files).some(v=>bare(v)===bare(file)))};
const nearest=(list,w)=>list.reduce((best,x)=>Math.abs(x-w)<Math.abs(best-w)?x:best,list[0]);
function setFace(role,change){
 const now=fonts[role],fam=catalog.families.find(f=>f.id===(change.family??familyOf(now.file)?.id))||familyOf(now.file)||catalog.families[0];
 let style=change.style??now.style??'normal';if(!fam.italic)style='normal';
 let weight=change.weight??now.weight??400;if(!fam.weights.includes(weight))weight=nearest(fam.weights,weight);
 const file=fam.files[weight+'|'+style]||fam.files[weight+'|normal']||Object.values(fam.files)[0];
 fonts[role]={file:bare(file),weight,style};
 dirty=true;paintFaces();apply();
}
function paintFaces(){
 for(const role of catalog.roles){
  const famSel=sheet.querySelector(`[data-family="${role}"]`);if(!famSel)continue;
  const fam=familyOf(fonts[role].file);
  famSel.value=fam.id;
  const wSel=sheet.querySelector(`[data-weight="${role}"]`);
  wSel.replaceChildren(...fam.weights.map(w=>new Option(WEIGHT_TITLES[w]+' '+w,w)));
  wSel.value=String(fam.weights.includes(fonts[role].weight)?fonts[role].weight:nearest(fam.weights,fonts[role].weight||400));
  const it=sheet.querySelector(`[data-italic="${role}"]`);
  it.checked=fonts[role].style==='italic';it.disabled=!fam.italic;
  it.closest('.switch').title=fam.italic?'':fam.title+' has no italic';
 }
}
// --- render ---------------------------------------------------------------------------------
function render(){
 panel.innerHTML=`
<section class="wb-section look-card" id="look-brand-card"><h2>Brand</h2>
<div class="look-card-head look-view"><p class="look-current" id="look-current"></p><button type="button" class="wb-button" id="look-edit-brand">Edit</button></div>
<small class="look-view" id="look-brand-note"></small>
<div class="look-part look-view"><em class="note">Colours</em><div class="look-strip" id="look-strip"></div></div>
<div class="look-part look-view"><em class="note">Fonts</em><div class="look-faces-view" id="look-faces-view"></div></div>
<button type="button" class="wb-button add look-view" id="look-add-brand">+ New brand</button></section>
<section class="wb-section look-card look-view" id="look-season-card"><h2>Season</h2>
<div class="look-card-head"><p class="look-current" id="look-current-theme"></p><button type="button" class="wb-button" id="look-edit-theme">Edit</button></div>
<small id="look-season-note"></small>
<div class="look-part" id="look-theme-part"><em class="note">Colours it changes</em><div class="look-strip" id="look-theme-strip"></div></div>
<button type="button" class="wb-button add" id="look-add-theme">+ New season</button></section>
<small class="look-view look-hint">Pick the brand and season in the top bar; they stay on the stage in every tab.</small>
<div id="look-editor" hidden></div>`;
 sheet=$('#look-editor');
 sheet.innerHTML=`
<h2 id="sheet-title"><span></span><small></small></h2>
<div class="toolbar" id="look-head"><label class="property">Title <input id="look-title" type="text" placeholder="Numba Kenya"></label><small id="look-id-hint"></small></div>
<div class="toolbar" id="look-scope" aria-label="Season scope" hidden><strong>This season is for</strong><div class="look-row" role="group" aria-label="Season scope"><button type="button" class="wb-button" data-theme-scope="shared">All games</button><button type="button" class="wb-button" data-theme-scope="game"></button></div><small id="look-scope-hint"></small></div>
<div class="toolbar" id="look-season" aria-label="Season" hidden><strong>Season</strong><div class="season-row" id="look-seasons"></div><small>A season sets the play and cash-out colours and two accents over the brand; surfaces and text stay the brand\'s. Or set the primary below and generate.</small></div>
<div class="toolbar" id="look-primary" aria-label="Primary"><strong>Primary</strong><div class="role-pair">${['primary','onPrimary'].map(k=>roleRow(k)).join('')}</div>
<div class="generate-row"><select id="look-style" aria-label="Palette style"></select><button id="look-generate" type="button" class="wb-button">Generate the palette</button></div></div>
<div class="toolbar" id="look-colours" aria-label="Colours"><strong>Colours</strong>
${pairs().filter(([a])=>a!=='primary').map(([a,b])=>`<div class="role-pair">${[a,b].filter(Boolean).map(k=>roleRow(k)).join('')}</div>`).join('')}
<small>Twelve colours describe a brand; panels, borders, switches and shadows derive from them.</small></div>
<div class="toolbar" id="look-faces" aria-label="Faces"><strong>Fonts</strong>
${catalog.roles.map(role=>`<div class="face" data-role="${role}"><b>${role==='body'?'Body':'Numbers'}</b>
<select data-family="${role}" aria-label="${role} font" title="The family every ${role==="body"?"label":"amount and multiplier"} is set in">${catalog.families.map(f=>`<option value="${f.id}">${esc(f.title)}</option>`).join('')}</select>
<select data-weight="${role}" aria-label="${role} weight"></select>
<label class="switch"><input type="checkbox" data-italic="${role}">Italic</label></div>`).join('')}
<label class="switch" id="look-fonts-own" hidden><input type="checkbox" id="look-fonts-game"><span></span></label><small id="look-fonts-hint" hidden></small>
</div>
<details class="toolbar look-group" id="look-advanced"><summary>Advanced · derived tokens<span class="count"></span></summary>
${Object.keys(derive(catalog.brands.default.roles)).map(k=>`<label class="look-colour"><span>${nice(k)}</span><input type="color" data-key="${k}"><input type="text" data-hex="${k}" maxlength="7" spellcheck="false"><button type="button" class="wb-button reset" data-reset="${k}" title="Back to the derived value">↺</button></label>`).join('')}
<small>Each one follows the roles above until you set it here.</small></details>
<div class="toolbar look-danger" id="look-danger"><button id="look-delete" type="button">Delete brand</button></div>
<div class="toolbar" id="look-actions" aria-label="Actions"><button id="look-save" type="button">Save brand</button><button id="look-revert" type="button">Cancel</button><small id="look-message" role="status"></small></div>`;
 const editActions=$('#look-actions'),scroll=document.createElement('div');scrollBox=scroll;
 scroll.className='look-scroll';editActions.remove();scroll.append(...panel.childNodes);panel.append(scroll,editActions);
 const pickerState=window.ComposerLookPicker;
 // The brand and season are picked in the top bar, for every tab; this panel shows and edits the pick.
 lookPicker=Workbench.lookPicker({container:$('#look-pick'),catalogTokens:Workbench.lookTokens(catalog),brand:pickerState?.brand||'default',theme:pickerState?.theme||'',onChange:pickLook});
 $('#look-edit-brand').onclick=()=>edit(false);$('#look-edit-theme').onclick=()=>editTheme(false);$('#look-add-theme').onclick=()=>editTheme(true);$('#look-add-brand').onclick=()=>edit(true);
 $('#look-title').oninput=()=>{$('#look-title').removeAttribute('aria-invalid');if($('#look-message').classList.contains('sound-error'))say('');if(!creating)return;const id=slug($('#look-title').value);$('#look-id-hint').textContent=id?'id · '+id:'';$('#look-id-hint').title=id?(editingTheme?'brands/'+brandId+'/themes/'+id+'.json':'brands/'+id+'/'):'';dirty=true};
 $('#look-seasons').replaceChildren(...Object.entries(SEASONS).map(([id,sn])=>{const b=document.createElement('button');b.type='button';b.className='wb-button season';b.innerHTML=`<i style="background:linear-gradient(135deg,${sn.primary} 50%,${sn.success} 50%)"></i>${esc(sn.title)}`;b.onclick=()=>{// A season replaces the one before it: start again from the brand, then apply it.
   Object.assign(roles,brandRoles(),fromSeason(id,brandRoles()));if(creating&&!$('#look-title').value){$('#look-title').value=sn.title;$('#look-title').dispatchEvent(new Event('input'))}staged=false;dirty=true;mode();paint();apply();toast(sn.title+' applied over '+catalog.brands[brandId].title+'. Adjust any role, then Save.')};return b}));
 const styleSel=$('#look-style');styleSel.replaceChildren(...Object.entries(STYLES).map(([id,st])=>Object.assign(new Option(st.title,id),{title:st.about})));try{styleSel.value=localStorage.getItem('crash-composer-palette-style')||'neutral'}catch{}
 styleSel.onchange=()=>{try{localStorage.setItem('crash-composer-palette-style',styleSel.value)}catch{}};
 $('#look-generate').onclick=()=>{const p=roles.primary;const generated=fromPrimary(p,styleSel.value);
  Object.assign(roles,generated);staged=false;dirty=true;mode();paint();apply();toast('Palette generated from '+p+'. Adjust any role, then Save.')};
 sheet.querySelectorAll('.role[data-role]').forEach(row=>{row.addEventListener('focusin',()=>highlightRole(row.dataset.role));row.addEventListener('focusout',()=>clearHighlight())});
 sheet.querySelectorAll('[data-role-key]').forEach(n=>n.oninput=()=>setRole(n.dataset.roleKey,n.value));
 sheet.querySelectorAll('[data-role-hex]').forEach(n=>n.onchange=()=>{const v=n.value.trim().toLowerCase();if(/^#[0-9a-f]{6}$/.test(v))setRole(n.dataset.roleHex,v);else n.value=roles[n.dataset.roleHex]});
 sheet.querySelectorAll('[data-role-reset]').forEach(n=>n.onclick=()=>{if(!editingTheme)return;roles[n.dataset.roleReset]=brandRoles()[n.dataset.roleReset];dirty=true;paint();apply()});
 sheet.querySelectorAll('[data-key]').forEach(n=>n.oninput=()=>setOverride(n.dataset.key,n.value));
 sheet.querySelectorAll('[data-hex]').forEach(n=>n.onchange=()=>{const v=n.value.trim().toLowerCase();if(/^#[0-9a-f]{6}$/.test(v))setOverride(n.dataset.hex,v);else n.value=colors()[n.dataset.hex]});
 sheet.querySelectorAll('[data-reset]').forEach(n=>n.onclick=()=>{delete overrides[n.dataset.reset];dirty=true;paint();apply()});
 sheet.querySelectorAll('[data-family]').forEach(n=>n.onchange=()=>setFace(n.dataset.family,{family:n.value}));
 sheet.querySelectorAll('[data-weight]').forEach(n=>n.onchange=()=>setFace(n.dataset.weight,{weight:Number(n.value)}));
 sheet.querySelectorAll('[data-italic]').forEach(n=>n.onchange=()=>setFace(n.dataset.italic,{style:n.checked?'italic':'normal'}));

 sheet.querySelectorAll('[data-theme-scope]').forEach(n=>n.onclick=()=>{if(!creating)return;themeScope=n.dataset.themeScope;dirty=true;mode()});
 $('#look-fonts-game').onchange=e=>{fontsGame=e.target.checked;dirty=true;mode()};
 $('#look-save').onclick=()=>save().catch(e=>say(e.message,true));$('#look-revert').onclick=()=>{show(brandId,backTheme)};$('#look-delete').onclick=remove;
}
// A brand and season put on the stage, from the top bar or from search.
function pickLook(v){
 if(editing||!catalog?.brands[v.brand])return false;
 if(!((v.theme||'') in catalog.brands[v.brand].themes||!v.theme))v={...v,theme:''};
 const state=window.ComposerLookPicker;if(state){state.brand=v.brand;state.theme=v.theme||''}
 if(lookPicker){lookPicker.brand=v.brand;lookPicker.theme=v.theme||''}
 Workbench.applyLook(frame,v);show(v.brand,v.theme||'');window.dispatchEvent(new CustomEvent('composer-look',{detail:v}));return true;
}
let lookPicker=null,backTheme=''; // the season on show when an edit began, put back by Cancel
function pairs(){const k=catalog.colorRoles.map(r=>r.key);const out=[];for(let i=0;i<k.length;){if(k[i+1]&&k[i+1]==='on'+k[i][0].toUpperCase()+k[i].slice(1)){out.push([k[i],k[i+1]]);i+=2}else{out.push([k[i],null]);i++}}return out}
function clearHighlight(){frame.contentDocument?.querySelectorAll('[data-composer-highlight]').forEach(el=>el.removeAttribute('data-composer-highlight'))}
function highlightRole(key){
 clearHighlight();const doc=frame.contentDocument;if(!doc||!roles[key])return;
 let style=doc.getElementById('composer-role-highlight');if(!style){style=doc.createElement('style');style.id='composer-role-highlight';style.textContent='[data-composer-highlight]{outline:2px dashed #70ccff!important;outline-offset:3px!important}';doc.head.append(style)}
 const probe=doc.createElement('span');probe.style.color=roles[key];doc.body.append(probe);const color=doc.defaultView.getComputedStyle(probe).color;probe.remove();
 for(const el of doc.body.querySelectorAll('button,label,input,select,h1,h2,h3,p,span,svg')){const rect=el.getBoundingClientRect();if(!rect.width||!rect.height)continue;const css=doc.defaultView.getComputedStyle(el);if([css.color,css.backgroundColor,css.borderTopColor].includes(color))el.setAttribute('data-composer-highlight','')}
}
function roleRow(k){const r=catalog.colorRoles.find(x=>x.key===k);return `<label class="role" data-role="${k}"><span class="role-title">${esc(r.title)}<em class="ratio"></em></span><span class="role-about">${esc(r.about)}</span><span class="role-swatch"><input type="color" data-role-key="${k}"><input type="text" data-role-hex="${k}" maxlength="7" spellcheck="false"><button type="button" class="wb-button reset" data-role-reset="${k}" title="Back to the brand colour">↺</button></span></label>`}
const CYR={а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ie',ж:'zh',з:'z',и:'y',і:'i',ї:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ь:'',ю:'iu',я:'ia',ы:'y',э:'e',ё:'io',ъ:''};
const slug=t=>{let v=t.toLowerCase().replace(/[а-яёґєіїъы]/g,c=>CYR[c]??'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,30);if(v&&!/^[a-z]/.test(v))v='brand-'+v;return v};
// --- the top bar's pick ------------------------------------------------------------------------
const bar={button:$('#look-bar-button'),menu:$('#look-bar-menu')};
function openBar(on){if(!bar.menu)return;bar.menu.hidden=!on;bar.button.setAttribute('aria-expanded',String(on))}
function paintBar(){
 if(!bar.button||!catalog)return;
 const brand=catalog.brands[brandId]||catalog.brands.default,season=themeId&&brand.themes[themeId];
 bar.button.querySelector('.swatch').style.background=(season&&season.roles?.primary)||brand.roles.primary;
 bar.button.querySelector('strong').textContent=brand.title;
 bar.button.querySelector('small').textContent=season?season.title:'No season';
 // An edit in progress belongs to one brand; it is saved or cancelled before another is picked.
 bar.button.disabled=editing;bar.button.title=editing?'Save or cancel the edit before picking another brand':'Brand and season on the stage';if(editing)openBar(false);
 const can=!!window.ComposerAuth?.has('design.edit');
 const current=$('#look-current');if(!current)return;
 const dot=c=>'<i class="swatch" style="background:'+esc(c)+'"></i>';
 current.innerHTML=dot(brand.roles.primary)+'<b>'+esc(brand.title)+'</b>';
 $('#look-current-theme').innerHTML=season?dot(season.roles?.primary||brand.roles.primary)+'<b>'+esc(season.title)+'</b>':'<b class="none">No season</b>';
 const own=brand.own||{},mine=!!season&&(own.themes||[]).includes(themeId);
 // Brands and their shared seasons are changed only by those who may edit Brands · all games;
 // anyone who may edit this game's design can still add and change a season of its own.
 const shared=!catalog.scope||catalog.scope.canEditShared!==false;
 $('#look-edit-brand').hidden=!can||!shared;$('#look-add-brand').hidden=!can||!shared;$('#look-edit-theme').hidden=!can||!season||(!shared&&!mine);$('#look-add-theme').hidden=!can;
 $('#look-brand-note').textContent=layered()?'Every game shares this brand.'+(own.fonts?' '+gameTitle()+' is set in its own fonts (below).':''):'';
 $('#look-brand-note').hidden=!$('#look-brand-note').textContent;
 $('#look-season-note').textContent=season?(layered()?(mine?'Only '+gameTitle()+' has this season.':'Every game has this season.')+' ':'')+'Laid over '+brand.title+'.':brand.title+' as designed, nothing laid over it.';
 const changed=season?catalog.colorRoles.filter(r=>season.roles?.[r.key]&&season.roles[r.key]!==brand.roles[r.key]):[];
 $('#look-theme-part').hidden=!changed.length;
 $('#look-theme-strip').innerHTML=changed.map(r=>`<span title="${esc(r.about)}"><i style="background:${season.roles[r.key]}"></i>${esc(r.title)}</span>`).join('');
}
if(bar.button){
 bar.button.onclick=()=>openBar(bar.menu.hidden);
 document.addEventListener('click',e=>{if(!bar.button.parentElement.contains(e.target))openBar(false)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')openBar(false)});
}
// --- the game's own fonts (Brands, under the season) -----------------------------------------------------------
// A brand's fonts are every game's; here the picked game is set in its own, for the picked brand.
const gf={own:false,fonts:{},dirty:false,box:null};
let scrollBox=null,stageBefore=null;
function lookRoom(){
 let room=$('#look-room');
 if(!room){room=document.createElement('div');room.id='look-room';room.hidden=true;room.setAttribute('aria-label','Brand editor');const fit=$('#fit');fit.parentElement.insertBefore(room,fit)}
 return room;
}
// Where the editor sits: in the room while editing on the Brands tab, back in the panel otherwise.
function placeEditor(){
 const room=lookRoom(),here=window.ComposerTarget?.workspace==='look';
 if(editing){room.append(sheet,$('#look-actions'));if(!stageBefore){stageBefore={device:{...theStage.device},zoom:devices.zoom||'fit'};theStage.set({device:'mobile',zoom:'fit'})}}
 else{if(scrollBox)scrollBox.append(sheet);panel.append($('#look-actions'));if(stageBefore){const id=stageBefore.device?.id;theStage.set({device:id==='custom'?stageBefore.device:id,zoom:stageBefore.zoom});stageBefore=null}}
 room.hidden=!(editing&&here);$('#room').classList.toggle('look-workspace',editing&&here);
}
const cloudDrafts=()=>!!window.ComposerDraftEditors?.enabled&&window.ComposerTarget?.value!=='kit';
function gameFontsBox(){
 if(gf.box?.isConnected)return gf.box;
 // In Brands, under the brand and its season: fonts are a brand's, and this is where one game
 // is set in others. (It sat on the Game tab, far from the fonts it departs from.)
 const box=document.createElement('section');box.className='wb-section';box.id='game-fonts';box.setAttribute('aria-label','Fonts in '+gameTitle());
 box.innerHTML=`<h2>Fonts in <span data-gf-game></span></h2>
<p id="game-fonts-summary"></p>
<details id="game-fonts-more"><summary>Set different fonts for this game</summary>
<div class="look-row" role="group" aria-label="Which fonts this game is set in"><button type="button" class="wb-button" data-gf-own="0"></button><button type="button" class="wb-button" data-gf-own="1"></button></div>
${['body','numbers'].map(role=>`<div class="face" data-gf-role="${role}"><b>${role==='body'?'Body':'Numbers'}</b><select data-gf-family="${role}" aria-label="${role} font"></select><select data-gf-weight="${role}" aria-label="${role} weight"></select></div>`).join('')}
<small id="game-fonts-note"></small>
<div class="game-fonts-actions" hidden><button type="button" class="wb-button primary" id="game-fonts-save">Save fonts</button><button type="button" class="wb-button" id="game-fonts-cancel">Cancel</button></div></details>`;
 ($('#look-season-card')||$('#look-controls')).after?.(box);gf.box=box;
 box.querySelectorAll('[data-gf-own]').forEach(b=>b.onclick=()=>{const own=b.dataset.gfOwn==='1';if(own===gf.own)return;gf.own=own;if(!own)gf.fonts=strip(catalog.brands[brandId].sharedFonts||catalog.brands[brandId].fonts);gf.dirty=true;paintGameFonts(true)});
 const set=(role,change)=>{
  const now=gf.fonts[role],fam=catalog.families.find(f=>f.id===(change.family??familyOf(now.file)?.id))||familyOf(now.file)||catalog.families[0];
  const style=fam.italic?now.style||'normal':'normal';let weight=change.weight??now.weight??400;if(!fam.weights.includes(weight))weight=nearest(fam.weights,weight);
  gf.fonts[role]={file:bare(fam.files[weight+'|'+style]||fam.files[weight+'|normal']||Object.values(fam.files)[0]),weight,style};gf.dirty=true;paintGameFonts(true);
 };
 box.querySelectorAll('[data-gf-family]').forEach(n=>n.onchange=()=>set(n.dataset.gfFamily,{family:n.value}));
 box.querySelectorAll('[data-gf-weight]').forEach(n=>n.onchange=()=>set(n.dataset.gfWeight,{weight:Number(n.value)}));
 $('#game-fonts-cancel').onclick=()=>{resetGameFonts();apply()};
 $('#game-fonts-save').onclick=()=>saveGameFonts().catch(e=>{$('#game-fonts-note').textContent=e.message;$('#game-fonts-note').classList.add('sound-error')});
 return box;
}
function resetGameFonts(){
 const brand=catalog.brands[brandId];
 gf.own=!!brand.own?.fonts;gf.fonts=strip(brand.fonts);gf.dirty=false;paintGameFonts(false);
}
function paintGameFonts(preview){
 const box=gameFontsBox(),brand=catalog.brands[brandId],can=!!catalog.scope?.canEditGame;
 // Without the shared scope a brand is the game's own already, fonts and all: nothing to set apart.
 box.hidden=!layered()||window.ComposerTarget?.value==='kit';if(box.hidden)return;
 box.querySelector('[data-gf-game]').textContent=gameTitle();
 box.querySelector('[data-gf-own="0"]').textContent=brand.title+'’s';box.querySelector('[data-gf-own="1"]').textContent=gameTitle()+'’s own';
 box.querySelectorAll('[data-gf-own]').forEach(b=>{b.setAttribute('aria-pressed',String((b.dataset.gfOwn==='1')===gf.own));b.disabled=!can});
 for(const role of ['body','numbers']){
  const face=gf.fonts[role];if(!face)continue;const fam=familyOf(face.file)||catalog.families[0];
  const f=box.querySelector(`[data-gf-family="${role}"]`),w=box.querySelector(`[data-gf-weight="${role}"]`);
  f.replaceChildren(...catalog.families.map(x=>new Option(x.title,x.id)));f.value=fam.id;
  w.replaceChildren(...fam.weights.map(x=>new Option(WEIGHT_TITLES[x]+' '+x,x)));w.value=String(face.weight);
  f.disabled=w.disabled=!gf.own||!can;
 }
 // The one line read without opening anything: whose fonts, and which.
 const faceName=role=>{const face=gf.fonts[role];if(!face)return '';const fam=familyOf(face.file)||catalog.families[0];return fam.title+' '+(WEIGHT_TITLES[face.weight]||face.weight)};
 $('#game-fonts-summary').textContent=(gf.own?gameTitle()+'’s own':brand.title+'’s')+' · '+faceName('body')+' / '+faceName('numbers');
 if(gf.own||gf.dirty)$('#game-fonts-more').open=true;
 const note=$('#game-fonts-note');note.classList.remove('sound-error');
 note.textContent=gf.own?'Only '+gameTitle()+' is set in these, in '+brand.title+'. The other games keep the brand’s fonts.':gameTitle()+' is set in the fonts of '+brand.title+', like every game. They are changed in Brands.';
 box.querySelector('.game-fonts-actions').hidden=!gf.dirty;
 if(preview){fonts=JSON.parse(JSON.stringify(gf.fonts));const root=frame.contentDocument?.documentElement;if(root)applyFaces(root)}
}
async function saveGameFonts(){
 window.ComposerUX?.status('saving');
 const response=await fetch('brands/'+brandId+'?scope=game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fonts:gf.own?gf.fonts:null})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.message||('HTTP '+response.status));
 gf.dirty=false;catalog=null;await open();window.ComposerUX?.status('saved');
}
// --- showing and editing ---------------------------------------------------------------------
function show(id,theme){
 staged=false;
 const brand=catalog.brands[id]||catalog.brands.default;brandId=catalog.brands[id]?id:'default';
 themeId=theme!==undefined?theme:(lookPicker?.theme||'');if(!(themeId in brand.themes))themeId='';
 roles={...brand.roles,...(themeId?brand.themes[themeId].roles:{})};overrides={...brand.overrides};fonts=JSON.parse(JSON.stringify(brand.fonts));editing=false;creating=false;editingTheme=false;dirty=false;
 mode();paint();resetGameFonts();apply();say('');
 if(window.ComposerLookPicker){window.ComposerLookPicker.brand=brandId;window.ComposerLookPicker.theme=themeId}
}
function editTheme(fresh){
 if(!window.ComposerAuth?.has('design.edit'))return;
 creating=fresh;editing=true;editingTheme=true;dirty=false;backTheme=themeId;
 const brand=catalog.brands[brandId];
 // A new season is for every game unless said otherwise; an existing one stays where it lives.
 themeScope=!fresh&&brand.own?.themes?.includes(themeId)?'game':catalog.scope?.canEditShared===false?'game':'shared';
 if(fresh){themeId='';roles={...brand.roles,primary:catalog.brands.default.roles.primary};$('#look-title').value='';$('#look-id-hint').textContent='';staged=true}
 else{staged=false;$('#look-title').value=brand.themes[themeId].title;$('#look-id-hint').textContent='brands/'+brandId+'/themes/'+themeId+'.json'}
 mode();paint();apply();
}
function edit(fresh){
 if(!window.ComposerAuth?.has('design.edit'))return;
 creating=fresh;editing=true;editingTheme=false;dirty=false;
 backTheme=themeId;roles={...catalog.brands[brandId].roles};themeId='';
 fontsGame=false;fonts=JSON.parse(JSON.stringify(catalog.brands[brandId].sharedFonts||catalog.brands[brandId].fonts));
 staged=false;
 if(fresh){$('#look-title').value='';$('#look-id-hint').textContent='';roles.primary=catalog.brands.default.roles.primary;staged=true}
 else{$('#look-title').value=catalog.brands[brandId].title;$('#look-id-hint').textContent='brands/'+brandId+'/'}
 mode();paint();
}
function mode(){
 const brand=catalog.brands[brandId];
 sheet.hidden=!editing;
 $('#look-actions').hidden=!editing;
 placeEditor();
 // The cards stay in the panel as a summary while the editor works in the room; they only stop offering edits.
 panel.querySelectorAll('.look-view').forEach(n=>n.hidden=false);$('#look-brand-card').classList.toggle('editing',editing);
 for(const id of ['look-edit-brand','look-add-brand','look-edit-theme','look-add-theme']){const b=$('#'+id);if(b)b.disabled=editing}
 paintBar();
 panel.querySelector('h2').textContent=editing?(editingTheme?'Season':'Brand'):'Brand';
 $('#sheet-title span').textContent=editingTheme?(creating?'New season':brand.themes[themeId]?.title||''):(creating?'New brand':brand.title);
 $('#sheet-title small').textContent=editingTheme?'season of '+brand.title:(creating?'from '+brand.title:'brand')+(!editingTheme?(layered()?' · all games':cloudDrafts()?' · '+gameTitle()+' only':''):'');
 // Where a season lives: every game, or this one. Chosen for a new season, fixed afterwards.
 const scopeBox=$('#look-scope');scopeBox.hidden=!editingTheme||!layered();
 scopeBox.querySelectorAll('[data-theme-scope]').forEach(n=>{if(n.dataset.themeScope==='game')n.textContent='Only '+gameTitle();n.setAttribute('aria-pressed',String(n.dataset.themeScope===themeScope));n.disabled=!creating||(n.dataset.themeScope!=='game'&&catalog.scope?.canEditShared===false)});
 $('#look-scope-hint').textContent=themeScope==='game'?'Only '+gameTitle()+' offers this season; the other games do not.':'Every game offers this season.';
 // A brand's faces are shared; a game may set its own.
 $('#look-fonts-own').hidden=true;
 const facesHint=$('#look-fonts-hint');facesHint.hidden=editingTheme||!layered();facesHint.textContent='Every game is set in these fonts'+(brand.own?.fonts?', except '+gameTitle()+', which has its own: see Fonts in '+gameTitle()+'.':'. One game can have its own, set below.');
 $('#look-faces').hidden=editingTheme;$('#look-advanced').hidden=editingTheme;
 $('#look-save').textContent=editingTheme?'Save season':'Save brand';$('#look-delete').textContent=editingTheme?'Delete season':'Delete brand';
 $('#look-delete').hidden=creating||(!editingTheme&&brandId==='default');$('#look-danger').hidden=$('#look-delete').hidden;
 $('#look-title').placeholder=editingTheme?'Christmas':'Numba Kenya';
 sheet.classList.toggle('theme-mode',editingTheme);
 // A new brand or theme starts from one colour: only the primary shows until the palette is generated.
 sheet.classList.toggle('staged',staged);
 $('#look-season').hidden=!editingTheme;
 sheet.querySelectorAll('.role-pair').forEach(pair=>pair.hidden=staged&&!pair.querySelector('[data-role-key="primary"]'));
 sheet.querySelectorAll('.role').forEach(row=>row.hidden=staged&&row.dataset.role!=='primary');
 $('#look-colours').hidden=staged;
 if(staged){$('#look-faces').hidden=true;$('#look-advanced').hidden=true}
 $('#look-save').disabled=staged;
}
function paint(){
 for(const [k,v] of Object.entries(roles)){const c=sheet.querySelector(`[data-role-key="${k}"]`),h=sheet.querySelector(`[data-role-hex="${k}"]`),row=c?.closest('.role');if(c)c.value=v;if(h)h.value=v;if(row)row.classList.toggle('themed',(!!themeId||editingTheme)&&v!==brandRoles()[k])}
 const all=colors();
 for(const [k,v] of Object.entries(all)){const c=sheet.querySelector(`[data-key="${k}"]`),h=sheet.querySelector(`[data-hex="${k}"]`),row=c?.closest('.look-colour');if(c)c.value=v;if(h)h.value=v;if(row)row.classList.toggle('overridden',k in overrides)}
 $('#look-advanced .count').textContent=Object.keys(overrides).length?Object.keys(overrides).length+' overridden':'';
 if(sheet.querySelector('[data-family]'))paintFaces();
 $('#look-faces-view').innerHTML=catalog.roles.map(role=>{const f=(editing?fonts:catalog.brands[brandId].sharedFonts||fonts)[role],fam=familyOf(f.file);return `<span><b>${role==='body'?'Body':'Numbers'}</b>${esc(fam?fam.title:f.file)} · ${WEIGHT_TITLES[f.weight]||f.weight}${f.style==='italic'?' italic':''}</span>`}).join('');
 $('#look-strip').innerHTML=catalog.colorRoles.map(r=>`<span title="${esc(r.about)}"><i style="background:${brandRoles()[r.key]}"></i>${esc(r.title)}</span>`).join('');
 audit();
}
function setRole(k,v){roles[k]=v;dirty=true;paint();apply()}
function setOverride(k,v){overrides[k]=v;dirty=true;paint();apply()}
// Every pair the audit reports, for any set of roles: the role behind each side and the
// colour it actually resolves to, so the same list can both explain and repair a palette.
function failuresFor(r,ov){
 const out=[];
 for(const [ink,surface,min,where] of PAIRS){const ratio=contrast(r[ink],r[surface]);if(ratio<min)out.push({ink,surface,min,where,ratio,inkHex:r[ink],surfaceHex:r[surface]})}
 const all={...derive(r),...ov,SECONDARY_ON_SURFACE:r.secondary};
 for(const [inkT,surfT,min,where] of DERIVED_PAIRS){const ratio=contrast(all[inkT],all[surfT]);if(ratio<min)out.push({ink:ROLE_OF[inkT],surface:ROLE_OF[surfT],min,where,ratio,tokens:nice(inkT)+' on '+nice(surfT),inkHex:all[inkT],surfaceHex:all[surfT]})}
 return out;
}
// A generated palette never ships a failing pair: each offending ink is moved away from the
// surface it sits on until it reads, and the surfaces themselves are left as the brand's.
function repair(r){
 const fixed={...r};
 for(let pass=0;pass<16;pass++){
  const fails=failuresFor(fixed,{});
  if(!fails.length)break;
  let moved=false;
  for(const f of fails){
   const role=f.ink;
   if(!role||role==='surface')continue;
   let base=fixed[role];
   if(role.startsWith('on'))base=contrast(inkFor(f.surfaceHex),f.surfaceHex)>contrast(base,f.surfaceHex)?inkFor(f.surfaceHex):base;
   const next=readableHsl(base,f.surfaceHex,f.min);
   if(next!==fixed[role]){fixed[role]=next;moved=true}
  }
  if(!moved)break;
 }
 return fixed;
}
function audit(){
 const failures=[];const worst={};
 for(const f of failuresFor(roles,overrides)){failures.push(f);for(const k of [f.ink,f.surface])if(k&&(!worst[k]||worst[k].ratio>f.ratio))worst[k]={ratio:f.ratio,other:k===f.ink?f.surface:f.ink,min:f.min,where:f.where}}
 sheet.querySelectorAll('.role').forEach(row=>{const k=row.dataset.role,w=worst[k];row.classList.toggle('fail',!!w);row.querySelector('.ratio').textContent=w?w.ratio.toFixed(1)+':1 with '+label(w.other).toLowerCase()+' · needs '+w.min+':1':'';row.title=w?w.where:''});
}
// --- the stage ---------------------------------------------------------------------------------
// A face is previewed by declaring it in the frame under a throwaway family name, so a face
// the generated tokens do not carry yet still shows on the stage as it will once saved.
let faceSeq=0;
function applyFaces(root){
 const doc=frame.contentDocument;if(!doc)return;
 let sheet=doc.getElementById('crash-look-faces');
 if(!sheet){sheet=doc.createElement('style');sheet.id='crash-look-faces';doc.head.append(sheet)}
 const rules=[];faceSeq++;
 for(const role of ['body','numbers']){
  const face=fonts[role];if(!face)continue;
  const fam=familyOf(face.file);if(!fam)continue;
  const path=fam.files[face.weight+'|'+(face.style||'normal')]||fam.files[face.weight+'|normal']||Object.values(fam.files)[0];
  const name='LookFace-'+role+'-'+faceSeq;
  rules.push('@font-face{font-family:'+name+";src:url('crash-ui/assets/fonts/"+path+"');font-weight:"+face.weight+';font-style:'+(face.style||'normal')+'}');
  root.style.setProperty('--font-'+role,name);
 }
 sheet.textContent=rules.join('\n');
}
function apply(){
 const root=frame.contentDocument?.documentElement;if(!root||!catalog?.families)return;
 if(!editing&&!window.ComposerDraftEditors?.enabled){clear();return}
 const all=colors();
 for(const [k,v] of Object.entries(all))root.style.setProperty(cssName(k),v);
 for(const [k,v] of Object.entries(derivedVars(all)))root.style.setProperty(k,v);
 applyFaces(root);
}
function clear(){const root=frame.contentDocument?.documentElement;if(!root||!roles.surface)return;frame.contentDocument.getElementById('crash-look-faces')?.remove();for(const role of ['body','numbers'])root.style.removeProperty('--font-'+role);for(const k of Object.keys(derive(roles)))root.style.removeProperty(cssName(k));for(const k of Object.keys(derivedVars(colors())))root.style.removeProperty(k)}
// --- feedback, fonts, save --------------------------------------------------------------------------
let toastTimer=0;
function toast(text,error){let t=$('#look-toast');if(!t){t=document.createElement('div');t.id='look-toast';t.setAttribute('role','status');document.body.append(t)}t.textContent=text;t.classList.toggle('sound-error',!!error);t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3600)}
function say(text,error){if(error)window.ComposerUX?.status('error',text);const m=$('#look-message');if(m){m.textContent=text||'';m.classList.toggle('sound-error',!!error)}}
function targetId(){if(editingTheme)return creating?slug($('#look-title').value):themeId;return creating?slug($('#look-title').value):brandId}
async function save(){
 const id=targetId();
 if(!id){const t=$('#look-title');t.setAttribute('aria-invalid','true');t.focus();const m=$('#look-message');m.textContent=editingTheme?'Give the season a title first':'Give the brand a title first';m.classList.add('sound-error');return}
 window.ComposerUX?.status('saving');say('Saving…');
 let response;
 if(editingTheme){
  response=await fetch('brands/'+brandId+'/themes/'+id+(layered()&&themeScope==='game'?'?scope=game':''),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:$('#look-title').value||id,roles})});
 }else{
  const faces=Object.fromEntries(Object.entries(fonts).map(([role,face])=>[role,{file:face.file.split('/').pop(),weight:face.weight,style:face.style||'normal'}]));
  const body={from:brandId,title:$('#look-title').value||id,roles,overrides,fonts:faces};
  const post=(url,data)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  if(!layered()||creating)response=await post('brands/'+id,body);
  else{
   // The brand is every game's, its fonts included; a game's own fonts are set under it in Brands.
   // Saved only when something changed, so an untouched brand gets no empty change.
   const before=catalog.brands[id];
   const changed=body.title!==before.title||!sameJSON(roles,before.roles)||!sameJSON(overrides,before.overrides||{})||!sameJSON(faces,strip(before.sharedFonts||before.fonts));
   response={ok:true,json:async()=>({})};
   if(changed)response=await post('brands/'+id,body);
  }
 }
 const data=await response.json().catch(()=>({}));
 if(!response.ok)return say(data.message||('HTTP '+response.status),true);
 dirty=false;
 const savedBrand=editingTheme?brandId:id,savedTheme=editingTheme?id:'';
 try{sessionStorage.setItem('crash-composer-look',savedBrand);sessionStorage.setItem('crash-composer-look-theme',savedTheme)}catch{}
 const p=new URLSearchParams(location.hash.slice(1));p.set('tab','look');p.set('brand',savedBrand);if(savedTheme)p.set('theme',savedTheme);else p.delete('theme');
 // The page comes back without this module's memory; the toast is left for it to show.
 try{sessionStorage.setItem('composer-toast','Saved to '+(layered()&&!(editingTheme&&themeScope==='game')?'the brands draft of every game':gameTitle()+'’s draft')+' · see Changes')}catch{}
 location.hash='#'+p;location.reload();
}
async function remove(){
 if(creating)return;
 if(editingTheme){
  const own=layered()&&catalog.brands[brandId].own?.themes?.includes(themeId);
  if(!confirm('Remove season '+catalog.brands[brandId].themes[themeId].title+' from '+catalog.brands[brandId].title+(layered()?(own?' in '+gameTitle():' in every game'):'')+'?'))return;
  const r=await fetch('brands/'+brandId+'/themes/'+themeId+(own?'?scope=game':''),{method:'DELETE'});
  if(!r.ok)return say('Could not remove: HTTP '+r.status,true);
  try{sessionStorage.setItem('crash-composer-look',brandId);sessionStorage.setItem('crash-composer-look-theme','')}catch{}
  const p=new URLSearchParams(location.hash.slice(1));p.set('tab','look');p.delete('theme');location.hash='#'+p;location.reload();return;
 }
 if(brandId==='default')return;
 if(!confirm('Remove brand '+catalog.brands[brandId].title+(layered()?' from every game?':' from the kit?')))return;
 const response=await fetch('brands/'+brandId,{method:'DELETE'});
 if(!response.ok)return say('Could not remove: HTTP '+response.status,true);
 try{sessionStorage.setItem('crash-composer-look','default')}catch{}
 const p=new URLSearchParams(location.hash.slice(1));p.set('tab','look');p.delete('brand');location.hash='#'+p;location.reload();
}
// --- lifecycle ------------------------------------------------------------------------------------
// One at a time: the games, the tabs and the first load can all ask for the look at once.
let opening=Promise.resolve();
function open(){return opening=opening.catch(()=>{}).then(load)}
async function load(){
 if(window.ComposerDraftEditors?.enabled&&!editing)catalog=null;
 if(!catalog){
  catalog=await (await fetch('brands/')).json();render();
  let wanted='',wantedTheme=null;try{wanted=sessionStorage.getItem('crash-composer-look')||'';wantedTheme=sessionStorage.getItem('crash-composer-look-theme');sessionStorage.removeItem('crash-composer-look');sessionStorage.removeItem('crash-composer-look-theme')}catch{}
  const hash=new URLSearchParams(location.hash.slice(1));
  if(!wanted)wanted=hash.get('brand')||window.ComposerLookPicker?.brand||'default';
  if(wantedTheme===null)wantedTheme=hash.get('theme')||window.ComposerLookPicker?.theme||'';
  if(!catalog.brands[wanted])wanted='default';
  if(!(wantedTheme in catalog.brands[wanted].themes))wantedTheme='';
  if(window.ComposerLookPicker){window.ComposerLookPicker.brand=wanted;window.ComposerLookPicker.theme=wantedTheme}
  Workbench.applyLook(frame,{brand:wanted,theme:wantedTheme});
  lookPicker.brand=wanted;lookPicker.theme=wantedTheme;show(wanted,wantedTheme);
 }else{
  const current=window.ComposerLookPicker?.brand||'default',currentTheme=window.ComposerLookPicker?.theme||'';
  // Game leaves the stage plain, so coming back here puts the chosen look on it again.
  Workbench.applyLook(frame,{brand:current,theme:currentTheme});
  if(!editing&&(current!==brandId||currentTheme!==themeId)&&catalog.brands[current]){lookPicker.brand=current;lookPicker.theme=currentTheme;show(current,currentTheme)}else apply();
 }
}
// The pick rides along into every tab. An unsaved edit is only previewed on the Brands tab.
window.addEventListener('composer-workspace',e=>{
 if(e.detail==='look')open().catch(err=>{panel.innerHTML='<small class="sound-error">'+esc(err.message)+'</small>'});
 else if(editing){if(catalog)clear()}
 else if(catalog){Workbench.applyLook(frame,{brand:brandId,theme:themeId});apply()}
 else open().catch(()=>{})});
frame.addEventListener('load',()=>{if(catalog&&(!editing||window.ComposerTarget?.workspace==='look'))setTimeout(apply,300)});
// The editor in the room belongs to the Brands tab: another tab puts it away, coming back brings it out.
window.addEventListener('composer-workspace',()=>{if(catalog&&sheet)placeEditor()});
window.ComposerTarget.guard(()=>{if(gf.dirty){$('#game-fonts-note').textContent='Save or cancel the fonts before switching games.';$('#game-fonts-note').classList.add('sound-error');return false}if(dirty){say('Save or cancel your design edits before switching games.',true);return false}return true});
window.addEventListener('composer-target',()=>{catalog=null;editing=false;clear();open().catch(e=>say(e.message,true))});
// The Library gave a brand a family: the brands are read again so the cards and the stage show it.
window.addEventListener('composer-brand-fonts',()=>{if(editing)return;catalog=null;open().catch(e=>say(e.message,true))});
// Another tab (Library) can change a brand's faces; the pick is read again when it says so.
window.addEventListener('composer-look-changed',()=>{if(editing)return;catalog=null;open().catch(e=>say(e.message,true))});
open().catch(()=>{});
window.ComposerLook={pick:pickLook,get catalog(){return catalog},// Assets sends here to set a brand's fonts: the one place they are chosen.
 editBrand(){$('#look-tab').click();opening.then(()=>{if(!editing)edit(false);$('#look-faces')?.scrollIntoView({block:'center'})})},
 get dirty(){return dirty},get roles(){return roles},get brand(){return brandId},get editing(){return editing}};
})();

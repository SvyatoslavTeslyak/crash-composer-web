/* Workbench pieces shared by the showcase and Composer: the game picker, the device bar
   and the look (brand and theme) pickers. Pages own their state and pass callbacks; this
   module only builds the controls and keeps them in step. Brands and themes come from
   crash-ui/tokens.js, so a new brand in the kit appears here without any change. */
(function(){
'use strict';
const h=(tag,attrs={},html='')=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs))if(k==='class')n.className=v;else if(k.startsWith('data-'))n.dataset[k.slice(5)]=v;else n.setAttribute(k,v);n.innerHTML=html;return n};
// Real devices, in CSS pixels: what the games are designed for first, then a tablet and a laptop.
const DEVICES=[
 {id:'mobile',title:'Mobile',size:'390 × 844',w:390,h:844,bezel:true,icon:icon('mobile')},
 {id:'tablet',title:'Tablet',size:'820 × 1180',w:820,h:1180,bezel:true,icon:icon('tablet')},
 {id:'desktop',title:'Desktop',size:'1440 × 900',w:1440,h:900,bezel:false,icon:icon('desktop')},
 {id:'fluid',title:'Fluid',size:'fills page',w:0,h:0,bezel:false,icon:icon('fluid')},
];
const ZOOMS=[['fit','Fit'],['0.5','50%'],['0.75','75%'],['1','100%']];

/** A drop-down of games with thumbnail rows. games: [{id,title}], thumb(id) → url, subtitle(id) → text. */
function gamePicker({container,games,value,thumb,subtitle=()=>'',onPick,footer=null}){
 container.className='picker';
 const pick=h('button',{class:'game pick wb-button',type:'button','aria-haspopup':'listbox','aria-expanded':'false'},'<img alt="" width="40" height="40"><span><strong></strong><small></small></span>'+icon('chevron')+'');
 const list=h('div',{class:'games',role:'listbox',hidden:''});
 container.replaceChildren(pick,list);
 let current=value;
 const open=on=>{list.hidden=!on;pick.setAttribute('aria-expanded',String(on))};
 const show=()=>{const g=games.find(x=>x.id===current)||games[0];if(!g)return;pick.querySelector('img').src=thumb(g.id);pick.querySelector('strong').textContent=g.title;pick.querySelector('small').textContent=subtitle(g.id);
  list.querySelectorAll('.game').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.game===current)))};
 const fill=()=>{list.replaceChildren(...games.map(g=>{const b=h('button',{class:'game wb-button',type:'button',role:'option','data-game':g.id},`<img src="${thumb(g.id)}" alt="" width="40" height="40"><span><strong>${g.title}</strong><small>${subtitle(g.id)}</small></span>`);b.onclick=()=>{open(false);if(g.id!==current){current=g.id;show();onPick(g.id)}};return b}));if(footer){footer.classList.add('games-footer');list.append(footer)}};
 pick.onclick=()=>open(list.hidden);
 document.addEventListener('click',e=>{if(!container.contains(e.target))open(false)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')open(false)});
 fill();show();
 return {get value(){return current},set value(id){if(games.some(g=>g.id===id)){current=id;show()}},refresh(){fill();show()},close:()=>open(false)};
}

/** Device buttons plus a zoom row. onChange({device,zoom}) fires on every pick. */
function deviceBar({container,zoomContainer,device='mobile',zoom='fit',onChange}){
 container.className='devices';
 container.replaceChildren(...DEVICES.map(d=>{const b=h('button',{class:'device wb-button',type:'button','data-device':d.id},`${d.icon}<b>${d.title}</b><span>${d.size}</span>`);b.onclick=()=>{device=d.id;paint();onChange({device,zoom})};return b}));
 if(zoomContainer){zoomContainer.className='zoom';zoomContainer.replaceChildren(...ZOOMS.map(([z,label])=>{const b=h('button',{class:'wb-button',type:'button','data-zoom':z},label);b.onclick=()=>{zoom=z;paint();onChange({device,zoom})};return b}))}
 const paint=()=>{container.querySelectorAll('.device').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.device===device)));
  if(zoomContainer){zoomContainer.querySelectorAll('[data-zoom]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zoom===zoom)));zoomContainer.hidden=!DEVICES.find(d=>d.id===device).w}};
 paint();
 return {get device(){return device},set device(id){if(DEVICES.some(d=>d.id===id)){device=id;paint()}},get zoom(){return zoom},set zoom(z){zoom=z;paint()},info:()=>DEVICES.find(d=>d.id===device)};
}

/** Brand and theme chips from CrashTokens; the theme row shows the chosen brand's themes. onChange({brand,theme}). */
function lookPicker({container,brand='default',theme='',onChange,onAddTheme=null,onAddBrand=null,themes=true,catalogTokens=null}){
 const tokens=catalogTokens||window.CrashTokens||{BRANDS:{default:'Lotomobil'},THEMES:{}};
 const themesOf=b=>(tokens.THEMES||{})[b]||{};
 container.className='look';
 const brandRow=h('div',{class:'look-row',role:'group','aria-label':'Brand'}),themeRow=h('div',{class:'look-row',role:'group','aria-label':'Theme'}),themeNote=h('em',{class:'note'},'Theme');
 const themeBox=h('div',{class:'look-themes'});
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const swatch=c=>c?`<i class="swatch" style="background:${c}"></i>`:'';
 for(const [id,title] of Object.entries(tokens.BRANDS)){const b=h('button',{class:'wb-button',type:'button','data-brand':id,title},swatch((tokens.BRAND_SWATCHES||{})[id])+escape(title.replace(/ \(.*\)$/,'')));b.onclick=()=>{brand=id;if(!(theme in themesOf(brand)))theme='';fillThemes();paint();onChange({brand,theme})};brandRow.append(b)}
 if(onAddBrand){const add=h('button',{class:'wb-button add',type:'button',title:'New brand'},icon('plus')+'Add new');add.onclick=()=>onAddBrand();brandRow.append(add)}
 function fillThemes(){
  themeRow.replaceChildren();
  const none=h('button',{class:'wb-button season-off',type:'button','data-theme':'',title:'The brand as designed, no season over it'},'No season');none.onclick=()=>{theme='';paint();onChange({brand,theme})};themeRow.append(none);
  for(const [id,title] of Object.entries(themesOf(brand))){const b=h('button',{class:'wb-button',type:'button','data-theme':id},swatch(((tokens.THEME_SWATCHES||{})[brand]||{})[id])+escape(title));b.onclick=()=>{theme=id;paint();onChange({brand,theme})};themeRow.append(b)}
  if(onAddTheme){const add=h('button',{class:'wb-button add',type:'button',title:'New theme for this brand'},icon('plus')+'Add new');add.onclick=()=>onAddTheme(brand);themeRow.append(add)}
  themeNote.textContent=(tokens.BRANDS[brand]||'This brand')+' · seasons';
 }
 themeBox.replaceChildren(themeNote,themeRow);
 container.replaceChildren(...(themes?[h('em',{class:'note'},'Brand'),brandRow,themeBox]:[brandRow]));
 const paint=()=>{brandRow.querySelectorAll('button:not(.add)').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.brand===brand)));themeRow.querySelectorAll('button:not(.add)').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.theme||'')===theme)))};
 fillThemes();paint();
 return {get brand(){return brand},set brand(id){if(id in tokens.BRANDS){brand=id;if(!(theme in themesOf(brand)))theme='';fillThemes();paint()}},get theme(){return theme},set theme(id){if(!id||id in themesOf(brand)){theme=id||'';paint()}},get themes(){return themesOf(brand)}};
}

/** Apply a look to the kit running inside a same-origin frame, once its UI exists. */
function applyLook(frame,{brand,theme}){
 let tries=0;const attempt=()=>{const ui=frame.contentWindow?.CrashUI?.GameUI;if(ui&&typeof ui.setBrand==='function'){ui.setBrand(brand||'default');ui.setTheme(theme||'');return true}
  // A build made from a kit before brands has no setter; the look then arrives through the URL on the next load.
  if(ui)return true;return ++tries>200};
 if(!attempt()){const timer=setInterval(()=>{if(attempt())clearInterval(timer)},100)}
}
/** The stage: a frame shown as the chosen device, with a bezel for handhelds, scaled to fit
    the room or to a zoom, so the game inside still believes it has the device's real size.
    Elements: fit (the room), box (takes the scaled size), stage (the device), frame (the iframe),
    size (optional label). Call set({device,zoom}) after every change; resize re-fits. */
function stage({fit,box,stage,frame,size}){
 let device=DEVICES[0],zoom='fit';
 const BEZEL=24;
 function apply(){
  const d=device;
  if(size)size.hidden=!d.w;
  box.classList.toggle('fluid',!d.w);stage.classList.toggle('fluid',!d.w);stage.classList.toggle('bezel',d.bezel);
  if(!d.w){box.style.width=box.style.height='';stage.style.width=stage.style.height='';stage.style.transform='';frame.style.width=frame.style.height='';return}
  const pad=d.bezel?BEZEL:0;stage.style.width=(d.w+pad)+'px';stage.style.height=(d.h+pad)+'px';frame.style.width=frame.style.height='';
  refit();
 }
 function refit(){
  const d=device;if(!d.w)return;
  const area=fit.getBoundingClientRect();const w=stage.offsetWidth,h=stage.offsetHeight;
  const scale=zoom==='fit'?Math.min(1,(area.width-8)/w,(area.height-28)/h):Number(zoom);
  stage.style.transform=`scale(${scale})`;box.style.width=(w*scale)+'px';box.style.height=(h*scale)+'px';
  if(size)size.textContent=d.w+' × '+d.h+(scale<0.999?' · shown at '+Math.round(scale*100)+'%':'');
 }
 new ResizeObserver(refit).observe(fit);
 return {set({device:id,zoom:z}){if(id)device=DEVICES.find(d=>d.id===id)||(id.w?id:device);if(z)zoom=z;apply()},custom(w,h){device={id:'custom',w,h,bezel:false};apply()},get device(){return device},refit};
}
const lookQuery=({brand,theme})=>(brand&&brand!=='default'?'&brand='+brand:'')+(theme?'&theme='+theme:'');

window.Workbench={DEVICES,ZOOMS,gamePicker,deviceBar,lookPicker,applyLook,lookQuery,stage};
})();

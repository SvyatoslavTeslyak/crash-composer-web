/* Find (⌘K / Ctrl+K): one box to jump to a game, a tab, a brand or season, a language, or
   anything a tab registers (Texts adds its windows and texts). It only moves around: every
   jump goes through the same controls a click would, so guards and permissions still apply. */
(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const css=`
.palette-scrim{position:fixed;inset:0;z-index:2147482000;display:grid;justify-items:center;align-items:start;padding:12vh 16px 16px;background:rgba(3,6,10,.6)}
.palette{width:min(580px,100%);background:var(--inspector-card,#151e29);border:1px solid var(--inspector-border-strong,#3b4a5e);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.6);overflow:hidden;color:var(--inspector-text,#e2e7ee);font:14px/1.4 var(--inspector-sans,system-ui,sans-serif)}
.palette input{all:unset;box-sizing:border-box;display:block;width:100%;height:52px;padding:0 18px;border-bottom:1px solid var(--inspector-border,#303844);font-size:15px}
.palette ul{list-style:none;margin:0;padding:6px;max-height:min(420px,60vh);overflow:auto}
.palette li{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer}
.palette li.on{background:var(--inspector-surface-hover,#2a3442)}
.palette li .sw{width:10px;height:10px;border-radius:50%;flex:none;border:1px solid rgba(255,255,255,.18)}
.palette li img{width:22px;height:22px;border-radius:6px;flex:none}
.palette li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.palette li small{margin-left:auto;padding-left:12px;color:var(--inspector-muted,#98a5b5);font-size:12px;white-space:nowrap}
.palette .empty{padding:14px;color:var(--inspector-muted,#98a5b5)}`;
document.head.append(Object.assign(document.createElement('style'),{textContent:css}));
const sources=[];
const TABS=[['look','Brands'],['library','Library'],['layout','Game'],['translates','Texts'],['sound','Sounds']];
const LANGS=[['en','English'],['fr','Français'],['ht','Kreyòl']];
sources.push(()=>{
 const T=window.ComposerTarget,out=[];
 for(const t of T?.targets||[])if(t.id!=='kit'&&T.offered(t.id))out.push({title:t.title,kind:'Game',icon:'icons/'+t.id+'.png',go:()=>T.set(t.id)});
 for(const [id,title] of TABS){const tab=$('#'+id+'-tab');if(tab&&!tab.hidden)out.push({title,kind:'Tab',go:()=>tab.click()})}
 const cat=window.ComposerLook?.catalog;
 if(cat)for(const [bid,b] of Object.entries(cat.brands)){
  out.push({title:b.title,kind:'Brand',swatch:b.roles?.primary,go:()=>window.ComposerLook.pick({brand:bid,theme:''})});
  for(const [tid,t] of Object.entries(b.themes||{}))out.push({title:t.title,kind:'Season · '+b.title,swatch:t.roles?.primary||b.roles?.primary,go:()=>window.ComposerLook.pick({brand:bid,theme:tid})});
 }
 const lang=$('#language');
 if(lang)for(const [id,title] of LANGS)out.push({title,kind:'Preview language',go:()=>{lang.value=id;lang.dispatchEvent(new Event('change',{bubbles:true}))}});
 return out;
});
let scrim=null;
function close(){if(!scrim)return;scrim.remove();scrim=null}
function open(){
 if(scrim)return;
 const items=sources.flatMap(f=>{try{return f()||[]}catch{return []}});
 scrim=document.createElement('div');scrim.className='palette-scrim';
 scrim.innerHTML='<div class="palette" role="dialog" aria-label="Find"><input id="palette-q" type="text" placeholder="Find a game, tab, brand, season or text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="palette-list"><ul id="palette-list" role="listbox"></ul></div>';
 document.body.append(scrim);
 const input=$('#palette-q'),list=$('#palette-list');let shown=[],on=0;
 const draw=()=>{
  const words=input.value.toLowerCase().split(/\s+/).filter(Boolean);
  shown=items.filter(i=>{const hay=(i.title+' '+i.kind).toLowerCase();return words.every(w=>hay.includes(w))}).slice(0,40);
  on=Math.min(on,Math.max(0,shown.length-1));
  list.innerHTML=shown.map((i,n)=>`<li role="option" data-n="${n}" class="${n===on?'on':''}" aria-selected="${n===on}">${i.icon?`<img src="${esc(i.icon)}" alt="">`:i.swatch?`<i class="sw" style="background:${esc(i.swatch)}"></i>`:''}<span>${esc(i.title)}</span><small>${esc(i.kind)}</small></li>`).join('')||'<div class="empty">Nothing matches.</div>';
  list.querySelector('.on')?.scrollIntoView({block:'nearest'});
 };
 const pick=n=>{const i=shown[n];close();if(i)i.go()};
 list.addEventListener('mousemove',e=>{const li=e.target.closest('li');if(li&&Number(li.dataset.n)!==on){on=Number(li.dataset.n);draw()}});
 list.addEventListener('click',e=>{const li=e.target.closest('li');if(li)pick(Number(li.dataset.n))});
 scrim.addEventListener('mousedown',e=>{if(e.target===scrim)close()});
 input.oninput=()=>{on=0;draw()};
 input.onkeydown=e=>{
  if(e.key==='ArrowDown'){e.preventDefault();on=Math.min(shown.length-1,on+1);draw()}
  else if(e.key==='ArrowUp'){e.preventDefault();on=Math.max(0,on-1);draw()}
  else if(e.key==='Enter'){e.preventDefault();pick(on)}
  else if(e.key==='Escape'){e.preventDefault();close()}
 };
 draw();input.focus();
}
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&!e.altKey&&e.key.toLowerCase()==='k'){e.preventDefault();scrim?close():open()}});
$('#palette-open')?.addEventListener('click',open);
window.ComposerPalette={open,close,add(fn){sources.push(fn)}};
})();

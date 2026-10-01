/* Every <select> opens Composer's own list instead of the system menu. The select itself
   stays: it is still the control on the page, holds the value and fires input and change,
   so nothing that reads a select needs to know. Only the menu that opens is replaced. */
(()=>{
'use strict';
const css=`
.dd-menu{position:fixed;z-index:2147483000;display:grid;gap:2px;box-sizing:border-box;max-height:320px;overflow:auto;padding:6px;background:var(--inspector-card,#151e29);border:1px solid var(--inspector-border,#2a3646);border-radius:var(--inspector-radius-card,10px);box-shadow:0 12px 32px rgba(0,0,0,.45);font:14px/1.3 var(--inspector-sans,system-ui,sans-serif);color:var(--inspector-text,#e6ebf2)}
.dd-menu [role=option]{all:unset;box-sizing:border-box;display:grid;grid-template-columns:16px minmax(0,1fr);align-items:center;gap:8px;min-height:34px;padding:0 12px 0 8px;border:1px solid transparent;border-radius:8px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-menu [role=option] span{overflow:hidden;text-overflow:ellipsis}
.dd-menu [role=option].active{background:var(--inspector-surface-hover,#1f2a38)}
.dd-menu [role=option][aria-selected=true]{background:var(--inspector-surface-selected,#1b2a3d);border-color:var(--inspector-accent,#70ccff)}
.dd-menu [role=option][aria-disabled=true]{opacity:.45;cursor:not-allowed}
.dd-menu [role=option] svg{width:14px;height:14px;fill:none;stroke:var(--inspector-accent,#70ccff);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;visibility:hidden}
.dd-menu [role=option][aria-selected=true] svg{visibility:visible}
.dd-menu .dd-group{padding:8px 8px 2px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--inspector-muted,#8a97a8)}
select.dd-open{border-color:var(--inspector-accent,#70ccff)}`;
document.head.append(Object.assign(document.createElement('style'),{textContent:css}));
const CHECK='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.5 3.2 3.2L13 4.8"/></svg>';
let menu=null,owner=null,active=-1,typed='',typedAt=0;
const custom=s=>s instanceof HTMLSelectElement&&!s.multiple&&s.size<2;
const items=()=>menu?[...menu.querySelectorAll('[role=option]')]:[];
function close(){if(!menu)return;menu.remove();owner.classList.remove('dd-open');owner.removeAttribute('aria-expanded');menu=null;owner=null}
function mark(i,scroll=true){const all=items();if(!all.length)return;active=Math.max(0,Math.min(all.length-1,i));all.forEach((n,k)=>n.classList.toggle('active',k===active));if(scroll)all[active].scrollIntoView({block:'nearest'})}
function step(d){const all=items();let i=active;for(let k=0;k<all.length;k++){i=(i+d+all.length)%all.length;if(all[i].getAttribute('aria-disabled')!=='true')return mark(i)}}
function choose(i){
 const node=items()[i],select=owner;if(!node||node.getAttribute('aria-disabled')==='true')return;
 const index=Number(node.dataset.index);close();select.focus();
 if(select.selectedIndex===index)return;
 select.selectedIndex=index;
 select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));
}
function place(){
 const r=owner.getBoundingClientRect(),gap=6;
 menu.style.minWidth=r.width+'px';menu.style.maxWidth=Math.max(r.width,Math.min(420,innerWidth-16))+'px';
 const h=Math.min(menu.scrollHeight+2,320),below=innerHeight-r.bottom-gap-8,up=below<Math.min(h,160)&&r.top>below;
 menu.style.maxHeight=Math.max(120,Math.min(320,(up?r.top:innerHeight-r.bottom)-gap-8))+'px';
 menu.style.left=Math.max(8,Math.min(r.left,innerWidth-menu.offsetWidth-8))+'px';
 if(up){menu.style.top='';menu.style.bottom=(innerHeight-r.top+gap)+'px'}else{menu.style.bottom='';menu.style.top=(r.bottom+gap)+'px'}
}
function open(select){
 close();if(select.disabled)return;
 owner=select;menu=document.createElement('div');menu.className='dd-menu';menu.setAttribute('role','listbox');
 const label=select.getAttribute('aria-label');if(label)menu.setAttribute('aria-label',label);
 const option=o=>{if(o.hidden)return null;const b=document.createElement('div');b.setAttribute('role','option');b.dataset.index=o.index;b.setAttribute('aria-selected',String(o.index===select.selectedIndex));if(o.disabled||o.parentElement.disabled)b.setAttribute('aria-disabled','true');if(o.title)b.title=o.title;b.innerHTML=CHECK+'<span></span>';b.lastChild.textContent=o.label||o.textContent;return b};
 for(const child of select.children){
  if(child instanceof HTMLOptGroupElement){const g=document.createElement('div');g.className='dd-group';g.textContent=child.label;menu.append(g,...[...child.children].map(option).filter(Boolean))}
  else{const b=option(child);if(b)menu.append(b)}
 }
 // Inside a modal dialog the list has to live in it, or it would sit under the dialog.
 (select.closest('dialog[open]')||document.body).append(menu);
 select.classList.add('dd-open');select.setAttribute('aria-expanded','true');
 place();
 const all=items();mark(Math.max(0,all.findIndex(n=>n.getAttribute('aria-selected')==='true')));
 menu.addEventListener('mousemove',e=>{const n=e.target.closest('[role=option]');if(n)mark(all.indexOf(n),false)});
 menu.addEventListener('mousedown',e=>e.preventDefault()); // keep the focus on the select
 menu.addEventListener('click',e=>{const n=e.target.closest('[role=option]');if(n)choose(all.indexOf(n))});
}
document.addEventListener('mousedown',e=>{
 if(menu&&menu.contains(e.target))return;
 const select=e.target.closest?.('select');
 if(!select||!custom(select)){close();return}
 if(e.button!==0)return;
 e.preventDefault();select.focus();
 if(owner===select)close();else open(select);
},true);
document.addEventListener('keydown',e=>{
 if(menu){
  const all=items();
  if(e.key==='Escape'||e.key==='Tab'){if(e.key==='Escape'){e.preventDefault();e.stopPropagation()}close();return}
  if(e.key==='ArrowDown'){e.preventDefault();step(1)}
  else if(e.key==='ArrowUp'){e.preventDefault();step(-1)}
  else if(e.key==='Home'){e.preventDefault();active=-1;step(1)}
  else if(e.key==='End'){e.preventDefault();active=all.length;step(-1)}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(active)}
  else if(e.key.length===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
   const now=Date.now();typed=(now-typedAt<700?typed:'')+e.key.toLowerCase();typedAt=now;
   const i=all.findIndex(n=>n.textContent.trim().toLowerCase().startsWith(typed)&&n.getAttribute('aria-disabled')!=='true');if(i>=0)mark(i);e.preventDefault();
  }
  return;
 }
 const select=e.target;
 if(!custom(select)||select.disabled)return;
 if(e.key===' '||e.key==='Enter'||e.key==='ArrowDown'||e.key==='ArrowUp'||(e.altKey&&e.key.startsWith('Arrow'))){e.preventDefault();open(select)}
},true);
document.addEventListener('focusout',e=>{if(menu&&e.target===owner)setTimeout(()=>{if(menu&&document.activeElement!==owner)close()},0)});
addEventListener('resize',close);
addEventListener('blur',close);
document.addEventListener('scroll',e=>{if(menu&&e.target!==menu&&!menu.contains(e.target))close()},true);
})();

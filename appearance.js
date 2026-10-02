/* Dark or light, for Composer and the showcase alike. The choice is kept in this browser; it is
   applied before the page draws (this file is loaded in <head>), and any button marked
   data-appearance-toggle switches it. */
(()=>{
 const KEY='composer-appearance',root=document.documentElement;
 const read=()=>{try{return localStorage.getItem(KEY)}catch{return null}};
 const set=value=>{if(value==='light')root.dataset.appearance='light';else delete root.dataset.appearance;try{localStorage.setItem(KEY,value)}catch{}paint()};
 const paint=()=>{const light=root.dataset.appearance==='light';for(const b of document.querySelectorAll('[data-appearance-toggle]')){const label=light?'Dark theme':'Light theme';b.setAttribute('aria-label',label);b.title=label;const i=b.querySelector('[data-appearance-icon]');if(i&&window.icon)i.innerHTML=window.icon(light?'moon':'sun');const t=b.querySelector('[data-appearance-label]');if(t)t.textContent=light?'Dark':'Light'}};
 if(read()==='light')root.dataset.appearance='light';
 document.addEventListener('click',e=>{if(e.target.closest('[data-appearance-toggle]'))set(root.dataset.appearance==='light'?'dark':'light')});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',paint);else paint();
 window.ComposerAppearance={set,get:()=>root.dataset.appearance==='light'?'light':'dark'};
})();

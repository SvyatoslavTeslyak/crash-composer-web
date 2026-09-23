/* Per-game private design/audio drafts. File libraries are immutable inputs. */
(()=>{
 const nativeFetch=window.fetch.bind(window),base=new URL('./',location.href),snapshots=new Map();
 const clone=v=>structuredClone(v),key=(g,s)=>g+':'+s;
 const result=r=>{if(r.error)throw Error(r.error.message);return r.data};
 const enabled=()=>!!window.ComposerAuth?.session&&!window.ComposerAuth.local;
 const game=()=>window.ComposerTarget?.value;
 async function read(g,s){
  const pending=s==='audio'?document.querySelector('#sound-tab.workspace-dirty'):window.ComposerLook?.dirty;
  if(pending&&snapshots.has(key(g,s)))return clone(snapshots.get(key(g,s)));
  const value=result(await ComposerAuth.client.from('composer_drafts').select('*').eq('game_id',g).single());
  snapshots.set(key(g,s),clone(value));return value;
 }
 async function save(g,s,value){
  if(!ComposerAuth.has(s==='design'?'design.edit':'audio.edit',g))throw Error('You do not have permission to edit this section.');
  const old=snapshots.get(key(g,s));if(!old)throw Error('Reload this section before saving.');
  const saved=result(await ComposerAuth.client.rpc('composer_save_section',{p_game:g,p_revision:old.revision,p_section:s,p_value:value}));
  snapshots.set(key(g,s),clone(saved));window.dispatchEvent(new CustomEvent('composer-draft-saved',{detail:{game:g,section:s,revision:saved.revision}}));return saved;
 }
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 async function original(path){const r=await nativeFetch(path,{cache:'no-store'});if(!r.ok)throw Error('Editor catalog unavailable');return r.json()}
 function mergeBrands(catalog,design){
  for(const [id,brand] of Object.entries(design?.brands||{})){
   if(brand===null)delete catalog.brands[id];else catalog.brands[id]={...(catalog.brands[id]||{}),...clone(brand)};
  }
  catalog.draftSelection=design?.selection;return catalog;
 }
 function editableBrand(b){return {title:b.title,roles:clone(b.roles||{}),overrides:clone(b.overrides||{}),fonts:clone(b.fonts||{}),themes:Object.fromEntries(Object.entries(b.themes||{}).map(([id,t])=>[id,{title:t.title,roles:clone(t.roles||{})}]))}}
 function applyAudio(manifest,patch){
  if(!patch)return manifest;
  for(const change of patch.events||[]){
   const event=manifest.events.find(e=>e.id===change.id);if(!event)throw Error('Sound catalog changed. Reload before saving.');
   if(event.takes.length!==change.takes.length)throw Error('Sound files changed. Reload before saving.');
   for(const field of ['volume_db','pitch_jitter','prompt'])if(field in change)event[field]=change[field];
   event.takes.forEach((t,i)=>t.enabled=change.takes[i].enabled);
  }
  return manifest;
 }
 async function baseline(payload,g){
  const out={translations:{},design:{brands:{},selection:{brand:'default',theme:''}},audio:{},_labels:{translations:{},brands:{},events:{}}};
  if(payload.translations){const data=await original('translations?game='+encodeURIComponent(g));out.translations=data.overrides||{};for(const [id,values] of Object.entries(payload.translations)){const entry=data.catalog.entries[id];if(entry){out._labels.translations[id]=entry.source;out.translations[id]={...Object.fromEntries(Object.keys(values).map(lang=>[lang,entry[lang]||entry.source])),...out.translations[id]}}}}
  if(payload.design){const data=await original('brands/');for(const id of Object.keys(payload.design.brands||{}))if(data.brands[id]){out.design.brands[id]=editableBrand(data.brands[id]);out._labels.brands[id]=data.brands[id].title}}
  if(payload.audio){const data=await original('studio/catalog?engine=pixi');for(const [id,patch] of Object.entries(payload.audio)){const m=data.sources.find(s=>s.id===id)?.manifest;if(m){out._labels.events[id]=Object.fromEntries(m.events.map(e=>[e.id,e.label||e.id]));out.audio[id]={events:patch.events.map(c=>m.events.find(e=>e.id===c.id)).filter(Boolean).map(e=>({id:e.id,volume_db:e.volume_db??null,pitch_jitter:e.pitch_jitter||0,...('prompt' in e?{prompt:e.prompt}:{}),takes:e.takes.map(t=>({enabled:t.enabled!==false}))}))}}}}
  return out;
 }
 window.ComposerDraftEditors={get enabled(){return enabled()},baseline,selection:()=>snapshots.get(key(game(),'design'))?.payload.design?.selection,applyAudio};
 window.fetch=async(input,options={})=>{
  const url=new URL(input instanceof Request?input.url:input,location.href),path=url.pathname.slice(base.pathname.length),method=(options.method||'GET').toUpperCase();
  if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||!(/^(brands\/|studio\/(catalog|save|restore|upload))/.test(path)))return nativeFetch(input,options);
  await window.ComposerAuth.ready;
  if(!enabled())return nativeFetch(input,options);
  const g=game();
  if(!g||g==='kit')return method==='GET'?nativeFetch(input,options):json({message:'Select a game to edit its private draft.'},400);
  try{
   if(path==='brands/'&&method==='GET')return json(mergeBrands(await original('brands/'),(await read(g,'design')).payload.design));
   if(path==='studio/catalog'&&method==='GET'){
    const catalog=await original('studio/catalog'+url.search),d=await read(g,'audio');
    for(const source of catalog.sources)if(source.manifest)applyAudio(source.manifest,d.payload.audio?.[source.id]);
    return json(catalog);
   }
   if(path.startsWith('brands/')&&['POST','DELETE'].includes(method)){
    const parts=path.split('/');if(!/^[a-z][a-z0-9-]{1,30}$/.test(parts[1])||(parts.length>2&&(parts.length!==4||parts[2]!=='themes'||!/^[a-z][a-z0-9-]{1,30}$/.test(parts[3]))))throw Error('Invalid brand or theme');
    const old=snapshots.get(key(g,'design'));if(!old)throw Error('Reload Brands before saving.');
    const design=clone(old.payload.design||{brands:{}}),catalog=mergeBrands(await original('brands/'),design),body=options.body?JSON.parse(options.body):{};
    const id=parts[1],theme=parts[3];
    if(method==='DELETE'&&!theme){if(id==='default')throw Error('Cannot remove default brand');design.brands[id]=null;design.selection={brand:'default',theme:''}}
    else{
     const originalBrand=catalog.brands[id]||catalog.brands[body.from]||catalog.brands.default,b=editableBrand(originalBrand);
     if(theme){if(method==='DELETE')delete b.themes[theme];else b.themes[theme]={title:body.title,roles:body.roles}}
     else{for(const field of ['title','roles','overrides','fonts'])if(field in body)b[field]=clone(body[field])}
     const allowedFonts=new Set(catalog.fonts.map(f=>typeof f==='string'?f:f.file));
     for(const face of Object.values(b.fonts))if(!allowedFonts.has(face.file)&&!catalog.fonts.some(f=>(typeof f==='string'?f:f.file)?.split('/').pop()===face.file))throw Error('Choose a font from the shared library.');
     design.brands[id]=b;design.selection={brand:id,theme:method==='DELETE'?'':theme||''};
    }
    await save(g,'design',design);return json({saved:true,cloud:true});
   }
   if(path==='studio/save'&&method==='POST'){
    const body=JSON.parse(options.body),old=snapshots.get(key(g,'audio'));if(!old)throw Error('Reload Sounds before saving.');
    if(!['kit',g].includes(body.source))throw Error('Sound belongs to another game.');
    const catalog=await original('studio/catalog?engine=pixi'),manifest=catalog.sources.find(s=>s.id===body.source)?.manifest;
    if(!manifest)throw Error('Sound source unavailable');applyAudio(clone(manifest),body);
    const audio=clone(old.payload.audio||{});audio[body.source]={events:body.events};await save(g,'audio',audio);return json({saved:true,cloud:true});
   }
   if(path==='studio/restore'&&method==='POST'){
    const old=snapshots.get(key(g,'audio')),audio=clone(old?.payload.audio||{}),source=url.searchParams.get('source');
    if(!['kit',g].includes(source))throw Error('Sound belongs to another game.');delete audio[source];await save(g,'audio',audio);return json({saved:true});
   }
   if(path==='studio/upload')throw Error('New audio files need shared asset storage. You can edit the existing takes in this draft.');
   return nativeFetch(input,options);
  }catch(e){return json({message:e.message},409)}
 };
})();

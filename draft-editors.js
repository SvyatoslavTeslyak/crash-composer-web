/* Design and audio drafts in the cloud. File libraries are immutable inputs.
 * Brands belong to every game: they are read and saved in a scope of their own, "shared",
 * which has a draft like a game's. A game's own draft keeps only what is the game's: its
 * sounds, and for a brand the seasons it adds and the faces it sets for itself.
 * A role that cannot read the shared scope sees the kit's brands and adds only its game's own. */
(()=>{
 const nativeFetch=window.fetch.bind(window),base=new URL('./',location.href),snapshots=new Map();
 const clone=v=>structuredClone(v),key=(g,s)=>g+':'+s;
 const result=r=>{if(r.error)throw Error(r.error.message);return r.data};
 const enabled=()=>!!window.ComposerAuth?.session&&!window.ComposerAuth.local;
 const game=()=>window.ComposerTarget?.value;
 const SHARED='shared';let sharedScope=null;
 async function read(g,s){
  const pending=s==='audio'?document.querySelector('#sound-tab.workspace-dirty'):window.ComposerLook?.dirty;
  if(pending&&snapshots.has(key(g,s)))return clone(snapshots.get(key(g,s)));
  const value=result(await ComposerAuth.client.from('composer_drafts').select('*').eq('game_id',g).single());
  snapshots.set(key(g,s),clone(value));return value;
 }
 async function save(g,s,value){
  if(!ComposerAuth.has(s==='design'?'design.edit':'audio.edit',g))throw Error('You do not have permission to edit this section.');
  const old=snapshots.get(key(g,s));if(!old)throw Error('Reload this section before saving.');
  window.ComposerUX?.status('saving');
  let saved;try{saved=result(await ComposerAuth.client.rpc('composer_save_section',{p_game:g,p_revision:old.revision,p_section:s,p_value:value}));}catch(error){window.ComposerUX?.status('error',error.message);throw error}
  snapshots.set(key(g,s),clone(saved));window.dispatchEvent(new CustomEvent('composer-draft-saved',{detail:{game:g,section:s,revision:saved.revision}}));return saved;
 }
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 async function original(path){const r=await nativeFetch(path,{cache:'no-store'});if(!r.ok)throw Error('Editor catalog unavailable');return r.json()}
 // Whether the shared scope is there to use: asked once, then remembered for the session.
 async function shared(){
  if(sharedScope===null){try{await read(SHARED,'design');sharedScope=true}catch{sharedScope=false}}
  return sharedScope;
 }
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const face=f=>({file:String(f.file).split('/').pop(),weight:f.weight,style:f.style||'normal'});
 const sameFaces=(a,b)=>same(Object.fromEntries(Object.entries(a||{}).map(([k,f])=>[k,face(f)])),Object.fromEntries(Object.entries(b||{}).map(([k,f])=>[k,face(f)])));
 // As tools/review_assets.py design_catalog. The shared brands go over the kit's.
 function mergeShared(catalog,design){
  for(const [id,brand] of Object.entries(design?.brands||{})){if(brand===null)delete catalog.brands[id];else catalog.brands[id]={...(catalog.brands[id]||{}),...clone(brand)}}
  return catalog;
 }
 // What a game keeps of its own for the shared brands: seasons only it has, and faces that
 // differ from the shared ones. Anything else in an older draft (whole brands) is left out.
 function ownDesign(design,catalog){
  const out={brands:{}};
  for(const [id,entry] of Object.entries(design?.brands||{})){
   const brand=catalog.brands[id];if(!entry||typeof entry!=='object'||!brand)continue;
   const themes=Object.fromEntries(Object.entries(entry.themes||{}).filter(([tid,t])=>!same(brand.themes?.[tid]&&{title:brand.themes[tid].title,roles:brand.themes[tid].roles},{title:t.title,roles:t.roles})).map(([tid,t])=>[tid,{title:t.title,roles:clone(t.roles||{})}]));
   const own={};
   if(Object.keys(themes).length)own.themes=themes;
   if(entry.fonts&&!sameFaces({...brand.fonts,...entry.fonts},brand.fonts))own.fonts=Object.fromEntries(Object.entries(entry.fonts).map(([k,f])=>[k,face(f)]));
   if(Object.keys(own).length)out.brands[id]=own;
  }
  return out;
 }
 // The game's own seasons and faces go over the shared brands; `own` tells the editors which.
 function mergeOwn(catalog,design){
  const own=ownDesign(design,catalog);
  for(const [id,entry] of Object.entries(own.brands)){
   const brand=catalog.brands[id];brand.own={themes:Object.keys(entry.themes||{}),fonts:!!entry.fonts};
   brand.themes={...(brand.themes||{}),...clone(entry.themes||{})};
   if(entry.fonts){brand.sharedFonts=clone(brand.fonts);brand.fonts={...brand.fonts,...clone(entry.fonts)}}
  }
  return catalog;
 }
 async function sharedCatalog(){return mergeShared(await original('brands/'),(await read(SHARED,'design')).payload.design)}
 // The brands a game's own seasons and faces are told apart from: the shared ones, or, for a role
 // that cannot read the shared draft, the kit's.
 async function comparisonCatalog(){try{return await sharedCatalog()}catch{return original('brands/')}}
 function editableBrand(b){return {title:b.title,roles:clone(b.roles||{}),overrides:clone(b.overrides||{}),fonts:clone(b.fonts||{}),themes:Object.fromEntries(Object.entries(b.themes||{}).map(([id,t])=>[id,{title:t.title,roles:clone(t.roles||{})}]))}}
 // A sound the team added: a file in the composer-audio bucket, under the game's folder, that the
 // draft lists after the library's takes. The preview plays it from the bucket; Apply locally
 // copies it beside the configuration (tools/release_config.py).
 const AUDIO_BUCKET='composer-audio',AUDIO_TYPES={wav:'audio/wav',ogg:'audio/ogg',mp3:'audio/mpeg'},AUDIO_LIMIT=8*1024*1024;
 const mediaUrl=path=>ComposerAuth.client.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
 function applyAudio(manifest,patch){
  if(!patch)return manifest;
  for(const change of patch.events||[]){
   const event=manifest.events.find(e=>e.id===change.id);if(!event)throw Error('Sound catalog changed. Reload before saving.');
   const known=event.takes.filter(t=>!t.media).length;
   if(change.takes.length<known)throw Error('Sound files changed. Reload before saving.');
   for(const field of ['volume_db','pitch_jitter','prompt'])if(field in change)event[field]=change[field];
   event.takes=event.takes.filter(t=>!t.media);
   event.takes.forEach((t,i)=>t.enabled=change.takes[i].enabled);
   for(const added of change.takes.slice(known)){
    if(!added?.media)throw Error('Sound files changed. Reload before saving.');
    event.takes.push({file:'media:'+added.media,media:added.media,name:added.name,url:mediaUrl(added.media),source:'upload:'+added.name,exists:true,enabled:added.enabled!==false});
   }
  }
  return manifest;
 }
 // The draft's form of a manifest's events: positions for the library's takes, files for added ones.
 const audioPatch=manifest=>({events:manifest.events.map(e=>({id:e.id,volume_db:e.volume_db??null,pitch_jitter:Number(e.pitch_jitter||0),...('prompt' in e?{prompt:e.prompt}:{}),takes:e.takes.map(t=>t.media?{enabled:t.enabled!==false,media:t.media,name:t.name}:{enabled:t.enabled!==false})}))});
 async function uploadTake(g,url,options){
  const source=url.searchParams.get('source'),eventId=url.searchParams.get('event')||'',file=options.body;
  if(!['kit',g].includes(source))throw Error('Sound belongs to another game.');
  if(!ComposerAuth.has('audio.edit',g))throw Error('You do not have permission to edit this game’s sounds.');
  const name=decodeURIComponent(new Headers(options.headers).get('X-File-Name')||file?.name||''),ext=name.split('.').pop().toLowerCase();
  if(!AUDIO_TYPES[ext])throw Error('Use a .wav, .ogg or .mp3 file.');
  if(!file?.size||file.size>AUDIO_LIMIT)throw Error('The sound must be larger than 0 and at most 8 MB.');
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
  const path=g+'/'+source+'/'+(eventId.toLowerCase().replace(/[^a-z0-9_-]+/g,'-').slice(0,60)||'sound')+'-'+digest+'.'+ext;
  const {error}=await ComposerAuth.client.storage.from(AUDIO_BUCKET).upload(path,file,{contentType:AUDIO_TYPES[ext],upsert:false,cacheControl:'31536000'});
  // The same file added before is already there under its own name; that is not an error.
  if(error&&!/exists|duplicate/i.test(error.message))throw Error(/bucket|not found/i.test(error.message)?'Sound storage is not set up yet: apply migration 202610020001_sound_media.sql.':error.message||'Upload failed.');
  const old=snapshots.get(key(g,'audio'))||await read(g,'audio');
  const catalog=await original('studio/catalog?engine=pixi'),base=catalog.sources.find(s=>s.id===source)?.manifest;
  if(!base)throw Error('Sound source unavailable');
  const manifest=applyAudio(clone(base),old.payload.audio?.[source]),event=manifest.events.find(e=>e.id===eventId);
  if(!event)throw Error('Sound catalog changed. Reload before saving.');
  // The added sound is the one the moment plays; the others stay in the list to switch back to.
  event.takes.forEach(t=>t.enabled=false);
  if(!event.takes.some(t=>t.media===path))event.takes.push({media:path,name:name.slice(0,120),enabled:true});else event.takes.find(t=>t.media===path).enabled=true;
  const audio=clone(old.payload.audio||{});audio[source]=audioPatch(manifest);await save(g,'audio',audio);
  return json({saved:true,cloud:true,media:path});
 }
 async function baseline(payload,g){
  const out={translations:{},design:{brands:{}},audio:{},_labels:{translations:{},brands:{},events:{}}};
  if(payload.translations){const data=await original('translations?game='+encodeURIComponent(g===SHARED?'kit':g));out.translations=data.overrides||{};for(const [id,values] of Object.entries(payload.translations)){const entry=data.catalog.entries[id];if(entry){out._labels.translations[id]=entry.source;out.translations[id]={...Object.fromEntries(Object.keys(values).map(lang=>[lang,entry[lang]||entry.source])),...out.translations[id]}}}}
  if(payload.design){
   // A game's own entry for a brand (its seasons and faces) is compared with the shared brand it
   // sits on; anything else (the shared scope, or a draft from before brands were shared) with the kit's.
   const kit=await original('brands/'),over=g!==SHARED&&await shared()?await sharedCatalog():null;
   for(const [id,entry] of Object.entries(payload.design.brands||{})){
    const ownOnly=over&&entry&&typeof entry==='object'&&Object.keys(entry).every(k=>['themes','fonts'].includes(k));
    if(ownOnly&&over.brands[id]){out.design.brands[id]={...(entry.fonts?{fonts:Object.fromEntries(Object.keys(entry.fonts).map(k=>[k,face(over.brands[id].fonts[k])]))}:{}),...(entry.themes?{themes:{}}:{})};out._labels.brands[id]=over.brands[id].title}
    else if(kit.brands[id]){out.design.brands[id]=editableBrand(kit.brands[id]);out._labels.brands[id]=kit.brands[id].title}
   }
  }
  if(payload.audio){const data=await original('studio/catalog?engine=pixi');for(const [id,patch] of Object.entries(payload.audio)){const m=data.sources.find(s=>s.id===id)?.manifest;if(m){out._labels.events[id]=Object.fromEntries(m.events.map(e=>[e.id,e.label||e.id]));out.audio[id]={events:patch.events.map(c=>m.events.find(e=>e.id===c.id)).filter(Boolean).map(e=>({id:e.id,volume_db:e.volume_db??null,pitch_jitter:e.pitch_jitter||0,...('prompt' in e?{prompt:e.prompt}:{}),takes:e.takes.map(t=>({enabled:t.enabled!==false}))}))}}}}
  return out;
 }
 window.ComposerDraftEditors={get enabled(){return enabled()},baseline,applyAudio,mediaUrl,shared,sharedCatalog,comparisonCatalog,ownDesign,SHARED};
 window.fetch=async(input,options={})=>{
  const url=new URL(input instanceof Request?input.url:input,location.href),path=url.pathname.slice(base.pathname.length),method=(options.method||'GET').toUpperCase();
  if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||!(/^(brands\/|studio\/(catalog|save|restore|upload))/.test(path)))return nativeFetch(input,options);
  // The kit's libraries (font families, icons) are files, not settings of a draft: they are added
  // and removed on the local server as before, whichever scope the brands are saved in.
  if(/^brands\/(fonts|google|icons)\//.test(path))return nativeFetch(input,options);
  await window.ComposerAuth.ready;
  if(!enabled())return nativeFetch(input,options);
  const g=game();
  if(!g||g==='kit')return method==='GET'?nativeFetch(input,options):json({message:'Select a game to edit its private draft.'},400);
  try{
   const layered=await shared();
   if(path==='brands/'&&method==='GET'){
    // Brands are every game's. A role that cannot read the shared draft sees the kit's brands with
    // this game's own seasons and faces, and may add only to those.
    const catalog=mergeOwn(layered?await sharedCatalog():await original('brands/'),(await read(g,'design')).payload.design);
    catalog.scope={shared:true,game:g,canEditShared:layered&&ComposerAuth.has('design.edit',SHARED),canEditGame:ComposerAuth.has('design.edit',g)};
    return json(catalog);
   }
   if(path==='studio/catalog'&&method==='GET'){
    const catalog=await original('studio/catalog'+url.search),d=await read(g,'audio');
    for(const source of catalog.sources)if(source.manifest)applyAudio(source.manifest,d.payload.audio?.[source.id]);
    return json(catalog);
   }
   if(path.startsWith('brands/')&&['POST','DELETE'].includes(method)){
    const parts=path.split('/');if(!/^[a-z][a-z0-9-]{1,30}$/.test(parts[1])||(parts.length>2&&(parts.length!==4||parts[2]!=='themes'||!/^[a-z][a-z0-9-]{1,30}$/.test(parts[3]))))throw Error('Invalid brand or theme');
    const body=options.body?JSON.parse(options.body):{},id=parts[1],theme=parts[3];
    {
     const gameOld=snapshots.get(key(g,'design')),sharedOld=layered?snapshots.get(key(SHARED,'design')):null;if(!gameOld||(layered&&!sharedOld))throw Error('Reload Brands before saving.');
     const catalog=sharedOld?mergeShared(await original('brands/'),sharedOld.payload.design):await original('brands/');
     const own=ownDesign(gameOld.payload.design,catalog),mine=own.brands[id]||{};
     // The game's own: a season only it has, or the faces it sets for itself.
     const forGame=url.searchParams.get('scope')==='game'||(!!theme&&!!mine.themes?.[theme]);
     if(forGame){
      if(!catalog.brands[id])throw Error('This brand is not shared yet. Save the brand first.');
      if(theme){
       if(catalog.brands[id].themes?.[theme])throw Error('Every game already has a season with this name. Give this one another title.');
       mine.themes={...(mine.themes||{})};if(method==='DELETE')delete mine.themes[theme];else mine.themes[theme]={title:body.title,roles:body.roles};
       if(!Object.keys(mine.themes).length)delete mine.themes;
      }else{
       if(method==='DELETE')throw Error('A brand belongs to every game and cannot be removed for one.');
       if(Object.keys(body).some(k=>k!=='fonts'))throw Error('Only a brand’s faces can be set for one game.');
       // No faces, or the shared ones again, means the game follows the shared brand.
       if(body.fonts&&!sameFaces({...catalog.brands[id].fonts,...body.fonts},catalog.brands[id].fonts))mine.fonts=Object.fromEntries(Object.entries(body.fonts).map(([k,f])=>[k,face(f)]));else delete mine.fonts;
       const allowedFonts=catalog.fonts.map(f=>(typeof f==='string'?f:f.file).split('/').pop());
       for(const f of Object.values(mine.fonts||{}))if(!allowedFonts.includes(f.file))throw Error('Choose a font from the shared library.');
      }
      if(Object.keys(mine).length)own.brands[id]=mine;else delete own.brands[id];
      await save(g,'design',own);return json({saved:true,cloud:true,scope:'game'});
     }
     if(!sharedOld)throw Error('Brands belong to every game, and your role cannot change them. You can add a season for this game only.');
     const design=clone(sharedOld.payload.design||{brands:{}});design.brands||={};
     if(method==='DELETE'&&!theme){if(id==='default')throw Error('Cannot remove default brand');design.brands[id]=null}
     else{
      const originalBrand=catalog.brands[id]||catalog.brands[body.from]||catalog.brands.default,b=editableBrand(originalBrand);
      if(theme){if(method==='DELETE')delete b.themes[theme];else{if(mine.themes?.[theme])throw Error('This game already has its own season with this name.');b.themes[theme]={title:body.title,roles:body.roles}}}
      else{for(const field of ['title','roles','overrides','fonts'])if(field in body&&body[field])b[field]=clone(body[field])}
      const allowedFonts=new Set(catalog.fonts.map(f=>typeof f==='string'?f:f.file));
      for(const f of Object.values(b.fonts))if(!allowedFonts.has(f.file)&&!catalog.fonts.some(x=>(typeof x==='string'?x:x.file)?.split('/').pop()===f.file))throw Error('Choose a font from the shared library.');
      design.brands[id]=b;
     }
     delete design.selection;
     await save(SHARED,'design',design);return json({saved:true,cloud:true,scope:'shared'});
    }
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
   if(path==='studio/upload'&&method==='POST')return await uploadTake(g,url,options);
   return nativeFetch(input,options);
  }catch(e){return json({message:e.message},409)}
 };
})();

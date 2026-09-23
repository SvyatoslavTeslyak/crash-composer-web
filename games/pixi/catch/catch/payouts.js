/* Presentation only: observe authoritative credits; never credit the wallet here. */
globalThis.CatchPayouts=class {
 constructor(){this.round=null;this.paid={};this.id=0;}
 observe(state){
  const paid=state.paid||{};
  if(this.round===null){this.round=state.round;this.paid={...paid};return null;}
  if(this.round!==state.round){this.round=state.round;this.paid={};}
  const positions=['left','main','right'].filter(key=>(paid[key]||0)>(this.paid[key]||0));
  const cents=positions.reduce((sum,key)=>sum+(paid[key]||0)-(this.paid[key]||0),0);
  this.paid={...paid};
  return cents>0?{id:++this.id,amount:cents/100,subtitle:positions.map(key=>key==='main'?'Main collected':key==='left'?'Left wins':'Right wins').join(' · ')}:null;
 }
};

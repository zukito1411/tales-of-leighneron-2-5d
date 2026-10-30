import type {HouseShape} from './HouseGeometry';
export const AUTHORED_BUILDINGS=new Set(['old-cottage','cottage','old-inn','inn','hall','manor','smithy','capital-smithy','stable','storehouse','castle','chapel','road-shrine','old-shrine',
  'gatehouse','elven-cottage','elven-manor','elven-gate','elven-chapel','elven-smithy','elven-stable','elven-guildhall','elven-estate','elven-palace']);
export interface EntryDoor {center:number;front:number;width:number;height:number}
export interface EntryTread {left:number;right:number;back:number;front:number;bottom:number;top:number}
/** The rendered entrance and outdoor foot solver share these same dimensions.
 * No inferred collision box or separately guessed staircase is involved. */
export function architectureEntryDoor(shape:HouseShape):EntryDoor|undefined{
 const id=shape.profile.id,W=shape.width,H=shape.height,elf=id.startsWith('elven-');
 if(!AUTHORED_BUILDINGS.has(id)||shape.profile.tiers||shape.segment||shape.profile.board||/gate|chapel|shrine/.test(id))return;
 let center=.50,front=.014*W,width=.22,height=H*(/guildhall/.test(id)?.30:.25);
 if(id==='castle'||id==='elven-palace'){front=.030*W;width=.15;height=H*.25;}
 else if(/smithy|stable/.test(id)){front=.015*W;width=/smithy/.test(id)?.23:.29;height=Math.max(shape.doorHeight??0,H*.30);}
 else if(/inn|manor|estate/.test(id)){center=.52;front=.065*W;width=.22;height=H*.24;}
 else if(/cottage/.test(id)){center=elf?.50:.58;front=.015*W;width=elf?.24:.23;height=H*.34;}
 height=Math.max(height,shape.doorHeight??0);
 if(!/castle|palace/.test(id))width=Math.min(width,height/W*.60);
 return {center,front,width,height};
}
export function architectureEntryTreads(shape:HouseShape):EntryTread[]{
 const {width:W,height:H}=shape,id=shape.profile.id;
 if(!AUTHORED_BUILDINGS.has(id)||shape.profile.tiers||shape.segment||shape.profile.board||/gate/.test(id))return [];
 const ground=.5-shape.top-Math.max(.96,shape.ground??.96)*H,X=(x:number)=>shape.left+x*W-.5;
 if(/chapel|shrine/.test(id))return Array.from({length:3},(_,i)=>({left:X(.27-i*.035),right:X(.73+i*.035),
  back:.035*W,front:(.09+i*.035)*W,bottom:ground-.01*W,top:ground+(.022-i*.006)*H}));
 const entry=architectureEntryDoor(shape);if(!entry)return [];
 return Array.from({length:3},(_,i)=>({left:X(entry.center-entry.width*.65-i*.022),right:X(entry.center+entry.width*.65+i*.022),
  // Keep the building's own anchor outside its steps: sampling an owner's
  // height must never lift its whole model onto its own top tread.
  back:Math.max(.0001*W,entry.front-.015*W),front:entry.front+(.028+i*.028)*W,
  bottom:ground-.015*W,top:ground+.006*W*(3-i)}));
}

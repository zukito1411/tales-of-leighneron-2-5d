import type {Vec2} from '../game/types';

export interface CapitalSite extends Vec2 {frontY:number;frontage?:number}
export const CAPITAL_SHRINE_SITE={x:1100,y:3900} as const;
/** Sacred garden and its entire south-facing view/arrival corridor. */
export const CAPITAL_SHRINE_COURT={left:450,right:1750,top:3200,bottom:5300} as const;

/** A surveyed city, indexed by existing building slot. There is no nearest-free
 * relocation here: changing a block means changing its authored survey. */
export const CAPITAL_BUILDING_SITES:Readonly<Record<number,CapitalSite>>=(()=>{
 const sites:Record<number,CapitalSite>={};
 const at=(i:number,x:number,y:number,frontY:number,frontage?:number)=>sites[i]={x,y,frontY,...(frontage?{frontage}:{})};
 at(0,-5400,-250,0);at(1,0,-3100,-3004);at(2,-3500,-1200,-900,650);
 at(3,-4400,-300,0);at(4,3500,700,1100);at(5,-1100,-300,0);at(6,5400,-250,0);
 at(7,-4450,700,1100,700);at(8,-3500,1600,1900);at(9,4700,700,1100);
 at(10,-4650,1600,1900);at(11,-5350,1500,1900);at(12,1100,3900,4300);
 at(13,5600,400,1100);at(14,2400,1600,1900);at(15,3300,1600,1900);
 at(18,4300,1600,1900);at(20,2000,700,1100,700);at(21,2400,-300,0);
 at(22,-2700,-1200,-900,600);at(23,-2700,1600,1900);at(27,-1000,1600,1900);
 at(31,-2370,2250,2600);at(33,1500,1600,1900);
 // Upper terraces: aligned facades around three broad, connected courts.
 for(const [start,side] of [[34,-1],[46,1]])for(let i=0;i<6;i++){
  const y=i<3?-3400:-2300,x=side*[4300,3500,2700][i%3];at(start+i,x,y,y+300,600);
 }
 at(86,-2700,-300,0);at(87,-1900,-300,0);at(88,1400,-300,0);at(89,4000,-300,0);
 at(90,-1800,1600,1900);at(91,-3500,-300,0);at(92,5100,1600,1900);
 at(93,4600,-300,0);at(95,-5200,2400,2600);
 at(96,3500,-1200,-900,800);at(97,2700,-1200,-900);at(98,-4300,-1200,-900,600);at(99,4300,-1200,-900,600);
 const westIds=[16,17,25,26,28,29,30,40,41,42,43,44,45,58,59,60,61,62,68,69,70,71,76,77,78,79,84,94];
 const westRows=[{road:2600,x:[4400,3750,3100,1150,500]},
  {road:3200,x:[4400,3750,3100,2450,1800,1150,500]},
  {road:3800,x:[3750,3100,2450,1800,1150,500]},
  {road:4400,x:[3750,3100,2450,1800,1150,500]},
  {road:5000,x:[1150,500]},{road:5500,x:[1150,500]}];
 let slot=0;for(const row of westRows)for(const x of row.x){const y=row.road===5500?5360:row.road-220;at(westIds[slot++],-x,y,row.road);}
 const eastIds=[19,24,32,52,53,54,55,56,57,63,64,65,66,67,72,73,74,75,80];
 const eastRows=[{road:2500,x:[1100,1900,2700,3500,4300,5000]},
  {road:3300,x:[1100,2000,2700,3400,4100,4800]},
  {road:4100,x:[2100,2750,3500,4200]},{road:4800,x:[2100,2750,3500]}];
 slot=0;for(const row of eastRows)for(const x of row.x)at(eastIds[slot++],x,row.road-240,row.road);
 at(81,500,2260,2500);at(82,500,3060,3300);at(83,2050,5440,5600);at(85,800,700,1100);
 return sites;
})();

export const CAPITAL_LOCAL_STREETS:ReadonlyArray<{id:string;width:number;surface:'stone'|'dirt';points:Vec2[]}>= [
 ...[-1,1].flatMap(side=>[
  ...[-3100,-2000,-900].map(y=>({id:'upper-court:'+side+':'+y,width:112,surface:'stone' as const,points:[{x:side*4800,y},{x:side*2250,y},{x:side*1700,y:-900},{x:0,y:-900}]})),
  {id:'upper-outer-link:'+side,width:96,surface:'stone' as const,points:[{x:side*4800,y:-3100},{x:side*4800,y:-900},{x:side*5100,y:0}]},
  {id:'upper-inner-link:'+side,width:88,surface:'stone' as const,points:[{x:side*2250,y:-3100},{x:side*2250,y:-900}]},
 ]),
 {id:'merchant-row',width:88,surface:'stone',points:[{x:-5400,y:1900},{x:0,y:1900},{x:5500,y:1900}]},
 ...[[2600,5300],[3200,4800],[3800,4400],[4400,4000],[5000,1700],[5500,1700]].map(([y,x])=>({id:'commoner-lane:'+y,width:76,surface:'dirt' as const,points:[{x:-x,y},{x:0,y}]})),
 ...[[4100,3800],[2900,4400],[1700,5000]].map(([x,y])=>({id:'commoner-alley:'+x,width:64,surface:'dirt' as const,points:[{x:-x,y:1900},{x:-x,y}]})),
 ...[[2500,5300],[3300,5000],[4100,4400],[4800,3500],[5600,2100]].map(([y,x])=>({id:'rural-lane:'+y,width:88,surface:'stone' as const,points:[{x:0,y},{x,y}]})),
 ...[[1700,4800],[3100,4800],[4500,2500]].map(([x,y])=>({id:'rural-link:'+x,width:80,surface:'stone' as const,points:[{x,y:1900},{x,y}]})),
 {id:'hearth-shrine-approach',width:112,surface:'stone',points:[{x:0,y:4300},{x:1100,y:4300},{x:1100,y:3964}]},
 {id:'western-market-aisle',width:88,surface:'stone',points:[{x:-3800,y:600},{x:-1550,y:600},{x:-1550,y:1100}]},
];

export const CAPITAL_NPC_COURTS:Readonly<Record<string,Vec2>>={
 'captain-yselle-ward':{x:-4400,y:-140},'ser-caldus-rowe':{x:2700,y:350},
 'lina-farrow':{x:-1150,y:2500},'maren-voss':{x:800,y:4200},'pell-rusk':{x:-2050,y:2050},
 'edith-loom':{x:-3500,y:900},'judit-loom':{x:-3350,y:900},'corin-brass':{x:3500,y:900},'perrin-brass':{x:3250,y:900},
 'folk:highmere:local:0':{x:-3900,y:900},'folk:highmere:local:1':{x:3900,y:900},
 'folk:highmere:local:2':{x:-2800,y:900},'folk:highmere:local:3':{x:2900,y:900},
 'folk:highmere:visitor:0':{x:-3500,y:170},'folk:highmere:visitor:1':{x:3100,y:170},
 'folk:highmere:visitor:2':{x:-2400,y:3100},'folk:highmere:visitor:3':{x:2900,y:3200},
};
export const CAPITAL_ESCORT_ARRIVAL={x:-1000,y:1780} as const;

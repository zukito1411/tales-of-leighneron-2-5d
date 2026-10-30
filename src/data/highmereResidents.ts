import {HIGHMERE_QUAY} from './highmerePlan';
import type {NpcDefinition,Vec2} from '../game/types';
import {HIGHMERE_HOUSEHOLD_COURTS} from './highmereBoroughs';

const names=['Agnes Hearthwell','Hugh Oakfold','Alice Millerbrook','Walter Goodacre','Joan Reedwell','Robert Claygate',
  'Emma Copperwell','William Rushmere','Rose Barleywick','John Ashcombe','Mabel Ferncroft','Gilbert Hayward',
  'Edith Rowanwell','Thomas Millward','Beatrice Woolgate','Simon Elmstead','Cecily Breadcroft','Henry Copperside',
  'Margery Wheatwell','Peter Brookfold','Isabel Waincroft','Roger Mossgate','Matilda Willowstead','Nicholas Stonefold',
  'Aveline Grangefield','Geoffrey Seedwell','Hawise Applecroft','Osbert Oatmere'];

/** Named, persistent people use the existing NPC streaming, art and street
 * routing. Short neighborhood routines avoid a city-wide simulation pass. */
export function createHighmereResidents():NpcDefinition[]{
  const people:NpcDefinition[]=[];
  const add=(id:string,name:string,title:string,point:Vec2,home:Vec2,social:Vec2,index:number,district:string)=>{
    const spriteTexture:NpcDefinition['spriteTexture']=['npc_villager','npc_attendant','npc_blacksmith','npc_adventurer'][index%4] as NpcDefinition['spriteTexture'];
    people.push({id:'capital:highmere:resident:'+id,name,title,townId:'highmere',districtId:district,
      ancestry:'human',visualRegion:'trandum',settlementResident:true,spriteFrame:0,spriteTexture,
      worldOffset:point,homeLocation:home,patrolRadius:0,role:title+' serving the households of Highmere',
      faction:'Highmere Households',connections:[{npcId:'maela-quill',relationship:'Registered with the city household and trade tally'}],
      relationshipToLeigneron:{kind:'acquaintance',trust:42,summary:'Knows the roadwarden family through the city relief deliveries.'},
      schedule:[{startHour:6,activity:'Sets out the day’s household work',location:point},
        {startHour:12,activity:'Meets neighbors beside the public lane',location:social},
        {startHour:18,activity:'Finishes work in the home court',location:home},
        {startHour:22,activity:'Keeps the household lantern',location:home}],
      dialoguePersonality:'Welcoming, busy and proud of the neighborhood',
      dialogue:[title.includes('Quay')?'The packet is outside Eastgate. Follow the paved bank south; the captain boards passengers at the timber quay.'
        :title.includes('Garden')?'The upper gardens belong to everyone who can keep their boots out of the herb beds.'
          :'The main road carries the wagons. These smaller lanes are where we work, share a meal and look after the neighbors.',
        'A city lives by its households. Keep the flour moving and the lamps lit, and we can manage the rest.'],questIds:[]});
  };
  for(const [i,c] of HIGHMERE_HOUSEHOLD_COURTS.entries()){
    const outer=Math.abs(c.x)>=4900,side=Math.sign(c.x);
    const point={x:outer?c.x-side*200:c.x+150,y:c.streetY-115};
    const home={x:outer?c.x-side*350:c.x-150,y:c.streetY-115};
    const social={x:outer?c.x-side*80:c.x+(c.x>0?150:240),y:c.streetY-115};
    add(c.id,names[i],c.x<0?['Household Baker','Linen Mender','Potter','Kitchen Gardener'][i%4]
      :['Seed Keeper','Wainwright','Garden Provisioner','Grain Sorter'][i%4],point,home,social,i,c.district);
  }
  for(const [i,[x,y,name,title]] of ([
    [-2050,525,'Sabina Threadwell','Cloth Market Seller'],[-2800,525,'Adam Copperfold','Market Provisioner'],
    [-3550,525,'Alys Herbwick','Herb Market Seller'],[-2050,980,'Hamon Rivetwell','Guild Tool Trader'],
    [-2800,980,'Eleanor Ashfold','Apothecary Supplier'],[-3550,980,'Hob Cartwell','Wagon Fittings Trader'],
    [-3950,-1900,'Ida Rosewell','Noble Garden Keeper'],[-4900,-2500,'Edwin Leafgate','Embassy Gardener'],
    [3950,-1900,'Agatha Dawnwell','Temple Garden Keeper'],[4900,-2500,'Lucas Bellward','Temple Provisioner'],
    [HIGHMERE_QUAY.landing.x-190,HIGHMERE_QUAY.landing.y-200,'Marion Saltwick','Quay Packet Captain'],[HIGHMERE_QUAY.landing.x-190,HIGHMERE_QUAY.landing.y+150,'Ralph Ropewell','Quay Porter'],
    [HIGHMERE_QUAY.landing.x-190,HIGHMERE_QUAY.landing.y+650,'Juliana Sailfold','Quay Passenger Clerk'],
  ] as const).entries()){
    const point={x,y},quay=title.startsWith('Quay'),market=y>0&&!quay;
    const home={x:market?x+Math.sign(x)*110:quay?x-110:x,y:market&&y<600?y:y+50};
    const social={x:quay?x-110:market?x+Math.sign(x)*220:x,y:market&&y<600?y:y+30};
    add('trade:'+i,name,title,point,home,social,i,
      quay?'Highmere River Quay':y<0?'Upper Wards':'Market and Guild Borough');
  }
  return people;
}

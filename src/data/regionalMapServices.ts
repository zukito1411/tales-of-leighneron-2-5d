import {WORLD_CONTENT} from './content';
import {MAP_INNS,MAP_BLACKSMITHS} from './mapServices';
import {NPC_INTERIOR_BY_ID} from './interiors';
import {NPC_BY_ID} from './npcs';
import {PORT_BY_ID} from './ports';
import type {NavigationMarker} from '../game/types';

/** Authored services remain visible when their disposable world actors unload.
 * Built once for the survey; minimap enemy/NPC snapshots stay local. */
export const REGIONAL_MAP_SERVICES:readonly NavigationMarker[]=WORLD_CONTENT.flatMap((d):NavigationMarker[]=>{
 const inn=MAP_INNS.get(d.id);
 const smith=d.kind==='npc'&&MAP_BLACKSMITHS.has(d.npcId);
 const service:NavigationMarker['service']=inn?'inn':smith?'blacksmith'
  :'townShrineId' in d&&d.townShrineId?'shrine'
  :'contractTownId' in d&&d.contractTownId?'contracts'
  :'portId' in d&&d.portId?'harbor':d.kind==='dungeon-entrance'?'cave':undefined;
 if(!service)return [];
 const room=smith&&d.kind==='npc'?NPC_INTERIOR_BY_ID[d.npcId]:undefined;
 const port='portId' in d&&d.portId?PORT_BY_ID[d.portId]:undefined;
 const point=inn?.door??room?.entry.door??port?.landing??d.world;
 const label=inn?.name??(d.kind==='npc'?NPC_BY_ID[d.npcId].name:'name' in d?d.name:'Service');
 return [{id:d.id,kind:'landmark',service,label,...point}];
});

import type {TerrainKind} from '../types';

export const MINI_TERRAIN_COLORS:Record<TerrainKind,string>={
  grass:'#617849',forest:'#324e37',dirt:'#ab8b60',stone:'#96908a',snow:'#d1ddd9',
  ash:'#66544e',sand:'#c3ac78',water:'#294d63',farmland:'#918449',
  marsh:'#657363',lava:'#b85835',ice:'#9fc8df',
};
export const WATER_CELL_SIZE=32,WATER_FIELD_SIZE=8192,WATER_FIELD_PIXELS=512,WATER_FIELD_STEP=1024;
export type GeographyRequest={kind:'water'|'minimap';x:number;y:number;extent:number;pixels:number};
export type GeographyMessage=GeographyRequest&{id:number};
export type GeographyReply={id:number;bitmap:ImageBitmap;hasWater:boolean}|{id:number;error:string};

import {TOWN_BY_ID} from './towns';
import {highmereElevation} from './highmerePlan';
import {artFrameSize} from './art';
import type {PropContentDefinition} from '../game/types';

/** Each tread clears the existing grade at its upper edge. The ceremonial
 * crossing stays open at the sides; no rails obstruct the upper cross street. */
export const CAPITAL_STAIR_ID='detail:highmere:royal-approach-stairs';
const WIDTH=320,RUN=800,FRONT=-250,STEPS=16;
export const CAPITAL_STAIR={width:WIDTH,run:RUN,height:180,
 heights:Array.from({length:STEPS},(_,i)=>highmereElevation(0,FRONT-RUN*(i+1)/STEPS)/WIDTH)};
export function streetStair(id:string){return id===CAPITAL_STAIR_ID?CAPITAL_STAIR:undefined;}
export const CAPITAL_STAIR_CONTENT:PropContentDefinition={id:CAPITAL_STAIR_ID,kind:'prop',
 world:{x:TOWN_BY_ID.highmere.world.x,y:TOWN_BY_ID.highmere.world.y+FRONT},
 texture:'native_civic_bare',frame:9,scale:WIDTH/artFrameSize('native_civic_bare',9).width,
 solid:false,streamRadiusChunks:1,placement:'fixed',label:'Royal approach stone stairway'};

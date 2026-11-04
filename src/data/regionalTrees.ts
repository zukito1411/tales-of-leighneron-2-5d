import type {RegionId} from '../game/types';

/** Complete, measured sprites with transparent gutters. Prepared lazily only
 * for a streamed chunk using this palette, never by the cold boot packer. */
export const REGIONAL_TREE_SHEET={key:'regional_trees' as const,path:'assets/trees/regional-trees-v1.png',
 sourceSize:[1254,1254] as const,columns:6,atlasColumns:3,density:2,frameWidth:256,frameHeight:384,
 blackBackground:false,streamed:true,
 regions:[[71,139,260,372],[463,132,321,383],[900,88,288,428],[60,700,282,425],[438,713,377,413],[925,683,258,441]] as const,
 names:['coconut-palm','tropical-banyan','elven-silvercrown','elven-cedar','darkwood-oak','darkwood-fir']};
export function regionalTree(region:RegionId,biome:string,terrain:string,variation:number){
 if(terrain==='snow'||biome==='snowfield')return;
 if(region==='portquill')return {texture:'regional_trees' as const,frame:variation>.35?1:0,height:variation>.35?390:340};
 if(region==='rindass'&&biome==='coast')return {texture:'regional_trees' as const,frame:0,height:330};
 if(region==='narenthil')return {texture:'regional_trees' as const,frame:variation>.25?3:2,height:variation>.25?570:650};
 if(region==='druganwoods'&&biome==='forest')return {texture:'regional_trees' as const,frame:variation>.2?5:4,height:variation>.2?445:425};
}

import type {RoomObject,RoomRect} from './interiors';

export type FurnitureHeading=0|90|180|270;
/** Furniture models use a front-foot anchor: depth extends toward local -Y,
 * and a chair faces local +Y. Rotate that ground footprint with the mesh. */
export function interiorFurnitureFootprint(x:number,y:number,width:number,depth:number,rotation:FurnitureHeading=0):RoomRect {
 if(rotation===90)return {x,y:y-width/2,width:depth,height:width};
 if(rotation===180)return {x:x-width/2,y,width,height:depth};
 if(rotation===270)return {x:x-depth,y:y-width/2,width:depth,height:width};
 return {x:x-width/2,y:y-depth,width,height:depth};
}

/** Two opposing end chairs share the table's ground center. The front feet
 * sit just outside its edges; chair backs extend away from the tabletop. */
export function diningFurniture(x:number,y:number,width:number,chairWidth=62):RoomObject[]{
 const table:RoomObject={art:'table',x,y,width,solid:interiorFurnitureFootprint(x,y,width,width*.5)};
 const centerY=y-width*.25,gap=18;
 const seat=(x:number,rotation:FurnitureHeading):RoomObject=>({art:'chair',x,y:centerY,width:chairWidth,rotation,
  solid:interiorFurnitureFootprint(x,centerY,chairWidth,chairWidth*.5,rotation)});
 return [table,seat(x-width/2-gap,270),seat(x+width/2+gap,90)];
}

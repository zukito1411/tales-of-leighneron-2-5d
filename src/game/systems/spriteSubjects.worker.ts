import {actorSpriteSubjects,actorSpriteGridSubjects} from './spriteComponents';
import type {SubjectRequest,SubjectReply} from './SpriteSubjectPreparation';
const scope=self as unknown as {onmessage:((event:MessageEvent<SubjectRequest>)=>void)|null;postMessage:(message:SubjectReply,transfer:Transferable[])=>void};
scope.onmessage=({data})=>{
  try{
    const subjects=data.grid?actorSpriteGridSubjects(data.pixels,data.width,data.height,data.columns,data.rows,{keepDetachedDetails:true}):actorSpriteSubjects(data.pixels,data.width,data.height,data.columns,data.rows,data.name);
    scope.postMessage({id:data.id,subjects},subjects.map(subject=>subject.pixels.buffer as ArrayBuffer));
  }catch(error){scope.postMessage({id:data.id,error:error instanceof Error?error.message:String(error)},[]);}
};

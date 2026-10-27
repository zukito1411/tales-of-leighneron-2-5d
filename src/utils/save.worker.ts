import {parseSave,getSaveValidationProblem} from './saveValidation';
import type {SavePreparation,PreparedSave} from './SaveWorker';

interface SaveWorkerScope {
  onmessage:((event:MessageEvent<SavePreparation>)=>void)|null;
  postMessage:(message:PreparedSave)=>void;
}
const scope=self as unknown as SaveWorkerScope;
scope.onmessage=({data:{id,data}})=>{
  try{
    const raw=JSON.stringify(data);
    // Validate the exact serialized bytes with the same parser as Continue.
    // Migrations operate only on the parsed copy, never on the live store.
    scope.postMessage(parseSave(raw)?{id,raw,problem:null}:
      {id,raw:null,problem:getSaveValidationProblem()??'Save validation failed'});
  }catch(error){
    scope.postMessage({id,raw:null,problem:error instanceof Error?error.message:String(error)});
  }
};

import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {useGameStore} from '../src/store/gameStore';
import {allowExplicitNewGame,importSaveBackup,parseSave,SAVE_KEY,saveGame,saveProgressCheckpoint,setSaveSnapshotProvider} from '../src/utils/save';
import type {PreparedSave,SavePreparation} from '../src/utils/SaveWorker';

class CheckpointWorker {
  static latest:CheckpointWorker;
  onmessage:((event:MessageEvent<PreparedSave>)=>void)|null=null;
  onerror:(()=>void)|null=null;
  onmessageerror:(()=>void)|null=null;
  requests:SavePreparation[]=[];
  stopped=false;
  constructor(){CheckpointWorker.latest=this;}
  postMessage(request:SavePreparation){this.requests.push(structuredClone(request));}
  terminate(){this.stopped=true;}
  reply(request=this.requests.at(-1)!){
    const raw=JSON.stringify(request.data);
    if(!parseSave(raw))throw new Error('Invalid regression fixture');
    this.onmessage?.({data:{id:request.id,raw,problem:null}} as MessageEvent<PreparedSave>);
  }
}
let values:Map<string,string>;
beforeEach(()=>{
  vi.useFakeTimers();values=new Map();
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});
  vi.stubGlobal('Worker',CheckpointWorker);
  vi.stubGlobal('window',{setTimeout,clearTimeout,location:{hostname:'audit.invalid',search:''}});
  vi.stubGlobal('document',{hidden:false,addEventListener:vi.fn(),removeEventListener:vi.fn()});
  setSaveSnapshotProvider();allowExplicitNewGame();useGameStore.getState().resetGame();
  setSaveSnapshotProvider(()=>{});
});
afterEach(()=>{setSaveSnapshotProvider();vi.useRealTimers();vi.unstubAllGlobals();});

describe('background checkpoint ownership',()=>{
  it('keeps one in-flight snapshot, coalesces later requests, and commits the latest validated state',()=>{
    useGameStore.setState({gold:31});saveProgressCheckpoint();
    const worker=CheckpointWorker.latest;
    useGameStore.setState({gold:52});saveProgressCheckpoint();saveProgressCheckpoint();
    expect(worker.requests).toHaveLength(1);
    worker.reply();expect(worker.requests).toHaveLength(2);expect(values.has(SAVE_KEY)).toBe(false);
    worker.reply();expect(parseSave(values.get(SAVE_KEY)!)?.state.gold).toBe(52);
  });
  it('cannot replace an immediate checkpoint with an older worker result',()=>{
    useGameStore.setState({gold:31});saveProgressCheckpoint();const worker=CheckpointWorker.latest;
    useGameStore.setState({gold:84});expect(saveGame()).toBe(true);const committed=values.get(SAVE_KEY);
    worker.reply();expect(values.get(SAVE_KEY)).toBe(committed);
  });
  it('cannot replace an imported checkpoint and terminates on scene cleanup',()=>{
    useGameStore.setState({gold:84});expect(saveGame()).toBe(true);
    const imported=values.get(SAVE_KEY)!;
    useGameStore.setState({gold:31});saveProgressCheckpoint();const worker=CheckpointWorker.latest;
    importSaveBackup({raw:imported,level:1,savedAt:'',source:'standalone'});
    worker.reply();expect(values.get(SAVE_KEY)).toBe(imported);
    setSaveSnapshotProvider();expect(worker.stopped).toBe(true);
  });
  it('preserves the primary when worker validation rejects a new snapshot',()=>{
    expect(saveGame()).toBe(true);const primary=values.get(SAVE_KEY);
    saveProgressCheckpoint();const worker=CheckpointWorker.latest;
    worker.onmessage?.({data:{id:worker.requests[0].id,raw:null,problem:'invalid content'}} as MessageEvent<PreparedSave>);
    expect(values.get(SAVE_KEY)).toBe(primary);
  });
});

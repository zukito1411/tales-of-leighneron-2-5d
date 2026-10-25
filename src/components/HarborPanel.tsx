import {PORTS,PORT_BY_ID} from '../data/ports';
import {useGameStore} from '../store/gameStore';
import '../harbor.css';
export function HarborPanel(){
 const panel=useGameStore(s=>s.panel),id=useGameStore(s=>s.harborPortId),passage=useGameStore(s=>s.passage);
 if(passage)return <aside className="passage-status" role="status">{passage.progress<.5?'Leaving for ':'Arriving at '}{PORT_BY_ID[passage.to]?.name ?? 'the destination'} <progress value={passage.progress} max={1}/></aside>;
 if(panel!=='harbor'||!id)return null;const port=PORT_BY_ID[id];
 if(!port)return <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Harbor passage"><section className="panel pause-panel">
  <header><h2>Harbor unavailable</h2><button type="button" onClick={()=>useGameStore.getState().closePanel()}>Close</button></header>
  <p>This harbor is not available. Close the menu and return to the world.</p>
 </section></div>;
 return <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Harbor passage"><section className="panel pause-panel">
  <header><div><h2>{port.name}</h2><p>{port.description}</p></div><button onClick={()=>useGameStore.getState().closePanel()}>Close</button></header>
  <p>The crew carries passengers free while the crown roads recover. Choose a destination and board the docked boat.</p>
  <div className="menu-actions">{PORTS.filter(p=>p.id!==id).map(p=><button key={p.id} onClick={()=>useGameStore.getState().hydrate({passageRequest:p.id,panel:null})}>Sail to {p.name}</button>)}</div>
  <p>Darkav: land at Ashen Landing, then follow the ash road north to Blackspire. Attune its shrine for later fast travel.</p>
 </section></div>;
}

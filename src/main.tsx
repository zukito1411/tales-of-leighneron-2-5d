import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './fantasy-ui.css';
import './map-layout-fix.css';
import './map-regional-navigation.css';
import './inventory-column.css';
import './lore-journal.css';
import {prepareOfflineStartup} from './utils/appStartup';

async function start(){
  try{if(!(await prepareOfflineStartup()))return;}catch(error){console.warn('Offline preparation:',error);}
  try{
    const {default:App}=await import('./App');
    createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
  }catch(error){
    console.error('[startup] Application initialization failed:',error);
    window.dispatchEvent(new CustomEvent('mernondna-startup-error',{detail:error}));
  }
}
void start();

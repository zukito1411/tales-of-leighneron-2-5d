import {useEffect,useState} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';
import {saveVerifiedNativeBackup,type NativeBackupBridge} from '../utils/nativeBackupFlow';
import {GRAPHICS_REPORT_EVENT,graphicsReportExport,hasGraphicsReport} from '../utils/graphicsRecoveryReport';

const NativeFiles=registerPlugin<NativeBackupBridge>('SaveFiles');
/** Reuse the existing verified on-device file writer, independently of saves. */
export function GraphicsReportControls(){
  const [available,setAvailable]=useState(hasGraphicsReport);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    const changed=()=>setAvailable(hasGraphicsReport());
    window.addEventListener(GRAPHICS_REPORT_EVENT,changed);
    return ()=>window.removeEventListener(GRAPHICS_REPORT_EVENT,changed);
  },[]);
  if(!available)return null;
  const exportReport=async()=>{
    if(busy)return;setBusy(true);setMessage('');
    try{
      const report=graphicsReportExport();
      if(Capacitor.isNativePlatform()){
        const saved=await saveVerifiedNativeBackup(NativeFiles,report);
        setMessage('Graphics report saved: Downloads/TalesOfLeigneron/'+saved.filename);
      }else{
        const url=URL.createObjectURL(new Blob([report.json],{type:'application/json'}));
        try{
          const link=document.createElement('a');link.href=url;link.download=report.filename;
          document.body.appendChild(link);link.click();link.remove();
          setMessage('Graphics report download requested.');
        }finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
      }
    }catch(error){setMessage(error instanceof Error?error.message:'Could not export the graphics report.');}
    finally{setBusy(false);}
  };
  return <div className="save-transfer-controls"><button type="button" disabled={busy} onClick={()=>{void exportReport();}}>
    {busy?'Saving report…':'Export Graphics Report'}</button>{message&&<p className="save-transfer-message" role="status">{message}</p>}</div>;
}

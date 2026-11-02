package com.mernondna.rpg25d;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name="GameAssets")
public class GameAssetsPlugin extends Plugin {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy=new AtomicBoolean();
    private volatile boolean closed=false;
    private GameAssetStore store(){return ((MainActivity)getActivity()).gameAssets;}
    @PluginMethod public void status(PluginCall call){worker.execute(()->{
        try{call.resolve(store().status());}catch(Exception error){call.reject("Could not check game files.",error);}
    });}
    @PluginMethod public void prepare(PluginCall call){
        if(!busy.compareAndSet(false,true)){call.reject("A download is already running.");return;}
        worker.execute(()->{try{
            store().install((done,total,message)->{if(!closed){JSObject p=new JSObject();p.put("done",done);p.put("total",total);p.put("message",message);notifyListeners("progress",p);}});
            if(!closed)call.resolve();
        }catch(Exception error){if(!closed)call.reject("Download interrupted: "+error.getMessage()+". Retry to resume; completed files are kept.",error);}
        finally{busy.set(false);}});
    }
    @Override protected void handleOnDestroy(){closed=true;worker.shutdownNow();super.handleOnDestroy();}
}

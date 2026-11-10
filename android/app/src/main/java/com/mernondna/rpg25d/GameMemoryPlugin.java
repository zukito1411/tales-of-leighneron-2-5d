package com.mernondna.rpg25d;

import android.app.ActivityManager;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Read-only device memory class for full-fidelity artwork residency.
 * Reports physical RAM capacity, not free GPU memory. WebGL texture cache
 * still enforces a conservative bound and releases truly unused artwork. */
@CapacitorPlugin(name="GameMemory")
public class GameMemoryPlugin extends Plugin {
    @PluginMethod
    public void profile(PluginCall call) {
        ActivityManager manager=(ActivityManager)getContext().getSystemService(Context.ACTIVITY_SERVICE);
        if(manager==null){call.reject("Memory information unavailable.");return;}
        ActivityManager.MemoryInfo info=new ActivityManager.MemoryInfo();
        manager.getMemoryInfo(info);
        JSObject result=new JSObject();
        result.put("physicalRamGiB",(double)info.totalMem/(1024.0*1024.0*1024.0));
        result.put("lowMemory",info.lowMemory);
        call.resolve(result);
    }
}

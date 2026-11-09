package com.mernondna.rpg25d;

import android.os.Bundle;
import android.view.View;
import android.view.Display;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

public class MainActivity extends BridgeActivity {
    GameAssetStore gameAssets;
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SaveFilesPlugin.class);
        registerPlugin(GameAssetsPlugin.class);
        gameAssets=new GameAssetStore(this);
        super.onCreate(savedInstanceState);
        if(gameAssets.enabled)bridge.setWebViewClient(new BridgeWebViewClient(bridge){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                if(MainActivity.this.bridge.getHost().equals(request.getUrl().getHost())){
                    WebResourceResponse local=gameAssets.serve(request);if(local!=null)return local;
                }
                return super.shouldInterceptRequest(view,request);
            }
        });
        hideSystemBars();
        requestHighestRefreshRate();
    }

    @Override
    public void onResume() {
        super.onResume();
        requestHighestRefreshRate();
    }

    /**
     * Request the highest refresh mode supported by the current display,
     * without changing its resolution. Android may ignore this preference
     * for power saver, thermal limits, user settings or other app windows.
     *
     * Refresh-rate selection never changes Phaser's game-time delta or
     * Arcade physics; rendering still follows WebView's rAF cadence.
     */
    private void requestHighestRefreshRate() {
        Display display=getWindowManager().getDefaultDisplay();
        if(display==null)return;
        float highest=0f;
        for(float hz:display.getSupportedRefreshRates()) {
            if(Float.isFinite(hz)&&hz>highest)highest=hz;
        }
        if(highest<=0f)return;
        WindowManager.LayoutParams params=getWindow().getAttributes();
        if(Math.abs(params.preferredRefreshRate-highest)<.01f)return;
        params.preferredRefreshRate=highest;
        getWindow().setAttributes(params);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        );
    }
}

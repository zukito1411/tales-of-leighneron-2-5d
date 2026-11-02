package com.mernondna.rpg25d;

import android.content.Context;
import android.webkit.*;
import com.getcapacitor.JSObject;
import org.json.*;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.*;

/** Private, content-addressed files only. No save directories, database or
 * remotely supplied executable code. The APK pins its exact asset manifest. */
public final class GameAssetStore {
    interface Progress {void update(long done,long total,String message);}
    private final File directory;
    private final JSONObject manifest,files;
    private final JSONArray packs;
    private final Map<String,Long> expected=new HashMap<>();
    public final boolean enabled;
    GameAssetStore(Context context){
        directory=new File(context.getNoBackupFilesDir(),"game-assets-v1");
        JSONObject loaded=null;
        try(InputStream in=context.getAssets().open("public/native-assets.json")){
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[16384];int n;while((n=in.read(buffer))!=-1)bytes.write(buffer,0,n);
            loaded=new JSONObject(bytes.toString("UTF-8"));
        }catch(FileNotFoundException absent){/* A full offline APK needs no downloader. */}
        catch(Exception error){throw new IllegalStateException("Invalid game asset manifest",error);}
        manifest=loaded;enabled=loaded!=null;
        files=enabled?loaded.optJSONObject("files"):new JSONObject();packs=enabled?loaded.optJSONArray("packs"):new JSONArray();
        if(enabled)try{
            if(loaded.getInt("version")!=1||!loaded.getString("baseUrl").equals("https://github.com/zukito1411/tales-of-leighneron-2-5d/releases/download/leighneron-assets-v1/"))throw new IOException("Invalid asset source");
            for(Iterator<String> it=files.keys();it.hasNext();){String path=it.next();JSONObject f=files.getJSONObject(path);String hash=f.getString("hash");
                if(!path.startsWith("assets/")||path.contains("..")||!hash.matches("[a-f0-9]{64}")||f.getLong("bytes")<0)throw new IOException("Invalid asset path");expected.put(hash,f.getLong("bytes"));}
        }catch(Exception error){throw new IllegalStateException("Invalid game asset manifest",error);}
    }
    private File blob(String hash){return new File(directory,hash);}
    private boolean present(String hash){File f=blob(hash);Long size=expected.get(hash);return size!=null&&f.isFile()&&f.length()==size;}
    private boolean needed(JSONObject pack)throws JSONException{JSONArray list=pack.getJSONArray("files");for(int i=0;i<list.length();i++)if(!present(list.getString(i)))return true;return false;}
    JSObject status()throws Exception{
        long bytes=0;for(int i=0;i<packs.length();i++){JSONObject pack=packs.getJSONObject(i);if(needed(pack))bytes+=pack.getLong("bytes");}
        JSObject result=new JSObject();result.put("bytes",bytes);result.put("ready",bytes==0);return result;
    }
    private static String digest(File file)throws Exception{
        MessageDigest d=MessageDigest.getInstance("SHA-256");byte[] buffer=new byte[65536];
        try(InputStream in=new FileInputStream(file)){int n;while((n=in.read(buffer))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();d.update(buffer,0,n);}}
        StringBuilder hex=new StringBuilder();for(byte b:d.digest())hex.append(String.format(Locale.ROOT,"%02x",b&255));return hex.toString();
    }
    void install(Progress progress)throws Exception{
        if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Could not create game storage");
        long total=status().getLong("bytes"),done=0;
        for(int i=0;i<packs.length();i++){
            JSONObject pack=packs.getJSONObject(i);if(!needed(pack))continue;
            String hash=pack.getString("hash");if(!hash.matches("[a-f0-9]{64}"))throw new IOException("Invalid pack hash");
            long size=pack.getLong("bytes");File part=new File(directory,hash+".part");
            if(part.length()>size)part.delete();
            long offset=part.isFile()?part.length():0;
            if(offset<size){
                HttpURLConnection connection=(HttpURLConnection)new URL(manifest.getString("baseUrl")+hash+".zip").openConnection();
                connection.setConnectTimeout(30000);connection.setReadTimeout(30000);connection.setRequestProperty("Accept-Encoding","identity");
                if(offset>0)connection.setRequestProperty("Range","bytes="+offset+"-");
                try{
                    int code=connection.getResponseCode();boolean append=code==206&&offset>0&&connection.getHeaderField("Content-Range")!=null&&connection.getHeaderField("Content-Range").startsWith("bytes "+offset+"-");
                    if(code!=200&&!append)throw new IOException("Download HTTP "+code);
                    if(!append)offset=0;
                    if(directory.getUsableSpace()<Math.max(0,size-offset)+32L*1024*1024)throw new IOException("Not enough storage space");
                    try(InputStream in=connection.getInputStream();OutputStream out=new FileOutputStream(part,append)){
                        byte[] buffer=new byte[65536];int n;long last=0;
                        while((n=in.read(buffer))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();offset+=n;if(offset>size)throw new IOException("Pack exceeds expected size");out.write(buffer,0,n);
                            long now=System.currentTimeMillis();if(now-last>150){progress.update(done+offset,total,"Downloading game files");last=now;}}
                    }
                }finally{connection.disconnect();}
            }
            progress.update(done,total,"Checking and unpacking game files");
            if(part.length()!=size||!digest(part).equals(hash)){part.delete();throw new IOException("Pack verification failed");}
            Set<String> allowed=new HashSet<>();JSONArray list=pack.getJSONArray("files");for(int j=0;j<list.length();j++)allowed.add(list.getString(j));
            try(ZipInputStream zip=new ZipInputStream(new FileInputStream(part))){
                ZipEntry entry;while((entry=zip.getNextEntry())!=null){String name=entry.getName();
                    if(entry.isDirectory()||!allowed.remove(name)||!expected.containsKey(name))throw new IOException("Unexpected pack entry");
                    if(directory.getUsableSpace()<expected.get(name)+4L*1024*1024)throw new IOException("Not enough storage to unpack game files");
                    File temporary=new File(directory,name+".tmp");long count=0;
                    try(OutputStream out=new FileOutputStream(temporary)){byte[] buffer=new byte[65536];int n;while((n=zip.read(buffer))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();count+=n;if(count>expected.get(name))throw new IOException("Asset exceeds expected size");out.write(buffer,0,n);}}
                    if(count!=expected.get(name)||!digest(temporary).equals(name)){temporary.delete();throw new IOException("Asset verification failed");}
                    android.system.Os.rename(temporary.getAbsolutePath(),blob(name).getAbsolutePath());
                }
            }
            if(!allowed.isEmpty())throw new IOException("Incomplete pack");
            part.delete();done+=size;progress.update(done,total,"Game files ready");
        }
        if(!status().getBoolean("ready",false))throw new IOException("Incomplete game files");
        // Retire only old downloader files after the complete current manifest
        // is usable. Never inspect or remove save/settings/backup storage.
        File[] old=directory.listFiles();if(old!=null)for(File f:old)if(!expected.containsKey(f.getName()))f.delete();
    }
    WebResourceResponse serve(WebResourceRequest request){
        String path=request.getUrl().getPath();if(path==null||!path.startsWith("/"))return null;
        JSONObject entry=files.optJSONObject(path.substring(1));if(entry==null)return null;
        try{
            String hash=entry.getString("hash");if(!present(hash))return new WebResourceResponse("text/plain","UTF-8",404,"Missing game file",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
            File f=blob(hash);long length=f.length(),start=0,end=length-1;boolean range=false;
            if(length==0)return new WebResourceResponse("application/octet-stream",null,new ByteArrayInputStream(new byte[0]));
            String requested=request.getRequestHeaders().get("Range");if(requested==null)requested=request.getRequestHeaders().get("range");
            if(requested!=null&&requested.matches("bytes=\\d+-\\d*")){
                String[] bounds=requested.substring(6).split("-",-1);start=Long.parseLong(bounds[0]);if(!bounds[1].isEmpty())end=Math.min(end,Long.parseLong(bounds[1]));range=true;
            }
            if(start<0||start>end||end>=length)return new WebResourceResponse("text/plain","UTF-8",416,"Invalid range",Collections.singletonMap("Content-Range","bytes */"+length),new ByteArrayInputStream(new byte[0]));
            RandomAccessFile input=new RandomAccessFile(f,"r");input.seek(start);final long count=end-start+1;
            InputStream stream=new InputStream(){long remaining=count;public int read()throws IOException{if(remaining<=0)return -1;int b=input.read();if(b>=0)remaining--;return b;}public int read(byte[] b,int o,int n)throws IOException{if(remaining<=0)return -1;int got=input.read(b,o,(int)Math.min(n,remaining));if(got>0)remaining-=got;return got;}public void close()throws IOException{input.close();}};
            Map<String,String> headers=new HashMap<>();headers.put("Content-Length",Long.toString(count));headers.put("Accept-Ranges","bytes");headers.put("Cache-Control","no-store");
            if(range)headers.put("Content-Range","bytes "+start+"-"+end+"/"+length);
            String mime=URLConnection.guessContentTypeFromName(path);if(mime==null){String ext=MimeTypeMap.getFileExtensionFromUrl(path);mime=MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);}if(mime==null)mime="application/octet-stream";
            return new WebResourceResponse(mime,null,range?206:200,range?"Partial Content":"OK",headers,stream);
        }catch(Exception error){return new WebResourceResponse("text/plain","UTF-8",500,"Game file error",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
    }
}

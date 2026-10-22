package com.mernondna.rpg25d;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.UUID;

/**
 * Save backup file access through Android's Storage Access Framework.
 * No broad storage permission is needed: the player chooses each document.
 */
@CapacitorPlugin(name = "SaveFiles")
public class SaveFilesPlugin extends Plugin {
    private static final int MAX_IMPORT_BYTES = 64 * 1024 * 1024;

    // Stage while the WebView is still foregrounded. The document picker used
    // to suspend a GPU-heavy Phaser game while keeping a multi-megabyte JSON
    // string inside PluginCall. If Android killed the WebView, it left a
    // zero-byte destination. Staging means later calls contain only a token.
    @PluginMethod
    public void stageExportJson(PluginCall call) {
        String content = call.getString("content");
        if (content == null || !content.startsWith("{")) {
            call.reject("Backup is not a JSON document.");
            return;
        }
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32 || bytes.length > MAX_IMPORT_BYTES) {
            call.reject("Backup must contain between 32 bytes and 64 MB.");
            return;
        }
        File dir = stagingDirectory();
        if (!dir.isDirectory() && !dir.mkdirs()) {
            call.reject("Cannot create a private backup staging directory.");
            return;
        }
        // Expire unclaimed staging copies. Never touch the actual game save.
        File[] previous = dir.listFiles();
        if (previous != null) for (File file : previous) {
            if (System.currentTimeMillis() - file.lastModified() > 24L * 60 * 60 * 1000) file.delete();
        }
        String token = UUID.randomUUID().toString();
        File staged = new File(dir, token + ".json");
        try (FileOutputStream out = new FileOutputStream(staged)) {
            out.write(bytes);
            out.getFD().sync();
            JSObject response = new JSObject();
            response.put("token", token);
            response.put("bytes", bytes.length);
            call.resolve(response);
        } catch (Exception error) {
            staged.delete();
            call.reject("Could not stage backup: " + error.getMessage());
        }
    }

    // Android 10+ saves directly in Downloads/TalesOfLeigneron without
    // invoking an external document picker (and without backgrounding WebView).
    // Older devices retain the picker, but its pending call is now tiny.
    @PluginMethod
    public void exportStagedJson(PluginCall call) {
        String token = call.getString("token");
        String filename = call.getString("filename");
        if (token == null || !token.matches("[0-9a-fA-F-]{36}") ||
            filename == null || !filename.matches("[A-Za-z0-9._-]{1,180}\\.json")) {
            call.reject("Invalid staged backup request.");
            return;
        }
        File staged = stagedFile(token);
        if (!staged.isFile() || staged.length() < 32 || staged.length() > MAX_IMPORT_BYTES) {
            call.reject("The staged backup is missing or empty.");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, filename);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(call, intent, "writeStagedDocument");
            return;
        }
        Uri uri = null;
        try {
            ContentValues metadata = new ContentValues();
            metadata.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
            metadata.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
            metadata.put(MediaStore.MediaColumns.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS + "/TalesOfLeigneron");
            metadata.put(MediaStore.MediaColumns.IS_PENDING, 1);
            ContentResolver resolver = getContext().getContentResolver();
            uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, metadata);
            if (uri == null) throw new IllegalStateException("Downloads rejected the backup.");
            int bytes = copyAndVerify(staged, uri);
            ContentValues published = new ContentValues();
            published.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, published, null, null);
            staged.delete();
            resolveExport(call, bytes, filename);
        } catch (Exception error) {
            if (uri != null) {
                try { getContext().getContentResolver().delete(uri, null, null); }
                catch (Exception ignored) { /* Preserve original write failure. */ }
            }
            call.reject("Could not save verified backup to Downloads: " + error.getMessage());
        }
    }

    @ActivityCallback
    private void writeStagedDocument(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("Backup export cancelled; existing saves were not changed.");
            return;
        }
        try {
            File staged = stagedFile(call.getString("token", ""));
            if (!staged.isFile()) throw new IllegalStateException("Staged backup unavailable.");
            int bytes = copyAndVerify(staged, data.getData());
            staged.delete();
            resolveExport(call, bytes, call.getString("filename", "backup.json"));
        } catch (Exception error) {
            try { getContext().getContentResolver().delete(data.getData(), null, null); }
            catch (Exception ignored) { /* Keep reporting the primary error. */ }
            call.reject("Could not export verified backup: " + error.getMessage());
        }
    }

    private File stagingDirectory() {
        return new File(getContext().getCacheDir(), "tol-export-stage");
    }

    private File stagedFile(String token) {
        if (token == null || !token.matches("[0-9a-fA-F-]{36}"))
            return new File(stagingDirectory(), "invalid-token");
        return new File(stagingDirectory(), token + ".json");
    }

    private int copyAndVerify(File staged, Uri destination) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        MessageDigest expected = MessageDigest.getInstance("SHA-256");
        byte[] buffer = new byte[8192];
        int copied = 0;
        try (InputStream source = new FileInputStream(staged);
             OutputStream output = resolver.openOutputStream(destination, "wt")) {
            if (output == null) throw new IllegalStateException("Cannot write Downloads document.");
            int count;
            while ((count = source.read(buffer)) != -1) {
                expected.update(buffer, 0, count);
                output.write(buffer, 0, count);
                copied += count;
            }
            output.flush();
        }
        if (copied != staged.length()) throw new IllegalStateException("Staged backup size changed.");
        MessageDigest actual = MessageDigest.getInstance("SHA-256");
        int checked = 0;
        try (InputStream readback = resolver.openInputStream(destination)) {
            if (readback == null) throw new IllegalStateException("Cannot verify Downloads document.");
            int count;
            while ((count = readback.read(buffer)) != -1) {
                actual.update(buffer, 0, count);
                checked += count;
            }
        }
        if (checked != copied || !Arrays.equals(expected.digest(), actual.digest()))
            throw new IllegalStateException("Downloads copy failed integrity verification.");
        return copied;
    }

    private void resolveExport(PluginCall call, int bytes, String filename) {
        JSObject response = new JSObject();
        response.put("saved", true);
        response.put("bytes", bytes);
        response.put("filename", filename);
        call.resolve(response);
    }

    @PluginMethod
    public void importJson(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        // Some Android document providers label JSON files as text/plain
        // or application/octet-stream. Let the player select their file and
        // validate the contents in the game before importing anything.
        intent.setType("*/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivityForResult(call, intent, "readDocument");
    }

    @ActivityCallback
    private void readDocument(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("Backup import cancelled. Your saves were not changed.");
            return;
        }
        try (InputStream input = getContext().getContentResolver().openInputStream(data.getData())) {
            if (input == null) throw new IllegalStateException("Cannot open the selected backup.");
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int size;
            while ((size = input.read(buffer)) != -1) {
                if (output.size() + size > MAX_IMPORT_BYTES)
                    throw new IllegalArgumentException("Save backup exceeds the 64 MB limit.");
                output.write(buffer, 0, size);
            }
            JSObject response = new JSObject();
            response.put("content", output.toString(StandardCharsets.UTF_8.name()));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Could not read the backup: " + error.getMessage());
        }
    }
}

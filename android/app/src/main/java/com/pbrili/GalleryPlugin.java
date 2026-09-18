package com.pbrili;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "Gallery", permissions = {
        @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = "storage")
})
public class GalleryPlugin extends Plugin {

    private static final String ALBUM = "排班日历";

    @PluginMethod
    public void saveImage(PluginCall call) {
        String dataUrl = call.getString("dataUrl", "");
        if (dataUrl == null || dataUrl.isEmpty()) {
            call.reject("缺少图片数据");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermsCallback");
            return;
        }
        performSave(call, dataUrl);
    }

    @PermissionCallback
    private void storagePermsCallback(PluginCall call) {
        if (getPermissionState("storage") != PermissionState.GRANTED) {
            call.reject("没有保存到相册的权限");
            return;
        }
        performSave(call, call.getString("dataUrl", ""));
    }

    private void performSave(PluginCall call, String dataUrl) {
        try {
            String base64 = dataUrl;
            int comma = base64.indexOf(',');
            if (comma >= 0) {
                base64 = base64.substring(comma + 1);
            }
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap == null) {
                call.reject("图片解析失败");
                return;
            }

            String fileName = call.getString("fileName", "donate-qr.png");
            Context context = getContext();
            String savedPath;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = context.getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH,
                        Environment.DIRECTORY_PICTURES + "/" + ALBUM);
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
                Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    call.reject("保存失败");
                    return;
                }
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) {
                        call.reject("保存失败");
                        return;
                    }
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
                }
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                savedPath = Environment.DIRECTORY_PICTURES + "/" + ALBUM + "/" + fileName;
            } else {
                File dir = new File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                        ALBUM);
                if (!dir.exists() && !dir.mkdirs()) {
                    call.reject("保存失败");
                    return;
                }
                File file = new File(dir, fileName);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
                }
                MediaScannerConnection.scanFile(context,
                        new String[] { file.getAbsolutePath() },
                        new String[] { "image/png" }, null);
                savedPath = file.getAbsolutePath();
            }

            JSObject result = new JSObject();
            result.put("path", savedPath);
            if (getActivity() != null) {
                getActivity().runOnUiThread(() -> Toast
                        .makeText(context, "已保存到相册，打开微信扫一扫即可", Toast.LENGTH_SHORT).show());
            }
            call.resolve(result);
        } catch (Exception e) {
            call.reject("保存失败：" + e.getMessage());
        }
    }
}

package com.abdullahataya.fooddistribution;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;

/**
 * ThermalPrinterPlugin:
 * Direct Android Native Bluetooth Classic (RFCOMM / SPP) plugin for Capacitor.
 * Specifically built for Xprinter XP-P801A (80mm) and compatible ESC/POS thermal printers.
 */
@CapacitorPlugin(
        name = "ThermalPrinter",
        permissions = {
                @Permission(strings = {Manifest.permission.BLUETOOTH_CONNECT}, alias = "bluetooth_connect"),
                @Permission(strings = {Manifest.permission.BLUETOOTH_SCAN}, alias = "bluetooth_scan")
        }
)
public class ThermalPrinterPlugin extends Plugin {

    private static final String TAG = "ThermalPrinterPlugin";
    // Standard Serial Port Profile (SPP) UUID used by Xprinter and almost all ESC/POS Bluetooth printers
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");
    private static final String PREFS_NAME = "AlAtayaPrinterPrefs";
    private static final String KEY_SAVED_MAC = "saved_printer_mac";
    private static final String KEY_SAVED_NAME = "saved_printer_name";

    private BluetoothSocket bluetoothSocket = null;
    private OutputStream outputStream = null;
    private String connectedDeviceName = null;
    private String connectedDeviceAddress = null;

    private BluetoothAdapter getAdapter() {
        return BluetoothAdapter.getDefaultAdapter();
    }

    private boolean hasConnectPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    @PluginMethod
    public void getPairedDevices(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) {
            call.reject("الجهاز لا يدعم البلوتوث");
            return;
        }

        if (!adapter.isEnabled()) {
            call.reject("البلوتوث غير مفعّل على جهازك. يرجى تفعيل البلوتوث أولاً.");
            return;
        }

        if (!hasConnectPermission()) {
            call.reject("يرجى منح صلاحية الاتصال بالبلوتوث (BLUETOOTH_CONNECT) للتطبيق");
            return;
        }

        try {
            Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
            JSArray devicesList = new JSArray();

            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String savedMac = prefs.getString(KEY_SAVED_MAC, "");

            if (pairedDevices != null) {
                for (BluetoothDevice device : pairedDevices) {
                    JSObject devObj = new JSObject();
                    String name = device.getName();
                    String address = device.getAddress();
                    devObj.put("name", name != null ? name : "طابعة بلوتوث غير معروفة");
                    devObj.put("address", address);
                    devObj.put("isSaved", address.equalsIgnoreCase(savedMac));
                    devicesList.put(devObj);
                }
            }

            JSObject ret = new JSObject();
            ret.put("devices", devicesList);
            call.resolve(ret);
        } catch (SecurityException e) {
            Log.e(TAG, "SecurityException while getting paired devices", e);
            call.reject("صلاحيات البلوتوث مرفوضة: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Error getting paired devices", e);
            call.reject("خطأ أثناء جلب الطابعات المقترنة: " + e.getMessage());
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address");
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        if (address == null || address.trim().isEmpty()) {
            address = prefs.getString(KEY_SAVED_MAC, null);
        }

        if (address == null || address.trim().isEmpty()) {
            call.reject("لم يتم تحديد طابعة. يرجى اختيار طابعة مقترنة من القائمة أولاً.");
            return;
        }

        BluetoothAdapter adapter = getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("البلوتوث غير مفعّل");
            return;
        }

        if (!hasConnectPermission()) {
            call.reject("صلاحية البلوتوث غير ممنوحة");
            return;
        }

        final String targetMac = address.trim();

        // Run connection in background thread
        new Thread(() -> {
            try {
                // If already connected to target, check if still alive
                if (bluetoothSocket != null && bluetoothSocket.isConnected() && targetMac.equalsIgnoreCase(connectedDeviceAddress)) {
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("deviceName", connectedDeviceName);
                    ret.put("address", connectedDeviceAddress);
                    call.resolve(ret);
                    return;
                }

                // Close any existing connection cleanly
                closeConnection();

                adapter.cancelDiscovery(); // Essential for fast and reliable connection

                BluetoothDevice device = adapter.getRemoteDevice(targetMac);
                String devName = device.getName() != null ? device.getName() : "طابعة حرارية";

                BluetoothSocket socket = null;
                try {
                    socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                } catch (IOException e1) {
                    Log.w(TAG, "Standard SPP connection failed, attempting fallback reflection socket...", e1);
                    try {
                        Method m = device.getClass().getMethod("createRfcommSocket", int.class);
                        socket = (BluetoothSocket) m.invoke(device, 1);
                        if (socket != null) {
                            socket.connect();
                        }
                    } catch (Exception e2) {
                        Log.e(TAG, "Fallback socket connection also failed", e2);
                        call.reject("فشل الاتصال بالطابعة (" + devName + "). تأكد من تشغيلها وقرب المسافة.");
                        return;
                    }
                }

                if (socket == null || !socket.isConnected()) {
                    call.reject("تعذر فتح قناة الاتصال مع الطابعة (" + devName + ")");
                    return;
                }

                bluetoothSocket = socket;
                outputStream = socket.getOutputStream();
                connectedDeviceName = devName;
                connectedDeviceAddress = targetMac;

                // Save MAC and Name
                prefs.edit()
                        .putString(KEY_SAVED_MAC, targetMac)
                        .putString(KEY_SAVED_NAME, devName)
                        .apply();

                // Send ESC @ (Initialize)
                try {
                    outputStream.write(new byte[]{0x1B, 0x40});
                    outputStream.flush();
                } catch (Exception ignored) {}

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("deviceName", devName);
                ret.put("address", targetMac);
                call.resolve(ret);

            } catch (SecurityException e) {
                Log.e(TAG, "Security exception connecting to printer", e);
                call.reject("صلاحيات البلوتوث غير متوفرة: " + e.getMessage());
            } catch (Exception e) {
                Log.e(TAG, "General exception connecting to printer", e);
                call.reject("حدث خطأ أثناء الاتصال بالطابعة: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeConnection();
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        boolean connected = bluetoothSocket != null && bluetoothSocket.isConnected();
        JSObject ret = new JSObject();
        ret.put("connected", connected);
        ret.put("deviceName", connectedDeviceName);
        ret.put("address", connectedDeviceAddress);
        call.resolve(ret);
    }

    @PluginMethod
    public void getSavedPrinter(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String mac = prefs.getString(KEY_SAVED_MAC, null);
        String name = prefs.getString(KEY_SAVED_NAME, null);

        JSObject ret = new JSObject();
        ret.put("hasSaved", mac != null);
        ret.put("address", mac);
        ret.put("name", name);
        call.resolve(ret);
    }

    @PluginMethod
    public void printTestReceipt(PluginCall call) {
        new Thread(() -> {
            try {
                if (!ensureConnected(call)) {
                    return;
                }

                // Generate native Android Arabic bitmap
                Bitmap testBitmap = EscPosRasterHelper.createTestReceiptBitmap();
                byte[] rasterBytes = EscPosRasterHelper.bitmapToEscPosRaster(testBitmap);

                outputStream.write(rasterBytes);
                outputStream.flush();

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Failed to print test receipt", e);
                call.reject("فشل إرسال تذكرة الاختبار إلى الطابعة: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void printInvoice(PluginCall call) {
        JSObject invoiceData = call.getObject("invoice");
        if (invoiceData == null) {
            call.reject("بيانات الفاتورة مفقودة");
            return;
        }

        String centerName = call.getString("centerName", "مركز العطايا لتوزيع المواد الغذائية");
        String centerAddress = call.getString("centerAddress", "");
        String centerPhone = call.getString("centerPhone", "");

        new Thread(() -> {
            try {
                if (!ensureConnected(call)) {
                    return;
                }

                JSONObject invoiceJson = new JSONObject(invoiceData.toString());

                // Generate native Android Arabic bitmap with StaticLayout (proper RTL and Arabic shaping)
                Bitmap invoiceBitmap = EscPosRasterHelper.createInvoiceReceiptBitmap(
                        invoiceJson,
                        centerName,
                        centerAddress,
                        centerPhone
                );

                byte[] rasterBytes = EscPosRasterHelper.bitmapToEscPosRaster(invoiceBitmap);

                outputStream.write(rasterBytes);
                outputStream.flush();

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Failed to print invoice", e);
                call.reject("فشل إرسال الفاتورة للطابعة الحرارية: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void printRaw(PluginCall call) {
        String base64Data = call.getString("data");
        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("البيانات فارغة");
            return;
        }

        new Thread(() -> {
            try {
                if (!ensureConnected(call)) {
                    return;
                }

                byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
                outputStream.write(data);
                outputStream.flush();

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Failed to print raw data", e);
                call.reject("فشل طباعة البيانات الخام: " + e.getMessage());
            }
        }).start();
    }

    private synchronized boolean ensureConnected(PluginCall call) {
        if (bluetoothSocket != null && bluetoothSocket.isConnected() && outputStream != null) {
            return true;
        }

        // Attempt automatic reconnect to saved printer
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String savedMac = prefs.getString(KEY_SAVED_MAC, null);

        if (savedMac == null) {
            call.reject("الطابعة غير متصلة. يرجى اختيار طابعة والاتصال بها أولاً من إعدادات الطابعة.");
            return false;
        }

        BluetoothAdapter adapter = getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("البلوتوث غير مفعّل");
            return false;
        }

        try {
            closeConnection();
            adapter.cancelDiscovery();
            BluetoothDevice device = adapter.getRemoteDevice(savedMac);
            bluetoothSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            bluetoothSocket.connect();
            outputStream = bluetoothSocket.getOutputStream();
            connectedDeviceName = device.getName();
            connectedDeviceAddress = savedMac;
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Automatic reconnection failed", e);
            call.reject("انقطع الاتصال بالطابعة (" + savedMac + ")، يرجى إعادة الاتصال بها.");
            return false;
        }
    }

    private synchronized void closeConnection() {
        try {
            if (outputStream != null) {
                outputStream.close();
            }
        } catch (Exception ignored) {}
        try {
            if (bluetoothSocket != null) {
                bluetoothSocket.close();
            }
        } catch (Exception ignored) {}

        outputStream = null;
        bluetoothSocket = null;
    }
}

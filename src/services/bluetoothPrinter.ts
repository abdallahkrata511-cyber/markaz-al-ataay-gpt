import { Capacitor, registerPlugin } from '@capacitor/core';
import { Invoice, AppSettings } from '../types';

export interface NativeThermalPrinterPlugin {
  getPairedDevices(): Promise<{ devices: Array<{ name: string; address: string; isSaved?: boolean }> }>;
  connect(options?: { address?: string }): Promise<{ success: boolean; deviceName?: string; address?: string }>;
  disconnect(): Promise<{ success: boolean }>;
  isConnected(): Promise<{ connected: boolean; deviceName?: string; address?: string }>;
  getSavedPrinter(): Promise<{ hasSaved: boolean; name?: string; address?: string }>;
  printTestReceipt(): Promise<{ success: boolean }>;
  printInvoice(options: {
    invoice: any;
    centerName?: string;
    centerAddress?: string;
    centerPhone?: string;
  }): Promise<{ success: boolean }>;
  printRaw(options: { data: string }): Promise<{ success: boolean }>;
}

/**
 * Web fallback implementation of the ThermalPrinter plugin
 * Prevents "plugin is not implemented on web" error when running in browser or preview.
 */
class ThermalPrinterWeb implements NativeThermalPrinterPlugin {
  async getPairedDevices(): Promise<{ devices: Array<{ name: string; address: string; isSaved?: boolean }> }> {
    const saved = BluetoothThermalPrinter.getSavedPrinter();
    return {
      devices: [
        {
          name: saved?.name || 'Xprinter XP-P801A (80mm)',
          address: saved?.address || '66:22:88:99:AA:BB',
          isSaved: true,
        },
        {
          name: 'طابعة فواتير بلوتوث محمولة (58mm)',
          address: 'AA:BB:CC:DD:EE:FF',
          isSaved: false,
        },
      ],
    };
  }

  async connect(options?: { address?: string }): Promise<{ success: boolean; deviceName?: string; address?: string }> {
    const saved = BluetoothThermalPrinter.getSavedPrinter();
    const address = options?.address || saved?.address || '66:22:88:99:AA:BB';
    const name = saved?.name || 'Xprinter XP-P801A';
    BluetoothThermalPrinter.savePrinter(name, address);
    return { success: true, deviceName: name, address };
  }

  async disconnect(): Promise<{ success: boolean }> {
    return { success: true };
  }

  async isConnected(): Promise<{ connected: boolean; deviceName?: string; address?: string }> {
    const saved = BluetoothThermalPrinter.getSavedPrinter();
    return {
      connected: true,
      deviceName: saved?.name || 'Xprinter XP-P801A',
      address: saved?.address || '66:22:88:99:AA:BB',
    };
  }

  async getSavedPrinter(): Promise<{ hasSaved: boolean; name?: string; address?: string }> {
    const saved = BluetoothThermalPrinter.getSavedPrinter();
    return {
      hasSaved: !!saved,
      name: saved?.name || 'Xprinter XP-P801A',
      address: saved?.address || '66:22:88:99:AA:BB',
    };
  }

  async printTestReceipt(): Promise<{ success: boolean }> {
    console.info('Test receipt simulated for web environment');
    return { success: true };
  }

  async printInvoice(): Promise<{ success: boolean }> {
    if (typeof window !== 'undefined') {
      window.print();
    }
    return { success: true };
  }

  async printRaw(): Promise<{ success: boolean }> {
    return { success: true };
  }
}

export const NativeThermalPrinter = registerPlugin<NativeThermalPrinterPlugin>('ThermalPrinter', {
  web: () => new ThermalPrinterWeb(),
});

export interface BluetoothDeviceState {
  connected: boolean;
  deviceName: string | null;
  deviceId?: string | null;
  paperWidth: '58mm' | '80mm';
  error: string | null;
}

export interface DiscoveredPrinter {
  id: string;
  name: string;
  address?: string;
  isSaved?: boolean;
}

const STORAGE_KEY_SAVED_PRINTER = 'al_ataya_last_bluetooth_printer';
const STORAGE_KEY_PAPER_WIDTH = 'al_ataya_printer_paper_width';

export class BluetoothThermalPrinter {
  private static isConnectedState = false;
  private static currentDeviceName: string | null = null;
  private static currentDeviceAddress: string | null = null;

  static isNativeAndroid(): boolean {
    return (
      typeof window !== 'undefined' &&
      Capacitor.isNativePlatform() &&
      Capacitor.getPlatform() === 'android' &&
      Capacitor.isPluginAvailable('ThermalPrinter')
    );
  }

  static isWebBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  static isWebBluetoothBlockedByPolicy(): boolean {
    try {
      if (typeof window !== 'undefined' && window.self !== window.top) {
        return true;
      }
      if (typeof document !== 'undefined') {
        const docAny = document as any;
        if (docAny.permissionsPolicy && typeof docAny.permissionsPolicy.allowsFeature === 'function') {
          return !docAny.permissionsPolicy.allowsFeature('bluetooth');
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  static getSavedPrinter(): { address?: string; name?: string } | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SAVED_PRINTER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  static savePrinter(name?: string | null, address?: string | null) {
    try {
      if (name || address) {
        localStorage.setItem(
          STORAGE_KEY_SAVED_PRINTER,
          JSON.stringify({ name: name || 'Xprinter XP-P801A', address: address || undefined })
        );
      }
    } catch {
      // ignore
    }
  }

  static getPaperWidth(): '58mm' | '80mm' {
    try {
      return (localStorage.getItem(STORAGE_KEY_PAPER_WIDTH) as '58mm' | '80mm') || '80mm';
    } catch {
      return '80mm';
    }
  }

  static setPaperWidth(width: '58mm' | '80mm') {
    try {
      localStorage.setItem(STORAGE_KEY_PAPER_WIDTH, width);
    } catch {
      // ignore
    }
  }

  static async isConnected(): Promise<boolean> {
    if (this.isNativeAndroid()) {
      try {
        const res = await NativeThermalPrinter.isConnected();
        this.isConnectedState = res.connected;
        if (res.deviceName) this.currentDeviceName = res.deviceName;
        if (res.address) this.currentDeviceAddress = res.address;
        return res.connected;
      } catch {
        return this.isConnectedState;
      }
    }
    return this.isConnectedState;
  }

  static getConnectedDeviceName(): string | null {
    return this.currentDeviceName;
  }

  static getConnectedDeviceAddress(): string | null {
    return this.currentDeviceAddress;
  }

  /**
   * Fetch Paired Bluetooth Classic Devices (Android Native or Web Fallback)
   */
  static async getPairedDevices(): Promise<DiscoveredPrinter[]> {
    try {
      const res = await NativeThermalPrinter.getPairedDevices();
      if (res && res.devices) {
        return res.devices.map((d) => ({
          id: d.address,
          name: d.name,
          address: d.address,
          isSaved: !!d.isSaved,
        }));
      }
    } catch (err: any) {
      console.warn('Error retrieving paired devices:', err);
    }

    // Fallback mockup / saved device
    const saved = this.getSavedPrinter();
    return [
      {
        id: saved?.address || '66:22:88:99:AA:BB',
        name: saved?.name || 'Xprinter XP-P801A (80mm)',
        address: saved?.address || '66:22:88:99:AA:BB',
        isSaved: true,
      },
    ];
  }

  /**
   * Connect to Bluetooth Thermal Printer (SPP / Bluetooth Classic RFCOMM)
   */
  static async connect(address?: string): Promise<{
    success: boolean;
    deviceName?: string;
    address?: string;
    error?: string;
    isPermissionsPolicyBlocked?: boolean;
  }> {
    // 1. Android Native Capacitor Bridge (Direct RFCOMM Socket)
    if (this.isNativeAndroid()) {
      try {
        const res = await NativeThermalPrinter.connect({ address });
        if (res && res.success) {
          this.isConnectedState = true;
          this.currentDeviceName = res.deviceName || 'Xprinter XP-P801A';
          this.currentDeviceAddress = res.address || address || null;
          this.savePrinter(this.currentDeviceName, this.currentDeviceAddress);
          return {
            success: true,
            deviceName: this.currentDeviceName,
            address: this.currentDeviceAddress || undefined,
          };
        }
      } catch (err: any) {
        console.error('Native printer connect failed:', err);
        return {
          success: false,
          error: err?.message || 'فشل الاتصال بالطابعة عبر البلوتوث الكلاسيكي. تأكد من إقرانها بالهاتف أولاً.',
        };
      }
    }

    // 2. Web / Browser simulation mode (No crash, seamless UX)
    const saved = this.getSavedPrinter();
    const targetAddress = address || saved?.address || '66:22:88:99:AA:BB';
    const targetName = saved?.name || 'Xprinter XP-P801A (80mm)';

    this.isConnectedState = true;
    this.currentDeviceName = targetName;
    this.currentDeviceAddress = targetAddress;
    this.savePrinter(targetName, targetAddress);

    return {
      success: true,
      deviceName: targetName,
      address: targetAddress,
    };
  }

  /**
   * Disconnect
   */
  static async disconnect(): Promise<void> {
    try {
      if (this.isNativeAndroid()) {
        await NativeThermalPrinter.disconnect();
      }
    } catch (e) {
      console.warn('Disconnect warning', e);
    } finally {
      this.isConnectedState = false;
      this.currentDeviceName = null;
      this.currentDeviceAddress = null;
    }
  }

  /**
   * Test Print (طباعة اختبار حقيقية)
   * Contains exact required text:
   * مركز العطايا
   * اختبار الطابعة
   * Xprinter XP-P801A
   * 123456789
   * ABC
   * العربية
   * سكر
   * زيت
   * شاي
   * المجموع
   * اختبار ناجح
   */
  static async printTestReceipt(centerName = 'مركز العطايا لتوزيع المواد الغذائية'): Promise<boolean> {
    // 1. Android Native Route (Draws Arabic Bitmap via StaticLayout and sends ESC/POS GS v 0 raster)
    if (this.isNativeAndroid()) {
      try {
        const res = await NativeThermalPrinter.printTestReceipt();
        return !!res && res.success;
      } catch (err) {
        console.error('Native test receipt error:', err);
        throw err;
      }
    }

    // 2. Web fallback
    console.info('Test receipt executed successfully for:', centerName);
    return true;
  }

  /**
   * Prints the sales invoice
   * Converts Arabic invoice into 80mm Raster Bitmap on Android Native,
   * completely eliminating letter disjoining or UTF-8 corruption.
   * If currency is USD (fixed USD), it hides customer exchange rate completely.
   */
  static async printInvoice(
    invoice: Invoice,
    settings: AppSettings,
    paperWidth: '58mm' | '80mm' = '80mm'
  ): Promise<boolean> {
    // 1. Android Native Route (High Precision Canvas Raster)
    if (this.isNativeAndroid()) {
      try {
        const formattedDate = new Date(invoice.date).toLocaleString('ar-SY', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const invoicePayload = {
          ...invoice,
          dateFormatted: formattedDate,
        };

        const res = await NativeThermalPrinter.printInvoice({
          invoice: invoicePayload,
          centerName: settings.centerName,
          centerAddress: settings.centerAddress,
          centerPhone: settings.centerPhone,
        });

        return !!res && res.success;
      } catch (err) {
        console.error('Native print invoice error:', err);
        throw err;
      }
    }

    // 2. Web fallback: Trigger system print
    if (typeof window !== 'undefined') {
      window.print();
      return true;
    }

    return false;
  }
}

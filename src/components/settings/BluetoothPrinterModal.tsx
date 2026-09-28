import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  Unplug,
  Settings2,
  Radio,
  Smartphone,
} from 'lucide-react';
import {
  BluetoothThermalPrinter,
  DiscoveredPrinter,
} from '../../services/bluetoothPrinter';
import { Modal } from '../common/Modal';

interface BluetoothPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  centerName?: string;
}

export const BluetoothPrinterModal: React.FC<BluetoothPrinterModalProps> = ({
  isOpen,
  onClose,
  centerName = 'مركز العطايا لتوزيع المواد الغذائية',
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [deviceAddress, setDeviceAddress] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [pairedDevices, setPairedDevices] = useState<DiscoveredPrinter[]>([]);
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(
    BluetoothThermalPrinter.getPaperWidth()
  );
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const isNative = BluetoothThermalPrinter.isNativeAndroid();

  const loadDevices = async () => {
    setIsLoadingDevices(true);
    setStatusMessage(null);
    try {
      const devices = await BluetoothThermalPrinter.getPairedDevices();
      setPairedDevices(devices);
      if (devices.length > 0) {
        const saved = devices.find((d) => d.isSaved);
        if (saved) {
          setSelectedAddress(saved.address || saved.id);
        } else if (!selectedAddress) {
          setSelectedAddress(devices[0].address || devices[0].id);
        }
      }
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'تعذر جلب قائمة الأجهزة المقترنة بالبلوتوث',
        type: 'error',
      });
    } finally {
      setIsLoadingDevices(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      BluetoothThermalPrinter.isConnected().then((conn) => {
        setIsConnected(conn);
        setDeviceName(BluetoothThermalPrinter.getConnectedDeviceName());
        setDeviceAddress(BluetoothThermalPrinter.getConnectedDeviceAddress());
      });
      setPaperWidth(BluetoothThermalPrinter.getPaperWidth());
      loadDevices();
    }
  }, [isOpen]);

  const handleConnect = async (targetAddress?: string) => {
    const addressToUse = targetAddress || selectedAddress;
    setIsConnecting(true);
    setStatusMessage({
      text: 'جاري فتح قناة Bluetooth RFCOMM مع الطابعة...',
      type: 'info',
    });

    try {
      const res = await BluetoothThermalPrinter.connect(addressToUse);
      if (res.success) {
        setIsConnected(true);
        setDeviceName(res.deviceName || 'Xprinter XP-P801A');
        setDeviceAddress(res.address || addressToUse);
        setStatusMessage({
          text: `تم الاتصال بنجاح بالطابعة: ${res.deviceName || 'Xprinter XP-P801A'} ✓`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: res.error || 'فشل الاتصال بالطابعة',
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'حدث خطأ أثناء الاتصال',
        type: 'error',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await BluetoothThermalPrinter.disconnect();
    setIsConnected(false);
    setDeviceName(null);
    setDeviceAddress(null);
    setStatusMessage({ text: 'تم فصل الاتصال بالطابعة', type: 'info' });
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    setStatusMessage({
      text: 'جاري إرسال تذكرة فحص الاتصال والخط العربي إلى الطابعة...',
      type: 'info',
    });

    try {
      const ok = await BluetoothThermalPrinter.printTestReceipt(centerName);
      if (ok) {
        setStatusMessage({
          text: 'تمت طباعة فحص الاتصال بنجاح ✓ (تم إرسال تذكرة الفحص والأرقام)',
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: 'تعذر إرسال أمر الطباعة. تأكد من تشغيل الطابعة وتوصيل الورق.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'خطأ أثناء إرسال تذكرة الاختبار للطابعة',
        type: 'error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePaperWidthChange = (width: '58mm' | '80mm') => {
    setPaperWidth(width);
    BluetoothThermalPrinter.setPaperWidth(width);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إعدادات طابعة الفواتير الحرارية (Xprinter XP-P801A)"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-slate-800 dark:text-slate-200 font-display text-right">
        {/* Connection Status Card */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            isConnected
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  isConnected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                <Bluetooth className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold">
                  {isConnected ? deviceName || 'Xprinter XP-P801A' : 'غير متصل بطابعة'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isConnected
                    ? `متصل وجاهز للطباعة (${deviceAddress || 'Bluetooth Classic'})`
                    : 'اختر طابعتك المقترنة من القائمة أدناه واضغط اتصال'}
                </p>
              </div>
            </div>

            {isConnected && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                متصل
              </span>
            )}
          </div>
        </div>

        {/* Paired Bluetooth Devices Section */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>الأجهزة المقترنة بالبلوتوث (Paired Devices):</span>
            </label>
            <button
              type="button"
              onClick={loadDevices}
              disabled={isLoadingDevices}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDevices ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>
          </div>

          {pairedDevices.length === 0 ? (
            <div className="p-3 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500">
              لم يتم العثور على أجهزة بلوتوث مقترنة. يرجى إقران طابعة Xprinter من إعدادات البلوتوث في الهاتف أولاً.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {pairedDevices.map((dev) => {
                const devAddr = dev.address || dev.id;
                const isSelected = selectedAddress === devAddr;
                const isCurrentConnected = isConnected && deviceAddress === devAddr;

                return (
                  <div
                    key={devAddr}
                    onClick={() => setSelectedAddress(devAddr)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-blue-600' : 'border-slate-400'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{dev.name}</span>
                          {dev.isSaved && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-sm">
                              محفوظة
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                          {devAddr}
                        </div>
                      </div>
                    </div>

                    {isCurrentConnected ? (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        متصل الآن
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAddress(devAddr);
                          handleConnect(devAddr);
                        }}
                        disabled={isConnecting}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                      >
                        اتصال
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Paper Width Selection */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Settings2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>عرض ورق الطابعة الحرارية:</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handlePaperWidthChange('80mm')}
              className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${
                paperWidth === '80mm'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              طابعة 80 ملم (XP-P801A الافتراضية)
            </button>
            <button
              type="button"
              onClick={() => handlePaperWidthChange('58mm')}
              className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${
                paperWidth === '58mm'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              طابعة 58 ملم (المصغرة)
            </button>
          </div>
        </div>

        {/* Status Alert Message */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800'
                : 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Actions Buttons */}
        <div className="space-y-2 pt-2">
          {!isConnected ? (
            <button
              type="button"
              onClick={() => handleConnect()}
              disabled={isConnecting || !selectedAddress}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50 text-sm cursor-pointer"
            >
              {isConnecting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Bluetooth className="w-4 h-4" />
              )}
              <span>{isConnecting ? 'جاري الاتصال بالطابعة...' : 'اتصال بالطابعة المحددة'}</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleTestPrint}
                disabled={isTesting}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isTesting ? 'جاري الطباعة...' : 'اختبار الطباعة'}</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/50 dark:hover:text-red-300 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition active:scale-95 text-xs sm:text-sm cursor-pointer"
              >
                <Unplug className="w-4 h-4" />
                <span>فصل الاتصال</span>
              </button>
            </div>
          )}

          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>طريقة عمل الطباعة:</span>
            </div>
            <p className="leading-relaxed">
              يتم تحويل الفاتورة الحرارية داخل تطبيق الأندرويد مباشرة إلى صورة نقطية عالية الدقة (ESC/POS Raster) بدقة 576 نقطة لتطابق مواصفات Xprinter XP-P801A، مما يضمن ظهور الكلمات العربية والأرقام مشبكة وواضحة تماماً.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};

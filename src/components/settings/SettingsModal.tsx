import React, { useState, useRef } from 'react';
import {
  Settings,
  Save,
  Download,
  Upload,
  Bluetooth,
  Store,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { AppSettings } from '../../types';
import { NumberInput } from '../common/NumberInput';
import { LocalDatabase } from '../../services/db';
import { Modal } from '../common/Modal';
import { BluetoothPrinterModal } from './BluetoothPrinterModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onDataReload: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onDataReload,
}) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [isBtModalOpen, setIsBtModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  const handleExportBackup = async () => {
    try {
      const jsonStr = LocalDatabase.exportBackup();
      const fileName = `AlAtaya_Backup_${new Date().toISOString().slice(0, 10)}.json`;

      if (Capacitor.isNativePlatform()) {
        try {
          const writeRes = await Filesystem.writeFile({
            path: fileName,
            data: jsonStr,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
          });
          await Share.share({
            title: 'نسخة احتياطية - مركز العطايا',
            text: `نسخة احتياطية لقاعدة بيانات مركز العطايا لتوزيع المواد الغذائية (${new Date().toLocaleDateString('ar-SY')})`,
            url: writeRes.uri,
            dialogTitle: 'مشاركة أو حفظ النسخة الاحتياطية',
          });
          setBackupMsg('تم تصدير ومشاركة النسخة الاحتياطية بنجاح!');
          setTimeout(() => setBackupMsg(null), 3000);
          return;
        } catch (nativeErr) {
          console.warn('Native share backup error, falling back to web download', nativeErr);
        }
      }

      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg('تم تنزيل النسخة الاحتياطية بنجاح!');
      setTimeout(() => setBackupMsg(null), 3000);
    } catch {
      setBackupMsg('فشل تصدير النسخة الاحتياطية');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so user can pick the same file again if desired
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = LocalDatabase.importBackup(content);
      if (res.success) {
        setBackupMsg(res.message);
        onDataReload();
      } else {
        setBackupMsg(res.message);
      }
      setTimeout(() => setBackupMsg(null), 4000);
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="إعدادات المركز وقاعدة البيانات"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4 text-slate-800 dark:text-slate-200 font-display text-right">
          {/* Center Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              اسم المركز التجاري / الشركة
            </label>
            <input
              type="text"
              required
              value={formData.centerName}
              onChange={(e) => setFormData({ ...formData, centerName: e.target.value })}
              className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                رقم الهاتف / واتساب
              </label>
              <input
                type="text"
                value={formData.centerPhone || ''}
                onChange={(e) => setFormData({ ...formData, centerPhone: e.target.value })}
                className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-hidden"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                العنوان والمنطقة
              </label>
              <input
                type="text"
                value={formData.centerAddress || ''}
                onChange={(e) => setFormData({ ...formData, centerAddress: e.target.value })}
                className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-hidden"
              />
            </div>
          </div>

          {/* Exchange rate and currencies */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                سعر صرف الدولار المعتمد (ل.س):
              </span>
              <div className="w-36">
                <NumberInput
                  value={formData.exchangeRate}
                  onChange={(val) => setFormData({ ...formData, exchangeRate: Math.max(1, val) })}
                  min={1}
                  step={100}
                />
              </div>
            </div>

            {/* Partner & Capital Settings */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    الشريك وحساب رأس المال:
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    تفعيل حساب الشريك وحركات رأس المال (يبدأ من 0 $ ويُحدد بالحركات الموثقة)
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.hasPartner ?? true}
                  onChange={(e) => setFormData({ ...formData, hasPartner: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </div>

              {(formData.hasPartner ?? true) && (
                <div className="pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                      اسم الشريك
                    </label>
                    <input
                      type="text"
                      value={formData.partnerName || 'أبو عمر'}
                      onChange={(e) => setFormData({ ...formData, partnerName: e.target.value })}
                      className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      placeholder="اسم الشريك..."
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      يتم تسجيل حركات رأس المال (إيداع أو استرداد) من صفحة الشركاء وتُحسب بدقة بدون قيم ثابتة.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Thermal Printer Settings Card */}
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <Bluetooth className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                  طابعة الفواتير الحرارية (Xprinter XP-P801A)
                </h4>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-400">
                  إعدادات البلوتوث الكلاسيكي، الأجهزة المقترنة، واختبار الطباعة
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsBtModalOpen(true)}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>إدارة الطابعة</span>
            </button>
          </div>

          {/* Backup & Restore Local DB */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                النسخ الاحتياطي لقاعدة البيانات المحلية (Offline):
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              احفظ نسخة كاملة من بياناتك (المنتجات، الفواتير، الأرباح، ديون العملاء والموردين) على هاتفك أو شاركها.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex-1 py-2.5 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير نسخة احتياطية</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2.5 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>استرجاع نسخة</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </div>
            {backupMsg && (
              <p className="text-xs text-emerald-600 font-bold text-center mt-1 animate-pulse">
                {backupMsg}
              </p>
            )}
          </div>

          {/* Submit button */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer font-display"
            >
              <Save className="w-4 h-4" />
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Dedicated Bluetooth Printer Modal */}
      <BluetoothPrinterModal
        isOpen={isBtModalOpen}
        onClose={() => setIsBtModalOpen(false)}
        centerName={formData.centerName}
      />
    </>
  );
};

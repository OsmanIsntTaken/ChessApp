import React from 'react';
import { CheckCircle2, Download, Smartphone, Terminal, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface MobileApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileApkModal: React.FC<MobileApkModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Android ve Çevrimdışı Kurulum"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#262421]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <Smartphone className="h-5 w-5 text-[#81B64C]" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Android, APK & Çevrimdışı Kullanım
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5 dark:text-stone-400 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5 text-xs text-slate-600 dark:text-stone-300">
          {/* Offline / PWA status */}
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-[#1D1B19]">
            {isOnline ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#81B64C]" />
            ) : (
              <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            )}
            <div className="space-y-1">
              <div className="font-semibold text-slate-900 dark:text-white">
                Çevrimdışı PWA & Yerel Motor Hazır
              </div>
              <p>
                Tüm hamle kuralları ve yerel yapay zeka motoru (1.8 MB WASM) tarayıcı önbelleğine
                kaydedilir. İnternet olmadan da botlara karşı ve 2 kişilik oynayabilirsin.
              </p>
            </div>
          </div>

          {/* Direct PWA Install */}
          <div className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              1. Android / Masaüstü Uygulama Kurulumu (Anında)
            </h3>
            {isInstalled ? (
              <p className="font-medium text-[#6F9F3D] dark:text-[#95C95D]">
                Uygulama zaten cihazına tam ekran uygulama olarak kurulu.
              </p>
            ) : isInstallable ? (
              <button
                type="button"
                onClick={install}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#81B64C] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#73A541]"
              >
                <Download className="h-4 w-4" />
                Uygulama Olarak Yükle (PWA)
              </button>
            ) : isIOS ? (
              <p>
                Safari menüsünden <strong>Paylaş</strong> simgesine dokun ve{' '}
                <strong>Ana Ekrana Ekle</strong> seçeneğini seç.
              </p>
            ) : (
              <p>
                Android Chrome menüsünden (⋮) <strong>Uygulamayı Yükle / Ana Ekrana Ekle</strong>{' '}
                seçeneğiyle yerel Android uygulaması gibi tam ekran kurabilirsin.
              </p>
            )}
          </div>

          {/* Capacitor APK Build Guide */}
          <div className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[#81B64C]" />
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                2. İmzalı / Debug APK Derleme (Capacitor + Gradle)
              </h3>
            </div>
            <p>
              Proje kökünde Android paketleme için{' '}
              <code className="font-mono-num rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">
                capacitor.config.ts
              </code>{' '}
              ve otomatik APK derleyen{' '}
              <code className="font-mono-num rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">
                .github/workflows/android-apk.yml
              </code>{' '}
              dosyaları hazırdır. Kendi bilgisayarında APK üretmek için:
            </p>
            <pre className="font-mono-num overflow-x-auto rounded-lg bg-[#1A1917] p-3 text-[11px] text-stone-200">
{`npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug`}
            </pre>
            <p className="text-[11px] text-slate-500 dark:text-stone-400">
              Çıktı dosyası: <code className="font-mono-num">android/app/build/outputs/apk/debug/app-debug.apk</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

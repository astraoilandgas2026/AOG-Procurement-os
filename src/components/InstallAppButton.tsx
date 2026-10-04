import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function getInstallHelp() {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);

  if (isIOS) {
    return 'En iPhone/iPad: abre esta página en Safari, toca Compartir y luego “Añadir a pantalla de inicio”.';
  }

  if (isAndroid) {
    return 'En Android: abre esta página en Chrome y usa “Instalar app” o “Añadir a pantalla de inicio” desde el menú del navegador.';
  }

  return 'En Chrome o Edge: usa el menú del navegador y selecciona “Instalar Astra Procurement” o “Instalar app”.';
}

export function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const install = async () => {
    if (!installEvent) {
      window.alert(getInstallHelp());
      return;
    }

    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <button
      type="button"
      onClick={install}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[var(--astra-dark)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      title="Instalar Astra Procurement como aplicación"
      aria-label="Instalar Astra Procurement como aplicación"
    >
      <Download size={14} />
      Instalar app
    </button>
  );
}

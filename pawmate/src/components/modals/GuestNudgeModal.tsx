import { useUIStore } from '@/store/uiStore.ts';
import { useUserStore } from '@/store/userStore.ts';
import { analytics } from '@/lib/analytics.ts';
import { t } from '@/lib/i18n.ts';

interface Props {
  onUpgrade: () => void;
}

export function GuestNudgeModal({ onUpgrade }: Props) {
  const showGuestNudge = useUIStore(s => s.showGuestNudge);
  const setShowGuestNudge = useUIStore(s => s.setShowGuestNudge);
  const { user } = useUserStore();

  if (!showGuestNudge) return null;

  const handleUpgrade = () => {
    analytics.guestConverted(user?.id);
    setShowGuestNudge(false);
    onUpgrade();
  };

  return (
    <div className="modal-backdrop" onClick={() => setShowGuestNudge(false)}>
      <div className="modal-sheet text-center" onClick={e => e.stopPropagation()}>
        <div className="text-5xl mb-3">🐾</div>
        <h2 className="text-xl font-bold mb-2">{t.auth.guestNudge}</h2>
        <p className="text-gray-400 text-sm mb-6">{t.auth.guestNudgeDesc}</p>

        <button
          onClick={handleUpgrade}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl font-bold text-white mb-3 active:scale-95 transition-transform"
        >
          {t.auth.upgradeAccount}
        </button>
        <button
          onClick={() => setShowGuestNudge(false)}
          className="w-full py-2 text-gray-400 text-sm"
        >
          {t.app.cancel}
        </button>
      </div>
    </div>
  );
}

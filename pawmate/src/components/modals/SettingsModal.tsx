import { useState } from 'react';
import { useUIStore } from '@/store/uiStore.ts';
import { useUserStore } from '@/store/userStore.ts';
import { useAuth } from '@/hooks/useAuth.ts';
import { t } from '@/lib/i18n.ts';

export function SettingsModal() {
  const { settingsOpen, closeSettings, addToast } = useUIStore();
  const { user, isGuest, isPremium, displayName } = useUserStore();
  const { signOut } = useAuth();
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (!settingsOpen) return null;

  const handleLogout = async () => {
    if (!confirmLogout) {
      setConfirmLogout(true);
      return;
    }
    await signOut();
    closeSettings();
  };

  return (
    <div className="modal-backdrop" onClick={closeSettings}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{t.settings.title}</h2>
          <button onClick={closeSettings} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        {/* Account info */}
        <div className="bg-gray-700/40 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-2xl">
              {isGuest ? '👤' : '🐾'}
            </div>
            <div>
              <div className="font-semibold">{displayName ?? (isGuest ? 'אורח' : user?.email ?? 'שחקן')}</div>
              <div className="text-xs text-gray-400">
                {isGuest ? t.auth.guestWarning : user?.email}
              </div>
              {isPremium && (
                <span className="text-xs text-yellow-400 font-bold">{t.economy.premiumBadge}</span>
              )}
            </div>
          </div>
          {isGuest && (
            <button
              onClick={() => { closeSettings(); }}
              className="mt-3 w-full bg-purple-600 hover:bg-purple-500 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              {t.auth.upgradeAccount}
            </button>
          )}
        </div>

        {/* Toggle settings */}
        <div className="space-y-1 mb-4">
          {[
            { label: t.settings.sound, emoji: '🔊', value: soundOn, set: setSoundOn },
            { label: t.settings.music, emoji: '🎵', value: musicOn, set: setMusicOn },
            { label: t.settings.notifications, emoji: '🔔', value: notificationsOn, set: setNotificationsOn },
          ].map(({ label, emoji, value, set }) => (
            <div key={label} className="flex items-center justify-between py-3 border-b border-gray-700/50">
              <div className="flex items-center gap-2">
                <span>{emoji}</span>
                <span className="text-sm font-medium">{label}</span>
              </div>
              <button
                onClick={() => set(!value)}
                className={`w-12 h-6 rounded-full transition-colors ${value ? 'bg-green-500' : 'bg-gray-600'} relative`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${value ? 'right-0.5' : 'left-0.5'}`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Version */}
        <div className="text-center text-xs text-gray-600 mb-4">
          Pawmate v0.1.0 — Phase 1 MVP
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`w-full py-3 rounded-2xl font-bold transition-colors ${confirmLogout ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {confirmLogout ? t.settings.logoutConfirm : t.auth.logout}
        </button>
      </div>
    </div>
  );
}

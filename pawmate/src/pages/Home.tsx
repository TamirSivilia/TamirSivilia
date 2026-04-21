import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Phaser from 'phaser';
import { createPhaserConfig } from '@/game/config.ts';
import { HUD } from '@/components/hud/HUD.tsx';
import { ActionBar } from '@/components/hud/ActionBar.tsx';
import { ShopModal } from '@/components/modals/ShopModal.tsx';
import { SettingsModal } from '@/components/modals/SettingsModal.tsx';
import { GuestNudgeModal } from '@/components/modals/GuestNudgeModal.tsx';
import { useUIStore } from '@/store/uiStore.ts';
import { useUserStore } from '@/store/userStore.ts';
import { usePet } from '@/hooks/usePet.ts';
import { useDecay } from '@/hooks/useDecay.ts';
import { analytics } from '@/lib/analytics.ts';
import { GUEST_NUDGE_DELAY_MS } from '@/data/constants.ts';

export function Home() {
  const { t } = useTranslation();
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentScene, setScene, openSettings, setShowGuestNudge } = useUIStore();
  const { isGuest, guestNudgeShown, setGuestNudgeShown, user } = useUserStore();
  const { completedWalk } = usePet();

  useDecay();

  // Initialize Phaser once
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const el = containerRef.current;
    const width = el.clientWidth || 375;
    const height = el.clientHeight || 400;

    gameRef.current = new Phaser.Game(createPhaserConfig(width, height));

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // Walk completed — apply stat effects
  useEffect(() => {
    if (currentScene === 'home') {
      completedWalk();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScene]);

  // Guest nudge after 10 minutes
  useEffect(() => {
    if (!isGuest || guestNudgeShown) return;
    const timer = setTimeout(() => {
      setShowGuestNudge(true);
      setGuestNudgeShown(true);
      analytics.guestNudgeShown(user?.id);
    }, GUEST_NUDGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isGuest, guestNudgeShown]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <HUD />

      {/* Settings button */}
      <div className="absolute top-2 left-2 z-10">
        <button
          onClick={openSettings}
          className="w-9 h-9 bg-gray-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center text-lg border border-gray-700/50"
        >
          ⚙️
        </button>
      </div>

      {/* Phaser Game Canvas */}
      <div ref={containerRef} id="game-canvas" className="flex-1 w-full" />

      {/* Bottom hint */}
      {currentScene === 'home' && (
        <div className="text-center text-xs text-gray-600 py-1">
          {t('misc.tapForLove')}
        </div>
      )}

      <ActionBar />

      <ShopModal />
      <SettingsModal />
      <GuestNudgeModal onUpgrade={() => { /* navigate to login upgrade */ }} />
    </div>
  );
}

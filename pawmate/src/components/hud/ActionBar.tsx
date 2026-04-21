import { useState, useEffect } from 'react';
import { usePet } from '@/hooks/usePet.ts';
import { useUIStore } from '@/store/uiStore.ts';
import { t } from '@/lib/i18n.ts';

interface ActionButtonProps {
  label: string;
  emoji: string;
  onPress: () => void;
  cooldownMs?: number;
  disabled?: boolean;
}

function ActionButton({ label, emoji, onPress, cooldownMs = 0, disabled }: ActionButtonProps) {
  const [remaining, setRemaining] = useState(cooldownMs);

  useEffect(() => {
    setRemaining(cooldownMs);
    if (cooldownMs <= 0) return;
    const interval = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1000;
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownMs]);

  const isOnCooldown = remaining > 0;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const cooldownLabel = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;

  return (
    <button
      onClick={!isOnCooldown && !disabled ? onPress : undefined}
      disabled={isOnCooldown || disabled}
      className={`
        flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl transition-all duration-150
        ${isOnCooldown || disabled
          ? 'bg-gray-700/50 opacity-60 cursor-not-allowed'
          : 'bg-gray-700 active:scale-90 active:bg-gray-600'
        }
      `}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs font-semibold text-white leading-none">{label}</span>
      {isOnCooldown && (
        <span className="text-xs text-gray-400 ltr-num">{cooldownLabel}</span>
      )}
    </button>
  );
}

export function ActionBar() {
  const { pet, cooldowns, isSleeping, isOnCooldown, getCooldownRemaining, feed, play, sleep } = usePet();
  const { setScene, openShop } = useUIStore();

  if (!pet) return null;

  const handleWalk = () => {
    if (isOnCooldown('walk')) return;
    if (pet.energy < 15) {
      useUIStore.getState().addToast(t.actions.noEnergy, 'error', '😴');
      return;
    }
    setScene('walk');
  };

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50 px-4 py-3">
      {isSleeping ? (
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="text-2xl">😴</span>
          <span className="text-gray-300 font-medium">{t.actions.sleeping}</span>
        </div>
      ) : (
        <div className="flex justify-around gap-2">
          <ActionButton
            label={t.actions.feed}
            emoji="🍖"
            onPress={() => feed()}
            cooldownMs={isOnCooldown('feed') ? getCooldownRemaining('feed') : 0}
          />
          <ActionButton
            label={t.actions.play}
            emoji="🎾"
            onPress={play}
            cooldownMs={isOnCooldown('play') ? getCooldownRemaining('play') : 0}
            disabled={pet.energy < 10}
          />
          <ActionButton
            label={t.actions.walk}
            emoji="🐾"
            onPress={handleWalk}
            cooldownMs={isOnCooldown('walk') ? getCooldownRemaining('walk') : 0}
            disabled={pet.energy < 15}
          />
          <ActionButton
            label={t.actions.sleep}
            emoji="💤"
            onPress={sleep}
          />
          <ActionButton
            label={t.economy.shop}
            emoji="🛍️"
            onPress={openShop}
          />
        </div>
      )}
    </div>
  );
}

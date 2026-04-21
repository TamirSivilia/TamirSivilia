import { usePetStore } from '@/store/petStore.ts';
import { useEconomyStore } from '@/store/economyStore.ts';
import { useUIStore } from '@/store/uiStore.ts';
import { PremiumBadge } from '@/components/common/PremiumBadge.tsx';
import { StatBar } from './StatBar.tsx';
import { getXpForNextLevel } from '@/lib/decay.ts';
import { t } from '@/lib/i18n.ts';

export function HUD() {
  const pet = usePetStore(s => s.pet);
  const coins = useEconomyStore(s => s.coins);
  const gems = useEconomyStore(s => s.gems);
  const openShop = useUIStore(s => s.openShop);

  if (!pet) return null;

  const xpForNext = getXpForNextLevel(pet.level);
  const xpPct = ((pet.xp - (xpForNext / 2)) / (xpForNext - xpForNext / 2)) * 100;

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm px-4 pt-3 pb-2 border-b border-gray-700/50">
      {/* Top row: pet info + currency */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold text-white">{pet.name}</div>
          <div className="text-xs bg-purple-600/50 text-purple-200 px-2 py-0.5 rounded-full">
            {t.stats.level} <span className="ltr-num">{pet.level}</span>
          </div>
          <PremiumBadge />
        </div>

        {/* Currency */}
        <div className="flex items-center gap-3">
          <button
            onClick={openShop}
            className="flex items-center gap-1 bg-yellow-500/20 hover:bg-yellow-500/30 px-2.5 py-1 rounded-xl transition-colors"
          >
            <span className="text-sm">🪙</span>
            <span className="text-yellow-400 text-sm font-bold ltr-num">{coins}</span>
          </button>
          <button
            onClick={openShop}
            className="flex items-center gap-1 bg-blue-500/20 hover:bg-blue-500/30 px-2.5 py-1 rounded-xl transition-colors"
          >
            <span className="text-sm">💎</span>
            <span className="text-blue-400 text-sm font-bold ltr-num">{gems}</span>
          </button>
        </div>
      </div>

      {/* XP bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{t.stats.xp}</span>
          <span className="ltr-num">{pet.xp} / {xpForNext}</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.max(0, Math.min(100, xpPct))}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <StatBar label={t.stats.hunger} value={pet.hunger} color="#f97316" emoji="🍖" />
        <StatBar label={t.stats.happiness} value={pet.happiness} color="#eab308" emoji="😊" />
        <StatBar label={t.stats.energy} value={pet.energy} color="#3b82f6" emoji="⚡" />
        <StatBar label={t.stats.hygiene} value={pet.hygiene} color="#22c55e" emoji="🛁" />
        <StatBar label={t.stats.health} value={pet.health} color="#ec4899" emoji="❤️" />
        <StatBar label={t.stats.bond} value={pet.bond} color="#a855f7" emoji="🔗" />
      </div>
    </div>
  );
}

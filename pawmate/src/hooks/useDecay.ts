import { useEffect, useRef } from 'react';
import { usePetStore } from '@/store/petStore.ts';
import { useUIStore } from '@/store/uiStore.ts';
import { tickDecay } from '@/lib/decay.ts';
import { STAT_DANGER_THRESHOLD } from '@/data/constants.ts';
import { t } from '@/lib/i18n.ts';

const TICK_INTERVAL_MS = 60 * 1000; // 1 minute

export function useDecay() {
  const { pet, isSleeping, updateStats } = usePetStore();
  const { addToast } = useUIStore();
  const lastNudgeRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!pet || isSleeping) return;

    const interval = setInterval(() => {
      const current = usePetStore.getState().pet;
      if (!current || usePetStore.getState().isSleeping) return;

      const newStats = tickDecay(
        {
          hunger: current.hunger,
          happiness: current.happiness,
          energy: current.energy,
          hygiene: current.hygiene,
          health: current.health,
          bond: current.bond,
        },
        60
      );

      updateStats(newStats);

      // Show speech bubbles / toasts for low stats
      const now = Date.now();
      const nudgeCooldown = 5 * 60 * 1000; // 5 minutes between nudges for same stat

      if (newStats.hunger < STAT_DANGER_THRESHOLD && (!lastNudgeRef.current.hunger || now - lastNudgeRef.current.hunger > nudgeCooldown)) {
        addToast(t.pet.speechHungry, 'info');
        lastNudgeRef.current.hunger = now;
      }
      if (newStats.happiness < STAT_DANGER_THRESHOLD && (!lastNudgeRef.current.happiness || now - lastNudgeRef.current.happiness > nudgeCooldown)) {
        addToast(t.pet.speechBored, 'info');
        lastNudgeRef.current.happiness = now;
      }
      if (newStats.energy < STAT_DANGER_THRESHOLD && (!lastNudgeRef.current.energy || now - lastNudgeRef.current.energy > nudgeCooldown)) {
        addToast(t.pet.speechTired, 'info');
        lastNudgeRef.current.energy = now;
      }
      if (newStats.hygiene < STAT_DANGER_THRESHOLD && (!lastNudgeRef.current.hygiene || now - lastNudgeRef.current.hygiene > nudgeCooldown)) {
        addToast(t.pet.speechDirty, 'info');
        lastNudgeRef.current.hygiene = now;
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [pet?.id, isSleeping]);
}

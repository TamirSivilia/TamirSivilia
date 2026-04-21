import { create } from 'zustand';
import { supabase } from '@/lib/supabase.ts';
import { DB_SYNC_DEBOUNCE_MS, LEVEL_XP_THRESHOLDS, LEVEL_UP_REWARDS } from '@/data/constants.ts';
import type { Species, Rarity } from '@/data/animals.ts';

export interface Pet {
  id: string;
  userId: string;
  name: string;
  species: Species;
  rarity: Rarity;
  level: number;
  xp: number;
  hunger: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
  bond: number;
  lastActionAt: string;
  lastSyncedAt: string;
  isActive: boolean;
  createdAt: string;
}

interface ActionCooldowns {
  feed?: number;
  play?: number;
  walk?: number;
  sleepUntil?: number;
}

interface PetStore {
  pet: Pet | null;
  cooldowns: ActionCooldowns;
  isSleeping: boolean;
  sleepEndsAt: number | null;

  setPet: (pet: Pet | null) => void;
  updateStats: (updates: Partial<Pick<Pet, 'hunger' | 'happiness' | 'energy' | 'hygiene' | 'health' | 'bond' | 'xp' | 'level'>>) => void;
  addXp: (amount: number) => { leveledUp: boolean; newLevel: number };
  setCooldown: (action: keyof ActionCooldowns, untilMs: number) => void;
  clearCooldown: (action: keyof ActionCooldowns) => void;
  setCooldownAll: (cooldowns: ActionCooldowns) => void;
  startSleep: (durationMs: number) => void;
  endSleep: () => void;
  syncToDb: () => Promise<void>;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export const usePetStore = create<PetStore>((set, get) => ({
  pet: null,
  cooldowns: {},
  isSleeping: false,
  sleepEndsAt: null,

  setPet: (pet) => set({ pet }),

  updateStats: (updates) => {
    set(state => {
      if (!state.pet) return state;
      const newPet = { ...state.pet, ...updates };
      // Clamp all stats to 0-100
      const statKeys = ['hunger', 'happiness', 'energy', 'hygiene', 'health'] as const;
      for (const key of statKeys) {
        newPet[key] = Math.max(0, Math.min(100, newPet[key]));
      }
      if ('bond' in newPet) newPet.bond = Math.max(0, Math.min(100, newPet.bond));
      return { pet: newPet };
    });

    // Debounced DB sync
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => get().syncToDb(), DB_SYNC_DEBOUNCE_MS);
  },

  addXp: (amount) => {
    const state = get();
    if (!state.pet) return { leveledUp: false, newLevel: 1 };

    const newXp = state.pet.xp + amount;
    let newLevel = state.pet.level;
    let leveledUp = false;

    for (let i = LEVEL_XP_THRESHOLDS.length - 1; i >= 0; i--) {
      if (newXp >= LEVEL_XP_THRESHOLDS[i]) {
        const calculatedLevel = i + 1;
        if (calculatedLevel > newLevel) {
          newLevel = calculatedLevel;
          leveledUp = true;
        }
        break;
      }
    }

    state.updateStats({ xp: newXp, level: newLevel });
    return { leveledUp, newLevel };
  },

  setCooldown: (action, untilMs) =>
    set(state => ({ cooldowns: { ...state.cooldowns, [action]: untilMs } })),

  clearCooldown: (action) =>
    set(state => {
      const next = { ...state.cooldowns };
      delete next[action];
      return { cooldowns: next };
    }),

  setCooldownAll: (cooldowns) => set({ cooldowns }),

  startSleep: (durationMs) => {
    const endsAt = Date.now() + durationMs;
    set({ isSleeping: true, sleepEndsAt: endsAt });
  },

  endSleep: () => {
    set({ isSleeping: false, sleepEndsAt: null });
    get().updateStats({ energy: Math.min(100, (get().pet?.energy ?? 0) + 40) });
  },

  syncToDb: async () => {
    const { pet } = get();
    if (!pet) return;
    const now = new Date().toISOString();
    await supabase.from('pets').update({
      name: pet.name,
      hunger: pet.hunger,
      happiness: pet.happiness,
      energy: pet.energy,
      hygiene: pet.hygiene,
      health: pet.health,
      bond: pet.bond,
      xp: pet.xp,
      level: pet.level,
      last_synced_at: now,
      last_action_at: now,
    }).eq('id', pet.id);
  },
}));

export function getLevelUpCoins(newLevel: number): number {
  return LEVEL_UP_REWARDS.coins + (newLevel % 5 === 0 ? 0 : 0);
}

export function getLevelUpGems(newLevel: number): number {
  return newLevel % 5 === 0 ? LEVEL_UP_REWARDS.gemsEvery5Levels : 0;
}

import { DECAY_RATES, STAT_CRITICAL_THRESHOLD } from '@/data/constants.ts';

export interface PetStats {
  hunger: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
  bond: number;
}

export interface DecayResult {
  stats: PetStats;
  secondsElapsed: number;
  healthPenalty: number;
  bondPenalty: number;
}

/**
 * Calculates stat decay based on real-world elapsed time since last sync.
 * Called on app load to apply offline time penalties.
 */
export function calculateOfflineDecay(
  stats: PetStats,
  lastSyncedAt: string
): DecayResult {
  const now = Date.now();
  const lastSync = new Date(lastSyncedAt).getTime();
  const secondsElapsed = Math.max(0, (now - lastSync) / 1000);

  // Cap offline time at 24 hours to avoid extreme penalties
  const cappedSeconds = Math.min(secondsElapsed, 24 * 60 * 60);

  const newHunger = Math.max(0, stats.hunger - DECAY_RATES.hunger * cappedSeconds);
  const newHappiness = Math.max(0, stats.happiness - DECAY_RATES.happiness * cappedSeconds);
  const newEnergy = Math.max(0, stats.energy - DECAY_RATES.energy * cappedSeconds);
  const newHygiene = Math.max(0, stats.hygiene - DECAY_RATES.hygiene * cappedSeconds);

  // Health drops when hunger or hygiene hit zero
  let healthPenalty = 0;
  if (newHunger <= 0) {
    healthPenalty += cappedSeconds * 0.005; // lose health slowly from starvation
  }
  if (newHygiene <= 0) {
    healthPenalty += cappedSeconds * 0.003;
  }

  // Bond drops when happiness is very low
  let bondPenalty = 0;
  if (newHappiness < STAT_CRITICAL_THRESHOLD) {
    bondPenalty = 1;
  }

  const newHealth = Math.max(1, stats.health - healthPenalty);
  const newBond = Math.max(0, stats.bond - bondPenalty);

  return {
    stats: {
      hunger: Math.round(newHunger),
      happiness: Math.round(newHappiness),
      energy: Math.round(newEnergy),
      hygiene: Math.round(newHygiene),
      health: Math.round(newHealth),
      bond: newBond,
    },
    secondsElapsed,
    healthPenalty,
    bondPenalty,
  };
}

/**
 * Applies a single tick of decay (called every minute while app is open).
 */
export function tickDecay(stats: PetStats, tickSeconds = 60): PetStats {
  const newHunger = Math.max(0, stats.hunger - DECAY_RATES.hunger * tickSeconds);
  const newHappiness = Math.max(0, stats.happiness - DECAY_RATES.happiness * tickSeconds);
  const newEnergy = Math.max(0, stats.energy - DECAY_RATES.energy * tickSeconds);
  const newHygiene = Math.max(0, stats.hygiene - DECAY_RATES.hygiene * tickSeconds);

  let newHealth = stats.health;
  if (newHunger <= 0) newHealth = Math.max(1, newHealth - 0.3);
  if (newHygiene <= 0) newHealth = Math.max(1, newHealth - 0.2);

  return {
    hunger: Math.round(newHunger),
    happiness: Math.round(newHappiness),
    energy: Math.round(newEnergy),
    hygiene: Math.round(newHygiene),
    health: Math.round(newHealth),
    bond: stats.bond,
  };
}

export function getLevelFromXp(xp: number): number {
  const thresholds = [0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250];
  let level = 1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (xp >= thresholds[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

export function getXpForNextLevel(currentLevel: number): number {
  const thresholds = [0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250];
  return thresholds[currentLevel] ?? thresholds[thresholds.length - 1] * 2;
}

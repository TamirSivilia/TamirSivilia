export const DECAY_RATES = {
  hunger: 1 / (10 * 60),      // -1 per 10 minutes (per second)
  happiness: 1 / (15 * 60),   // -1 per 15 minutes
  energy: 1 / (20 * 60),      // -1 per 20 minutes
  hygiene: 1 / (30 * 60),     // -1 per 30 minutes
} as const;

export const STAT_DANGER_THRESHOLD = 30;
export const STAT_CRITICAL_THRESHOLD = 10;

export const ACTION_COOLDOWNS = {
  feed: 60,       // 1 minute in seconds
  play: 120,      // 2 minutes
  walk: 600,      // 10 minutes
  sleep: 0,       // managed separately
} as const;

export const ACTION_EFFECTS = {
  feed: { hunger: 20, bond: 2 },
  play: { happiness: 15, energy: -10, bond: 1 },
  walk: { happiness: 15, health: 5, energy: -15, hunger: -10, bond: 3 },
  sleep: { energy: 40 },
} as const;

export const ACTION_XP = {
  feed: 5,
  play: 10,
  walk: 25,
  sleep: 15,
} as const;

export const ACTION_COIN_REWARDS = {
  feed: { min: 5, max: 10 },
  play: { min: 5, max: 15 },
  walk: { min: 10, max: 15 },
  sleep: { min: 5, max: 10 },
} as const;

export const FEED_COST_COINS = 10;

export const LEVEL_XP_THRESHOLDS = [
  0,    // lvl 1
  50,   // lvl 2
  150,  // lvl 3
  300,  // lvl 4
  500,  // lvl 5
  750,  // lvl 6
  1050, // lvl 7
  1400, // lvl 8
  1800, // lvl 9
  2250, // lvl 10
];

export const LEVEL_UP_REWARDS = {
  coins: 50,
  gems: 0,
  gemsEvery5Levels: 1,
} as const;

export const SLEEP_DURATION_MS = 5 * 60 * 1000; // 5 real minutes

export const TAP_PET_COOLDOWN_MS = 60 * 1000; // 1 minute

export const GUEST_NUDGE_DELAY_MS = 10 * 60 * 1000; // 10 minutes

export const DB_SYNC_DEBOUNCE_MS = 500;

export const WALK_MINIGAME_DURATION_SEC = 30;

export const AD_REWARD_COINS = 50;

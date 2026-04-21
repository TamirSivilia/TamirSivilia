import { useCallback } from 'react';
import { usePetStore, getLevelUpCoins, getLevelUpGems } from '@/store/petStore.ts';
import { useEconomyStore } from '@/store/economyStore.ts';
import { useUIStore } from '@/store/uiStore.ts';
import { useUserStore } from '@/store/userStore.ts';
import { analytics } from '@/lib/analytics.ts';
import {
  ACTION_COOLDOWNS,
  ACTION_EFFECTS,
  ACTION_XP,
  ACTION_COIN_REWARDS,
  SLEEP_DURATION_MS,
} from '@/data/constants.ts';
import { t } from '@/lib/i18n.ts';

export function usePet() {
  const { pet, cooldowns, isSleeping, updateStats, addXp, setCooldown, startSleep, endSleep } = usePetStore();
  const { addCoins, addGems, spendCoins, removeInventoryItem, getInventoryCount, logTransaction } = useEconomyStore();
  const { addToast } = useUIStore();
  const { user } = useUserStore();

  const isOnCooldown = useCallback((action: 'feed' | 'play' | 'walk') => {
    const cooldownUntil = cooldowns[action];
    return cooldownUntil ? Date.now() < cooldownUntil : false;
  }, [cooldowns]);

  const getCooldownRemaining = useCallback((action: 'feed' | 'play' | 'walk') => {
    const cooldownUntil = cooldowns[action];
    if (!cooldownUntil) return 0;
    return Math.max(0, cooldownUntil - Date.now());
  }, [cooldowns]);

  const rewardAction = useCallback((action: string) => {
    const range = ACTION_COIN_REWARDS[action as keyof typeof ACTION_COIN_REWARDS];
    if (!range) return 0;
    const coins = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    addCoins(coins);
    addToast(`+${coins} ${t.economy.coins}`, 'reward', '🪙');
    if (user?.id) logTransaction('reward', action, 'coins', coins);
    return coins;
  }, [addCoins, addToast, logTransaction, user]);

  const checkAndHandleLevelUp = useCallback((leveledUp: boolean, newLevel: number) => {
    if (!leveledUp) return;
    const coinsReward = getLevelUpCoins(newLevel);
    const gemsReward = getLevelUpGems(newLevel);
    addCoins(50 + coinsReward);
    if (gemsReward > 0) addGems(gemsReward);
    addToast(t.pet.levelUp.replace('{level}', String(newLevel)), 'success', '🎊');
    analytics.levelUp(newLevel, user?.id);
  }, [addCoins, addGems, addToast, user]);

  const feed = useCallback(async (foodItemId?: string) => {
    if (!pet || isSleeping) return;
    if (isOnCooldown('feed')) {
      addToast(t.actions.cooldown, 'info', '⏳');
      return;
    }

    // Use inventory food or spend coins
    if (foodItemId) {
      const hasFood = getInventoryCount(foodItemId) > 0;
      if (!hasFood) {
        addToast(t.actions.noFood, 'error');
        return;
      }
      removeInventoryItem(foodItemId);
    } else {
      const spent = spendCoins(10);
      if (!spent) {
        addToast(t.economy.notEnoughCoins, 'error');
        return;
      }
    }

    updateStats({
      hunger: pet.hunger + ACTION_EFFECTS.feed.hunger,
      bond: pet.bond + ACTION_EFFECTS.feed.bond,
    });

    const { leveledUp, newLevel } = addXp(ACTION_XP.feed);
    setCooldown('feed', Date.now() + ACTION_COOLDOWNS.feed * 1000);
    rewardAction('feed');
    checkAndHandleLevelUp(leveledUp, newLevel);
    addToast(t.actions.feedSuccess, 'success', '🍖');
    analytics.actionCompleted('feed', user?.id);
  }, [pet, isSleeping, isOnCooldown, getInventoryCount, removeInventoryItem, spendCoins, updateStats, addXp, setCooldown, rewardAction, checkAndHandleLevelUp, addToast, user]);

  const play = useCallback(async () => {
    if (!pet || isSleeping) return;
    if (isOnCooldown('play')) {
      addToast(t.actions.cooldown, 'info', '⏳');
      return;
    }
    if (pet.energy < 10) {
      addToast(t.actions.noEnergy, 'error', '😴');
      return;
    }

    updateStats({
      happiness: pet.happiness + ACTION_EFFECTS.play.happiness,
      energy: pet.energy + ACTION_EFFECTS.play.energy,
      bond: pet.bond + ACTION_EFFECTS.play.bond,
    });

    const { leveledUp, newLevel } = addXp(ACTION_XP.play);
    setCooldown('play', Date.now() + ACTION_COOLDOWNS.play * 1000);
    rewardAction('play');
    checkAndHandleLevelUp(leveledUp, newLevel);
    addToast(t.actions.playSuccess, 'success', '🎾');
    analytics.actionCompleted('play', user?.id);
  }, [pet, isSleeping, isOnCooldown, updateStats, addXp, setCooldown, rewardAction, checkAndHandleLevelUp, addToast, user]);

  const completedWalk = useCallback(async () => {
    if (!pet) return;

    updateStats({
      happiness: pet.happiness + ACTION_EFFECTS.walk.happiness,
      health: pet.health + ACTION_EFFECTS.walk.health,
      energy: pet.energy + ACTION_EFFECTS.walk.energy,
      hunger: pet.hunger + ACTION_EFFECTS.walk.hunger,
      bond: pet.bond + ACTION_EFFECTS.walk.bond,
    });

    const { leveledUp, newLevel } = addXp(ACTION_XP.walk);
    setCooldown('walk', Date.now() + ACTION_COOLDOWNS.walk * 1000);
    rewardAction('walk');
    checkAndHandleLevelUp(leveledUp, newLevel);
    addToast(t.actions.walkSuccess, 'success', '🐾');
    analytics.actionCompleted('walk', user?.id);
  }, [pet, updateStats, addXp, setCooldown, rewardAction, checkAndHandleLevelUp, addToast, user]);

  const sleep = useCallback(async () => {
    if (!pet || isSleeping) return;
    startSleep(SLEEP_DURATION_MS);
    addToast('חיית המחמד ישנה... zzz', 'info', '😴');
    analytics.actionCompleted('sleep', user?.id);

    // Wake up after duration
    setTimeout(() => {
      endSleep();
      const { leveledUp, newLevel } = addXp(ACTION_XP.sleep);
      setCooldown('sleep' as 'feed', 0); // reset sleep cooldown
      rewardAction('sleep');
      checkAndHandleLevelUp(leveledUp, newLevel);
      addToast(t.actions.sleepSuccess, 'success', '☀️');
    }, SLEEP_DURATION_MS);
  }, [pet, isSleeping, startSleep, endSleep, addXp, setCooldown, rewardAction, checkAndHandleLevelUp, addToast, user]);

  return {
    pet,
    cooldowns,
    isSleeping,
    isOnCooldown,
    getCooldownRemaining,
    feed,
    play,
    completedWalk,
    sleep,
  };
}

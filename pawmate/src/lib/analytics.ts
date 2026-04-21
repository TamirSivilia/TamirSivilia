import posthog from 'posthog-js';
import { supabase } from './supabase.ts';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string;

export function initAnalytics() {
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST || 'https://app.posthog.com',
      capture_pageview: false,
      persistence: 'localStorage',
    });
  }
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (POSTHOG_KEY) {
    posthog.identify(userId, properties);
  }
}

export function resetAnalytics() {
  if (POSTHOG_KEY) {
    posthog.reset();
  }
}

type EventPayload = Record<string, unknown>;

async function logToDb(userId: string | undefined, eventName: string, payload: EventPayload) {
  if (!userId) return;
  try {
    await supabase.from('events').insert({
      user_id: userId,
      event_name: eventName,
      payload,
    });
  } catch {
    // silently fail — analytics must never break the game
  }
}

export function track(eventName: string, payload: EventPayload = {}, userId?: string) {
  if (POSTHOG_KEY) {
    posthog.capture(eventName, payload);
  }
  if (userId) {
    logToDb(userId, eventName, payload);
  }
}

// Typed event helpers
export const analytics = {
  sessionStart: (userId?: string) => track('session_start', {}, userId),
  sessionEnd: (userId?: string) => track('session_end', {}, userId),
  onboardingCompleted: (userId?: string) => track('onboarding_completed', {}, userId),
  petNamed: (name: string, userId?: string) => track('pet_named', { name }, userId),

  actionCompleted: (action: string, userId?: string) =>
    track(`action_${action}_completed`, { action }, userId),

  shopOpened: (userId?: string) => track('shop_opened', {}, userId),
  itemViewed: (itemId: string, userId?: string) => track(`item_viewed_${itemId}`, { itemId }, userId),
  purchaseIntent: (itemId: string, userId?: string) =>
    track(`purchase_intent_${itemId}`, { itemId }, userId),
  purchaseSuccess: (itemId: string, currency: string, amount: number, userId?: string) =>
    track(`purchase_success_${itemId}`, { itemId, currency, amount }, userId),

  levelUp: (level: number, userId?: string) =>
    track(`level_up_${level}`, { level }, userId),

  adShown: (placement: string, userId?: string) => track('ad_shown', { placement }, userId),
  adCompleted: (placement: string, userId?: string) => track('ad_completed', { placement }, userId),
  adRewardClaimed: (reward: unknown, userId?: string) => track('ad_reward_claimed', { reward }, userId),

  guestNudgeShown: (userId?: string) => track('guest_signup_nudge_shown', {}, userId),
  guestConverted: (userId?: string) => track('guest_to_user_converted', {}, userId),
};

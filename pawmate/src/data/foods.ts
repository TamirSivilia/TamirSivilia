export type Currency = 'coins' | 'gems';

export interface FoodItem {
  id: string;
  nameKey: string;
  descKey: string;
  cost: number;
  currency: Currency;
  hungerBoost: number;
  healthBoost: number;
  tier: 'basic' | 'premium' | 'deluxe';
  emoji: string;
}

export const FOODS: FoodItem[] = [
  {
    id: 'basic_food',
    nameKey: 'basic_food',
    descKey: 'basic_food_desc',
    cost: 10,
    currency: 'coins',
    hungerBoost: 20,
    healthBoost: 0,
    tier: 'basic',
    emoji: '🍖',
  },
  {
    id: 'premium_food',
    nameKey: 'premium_food',
    descKey: 'premium_food_desc',
    cost: 25,
    currency: 'coins',
    hungerBoost: 35,
    healthBoost: 5,
    tier: 'premium',
    emoji: '🥩',
  },
  {
    id: 'deluxe_food',
    nameKey: 'deluxe_food',
    descKey: 'deluxe_food_desc',
    cost: 2,
    currency: 'gems',
    hungerBoost: 50,
    healthBoost: 15,
    tier: 'deluxe',
    emoji: '🍱',
  },
];

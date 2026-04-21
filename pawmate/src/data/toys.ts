import type { Currency } from './foods.ts';

export interface ToyItem {
  id: string;
  nameKey: string;
  descKey: string;
  cost: number;
  currency: Currency;
  happinessBoost: number;
  energyCost: number;
  emoji: string;
}

export const TOYS: ToyItem[] = [
  {
    id: 'ball',
    nameKey: 'ball',
    descKey: 'ball_desc',
    cost: 50,
    currency: 'coins',
    happinessBoost: 20,
    energyCost: 10,
    emoji: '⚽',
  },
  {
    id: 'feather',
    nameKey: 'feather',
    descKey: 'feather_desc',
    cost: 1,
    currency: 'gems',
    happinessBoost: 30,
    energyCost: 8,
    emoji: '🪶',
  },
];

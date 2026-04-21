export type Species = 'dog' | 'cat' | 'rabbit' | 'hamster' | 'turtle' | 'bird' | 'fish';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface AnimalDef {
  species: Species;
  rarity: Rarity;
  defaultNames: string[];
  color: number;        // Phaser tint color (hex)
  accentColor: number;
  phase1: boolean;      // available in phase 1
}

export const ANIMALS: AnimalDef[] = [
  {
    species: 'dog',
    rarity: 'common',
    defaultNames: ['בובי', 'מקס', 'ריקי', 'לאקי', 'כוכב'],
    color: 0xc8860a,
    accentColor: 0x8b5e03,
    phase1: true,
  },
  {
    species: 'cat',
    rarity: 'common',
    defaultNames: ['מיאו', 'נינה', 'קיטי', 'לונה', 'פרחה'],
    color: 0x888888,
    accentColor: 0x444444,
    phase1: true,
  },
  {
    species: 'rabbit',
    rarity: 'uncommon',
    defaultNames: ['פופי', 'שלגיה', 'לוני', 'בינבין', 'רוגי'],
    color: 0xf0d0b0,
    accentColor: 0xe8a080,
    phase1: true,
  },
  {
    species: 'hamster',
    rarity: 'uncommon',
    defaultNames: ['נאגי', 'פאפי', 'קוקי', 'חמסטר', 'זהבון'],
    color: 0xf5c842,
    accentColor: 0xd4a017,
    phase1: false,
  },
  {
    species: 'turtle',
    rarity: 'rare',
    defaultNames: ['צ\'לסי', 'טורטל', 'ירוק', 'שלדון', 'מאסטר'],
    color: 0x4a7c59,
    accentColor: 0x2d5a3c,
    phase1: false,
  },
  {
    species: 'bird',
    rarity: 'rare',
    defaultNames: ['כנפיים', 'ציוץ', 'ריו', 'פיפי', 'צ\'ירפי'],
    color: 0x4fc3f7,
    accentColor: 0x0288d1,
    phase1: false,
  },
  {
    species: 'fish',
    rarity: 'rare',
    defaultNames: ['בועי', 'גולד', 'ניאון', 'כסוף', 'כחלחל'],
    color: 0xff7043,
    accentColor: 0xe64a19,
    phase1: false,
  },
];

export const PHASE1_ANIMALS = ANIMALS.filter(a => a.phase1);

export function getAnimalDef(species: Species): AnimalDef {
  return ANIMALS.find(a => a.species === species) ?? ANIMALS[0];
}

export function getRandomPhase1Animal(): AnimalDef {
  return PHASE1_ANIMALS[Math.floor(Math.random() * PHASE1_ANIMALS.length)];
}

export function getRandomDefaultName(species: Species): string {
  const def = getAnimalDef(species);
  return def.defaultNames[Math.floor(Math.random() * def.defaultNames.length)];
}

import { create } from 'zustand';
import { supabase } from '@/lib/supabase.ts';
import { DB_SYNC_DEBOUNCE_MS } from '@/data/constants.ts';

export interface InventoryItem {
  id: string;
  itemId: string;
  itemType: 'food' | 'toy' | 'furniture' | 'cosmetic' | 'consumable';
  quantity: number;
}

interface EconomyStore {
  coins: number;
  gems: number;
  inventory: InventoryItem[];
  userId: string | null;

  setEconomy: (coins: number, gems: number, userId: string) => void;
  setInventory: (items: InventoryItem[]) => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  addGems: (amount: number) => void;
  spendGems: (amount: number) => boolean;
  addInventoryItem: (itemId: string, itemType: InventoryItem['itemType'], quantity?: number) => void;
  removeInventoryItem: (itemId: string, quantity?: number) => boolean;
  getInventoryCount: (itemId: string) => number;
  syncEconomyToDb: () => Promise<void>;
  logTransaction: (type: string, itemId: string | null, currency: string, amount: number, metadata?: Record<string, unknown>) => Promise<void>;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export const useEconomyStore = create<EconomyStore>((set, get) => ({
  coins: 0,
  gems: 0,
  inventory: [],
  userId: null,

  setEconomy: (coins, gems, userId) => set({ coins, gems, userId }),

  setInventory: (items) => set({ inventory: items }),

  addCoins: (amount) => {
    set(state => ({ coins: state.coins + amount }));
    scheduleSync(get);
  },

  spendCoins: (amount) => {
    const { coins } = get();
    if (coins < amount) return false;
    set(state => ({ coins: state.coins - amount }));
    scheduleSync(get);
    return true;
  },

  addGems: (amount) => {
    set(state => ({ gems: state.gems + amount }));
    scheduleSync(get);
  },

  spendGems: (amount) => {
    const { gems } = get();
    if (gems < amount) return false;
    set(state => ({ gems: state.gems - amount }));
    scheduleSync(get);
    return true;
  },

  addInventoryItem: (itemId, itemType, quantity = 1) => {
    set(state => {
      const existing = state.inventory.find(i => i.itemId === itemId);
      if (existing) {
        return {
          inventory: state.inventory.map(i =>
            i.itemId === itemId ? { ...i, quantity: i.quantity + quantity } : i
          ),
        };
      }
      return {
        inventory: [
          ...state.inventory,
          { id: crypto.randomUUID(), itemId, itemType, quantity },
        ],
      };
    });
    // Sync inventory addition to DB
    const { userId } = get();
    if (userId) {
      supabase.from('inventory').upsert({
        user_id: userId,
        item_id: itemId,
        item_type: itemType,
        quantity,
      }).then(() => {});
    }
  },

  removeInventoryItem: (itemId, quantity = 1) => {
    const item = get().inventory.find(i => i.itemId === itemId);
    if (!item || item.quantity < quantity) return false;
    set(state => ({
      inventory: state.inventory
        .map(i => i.itemId === itemId ? { ...i, quantity: i.quantity - quantity } : i)
        .filter(i => i.quantity > 0),
    }));
    return true;
  },

  getInventoryCount: (itemId) => {
    return get().inventory.find(i => i.itemId === itemId)?.quantity ?? 0;
  },

  syncEconomyToDb: async () => {
    const { userId, coins, gems } = get();
    if (!userId) return;
    await supabase.from('economy').update({ coins, gems, updated_at: new Date().toISOString() }).eq('user_id', userId);
  },

  logTransaction: async (type, itemId, currency, amount, metadata = {}) => {
    const { userId } = get();
    if (!userId) return;
    await supabase.from('transactions').insert({
      user_id: userId,
      type,
      item_id: itemId,
      currency,
      amount,
      metadata,
    });
  },
}));

function scheduleSync(get: () => EconomyStore) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => get().syncEconomyToDb(), DB_SYNC_DEBOUNCE_MS);
}

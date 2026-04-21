import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          is_guest: boolean;
          is_premium: boolean;
          premium_until: string | null;
          language: string;
          created_at: string;
          updated_at: string;
        };
      };
      pets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          species: string;
          rarity: string;
          level: number;
          xp: number;
          hunger: number;
          happiness: number;
          energy: number;
          hygiene: number;
          health: number;
          bond: number;
          last_action_at: string;
          last_synced_at: string;
          is_active: boolean;
          created_at: string;
        };
      };
      economy: {
        Row: {
          user_id: string;
          coins: number;
          gems: number;
          updated_at: string;
        };
      };
      inventory: {
        Row: {
          id: string;
          user_id: string;
          item_id: string;
          item_type: string;
          quantity: number;
          acquired_at: string;
        };
      };
    };
  };
}

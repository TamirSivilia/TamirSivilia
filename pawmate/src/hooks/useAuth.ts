import { useEffect } from 'react';
import { supabase } from '@/lib/supabase.ts';
import { useUserStore } from '@/store/userStore.ts';
import { usePetStore } from '@/store/petStore.ts';
import { useEconomyStore } from '@/store/economyStore.ts';
import { calculateOfflineDecay } from '@/lib/decay.ts';
import { analytics, identifyUser } from '@/lib/analytics.ts';
import type { Pet } from '@/store/petStore.ts';

export function useAuth() {
  const { setUser, setIsGuest, setIsPremium, setDisplayName, setLoading } = useUserStore();
  const { setPet, updateStats } = usePetStore();
  const { setEconomy, setInventory } = useEconomyStore();

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setUser(null);
        setPet(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserData(userId: string) {
    setLoading(true);
    try {
      const [profileRes, petRes, economyRes, inventoryRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('pets').select('*').eq('user_id', userId).eq('is_active', true).single(),
        supabase.from('economy').select('*').eq('user_id', userId).single(),
        supabase.from('inventory').select('*').eq('user_id', userId),
      ]);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        identifyUser(userId, { is_guest: profileRes.data?.is_guest });
      }

      if (profileRes.data) {
        setIsGuest(profileRes.data.is_guest ?? true);
        setIsPremium(profileRes.data.is_premium ?? false);
        setDisplayName(profileRes.data.display_name);
      }

      if (petRes.data) {
        const rawPet = petRes.data;
        const petData: Pet = {
          id: rawPet.id,
          userId: rawPet.user_id,
          name: rawPet.name,
          species: rawPet.species,
          rarity: rawPet.rarity,
          level: rawPet.level,
          xp: rawPet.xp,
          hunger: rawPet.hunger,
          happiness: rawPet.happiness,
          energy: rawPet.energy,
          hygiene: rawPet.hygiene,
          health: rawPet.health,
          bond: rawPet.bond,
          lastActionAt: rawPet.last_action_at,
          lastSyncedAt: rawPet.last_synced_at,
          isActive: rawPet.is_active,
          createdAt: rawPet.created_at,
        };

        // Apply offline decay
        const decayResult = calculateOfflineDecay(
          { hunger: petData.hunger, happiness: petData.happiness, energy: petData.energy, hygiene: petData.hygiene, health: petData.health, bond: petData.bond },
          petData.lastSyncedAt
        );

        setPet({ ...petData, ...decayResult.stats });
        if (decayResult.secondsElapsed > 60) {
          updateStats(decayResult.stats);
        }
      }

      if (economyRes.data) {
        setEconomy(economyRes.data.coins, economyRes.data.gems, userId);
      }

      if (inventoryRes.data) {
        setInventory(inventoryRes.data.map(i => ({
          id: i.id,
          itemId: i.item_id,
          itemType: i.item_type as 'food' | 'toy' | 'furniture' | 'cosmetic' | 'consumable',
          quantity: i.quantity,
        })));
      }

      analytics.sessionStart(userId);
    } finally {
      setLoading(false);
    }
  }

  async function signInAsGuest() {
    setLoading(true);
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setLoading(false);
      throw error;
    }
  }

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUpWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    const { user } = useUserStore.getState();
    if (user) analytics.sessionEnd(user.id);
    await supabase.auth.signOut();
    useUserStore.getState().reset();
    setPet(null);
  }

  return { signInAsGuest, signInWithEmail, signUpWithEmail, signOut };
}

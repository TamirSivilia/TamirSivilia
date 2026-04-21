import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase.ts';
import { usePetStore } from '@/store/petStore.ts';
import { useUserStore } from '@/store/userStore.ts';
import { useEconomyStore } from '@/store/economyStore.ts';
import { getRandomPhase1Animal, getRandomDefaultName } from '@/data/animals.ts';
import { analytics } from '@/lib/analytics.ts';
import type { Pet } from '@/store/petStore.ts';

const SPECIES_EMOJIS: Record<string, string> = {
  dog: '🐕',
  cat: '🐈',
  rabbit: '🐇',
};

export function Onboarding() {
  const { t } = useTranslation();
  const { setPet } = usePetStore();
  const { user } = useUserStore();
  const { setEconomy } = useEconomyStore();
  const [animalDef] = useState(() => getRandomPhase1Animal());
  const [name, setName] = useState(() => getRandomDefaultName(animalDef.species));
  const [nameError, setNameError] = useState('');
  const [loading, setLoading] = useState(false);

  const speciesEmoji = SPECIES_EMOJIS[animalDef.species] ?? '🐾';

  const validateName = (val: string) => {
    if (!val.trim()) return t('onboarding.nameRequired');
    if (val.trim().length < 2) return t('onboarding.nameTooShort');
    if (val.trim().length > 20) return t('onboarding.nameTooLong');
    return '';
  };

  const handleContinue = async () => {
    const err = validateName(name);
    if (err) { setNameError(err); return; }
    if (!user) return;

    setLoading(true);
    setNameError('');

    try {
      const { data: petData, error } = await supabase.from('pets').insert({
        user_id: user.id,
        name: name.trim(),
        species: animalDef.species,
        rarity: animalDef.rarity,
        level: 1,
        xp: 0,
        hunger: 80,
        happiness: 80,
        energy: 80,
        hygiene: 80,
        health: 100,
        bond: 0,
        is_active: true,
      }).select().single();

      if (error) throw error;

      const pet: Pet = {
        id: petData.id,
        userId: petData.user_id,
        name: petData.name,
        species: petData.species,
        rarity: petData.rarity,
        level: petData.level,
        xp: petData.xp,
        hunger: petData.hunger,
        happiness: petData.happiness,
        energy: petData.energy,
        hygiene: petData.hygiene,
        health: petData.health,
        bond: petData.bond,
        lastActionAt: petData.last_action_at,
        lastSyncedAt: petData.last_synced_at,
        isActive: petData.is_active,
        createdAt: petData.created_at,
      };

      setPet(pet);
      setEconomy(100, 5, user.id);
      analytics.onboardingCompleted(user.id);
      analytics.petNamed(name.trim(), user.id);
    } catch {
      setNameError(t('app.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-2">{t('onboarding.welcomeTitle')}</h1>
        <p className="text-gray-400 text-sm mb-8">{t('onboarding.welcomeSubtitle')}</p>

        <div className="relative inline-block mb-8">
          <div className="text-9xl animate-bounce">{speciesEmoji}</div>
          <div className="absolute -top-2 -left-2 bg-purple-600 text-xs font-bold px-2 py-1 rounded-full">
            {t(`pet.${animalDef.rarity}`)}
          </div>
        </div>

        <p className="text-gray-300 mb-4">{t('onboarding.yourNewPet')}</p>
        <p className="text-gray-400 text-sm mb-6">{t(`pet.${animalDef.species}`)}</p>

        <div className="mb-6">
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setNameError(''); }}
            placeholder={t('onboarding.namePlaceholder')}
            maxLength={20}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-center text-lg placeholder-gray-400 focus:outline-none focus:border-purple-500"
          />
          {nameError && <p className="text-red-400 text-sm mt-2">{nameError}</p>}
        </div>

        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-60 rounded-2xl font-bold text-lg active:scale-95 transition-all"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{t('app.loading')}</span>
            </div>
          ) : `${t('onboarding.letsContinue')} →`}
        </button>
      </div>
    </div>
  );
}

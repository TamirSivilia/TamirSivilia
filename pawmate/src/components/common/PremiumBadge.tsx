import { useTranslation } from 'react-i18next';
import { useUserStore } from '@/store/userStore.ts';

export function PremiumBadge() {
  const { t } = useTranslation();
  const isPremium = useUserStore(s => s.isPremium);
  if (!isPremium) return null;

  return (
    <span className="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-0.5 rounded-full border border-yellow-500/40">
      {t('economy.premiumBadge')}
    </span>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/store/uiStore.ts';
import { useEconomyStore } from '@/store/economyStore.ts';
import { useUserStore } from '@/store/userStore.ts';
import { FOODS } from '@/data/foods.ts';
import { TOYS } from '@/data/toys.ts';
import { ads } from '@/lib/ads.ts';
import { analytics } from '@/lib/analytics.ts';
import { AD_REWARD_COINS } from '@/data/constants.ts';

type Tab = 'food' | 'toys';

export function ShopModal() {
  const { t } = useTranslation();
  const { shopOpen, closeShop, addToast } = useUIStore();
  const { coins, gems, spendCoins, spendGems, addCoins, addInventoryItem, logTransaction } = useEconomyStore();
  const { user } = useUserStore();
  const [tab, setTab] = useState<Tab>('food');
  const [adLoading, setAdLoading] = useState(false);

  if (!shopOpen) return null;

  const handleBuyFood = (food: typeof FOODS[0]) => {
    analytics.purchaseIntent(food.id, user?.id);
    analytics.itemViewed(food.id, user?.id);

    if (food.currency === 'coins') {
      if (coins < food.cost) { addToast(t('economy.notEnoughCoins'), 'error'); return; }
      spendCoins(food.cost);
    } else {
      if (gems < food.cost) { addToast(t('economy.notEnoughGems'), 'error'); return; }
      spendGems(food.cost);
    }

    addInventoryItem(food.id, 'food');
    addToast(t('economy.purchased'), 'success', food.emoji);
    logTransaction('purchase', food.id, food.currency, food.cost);
    analytics.purchaseSuccess(food.id, food.currency, food.cost, user?.id);
  };

  const handleBuyToy = (toy: typeof TOYS[0]) => {
    analytics.purchaseIntent(toy.id, user?.id);

    if (toy.currency === 'coins') {
      if (coins < toy.cost) { addToast(t('economy.notEnoughCoins'), 'error'); return; }
      spendCoins(toy.cost);
    } else {
      if (gems < toy.cost) { addToast(t('economy.notEnoughGems'), 'error'); return; }
      spendGems(toy.cost);
    }

    addInventoryItem(toy.id, 'toy');
    addToast(t('economy.purchased'), 'success', toy.emoji);
    logTransaction('purchase', toy.id, toy.currency, toy.cost);
    analytics.purchaseSuccess(toy.id, toy.currency, toy.cost, user?.id);
  };

  const handleWatchAd = async () => {
    setAdLoading(true);
    analytics.adShown('shop_reward', user?.id);
    try {
      const result = await ads.showRewardedAd('shop_reward');
      if (result.success) {
        addCoins(AD_REWARD_COINS);
        addToast(t('economy.adReward'), 'reward', '🎉');
        logTransaction('ad_reward', 'rewarded_video', 'coins', AD_REWARD_COINS);
        analytics.adCompleted('shop_reward', user?.id);
        analytics.adRewardClaimed({ type: 'coins', amount: AD_REWARD_COINS }, user?.id);
      }
    } finally {
      setAdLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={closeShop}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{t('economy.shopTitle')}</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-sm">
              <span>🪙</span>
              <span className="text-yellow-400 font-bold ltr-num">{coins}</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span>💎</span>
              <span className="text-blue-400 font-bold ltr-num">{gems}</span>
            </div>
            <button onClick={closeShop} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">✕</button>
          </div>
        </div>

        {/* Rewarded Ad Button */}
        <button
          onClick={handleWatchAd}
          disabled={adLoading}
          className="w-full mb-4 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-60 py-3 rounded-2xl font-bold transition-all active:scale-95"
        >
          {adLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{t('economy.adLoading')}</span>
            </>
          ) : (
            <><span>📺</span><span>{t('economy.watchAd')}</span></>
          )}
        </button>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('food')}
            className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-colors ${tab === 'food' ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            🍖 {t('shop.food')}
          </button>
          <button
            onClick={() => setTab('toys')}
            className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-colors ${tab === 'toys' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            🎾 {t('shop.toys')}
          </button>
        </div>

        {/* Items */}
        <div className="space-y-3">
          {tab === 'food' && FOODS.map(food => (
            <div key={food.id} className="flex items-center gap-3 bg-gray-700/50 rounded-2xl p-3">
              <span className="text-3xl">{food.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{t(`shop.${food.nameKey}`)}</span>
                  {food.currency === 'gems' && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/30">{t('economy.premium')}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{t(`shop.${food.descKey}`)}</span>
              </div>
              <button
                onClick={() => handleBuyFood(food)}
                className="flex items-center gap-1 bg-orange-500 hover:bg-orange-400 active:scale-95 px-3 py-1.5 rounded-xl text-sm font-bold transition-all"
              >
                {food.currency === 'coins' ? '🪙' : '💎'}
                <span className="ltr-num">{food.cost}</span>
              </button>
            </div>
          ))}

          {tab === 'toys' && TOYS.map(toy => (
            <div key={toy.id} className="flex items-center gap-3 bg-gray-700/50 rounded-2xl p-3">
              <span className="text-3xl">{toy.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{t(`shop.${toy.nameKey}`)}</span>
                  {toy.currency === 'gems' && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/30">{t('economy.premium')}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{t(`shop.${toy.descKey}`)}</span>
              </div>
              <button
                onClick={() => handleBuyToy(toy)}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-500 active:scale-95 px-3 py-1.5 rounded-xl text-sm font-bold transition-all"
              >
                {toy.currency === 'coins' ? '🪙' : '💎'}
                <span className="ltr-num">{toy.cost}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

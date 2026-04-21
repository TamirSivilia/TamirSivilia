export interface AdResult {
  success: boolean;
  placement: string;
  reward?: { type: string; amount: number };
  error?: string;
}

export interface AdProvider {
  showRewardedAd(placement: string): Promise<AdResult>;
  showInterstitial(): Promise<void>;
  isAdFree(): boolean;
}

/**
 * Phase 1 stub — always "succeeds" after 2 sec, grants reward.
 * Phase 2: swap for AdMob/AdSense provider.
 */
export class StubAds implements AdProvider {
  async showRewardedAd(placement: string): Promise<AdResult> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      success: true,
      placement,
      reward: { type: 'coins', amount: 50 },
    };
  }

  async showInterstitial(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  isAdFree(): boolean {
    return false;
  }
}

export const ads: AdProvider = new StubAds();

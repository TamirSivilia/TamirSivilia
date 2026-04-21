export interface PurchaseResult {
  success: boolean;
  productId: string;
  transactionId?: string;
  error?: string;
}

export interface IAPProvider {
  purchase(productId: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<PurchaseResult[]>;
  isPremium(): boolean;
}

/**
 * Phase 1 stub — grants the item immediately and logs the transaction.
 * Phase 2: swap for StripeIAP or RevenueCatIAP.
 */
export class StubIAP implements IAPProvider {
  async purchase(productId: string): Promise<PurchaseResult> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      success: true,
      productId,
      transactionId: `stub_${Date.now()}`,
    };
  }

  async restorePurchases(): Promise<PurchaseResult[]> {
    return [];
  }

  isPremium(): boolean {
    return false;
  }
}

export const iap: IAPProvider = new StubIAP();

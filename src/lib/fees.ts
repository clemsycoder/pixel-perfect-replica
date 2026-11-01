// Pure fee math shared by the trading engine (SQL) and the trade-preview UI.
// The SQL engine recomputes these server-side; this module mirrors the same
// defaults so previews match execution. Defaults match platform_settings.

export const DEFAULT_TRADE_FEE_BPS = 50; // 0.50%
export const DEFAULT_WITHDRAWAL_FEE_BPS = 100; // 1.00%
export const DEFAULT_WITHDRAWAL_FEE_MIN_KOBO = 10_000; // ₦100

export function computeTradeFee(totalKobo: number, tradeFeeBps: number = DEFAULT_TRADE_FEE_BPS): number {
  return Math.round((totalKobo * tradeFeeBps) / 10_000);
}

export interface CostBreakdown {
  grossKobo: number;
  feeKobo: number;
  totalKobo: number;
}

export function buyCost(pricePerUnitKobo: number, quantity: number, tradeFeeBps: number = DEFAULT_TRADE_FEE_BPS): CostBreakdown {
  const grossKobo = Math.round(pricePerUnitKobo * quantity);
  const feeKobo = computeTradeFee(grossKobo, tradeFeeBps);
  return { grossKobo, feeKobo, totalKobo: grossKobo + feeKobo };
}

export function sellProceeds(
  pricePerUnitKobo: number,
  quantity: number,
  tradeFeeBps: number = DEFAULT_TRADE_FEE_BPS,
): CostBreakdown {
  const grossKobo = Math.round(pricePerUnitKobo * quantity);
  const feeKobo = computeTradeFee(grossKobo, tradeFeeBps);
  return { grossKobo, feeKobo, totalKobo: grossKobo - feeKobo };
}

export function computeWithdrawalFee(
  amountKobo: number,
  withdrawalFeeBps: number = DEFAULT_WITHDRAWAL_FEE_BPS,
  minFeeKobo: number = DEFAULT_WITHDRAWAL_FEE_MIN_KOBO,
): number {
  return Math.max(Math.round((amountKobo * withdrawalFeeBps) / 10_000), minFeeKobo);
}

export const MIN_TRADE_QUANTITY = 0.0001;
export const MAX_TRADE_QUANTITY = 1_000_000;
export const MIN_DEPOSIT_KOBO = 100_000; // ₦1,000
export const MAX_DEPOSIT_KOBO = 1_000_000_000_00; // ₦1,000,000,000
export const MIN_WITHDRAWAL_KOBO = 10_000; // ₦100

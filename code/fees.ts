// Chapter 3 — fee + slippage helpers.
// The fee split mirrors the SHAPE of Meteora DBC's constants (FEE_DENOMINATOR = 1e9, protocol takes
// 20% of the trading fee, a referral host gets 20% of the protocol share, fees round up).
// This is our clone's simplified TypeScript, not Meteora's Rust code.
export const FEE_DENOMINATOR = 1_000_000_000n;
export const PROTOCOL_FEE_PERCENT = 20n;
export const HOST_FEE_PERCENT = 20n;

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

export function tradingFee(amount: bigint, feeNumerator: bigint): bigint {
  return ceilDiv(amount * feeNumerator, FEE_DENOMINATOR); // round UP, protocol's favour
}

export function splitFee(fee: bigint, hasReferral: boolean) {
  const protocolGross = (fee * PROTOCOL_FEE_PERCENT) / 100n;
  const referral = hasReferral ? (protocolGross * HOST_FEE_PERCENT) / 100n : 0n;
  const protocol = protocolGross - referral;
  const partnerAndCreator = fee - protocolGross;
  return { partnerAndCreator, protocol, referral };
}

/** Front-end helper: turn a quote into a max you are willing to pay. */
export const maxWithSlippage = (quote: bigint, slippageBps: bigint) => ceilDiv(quote * (10_000n + slippageBps), 10_000n);
/** ...or a minimum you are willing to receive. */
export const minWithSlippage = (quote: bigint, slippageBps: bigint) => (quote * (10_000n - slippageBps)) / 10_000n;

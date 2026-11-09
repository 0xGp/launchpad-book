// Capstone part 1 — the curve engine (OUR CLONE'S DESIGN, not pump.fun's source code).
// Starting numbers are pump.fun's public Global defaults (raw units, 6-decimal tokens assumed).
export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const TOKEN_DECIMALS = 6n; // assumption used throughout the book
export const FEE_BPS = 100n; // pump.fun's public docs: fee_basis_points == 100 (1%)
export const BPS = 10_000n;

export interface Curve {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
}

export function newCurve(): Curve {
  return {
    virtualTokenReserves: 1_073_000_000_000_000n,
    virtualSolReserves: 30_000_000_000n,
    realTokenReserves: 793_100_000_000_000n,
    realSolReserves: 0n,
    tokenTotalSupply: 1_000_000_000_000_000n,
    complete: false,
  };
}

/** ceil(a / b) for positive bigints — round UP when the user pays. */
export const ceilDiv = (a: bigint, b: bigint): bigint => (a + b - 1n) / b;
/** Fee is always rounded UP (in the protocol's favour). */
export const feeOf = (amount: bigint, bps = FEE_BPS): bigint => ceilDiv(amount * bps, BPS);

/** Tokens out for an exact SOL input (before any cap). Rounded DOWN: the user receives. */
export function tokensForSol(c: Curve, solIn: bigint): bigint {
  return (c.virtualTokenReserves * solIn) / (c.virtualSolReserves + solIn);
}

/** SOL cost (before fee) for an exact token output. Rounded UP: the user pays. */
export function solForTokens(c: Curve, tokensOut: bigint): bigint {
  if (tokensOut >= c.virtualTokenReserves) throw new Error("tokensOut too large");
  return ceilDiv(c.virtualSolReserves * tokensOut, c.virtualTokenReserves - tokensOut);
}

/** SOL out (before fee) for selling tokens. Rounded DOWN: the user receives. */
export function solForSell(c: Curve, tokensIn: bigint): bigint {
  return (c.virtualSolReserves * tokensIn) / (c.virtualTokenReserves + tokensIn);
}

export interface BuyQuote { tokensOut: bigint; solCost: bigint; fee: bigint; total: bigint; partial: boolean }

/**
 * Quote a buy of an exact token amount (pump.fun-style `buy(amount, max_sol_cost)` shape).
 * Our clone's rule for the end of the curve: if amount > realTokenReserves we sell what is left
 * (partial fill) — the user only pays for what they get, so nothing needs refunding later.
 */
export function quoteBuy(c: Curve, amount: bigint): BuyQuote {
  if (c.complete) throw new Error("CurveComplete");
  if (amount <= 0n) throw new Error("ZeroAmount");
  const tokensOut = amount > c.realTokenReserves ? c.realTokenReserves : amount;
  const solCost = solForTokens(c, tokensOut);
  const fee = feeOf(solCost);
  return { tokensOut, solCost, fee, total: solCost + fee, partial: tokensOut < amount };
}

/** Apply a buy. Reverts (throws) before touching state if slippage is exceeded. */
export function applyBuy(c: Curve, amount: bigint, maxSolCost: bigint): BuyQuote {
  const q = quoteBuy(c, amount);
  if (q.total > maxSolCost) throw new Error(`ExceededSlippage: needs ${q.total} > max ${maxSolCost}`);
  c.virtualTokenReserves -= q.tokensOut;
  c.realTokenReserves -= q.tokensOut;
  c.virtualSolReserves += q.solCost;
  c.realSolReserves += q.solCost;
  if (c.realTokenReserves === 0n) c.complete = true; // the exact moment the curve completes
  return q;
}

export interface SellQuote { solOut: bigint; fee: bigint; net: bigint }

export function quoteSell(c: Curve, amount: bigint): SellQuote {
  if (c.complete) throw new Error("CurveComplete");
  if (amount <= 0n) throw new Error("ZeroAmount");
  const solOut = solForSell(c, amount);
  if (solOut > c.realSolReserves) throw new Error("InsufficientRealSol");
  const fee = feeOf(solOut);
  return { solOut, fee, net: solOut - fee };
}

export function applySell(c: Curve, amount: bigint, minSolOutput: bigint): SellQuote {
  const q = quoteSell(c, amount);
  if (q.net < minSolOutput) throw new Error(`ExceededSlippage: gets ${q.net} < min ${minSolOutput}`);
  c.virtualTokenReserves += amount;
  c.realTokenReserves += amount;
  c.virtualSolReserves -= q.solOut;
  c.realSolReserves -= q.solOut;
  return q;
}

/** Spot price in lamports per whole token, as a decimal string (display only). */
export function spotPriceLamportsPerToken(c: Curve): number {
  return Number(c.virtualSolReserves * 10n ** TOKEN_DECIMALS) / Number(c.virtualTokenReserves);
}

/** Format raw bigint units with a fixed number of decimals, without floating point. */
export function fmt(raw: bigint, decimals: bigint): string {
  const d = 10n ** decimals;
  const whole = raw / d;
  const frac = (raw % d).toString().padStart(Number(decimals), "0");
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

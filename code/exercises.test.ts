// Checks that the printed exercise solutions actually work.
import assert from "node:assert/strict";
import { Curve, newCurve, feeOf, tokensForSol, solForTokens, applyBuy } from "./engine.ts";

// Chapter 9.1 solution
export function applyBuyExactSolIn(c: Curve, solIn: bigint, minTokensOut: bigint) {
  if (c.complete) throw new Error("CurveComplete");
  const feeMax = feeOf(solIn);
  let tokens = tokensForSol(c, solIn - feeMax);
  if (tokens > c.realTokenReserves) tokens = c.realTokenReserves;
  if (tokens < minTokensOut) throw new Error("ExceededSlippage");
  const used = solForTokens(c, tokens);
  const fee = feeOf(used);
  const refund = solIn - used - fee;
  c.virtualTokenReserves -= tokens; c.realTokenReserves -= tokens;
  c.virtualSolReserves += used; c.realSolReserves += used;
  if (c.realTokenReserves === 0n) c.complete = true;
  return { tokens, used, fee, refund };
}
const c = newCurve();
const r1 = applyBuyExactSolIn(c, 1_000_000_000n, 0n);
assert.ok(r1.refund >= 0n && r1.used + r1.fee + r1.refund === 1_000_000_000n);
applyBuy(c, 750_000_000_000_000n, 10n ** 12n);
assert.equal(c.complete, false);
const r2 = applyBuyExactSolIn(c, 200_000_000_000n, 0n); // 200 SOL into a nearly-empty curve
assert.equal(r2.tokens, 793_100_000_000_000n - 750_000_000_000_000n - r1.tokens);
assert.ok(r2.refund > 0n && r2.refund < 200_000_000_000n && r2.used + r2.fee + r2.refund === 200_000_000_000n);
assert.equal(c.complete, true);
assert.throws(() => applyBuyExactSolIn(c, 1n, 0n), /CurveComplete/);
console.log("9.1 solution: partial refund", r2.refund, "lamports; curve complete");

// Chapter 1 + 4 solutions
type Phase = "Trading" | "Complete" | "Migrated";
const nextPhase = (p: Phase, e: "soldOut" | "migrate"): Phase =>
  p === "Trading" && e === "soldOut" ? "Complete" : p === "Complete" && e === "migrate" ? "Migrated" : p;
assert.equal(nextPhase("Migrated", "migrate"), "Migrated");
assert.equal(nextPhase("Trading", "migrate"), "Trading");
const dbc = (q: bigint, t: bigint) => q >= t;
assert.equal(dbc(99n, 100n), false); assert.equal(dbc(100n, 100n), true);
console.log("exercises: all checks passed");

import assert from "node:assert/strict";
import { newCurve, tokensForSol, solForTokens, quoteBuy, applyBuy, applySell, fmt, feeOf, LAMPORTS_PER_SOL } from "./engine.ts";

const c = newCurve();
// 1) 1 SOL in (ignoring fee) buys about 34,612,903.225806 tokens
const t1 = tokensForSol(c, LAMPORTS_PER_SOL);
console.log("1 SOL ->", fmt(t1, 6n), "tokens");
assert.equal(fmt(t1, 6n), "34,612,903.225806");

// 2) cost to buy all 793.1M real tokens
const all = solForTokens(c, c.realTokenReserves);
console.log("complete curve cost (before fee) ->", fmt(all, 9n), "SOL; with 1% fee ->", fmt(all + feeOf(all), 9n));
assert.ok(all > 85_005_000_000n && all < 85_006_000_000n);

// 3) 10M-token buy total = 285,042,334 lamports
const q = quoteBuy(c, 10_000_000_000_000n);
console.log("10M tokens -> cost", q.solCost, "fee", q.fee, "total", q.total);
assert.equal(q.solCost, 282_220_132n);
assert.equal(q.fee, 2_822_202n);
assert.equal(q.total, 285_042_334n);

// 4) slippage: Alice's quote is stale after someone buys ahead of her
const c2 = newCurve();
const aliceQuote = quoteBuy(c2, 10_000_000_000_000n);
applyBuy(c2, 100_000_000_000_000n, 10n ** 12n); // a 100M-token buy lands first
assert.throws(() => applyBuy(c2, 10_000_000_000_000n, aliceQuote.total), /ExceededSlippage/);

// 5) partial fill at the end + completion moment
const c3 = newCurve();
applyBuy(c3, 793_000_000_000_000n, 10n ** 12n);
const last = applyBuy(c3, 50_000_000_000_000n, 10n ** 12n);
assert.equal(last.partial, true);
assert.equal(last.tokensOut, 100_000_000_000n);
assert.equal(c3.realTokenReserves, 0n);
assert.equal(c3.complete, true);
assert.throws(() => quoteBuy(c3, 1n), /CurveComplete/);

// 6) round-trip can never profit (rounding favours the protocol)
const c4 = newCurve();
for (let i = 0; i < 1000; i++) {
  const b = applyBuy(c4, 1n, 10n ** 12n);
  const s = applySell(c4, 1n, 0n);
  assert.ok(s.net <= b.total);
}
assert.ok(c4.realSolReserves >= 0n);
console.log("after 1000 tiny round trips, curve kept", c4.realSolReserves, "lamports (never negative)");
console.log("engine: all checks passed");

import assert from "node:assert/strict";
import { tradingFee, splitFee, maxWithSlippage, minWithSlippage } from "./fees.ts";
// 1% fee = 10_000_000 / 1e9
const fee = tradingFee(1_000_000_001n, 10_000_000n);
assert.equal(fee, 10_000_001n); // 10,000,000.01 rounded up
const s = splitFee(1_000_000n, true);
assert.deepEqual(s, { partnerAndCreator: 800_000n, protocol: 160_000n, referral: 40_000n });
assert.equal(s.partnerAndCreator + s.protocol + s.referral, 1_000_000n);
assert.equal(maxWithSlippage(285_042_334n, 100n), 287_892_758n);
assert.equal(minWithSlippage(1_000_000n, 50n), 995_000n);
console.log("fees: all checks passed", s);

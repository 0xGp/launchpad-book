import assert from "node:assert/strict";
import { numberVsBigint, assertSlippage, assertMintLocked } from "./security.ts";
const r = numberVsBigint();
console.log("k as number:", r.asNumber, "| as bigint:", r.asBigint.toString(), "| exact?", r.exact);
assert.equal(r.exact, false);
assert.throws(() => assertSlippage(285_042_335n, 285_042_334n), /ExceededSlippage/);
assert.throws(() => assertMintLocked({ mintAuthority: "EveWallet", freezeAuthority: null }), /MintAuthority/);
assertMintLocked({ mintAuthority: null, freezeAuthority: null });
console.log("security: all checks passed");

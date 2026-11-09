import assert from "node:assert/strict";
import { globalPda, bondingCurvePda } from "./pdas.ts";
import { address } from "@solana/kit";
const g = await globalPda();
console.log("global PDA:", g);
assert.equal(g, "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"); // matches pump.fun's public docs
console.log("bonding-curve PDA for a sample mint:", await bondingCurvePda(address("So11111111111111111111111111111111111111112")));
console.log("pdas: all checks passed");

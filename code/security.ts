// Chapter 6 — three bugs and the rule that stops each one. OUR CLONE'S CHECKS.
export const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER); // 9,007,199,254,740,991

/** Bob's bug #1: JavaScript numbers silently lose precision above 2^53. */
export function numberVsBigint() {
  const asNumber = 1_073_000_000_000_000 * 30_000_000_000;          // k with JS numbers
  const asBigint = 1_073_000_000_000_000n * 30_000_000_000n;         // k with bigint
  return { asNumber, asBigint, exact: BigInt(asNumber) === asBigint };
}

/** Rule for Alice: the program, not the UI, enforces the user's limit. */
export function assertSlippage(actualCost: bigint, maxSolCost: bigint) {
  if (actualCost > maxSolCost) throw new Error("ExceededSlippage");
}

/** Rule for Eve: after create, nobody may mint more. The program checks this. */
export function assertMintLocked(mint: { mintAuthority: string | null; freezeAuthority: string | null }) {
  if (mint.mintAuthority !== null) throw new Error("MintAuthorityNotRevoked");
  if (mint.freezeAuthority !== null) throw new Error("FreezeAuthorityNotRevoked");
}

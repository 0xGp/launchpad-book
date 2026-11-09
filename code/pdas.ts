// Chapter 5 — deriving pump.fun's public PDAs with @solana/kit.
import { address, getAddressEncoder, getProgramDerivedAddress, type Address } from "@solana/kit";
export const PUMP_PROGRAM_ID = address("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

export async function globalPda(): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({ programAddress: PUMP_PROGRAM_ID, seeds: ["global"] });
  return pda;
}
export async function bondingCurvePda(mint: Address): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: PUMP_PROGRAM_ID,
    seeds: ["bonding-curve", getAddressEncoder().encode(mint)],
  });
  return pda;
}

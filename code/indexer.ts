// Chapter 7 — the indexer core. OUR CLONE'S DESIGN (general indexing pattern).
// Real Postgres would use: INSERT ... ON CONFLICT (signature, ix_path) DO NOTHING.
import { createHash } from "node:crypto";

/** Anchor event discriminator = first 8 bytes of sha256("event:<Name>"). */
export const eventDiscriminator = (name: string) => [...createHash("sha256").update(`event:${name}`).digest().subarray(0, 8)];

export interface TradeRow {
  signature: string; ixPath: string; slot: number; txIndex: number;
  mint: string; isBuy: boolean; tokenAmount: bigint; solAmount: bigint; fee: bigint;
  virtualSolReserves: bigint; virtualTokenReserves: bigint; blockTime: number;
}

export class TradeStore {
  rows = new Map<string, TradeRow>();               // trades table, PK (signature, ix_path)
  latest = new Map<string, TradeRow>();             // latest state per mint (moves forward only)
  insertOnConflictDoNothing(r: TradeRow): boolean {
    const key = `${r.signature}#${r.ixPath}`;
    if (this.rows.has(key)) return false;
    this.rows.set(key, r);
    return true;
  }
  upsertLatest(r: TradeRow) {
    const cur = this.latest.get(r.mint);
    const newer = !cur || r.slot > cur.slot || (r.slot === cur.slot && (r.txIndex > cur.txIndex ||
      (r.txIndex === cur.txIndex && r.ixPath > cur.ixPath)));
    if (newer) this.latest.set(r.mint, r); // a late/backfilled older trade never moves state backwards
  }
}

/** Idempotent: safe to call with WebSocket data AND overlapping backfill data. */
export function indexBatch(store: TradeStore, batch: TradeRow[]): { inserted: number; duplicates: number } {
  let inserted = 0, duplicates = 0;
  for (const r of batch) {
    if (store.insertOnConflictDoNothing(r)) { inserted++; store.upsertLatest(r); } else duplicates++;
  }
  return { inserted, duplicates };
}

/** Gap tracking: which slots have we NOT seen since the last checkpoint? */
export function findGap(lastIndexedSlot: number, firstSlotAfterReconnect: number) {
  return firstSlotAfterReconnect > lastIndexedSlot + 1
    ? { fromSlot: lastIndexedSlot + 1, toSlot: firstSlotAfterReconnect - 1 } : null;
}

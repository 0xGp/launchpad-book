// Tests for chapters 7 + 8, and the capstone part 3 stub (program events -> indexer -> candles).
import assert from "node:assert/strict";
import { LaunchpadProgram } from "./program.ts";
import { TradeStore, indexBatch, findGap, eventDiscriminator, type TradeRow } from "./indexer.ts";
import { buildCandles, ChartFeed, type Trade } from "./candles.ts";

assert.deepEqual(eventDiscriminator("TradeEvent"), [189, 219, 127, 211, 78, 230, 97, 238]);
console.log("TradeEvent discriminator matches the class notes");

const p = new LaunchpadProgram();
p.create("MINT", "alice");
for (let i = 0; i < 20; i++) p.buy(`sig${i}`, "u", "MINT", 5_000_000_000_000n, 10n ** 12n);
p.sell("sigS", "u", "MINT", 20_000_000_000_000n, 0n);

const rows: TradeRow[] = p.events.flatMap((e, i) => e.kind !== "TradeEvent" ? [] : [{
  signature: e.signature, ixPath: "0", slot: e.slot, txIndex: 0, mint: e.mint, isBuy: e.isBuy,
  tokenAmount: e.tokenAmount, solAmount: e.solAmount, fee: e.fee, virtualSolReserves: e.virtualSolReserves,
  virtualTokenReserves: e.virtualTokenReserves, blockTime: 1_700_000_000 + i * 15,
}]);
const store = new TradeStore();
assert.deepEqual(indexBatch(store, rows.slice(0, 15)), { inserted: 15, duplicates: 0 }); // live WS
assert.deepEqual(indexBatch(store, rows.slice(10)), { inserted: 6, duplicates: 5 });      // overlapping backfill
assert.equal(store.rows.size, 21);
indexBatch(store, [{ ...rows[0], signature: "late-old", slot: 0 }]);                      // late old trade
assert.equal(store.latest.get("MINT")!.signature, "sigS");                                // state did not go back
assert.deepEqual(findGap(100, 141), { fromSlot: 101, toSlot: 140 });

const trades: Trade[] = rows.map((r, i) => ({ seq: i + 1, time: r.blockTime,
  price: Number(r.virtualSolReserves) / Number(r.virtualTokenReserves), volume: Number(r.solAmount) / 1e9 }));
const all = buildCandles(trades);
const feed = new ChartFeed();
feed.onLive(trades[12]); feed.onLive(trades[13]);                     // arrive before the snapshot
feed.onSnapshot({ asOfSeq: 13, candles: buildCandles(trades.slice(0, 13)) });
for (const t of trades.slice(13)) feed.onLive(t);
feed.onLive(trades[15]);                                              // duplicate delivery
assert.deepEqual(feed.candles, all);                                  // no skipped, no double-counted trade
console.log(`pipeline: ${trades.length} trades -> ${all.length} one-minute candles; all checks passed`);

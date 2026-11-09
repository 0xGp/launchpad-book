// Capstone part 2 — the launchpad "program" as a TypeScript state machine.
// OUR CLONE'S DESIGN. It mimics the shape of pump.fun's public instructions
// (create / buy / sell / migrate, permissionless + idempotent migrate) but is NOT pump.fun's code.
import { Curve, newCurve, applyBuy, applySell } from "./engine.ts";

export type Status = "Trading" | "Complete" | "Migrating" | "Migrated";
// Migration is split into steps so a crash between transactions can resume (same idea as
// Meteora DBC's MigrationProgress field; the step names here are ours).
export type MigrationStep = "None" | "PoolCreated" | "LiquidityMoved" | "LpBurned";

export interface CoinState {
  mint: string;
  creator: string;
  curve: Curve;
  status: Status;
  step: MigrationStep;
  poolId?: string;
}

export type ProgramEvent =
  | { kind: "CreateEvent"; seq: number; slot: number; mint: string; creator: string }
  | { kind: "TradeEvent"; seq: number; slot: number; signature: string; mint: string; user: string;
      isBuy: boolean; tokenAmount: bigint; solAmount: bigint; fee: bigint;
      virtualSolReserves: bigint; virtualTokenReserves: bigint }
  | { kind: "CompleteEvent"; seq: number; slot: number; mint: string }
  | { kind: "MigrateEvent"; seq: number; slot: number; mint: string; poolId: string; sol: bigint; tokens: bigint };

type EventInput = ProgramEvent extends infer E ? E extends ProgramEvent ? Omit<E, "seq" | "slot"> : never : never;

export class LaunchpadProgram {
  coins = new Map<string, CoinState>();
  events: ProgramEvent[] = [];
  pools = new Map<string, { sol: bigint; tokens: bigint; lpBurned: boolean }>();
  slot = 1;
  private seq = 0;
  /** test hook: throw when migration reaches this step, to simulate a crash between txs */
  crashAfter?: MigrationStep;

  private emit(e: EventInput) {
    this.events.push({ ...e, seq: ++this.seq, slot: this.slot } as ProgramEvent);
  }

  /** Every instruction is all-or-nothing, like a Solana transaction: snapshot, run, roll back on error. */
  private atomic<T>(fn: () => T): T {
    const snap = structuredClone({ coins: this.coins, events: this.events, pools: this.pools, seq: this.seq });
    try {
      const out = fn();
      this.slot++;
      return out;
    } catch (err) {
      this.coins = snap.coins; this.events = snap.events; this.pools = snap.pools; this.seq = snap.seq;
      throw err;
    }
  }

  private coin(mint: string): CoinState {
    const c = this.coins.get(mint);
    if (!c) throw new Error("CoinNotFound");
    return c;
  }

  create(mint: string, creator: string) {
    return this.atomic(() => {
      if (this.coins.has(mint)) throw new Error("AlreadyExists"); // like an `init` account constraint
      this.coins.set(mint, { mint, creator, curve: newCurve(), status: "Trading", step: "None" });
      this.emit({ kind: "CreateEvent", mint, creator });
    });
  }

  buy(signature: string, user: string, mint: string, amount: bigint, maxSolCost: bigint) {
    return this.atomic(() => {
      const c = this.coin(mint);
      if (c.status !== "Trading") throw new Error("CurveComplete");
      const q = applyBuy(c.curve, amount, maxSolCost);
      this.emit({ kind: "TradeEvent", signature, mint, user, isBuy: true, tokenAmount: q.tokensOut,
        solAmount: q.solCost, fee: q.fee, virtualSolReserves: c.curve.virtualSolReserves,
        virtualTokenReserves: c.curve.virtualTokenReserves });
      if (c.curve.complete) { c.status = "Complete"; this.emit({ kind: "CompleteEvent", mint }); }
      return q;
    });
  }

  sell(signature: string, user: string, mint: string, amount: bigint, minSolOutput: bigint) {
    return this.atomic(() => {
      const c = this.coin(mint);
      if (c.status !== "Trading") throw new Error("CurveComplete");
      const q = applySell(c.curve, amount, minSolOutput);
      this.emit({ kind: "TradeEvent", signature, mint, user, isBuy: false, tokenAmount: amount,
        solAmount: q.solOut, fee: q.fee, virtualSolReserves: c.curve.virtualSolReserves,
        virtualTokenReserves: c.curve.virtualTokenReserves });
      return q;
    });
  }

  /**
   * Permissionless + idempotent migrate. Anyone may call it; calling it again is a no-op.
   * Each step checks-and-records progress, so a crash resumes instead of repeating work.
   * Returns "noop" when there is nothing to do.
   */
  migrate(_caller: string, mint: string): "migrated" | "noop" {
    return this.atomic(() => {
      const c = this.coin(mint);
      if (c.status === "Migrated") return "noop"; // second bot lands here: no pool, no transfer, no event
      if (c.status === "Trading" || !c.curve.complete || c.curve.realTokenReserves !== 0n)
        throw new Error("CurveNotComplete");
      c.status = "Migrating";
      const poolId = `pool:${mint}`; // deterministic id (like a PDA) so it can never be created twice

      if (c.step === "None") {
        if (!this.pools.has(poolId)) this.pools.set(poolId, { sol: 0n, tokens: 0n, lpBurned: false });
        c.poolId = poolId; c.step = "PoolCreated";
        this.checkpoint(c, "PoolCreated");
      }
      if (c.step === "PoolCreated") {
        const pool = this.pools.get(poolId)!;
        const tokensForPool = c.curve.tokenTotalSupply - 793_100_000_000_000n; // the unsold 206.9M
        pool.sol += c.curve.realSolReserves; pool.tokens += tokensForPool;
        c.curve.realSolReserves = 0n; c.step = "LiquidityMoved";
        this.checkpoint(c, "LiquidityMoved");
      }
      if (c.step === "LiquidityMoved") {
        this.pools.get(poolId)!.lpBurned = true; c.step = "LpBurned";
      }
      const pool = this.pools.get(poolId)!;
      c.status = "Migrated";
      this.emit({ kind: "MigrateEvent", mint, poolId, sol: pool.sol, tokens: pool.tokens });
      return "migrated";
    });
  }

  /** In a real program each step would be its own transaction; a crash here keeps the saved step. */
  private checkpoint(c: CoinState, step: MigrationStep) {
    if (this.crashAfter === step) {
      this.crashAfter = undefined;
      // persist progress so far (the earlier tx committed), then die
      const saved = structuredClone(c);
      const savedPools = structuredClone(this.pools);
      throw Object.assign(new Error(`Crash after ${step}`), { saved, savedPools });
    }
  }

  /** Simulates "the earlier transactions did commit": apply what a crash left on-chain. */
  restoreAfterCrash(err: any) {
    this.coins.set(err.saved.mint, err.saved);
    this.pools = err.savedPools;
  }
}

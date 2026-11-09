import assert from "node:assert/strict";
import { LaunchpadProgram } from "./program.ts";

const ONE_K_SOL = 10n ** 12n;
const p = new LaunchpadProgram();
p.create("MINT1", "alice");
assert.throws(() => p.create("MINT1", "eve"), /AlreadyExists/);
p.buy("sig1", "bob", "MINT1", 10_000_000_000_000n, 285_042_334n); // exact total from chapter 2
assert.throws(() => p.migrate("bot1", "MINT1"), /CurveNotComplete/);
p.buy("sig2", "carol", "MINT1", 900_000_000_000_000n, ONE_K_SOL); // partial fill completes the curve
assert.equal(p.coins.get("MINT1")!.status, "Complete");
assert.throws(() => p.buy("sig3", "dave", "MINT1", 1n, ONE_K_SOL), /CurveComplete/);

// two bots race to migrate
assert.equal(p.migrate("bot1", "MINT1"), "migrated");
assert.equal(p.migrate("bot2", "MINT1"), "noop");
assert.equal(p.pools.size, 1);
assert.equal(p.events.filter(e => e.kind === "MigrateEvent").length, 1);
const pool = p.pools.get("pool:MINT1")!;
console.log("pool after migrate:", pool);

// crash halfway, then resume
const q = new LaunchpadProgram();
q.create("MINT2", "alice");
q.buy("s1", "bob", "MINT2", 793_100_000_000_000n, ONE_K_SOL);
const solInCurve = q.coins.get("MINT2")!.curve.realSolReserves;
q.crashAfter = "PoolCreated";
try { q.migrate("bot1", "MINT2"); assert.fail("should crash"); }
catch (e: any) { assert.match(e.message, /Crash after PoolCreated/); q.restoreAfterCrash(e); }
assert.equal(q.coins.get("MINT2")!.step, "PoolCreated");
assert.equal(q.migrate("bot2", "MINT2"), "migrated"); // resumes from the saved step
assert.equal(q.migrate("bot3", "MINT2"), "noop");
assert.equal(q.pools.size, 1);
assert.equal(q.pools.get("pool:MINT2")!.sol, solInCurve); // money moved exactly once
assert.equal(q.events.filter(e => e.kind === "MigrateEvent").length, 1);

// failed instruction rolls back fully
const r = new LaunchpadProgram();
r.create("MINT3", "a");
const before = structuredClone(r.coins.get("MINT3")!.curve);
assert.throws(() => r.buy("x", "u", "MINT3", 10_000_000_000_000n, 285_042_333n), /ExceededSlippage/);
assert.deepEqual(r.coins.get("MINT3")!.curve, before);
console.log("events:", p.events.map(e => `${e.seq}:${e.kind}`).join(" "));
console.log("program: all checks passed");

// Chapter 8 — server-built candles + a gap-free "snapshot then live" merge. OUR CLONE'S DESIGN.
export interface Trade { seq: number; time: number; price: number; volume: number }
export interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }

/** Bucket trades into candles (time in seconds, bucket = 60 for 1-minute candles). */
export function buildCandles(trades: Trade[], bucket = 60): Candle[] {
  const out = new Map<number, Candle>();
  for (const t of [...trades].sort((a, b) => a.seq - b.seq)) {
    const time = Math.floor(t.time / bucket) * bucket;
    const c = out.get(time);
    if (!c) out.set(time, { time, open: t.price, high: t.price, low: t.price, close: t.price, volume: t.volume });
    else { c.high = Math.max(c.high, t.price); c.low = Math.min(c.low, t.price); c.close = t.price; c.volume += t.volume; }
  }
  return [...out.values()].sort((a, b) => a.time - b.time);
}

/** Apply one live trade to the last candle (what the browser does on each WebSocket message). */
export function applyLive(candles: Candle[], t: Trade, bucket = 60): Candle {
  const time = Math.floor(t.time / bucket) * bucket;
  const last = candles[candles.length - 1];
  if (last && last.time === time) {
    last.high = Math.max(last.high, t.price); last.low = Math.min(last.low, t.price);
    last.close = t.price; last.volume += t.volume; return last;
  }
  const c = { time, open: t.price, high: t.price, low: t.price, close: t.price, volume: t.volume };
  candles.push(c); return c;
}

/**
 * Client merge: 1) subscribe and BUFFER live trades, 2) fetch the snapshot (which says "as_of_seq"),
 * 3) drop buffered trades with seq <= as_of_seq, apply the rest in order, 4) then apply live directly.
 */
export class ChartFeed {
  candles: Candle[] = [];
  private buffer: Trade[] = [];
  private asOfSeq: number | null = null;
  onLive(t: Trade) {
    if (this.asOfSeq === null) { this.buffer.push(t); return; }
    if (t.seq <= this.asOfSeq) return; // already inside the snapshot: never count twice
    this.asOfSeq = t.seq;
    applyLive(this.candles, t);
  }
  onSnapshot(snapshot: { asOfSeq: number; candles: Candle[] }) {
    this.candles = structuredClone(snapshot.candles);
    this.asOfSeq = snapshot.asOfSeq;
    for (const t of this.buffer.sort((a, b) => a.seq - b.seq)) this.onLive(t);
    this.buffer = [];
  }
}

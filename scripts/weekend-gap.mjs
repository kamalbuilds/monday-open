// Weekend gap: Friday regular-session close vs the next Monday regular-session open, in basis points.
// Source: Yahoo Finance chart API (daily bars, unadjusted OHLC), fetched live on each run.
// Usage: node scripts/weekend-gap.mjs [--symbol TSLA] [--years 3]
// Writes scripts/data/<symbol>-weekend-gap.csv (one row per weekend) and a .summary.json beside it.
// Only Friday -> Monday pairs three calendar days apart count, so holiday weekends never enter the sample.
import fs from "fs";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const SYMBOL = arg("symbol", "TSLA").toUpperCase();
const YEARS = Number(arg("years", 3));
const url = `https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?range=${YEARS}y&interval=1d`;
const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
const r = (await res.json()).chart.result?.[0];
if (!r) throw new Error("no chart result for " + SYMBOL);
const q = r.indicators.quote[0];
const day = (t) => new Date(t * 1000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const bars = r.timestamp.map((t, i) => ({ date: day(t), open: q.open[i], close: q.close[i] })).filter((b) => b.open != null && b.close != null);

const rows = [];
for (let i = 1; i < bars.length; i++) {
  const fri = bars[i - 1], mon = bars[i];
  const dow = (d) => new Date(d + "T12:00:00Z").getUTCDay();
  const span = (new Date(mon.date) - new Date(fri.date)) / 864e5;
  if (dow(fri.date) === 5 && dow(mon.date) === 1 && span === 3)
    rows.push({ friday: fri.date, monday: mon.date, fri_close: fri.close, mon_open: mon.open, gap_bps: Math.round(((mon.open - fri.close) / fri.close) * 1e4 * 10) / 10 });
}
if (rows.length < 20) throw new Error(`only ${rows.length} weekends parsed, refusing to publish a figure`);

const abs = rows.map((x) => Math.abs(x.gap_bps)).sort((a, b) => a - b);
const pct = (p) => abs[Math.min(abs.length - 1, Math.floor(p * abs.length))];
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const summary = {
  symbol: SYMBOL, source: url.replace(/\?.*/, "") + "?range=" + YEARS + "y&interval=1d", fetched_at: new Date().toISOString(),
  weekends: rows.length, first: rows[0].friday, last: rows[rows.length - 1].monday,
  mean_abs_bps: Math.round(mean(abs)), median_abs_bps: Math.round(pct(0.5)), p90_abs_bps: Math.round(pct(0.9)), max_abs_bps: Math.round(abs[abs.length - 1]),
  share_over_100bps: Math.round((abs.filter((x) => x > 100).length / abs.length) * 100),
};
fs.mkdirSync(new URL("./data/", import.meta.url), { recursive: true });
const base = new URL(`./data/${SYMBOL.toLowerCase()}-weekend-gap`, import.meta.url);
fs.writeFileSync(base.pathname + ".csv", "friday,monday,fri_close,mon_open,gap_bps\n" + rows.map((x) => `${x.friday},${x.monday},${x.fri_close.toFixed(2)},${x.mon_open.toFixed(2)},${x.gap_bps}`).join("\n") + "\n");
fs.writeFileSync(base.pathname + ".summary.json", JSON.stringify(summary, null, 2) + "\n");
console.log(summary);

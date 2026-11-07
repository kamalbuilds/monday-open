import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight, Copy, Droplets, Lock, Radio, Timer } from "lucide-react";
import "./styles.css";
import { kp, pid, short, explorer, usd, FRI, fund, balance, runWeekend, liveBook, openPrints, slot, auctionOrders } from "./chain.js";

// MONDAY OPEN terminal (docs/design/DESIGN.md). Chain logic lives in chain.js.
const Ctx = createContext(null);
const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
function useTerminal() {
  const [run, setRun] = useState({ phase: -1, rows: [], msg: "", result: null, busy: false });
  const [tape, setTape] = useState([]);
  const [book, setBook] = useState(null);
  const [prints, setPrints] = useState([]);
  const [bal, setBal] = useState(null);
  const [sl, setSl] = useState(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [px, setPx] = useState("384.10");
  const [last, setLast] = useState(null);
  const log = (msg, sig, tone = "info") => setTape((t) => [{ id: Date.now() + Math.random(), at: clock(), msg, sig, tone }, ...t].slice(0, 40));
  const refreshBal = () => balance().then((l) => setBal(l / 1e9)).catch(() => {});
  useEffect(() => {
    const load = () => { if (window.__moBusy) return; liveBook().then(setBook).catch(() => {}); openPrints().then((ps) => { setPrints(ps); const l = ps[ps.length - 1]; if (l) auctionOrders(l.a).then((orders) => setLast({ ...l, n: ps.length, orders })).catch(() => {}); }).catch(() => {}); slot().then(setSl).catch(() => {}); };
    load(); refreshBal(); fund().then(refreshBal);
    const a = setInterval(load, 30000), b = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  const start = async (side, priceUsd, qty) => {
    if (run.busy) return;
    window.__moBusy = true;
    setRun({ phase: -1, rows: [], msg: "Checking burner balance…", result: null, busy: true });
    log(`Order entry: ${side} ${qty} TSLAx, limit $${Number(priceUsd).toFixed(2)}`, null, side === "Buy" ? "bid" : "ask");
    let lastSig = null;
    try {
      if (!(await fund((m) => setRun((r) => ({ ...r, msg: m }))))) throw new Error(`Burner has no devnet SOL. Send some to ${kp.publicKey.toBase58()}`);
      await runWeekend(side === "Buy" ? 0 : 1, Math.round(Number(priceUsd) * 10), Math.max(1, Math.min(3, qty)), (u) => {
        setRun((r) => ({ ...r, ...u }));
        if (u.sig && u.sig !== lastSig) { lastSig = u.sig; log(u.msg.replace(/ [1-9A-HJ-NP-Za-km-z]{4}\.\.\.[1-9A-HJ-NP-Za-km-z]{4}/, ""), u.sig, u.phase === 4 ? "bid" : "info"); }
      });
    } catch (e) { const m = "Error: " + (e?.message ?? e); setRun((r) => ({ ...r, msg: m })); log(m, null, "ask"); }
    window.__moBusy = false;
    setRun((r) => ({ ...r, busy: false })); refreshBal();
  };
  const fundNow = async () => { log("Faucet drip requested for burner"); const ok = await fund(); await refreshBal(); log(ok ? "Burner funded" : "Faucet could not fund the burner", null, ok ? "bid" : "ask"); };
  return { run, tape, book, prints, bal, sl, now, start, fundNow, px, setPx, last };
}
const bps = (px) => Math.round(((px - FRI) / FRI) * 10000);
const bpsTxt = (b) => `${b >= 0 ? "+" : ""}${b} bps`;
const mmss = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60); return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const Chip = ({ k = "mute", children }) => <span className={`chip chip-${k}`}>{children}</span>;
const Hash = ({ kind = "tx", id, label }) => <a className="hash" href={explorer(kind, id)} target="_blank" rel="noopener" title={id}>{label ?? short(id)}<ArrowUpRight size={12} /></a>;

function window_(book, now) {
  if (!book) return { k: "mute", label: "Loading", left: null };
  if (now < book.commitEnd) return { k: "cyan", label: "Sealing window", left: book.commitEnd - now };
  if (now < book.revealEnd) return { k: "amber", label: "Reveal window", left: book.revealEnd - now };
  return book.cleared ? { k: "bid", label: "Printed", left: null } : { k: "mute", label: "Seeder idle", left: null };
}

function TopBar() {
  const { bal, sl } = useContext(Ctx);
  return <header className="bar">
    <div className="logo"><span className="logo-mark" aria-hidden="true"><i /><i /><i /></span><span>MONDAY&nbsp;OPEN</span></div>
    <span className="bar-sym mono">TSLAx / SOL·devnet</span>
    <a className="bar-m" href="#order">Try it</a>
    <nav className="bar-nav"><a href="#terminal">Terminal</a><a href="#blotter">Blotter</a><a href="#method">Method</a><a href="#order">Try it</a></nav>
    <div className="bar-right">
      <span className="bar-meta mono">slot {sl ? sl.toLocaleString("en-US") : "…"}</span>
      <Chip k="bid"><Radio size={12} /> Devnet</Chip>
      <Hash kind="address" id={kp.publicKey.toBase58()} label={`wallet ${short(kp.publicKey.toBase58())} · ${bal === null ? "…" : bal.toFixed(3)} SOL`} />
    </div>
  </header>;
}

function Ticker() {
  const { book, prints, run, now } = useContext(Ctx);
  const w = window_(book, now), last = book?.lastPrint, res = run.result;
  const gaps = prints.map((p) => Math.abs(bps(p.px)));
  return <section className="ticker" aria-label="Market summary">
    <div className="tick"><span className="lbl">Friday close</span><span className="val mono">{usd(FRI)}</span><span className="sub">reference for every round</span></div>
    <div className="tick tick-hero"><span className="lbl">Last uniform print</span><span className="val mono">{last ? usd(last) : "-"}</span>{last ? <Chip k={last >= FRI ? "bid" : "ask"}>{bpsTxt(bps(last))}</Chip> : <span className="sub">seeded round</span>}</div>
    <div className="tick"><span className="lbl">Open gap, max</span><span className="val mono">{gaps.length ? (() => { const g = prints.map((p) => bps(p.px)).reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0); return bpsTxt(g); })() : "-"}</span><span className="sub">largest move vs Friday, {prints.length} prints</span></div>
    <div className="tick"><span className="lbl">Shares crossed</span><span className="val mono">{prints.reduce((t, p) => t + p.q, 0)}</span><span className="sub">across seeded rounds</span></div>
    <div className="tick"><span className="lbl">Seeded auctions</span><span className="val mono">{book ? book.rounds : "-"}</span><span className="sub">{prints.length} with a clearing print · <Chip k={w.k}>{w.left !== null ? `${w.label} ${mmss(w.left)}` : w.label}</Chip></span></div>
  </section>;
}

function OrderEntry() {
  const { run, start, px, setPx } = useContext(Ctx);
  const [side, setSide] = useState("Buy");
  const [qty, setQty] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const p = Math.max(0, Number(px) || 0);
  const lock = side === "Buy" ? Math.round(p * 10) * qty * 1000 / 1e9 : 0.000001;
  const q = (n) => setQty(Math.max(1, Math.min(3, n)));
  const vs = bps(Math.round(p * 10));
  return <section className="tile card entry" id="order" aria-label="Order entry">
    <header className="tile-h"><h2>Order entry</h2></header>
    <div className="toggle" role="radiogroup" aria-label="Side">
      {["Buy", "Sell"].map((s) => <button key={s} role="radio" aria-checked={side === s} className={side === s ? (s === "Buy" ? "is-bid" : "is-ask") : ""} onClick={() => setSide(s)}>{s === "Buy" ? "Bid" : "Ask"}</button>)}
    </div>
    <label className="in-l" htmlFor="px">Limit (USD per share)</label>
    <div className="in"><input id="px" className="mono" type="number" step="0.1" min="0.1" value={px} onChange={(e) => setPx(e.target.value)} /><span className="in-sfx mono">{bpsTxt(vs)}</span></div>
    <div className="nudges">{[-50, -10, 10, 50].map((d) => <button key={d} className="btn-sec mono" onClick={() => setPx((Math.round(FRI * (1 + d / 10000)) / 10).toFixed(2))}>{d > 0 ? "+" : ""}{d}bp</button>)}</div>
    <label className="in-l" htmlFor="qty">Quantity (shares, max 3)</label>
    <div className="qty"><button className="btn-sec" aria-label="Fewer shares" onClick={() => q(qty - 1)}>−</button><input id="qty" className="mono" type="number" min="1" max="3" value={qty} onChange={(e) => q(Number(e.target.value) || 1)} /><button className="btn-sec" aria-label="More shares" onClick={() => q(qty + 1)}>+</button></div>
    {confirm && !run.busy ? <div className="confirm" role="dialog" aria-label="Confirm sealed order">
      <p><b>Check before sealing.</b> Nobody can see your limit until the reveal, and you can't change it after sealing. We will lock <b className="mono">{lock.toFixed(6)} SOL</b> escrow on devnet; anything you don't fill is refunded at settlement.</p>
      <div className="confirm-a"><button className="btn-primary" onClick={() => { setConfirm(false); start(side, px, qty); }}><Lock size={16} /> Confirm and seal</button><button className="btn-ghost" onClick={() => setConfirm(false)}>Edit order</button></div>
    </div> : <button className="btn-primary" onClick={() => setConfirm(true)} disabled={run.busy}>{run.busy ? <><Timer size={16} /> Weekend in progress…</> : <><Lock size={16} /> Seal and run to the open</>}</button>}
    <dl className="kv">
      <div><dt>Notional</dt><dd className="mono">${(p * qty).toFixed(2)}</dd></div>
      <div><dt title="Devnet scale: $1 of notional escrows 0.00001 SOL">Escrow on devnet</dt><dd className="mono">{lock.toFixed(6)} SOL</dd></div>
      <div><dt title="Five transactions plus rent for one auction and four order accounts (not reclaimed yet)">Fees and rent, est.</dt><dd className="mono">≈0.012 SOL</dd></div>
    </dl>
    <p className="conseq">{side === "Buy" ? <>If Monday clears at or below <b className="mono">{usd(Math.round(p * 10))}</b>, you buy up to <b className="mono">{qty}</b> share{qty > 1 ? "s" : ""} at the single clearing price, never above your limit. Your limit is <b className={vs >= 0 ? "up-t" : "dn-t"}>{bpsTxt(vs)}</b> vs Friday close.</> : <>If Monday clears at or above <b className="mono">{usd(Math.round(p * 10))}</b>, you sell up to <b className="mono">{qty}</b> share{qty > 1 ? "s" : ""} at the single clearing price, never below your limit. Your limit is <b className={vs >= 0 ? "up-t" : "dn-t"}>{bpsTxt(vs)}</b> vs Friday close.</>}</p>
    <p className="entry-msg" aria-live="polite">{run.msg || "One press tops up the burner wallet from the faucet if needed, seals your order next to three seeded orders, then reveals, clears and settles them on devnet."}</p>
  </section>;
}

function Chart() {
  const { prints, book } = useContext(Ctx);
  const live = prints.length >= 2;
  const narrow = useNarrow();
  const W = narrow ? 360 : 640, H = narrow ? 200 : 170, L0 = 64, R0 = W - 16, T0 = 22, B0 = H - 38;
  let body = null;
  if (live) {
    const vals = [...prints.map((p) => p.px), FRI], lo = Math.floor((Math.min(...vals) - 20) / 100) * 100, hi = Math.ceil((Math.max(...vals) + 20) / 100) * 100;
    const step = (hi - lo) / 100 > 4 ? 200 : 100;
    const X = (i) => L0 + 50 + (i / (prints.length - 1)) * (R0 - L0 - 100), Y = (v) => B0 - ((v - lo) / (hi - lo)) * (B0 - T0);
    const ticks = []; for (let v = lo; v <= hi; v += step) ticks.push(v);
    const friY = Y(FRI);
    const fmt = (t) => new Date(t * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    body = <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Clearing prices of seeded devnet rounds against the Friday close">
      {ticks.map((v) => <g key={v}><line x1={L0} x2={R0} y1={Y(v)} y2={Y(v)} className="grid" /><text x={L0 - 8} y={Y(v) + 4} textAnchor="end" className="cx-ax">{usd(v)}</text></g>)}
      <line x1={L0} x2={R0} y1={friY} y2={friY} className="fri" />
      {prints.map((p, i) => { const x = X(i), y = Y(p.px), up = p.px >= FRI; return <g key={p.a}><line x1={x} x2={x} y1={friY} y2={y} className={up ? "stem up" : "stem dn"} /><rect x={x - 5} y={y - 5} width="10" height="10" className={up ? "dot up" : "dot dn"}><title>{`${fmt(p.t)} · ${usd(p.px)} · ${bpsTxt(bps(p.px))} vs Friday`}</title></rect><text x={up ? x : x + 10} y={up ? y - 10 : y + 4} textAnchor={up ? "middle" : "start"} className="pt-l">{usd(p.px)}</text><text x={x} y={H - 20} textAnchor="middle" className="cx-ax"><tspan x={x}>{new Date(p.t * 1000).toLocaleDateString([], { month: "short", day: "numeric" })}</tspan><tspan x={x} dy="16">{new Date(p.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</tspan></text></g>; })}
    </svg>;
  }
  return <section className="tile card chart-tile" aria-label="Open prints">
    <header className="tile-h"><h2>Uniform open prints <span className="h-sub">one point per round, not to time scale</span></h2>{live ? <span className="legend mono"><i /> Friday close {usd(FRI)}</span> : <Chip k="mute">Waiting for prints</Chip>}</header>
    {live ? <div className="plot2">{body}</div> : <div className="plot-empty">No cleared seeded rounds on chain yet. Each round the seeder clears adds one point here, so nothing on this chart is simulated.</div>}
    {!live && <footer className="tile-f mono"><span>{book ? `${book.rounds} seeded auctions found` : "reading devnet…"}</span></footer>}
  </section>;
}

const PH = ["Seal", "Reveal", "Clear", "Settle"];
const STEP_T = ["now", "at 9 s", "at 15 s", "by ~20 s"];
function useNarrow() {
  const q = "(max-width: 760px)";
  const [n, setN] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q), f = () => setN(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return n;
}

function Cross() {
  const { last } = useContext(Ctx);
  if (!last) return <section className="tile card cross-tile"><header className="tile-h"><h2>Where bids met asks</h2></header><div className="cross-empty">Reading the last seeded auction…</div></section>;
  const os = last.orders.filter((o) => o.revealed);
  const bids = os.filter((o) => o.side === 0).sort((a, b) => b.price - a.price), asks = os.filter((o) => o.side === 1).sort((a, b) => a.price - b.price);
  const prices = os.map((o) => o.price).concat(last.px), lo = Math.min(...prices) - 10, hi = Math.max(...prices) + 10;
  const tq = Math.max(bids.reduce((t, o) => t + o.qty, 0), asks.reduce((t, o) => t + o.qty, 0), 1);
  const narrow = useNarrow();
  const W = narrow ? 340 : 600, H = 150, X = (q) => 70 + (q / (tq * 1.6)) * (W - 60), Y = (v) => H - 16 - ((v - lo) / (hi - lo)) * (H - 32);
  const steps = (arr, end) => { let q = 0, d = `M ${X(0)} ${Y(arr[0]?.price ?? last.px)}`; for (const o of arr) { d += ` V ${Y(o.price)}`; q += o.qty; d += ` H ${X(q)}`; } return d + ` V ${Y(end)} H ${W - 20}`; };
  const mq = last.q;
  return <section className="tile card cross-tile" aria-label="Where bids met asks"><header className="tile-h"><h2>Where bids met asks <span className="h-sub">last seeded auction #{last.n}</span></h2><Hash kind="address" id={last.a} /></header><p className="cross-cap">Bids and asks cross at <b className="mono">{usd(last.px)}</b> for <b className="mono">{mq}</b> shares, so every fill in this auction printed at that one price. Across: cumulative shares. Up: limit price.</p><div className="cross">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cumulative bids and asks crossing at the clearing price">
      <line x1="70" x2={W - 20} y1={Y(last.px)} y2={Y(last.px)} className="cx-line" />
      <path d={steps(bids, lo)} className="cx-bid" /><path d={steps(asks, hi)} className="cx-ask" />
      {Array.from({ length: Math.floor(tq * 1.6) + 1 }, (_, q) => <text key={q} x={X(q)} y={H - 2} textAnchor="middle" className="cx-ax">{q}</text>)}<text x="4" y={Y(last.px) + 4} className="cx-t">{usd(last.px)}</text><line x1={X(mq)} x2={X(mq)} y1="8" y2={H - 16} className="cx-q" /><circle cx={X(mq)} cy={Y(last.px)} r="5" className="cx-dot" /><text x={X(mq) + 10} y={Y(last.px) - 8} className="cx-t">{mq} @ {usd(last.px)}</text>
            
      {[hi, lo].map((v) => <text key={v} x="2" y={Y(v) + 4} className="cx-ax">{usd(v)}</text>)}
    </svg>
    <div className="cross-k mono"><span className="k-bid">Bids {bids.map((o) => `${o.qty}@${usd(o.price)}`).join("  ")}</span><span className="k-ask">Asks {asks.map((o) => `${o.qty}@${usd(o.price)}`).join("  ")}</span></div>
  </div></section>;
}

function Clock() {
  const { run, px } = useContext(Ctx);
  const lim = Math.round((Number(px) || 0) * 10);
  const res = run.result, cur = run.phase;
  return <section className="tile card clock" aria-label="Auction clock">
    <header className="tile-h"><h2>Your auction</h2><Chip k={run.busy ? "amber" : res ? "bid" : "mute"}>{run.busy ? "Live" : res ? "Settled" : "Waiting for your seal"}</Chip></header>
    <div className={`track ${cur < 0 && !res && !run.busy ? "idle" : ""}`}>{PH.map((p, i) => { const done = cur === 4 || i < cur, on = i === cur && cur < 4, next = false; return <div key={p} className={`seg ${done ? "done" : ""} ${on ? "on" : ""} ${cur < 0 && !res && !run.busy && i === 0 ? "next" : ""}`}><span className="seg-bar" /><span className="seg-l mono">{p}</span><span className="seg-t mono">{STEP_T[i]}</span></div>; })}</div>
    {res || run.busy ? <div className="clear-hero">
      <span className="lbl">{res?.m ? "Your clearing price" : "Your limit, sealed until the reveal"}</span><span className="big mono">{res?.m ? usd(res.px) : run.rows.length ? "••••" : "…"}</span>
      <span className="sub">{res ? (res.m ? <>{res.m} share{res.m > 1 ? "s" : ""} crossed · {bpsTxt(res.bps)} vs Friday · you {res.you ? `filled ${res.you}` : "were refunded"}</> : "No cross: every order refunded") : run.msg}</span>
    </div> : <p className="clock-idle">Your clearing price and fill appear here after settlement. The chart above shows a finished seeded auction.</p>}
  </section>;
}

function Wallet() {
  const { bal, fundNow, run } = useContext(Ctx);
  const a = kp.publicKey.toBase58();
  return <section className="tile card wallet" id="wallet" aria-label="Wallet">
    <header className="tile-h"><h2>Burner wallet</h2><Chip k={bal === null ? "mute" : bal >= 0.015 ? "bid" : "mute"}>{bal === null ? "Checking" : bal >= 0.015 ? "Ready" : "Tops up on run"}</Chip></header>
    <div className="w-bal"><span className="val mono">{bal === null ? "-" : bal.toFixed(3)}</span><span className="sub">devnet SOL · a run needs about 0.015</span></div>
    <Hash kind="address" id={a} label={short(a)} />
    <div className="w-act"><button className="btn-sec" onClick={fundNow} disabled={run.busy}><Droplets size={14} /> Pre-fund now</button><button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(a)}><Copy size={14} /> Copy address</button></div>
    <p className="sub">Created in this browser and kept in local storage. Devnet only; never send real funds.</p>
  </section>;
}

function SeedTape() {
  const { prints } = useContext(Ctx);
  const ev = [...prints].reverse().slice(0, 3).map((p, i) => ({ id: p.a, at: new Date(p.t * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), msg: `#${prints.length - i} ${usd(p.px)} ×${p.q}`, a: p.a, up: p.px >= FRI }));
  return <ol className="tape-list">{ev.map((e) => <li key={e.id} className="tape-row"><span className="mono dim">{e.at}</span><span className="tape-msg">{e.msg} <span className={e.up ? "up-t" : "dn-t"}>{e.up ? "▲" : "▼"}</span></span><Hash kind="address" id={e.a} label={`auction ${short(e.a)}`} /></li>)}</ol>;
}

function Tape() {
  const { tape, prints } = useContext(Ctx);
  const hist = [];
  void [...prints].reverse().map((p) => ({ id: p.a, at: new Date(p.t * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), msg: `Seeded round printed ${usd(p.px)} x ${p.q} (${bpsTxt(bps(p.px))})`, acct: p.a, tone: p.px >= FRI ? "bid" : "ask" }));
  return <section className="tile card tape" aria-label="Event tape">
    <header className="tile-h"><h2>Tape</h2>{tape.length > 0 && <Chip k="amber">{tape.length} events</Chip>}</header>
    {tape.length === 0 && <SeedTape />}
    {tape.length === 0 && <dl className="acct"><div><dt>Program</dt><dd><Hash kind="address" id={pid.toBase58()} /></dd></div><div><dt>Seeder</dt><dd><Hash kind="address" id="GhyXbXu7y3DVptMiSPBri12rGMxJBKtex4hWSa6bfg9j" /></dd></div><div><dt>Faucet</dt><dd><Hash kind="address" id="6jnznfgZ6CeJeq8WxdyrZXeL1ENuAihcDU5sFjtcyB11" /></dd></div></dl>}
    <ol className="tape-list">
      {[...tape, ...hist].map((e) => <li key={e.id} className="tape-row"><span className="mono dim">{e.at} </span><span className="tape-msg">{e.msg}</span>{e.sig && <Hash id={e.sig} />}{e.acct && <Hash kind="address" id={e.acct} label={`auction ${short(e.acct)}`} />}</li>)}
    </ol>
  </section>;
}

const ST = { Sealing: "cyan", Sealed: "cyan", Revealed: "amber", Filled: "bid", Refunded: "mute" };
function Blotter() {
  const { run, last } = useContext(Ctx);
  const res = run.result, seeded = run.rows.length === 0 && last;
  return <section className="tile card blotter" id="blotter" aria-label="Fill blotter">
    <header className="tile-h"><h2>Fill blotter{seeded ? <span className="h-sub">last seeded auction #{last.n}</span> : null}</h2>{run.auction ? <Hash kind="address" id={run.auction} label={`auction ${short(run.auction)}`} /> : seeded ? <Hash kind="address" id={last.a} label={`auction ${short(last.a)}`} /> : null}</header>
    <div className="blot-grid"><div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Trader</th><th>Side</th><th className="r">Qty</th><th className="r">Limit</th><th className="r">Fill</th><th className="r">Status</th></tr></thead>
      <tbody>
        {seeded && last.orders.map((o) => <tr key={o.i}><td><Hash kind="address" id={o.trader} /></td><td><Chip k={o.side ? "ask" : "bid"}>{o.side ? "Ask" : "Bid"}</Chip></td><td className="r mono">{o.qty}</td><td className="r mono">{o.revealed ? usd(o.price) : "••••"}</td><td className="r mono">{o.filled ? `${o.filled} @ ${usd(last.px)}` : "-"}</td><td className="r"><Chip k={o.filled ? "bid" : "mute"}>{o.filled ? "Filled" : "Refunded"}</Chip></td></tr>)}
        {run.rows.length === 0 && !last && <tr><td colSpan="6" className="tbl-empty">Your order and three seeded orders land here. Limits stay hidden until the reveal.</td></tr>}
        {run.rows.map((o, i) => <tr key={i}><td>{o.who}</td><td><Chip k={o.side ? "ask" : "bid"}>{o.side ? "Ask" : "Bid"}</Chip></td><td className="r mono">{o.qty}</td><td className="r mono">{o.state.startsWith("Seal") ? "••••" : usd(o.price)}</td><td className="r mono">{o.filled ? `${o.filled} @ ${usd(res.px)}` : "-"}</td><td className="r"><Chip k={ST[o.state] ?? "mute"}>{o.state}</Chip></td></tr>)}
      </tbody>
    </table></div>
    <BlotSum />
    </div>
  </section>;
}

function BlotSum() {
  const { run, last } = useContext(Ctx);
  const res = run.result;
  const rows = run.rows.length ? run.rows : last ? last.orders : [];
  const px = res?.m ? res.px : !run.rows.length && last ? last.px : null;
  const crossed = res ? res.m : !run.rows.length && last ? last.q : null;
  const filled = rows.filter((o) => (o.filled ?? 0) > 0).length;
  return <dl className="bsum">
    <div><dt>Clearing price</dt><dd className="mono acc">{px ? usd(px) : "-"}</dd></div>
    <div><dt>Vs Friday close</dt><dd className="mono">{px ? bpsTxt(bps(px)) : "-"}</dd></div>
    <div><dt>Shares crossed</dt><dd className="mono">{crossed ?? "-"}</dd></div>
    <div><dt>Orders filled / refunded</dt><dd className="mono">{rows.length ? `${filled} / ${rows.length - filled}` : "-"}</dd></div>
    <div><dt>Fills at or better than limit</dt><dd className="mono">{px && rows.length && rows[0].price !== undefined ? `${rows.filter((o) => (o.filled ?? 0) > 0 && (o.side ? o.price <= px : o.price >= px)).length} of ${filled}` : "-"}</dd></div>
  </dl>;
}

function Method() {
  return <section className="spec tile card" id="method">
    <header className="tile-h"><h2>How the auction works</h2></header>
    <div className="spec-grid">
      <dl className="spec-dl">
        <div><dt>Seal</dt><dd>The chain holds only a SHA-256 commitment and an escrow deposit per order. Limits stay invisible while trading against them would still pay.</dd></div>
        <div><dt>Reveal</dt><dd>Each trader opens their commitment. A mismatched hash or an under-funded bid is rejected by the program.</dd></div>
        <div><dt>Clear</dt><dd>The program picks the one price that crosses the most shares. Every fill, bid or ask, settles at that price.</dd></div>
        <div><dt>Settle</dt><dd>The vault pays fills, splits the heavy side pro rata and refunds everything else.</dd></div>
        <div><dt>Why</dt><dd>Our team estimate puts the typical weekend move at about ±385 bps between Friday's close and Monday's open, on thin books with no underlying market.</dd></div>
      </dl>
      <div className="spec-side">
        <div className="judge" id="judges"><h3>Try it in 20 seconds</h3><ol><li>Keep the default bid, or set a limit and size.</li><li>Press <b>Seal and run to the open</b>. No wallet extension needed.</li><li>Watch the tape fill with real devnet transactions, then read the clearing price and the blotter.</li></ol></div>
        <div className="model"><h3>How it earns</h3><p>A few basis points on cleared notional, shared with the venue or wallet that routes orders into the auction.</p></div>
      </div>
    </div>
  </section>;
}

function App() {
  const t = useTerminal();
  return <Ctx.Provider value={t}><div className="app">
    <TopBar />
    <Ticker />
    <main className="term" id="terminal">
      <OrderEntry />
      <div className="center"><Cross /><Clock /><Chart /></div>
      <div className="right"><Wallet /><Tape /></div>
    </main>
    <Blotter />
    <Method />
    <footer className="foot"><span>MONDAY OPEN · sealed weekend batch auction · Solana devnet</span><Hash kind="address" id={pid.toBase58()} label={`program ${short(pid.toBase58())}`} /></footer>
  </div></Ctx.Provider>;
}
createRoot(document.getElementById("root")).render(<App />);

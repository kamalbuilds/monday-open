import React, { useState, useEffect, createContext, useContext } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, ArrowDownRight, ArrowRight, Check, ChevronDown, ChevronRight,
  CircleHelp, Clock3, LockKeyhole, Menu, Wallet, ShieldCheck, BarChart3, Link2
} from "lucide-react";
import "./styles.css";
import { kp, pid, short, explorer, usd, FRI, fund, balance, runWeekend, liveBook, openPrints } from "./chain.js";

// Shared demo state: the visitor's one-click weekend run + the seeded rolling book.
const Demo = createContext(null);
function useDemoState() {
  const [run, setRun] = useState({ phase: -1, rows: [], msg: "", result: null, busy: false });
  const [book, setBook] = useState(null);
  const [bal, setBal] = useState(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const refreshBal = () => balance().then((l) => setBal(l / 1e9)).catch(() => {});
  useEffect(() => {
    const load = () => { if (!window.__moBusy) liveBook().then(setBook).catch(() => {}); };
    load(); refreshBal();
    fund().then(refreshBal);
    const a = setInterval(load, 15000), b = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  const start = async (side, priceUsd, qty) => {
    if (run.busy) return;
    window.__moBusy = true;
    setRun((r) => ({ ...r, busy: true, result: null, msg: "Checking burner balance..." }));
    try {
      if (!(await fund((m) => setRun((r) => ({ ...r, msg: m }))))) throw new Error(`Couldn't fund the burner. Send devnet SOL to ${kp.publicKey.toBase58()}`);
      await runWeekend(side === "Buy" ? 0 : 1, Math.round(Number(priceUsd) * 10), Math.max(1, Math.min(3, qty)), (u) => setRun((r) => ({ ...r, ...u })));
    } catch (e) { setRun((r) => ({ ...r, msg: "Error: " + (e?.message ?? e) })); }
    window.__moBusy = false;
    setRun((r) => ({ ...r, busy: false })); refreshBal();
  };
  const fundNow = async () => { setRun((r) => ({ ...r, msg: "Funding burner with devnet SOL..." })); const ok = await fund(); await refreshBal(); setRun((r) => ({ ...r, msg: ok ? "Burner funded." : `Couldn't fund the burner. Send devnet SOL to ${kp.publicKey.toBase58()}` })); };
  return { run, book, bal, now, start, fundNow };
}
const dur = (s) => { s = Math.max(0, s); const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m` : `${m}m ${String(s % 60).padStart(2, "0")}s`; };
const money = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const chartPoints = "0,76 18,68 34,72 48,55 62,62 76,43 92,48 106,35 122,42 138,27 154,37 170,29 188,42 202,54 218,43 234,51 250,35 266,29 282,18 298,25 314,11 330,20 346,4 362,15 378,24 394,20 410,33 426,42 442,49";

function Header() {
  return <header className="topbar">
    <div className="brand"><span className="brand-dot" /> <span>MONDAY OPEN</span></div>
    <div className="network"><span className="online-dot" /> Devnet <ChevronDown size={14} /></div>
    <button className="icon-button" aria-label="Open menu"><Menu size={23} /></button>
    <div className="chainline">Solana devnet <span>·</span> Program <a href={explorer("address", pid.toBase58())} target="_blank" rel="noopener">{short(pid.toBase58())}</a></div>
  </header>;
}

// Live data swap (branch live-chart): same markup and classes as kaverimeshram's chart.
// Plots real seeded open prints vs the Friday close; falls back to the illustrative series
// until at least 2 prints exist on chain.
function PriceChart() {
  const [prints, setPrints] = useState([]);
  useEffect(() => { openPrints().then(setPrints).catch(() => {}); const t = setInterval(() => openPrints().then(setPrints).catch(() => {}), 60000); return () => clearInterval(t); }, []);
  const live = prints.length >= 2;
  let points = chartPoints, last = [442, 49], ylabels = ["260", "250", "240"], xlabels = ["Mon", "Tue", "Wed", "Thu", "Fri"], fri = null;
  if (live) {
    const vals = [...prints.map((p) => p.px), FRI];
    const lo = Math.min(...vals) * 0.998, hi = Math.max(...vals) * 1.002;
    const X = (i) => Math.round((i / (prints.length - 1)) * 442), Y = (v) => Math.round(100 - ((v - lo) / (hi - lo)) * 96 - 2);
    points = prints.map((p, i) => `${X(i)},${Y(p.px)}`).join(" ");
    last = [X(prints.length - 1), Y(prints[prints.length - 1].px)];
    ylabels = [hi, (hi + lo) / 2, lo].map((v) => (v / 10).toFixed(0));
    const fmt = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    xlabels = [0, 1, 2, 3, 4].map((k) => fmt(prints[Math.round((k / 4) * (prints.length - 1))].t));
    fri = Y(FRI);
  }
  return <div className="chart-wrap" aria-label={live ? "Seeded Monday-open prints vs Friday close" : "Illustrative weekly price chart"}>
    <div className="chart-ylabels">{ylabels.map((l, i) => <span key={i}>{l}</span>)}</div>
    <svg className="chart" viewBox="0 0 455 100" role="img" aria-label={live ? "TSLAx seeded open prints" : "Illustrative TSLAx weekly chart"}>
      <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00d6a0" stopOpacity=".22"/><stop offset="100%" stopColor="#00d6a0" stopOpacity="0"/></linearGradient></defs>
      <path d={`M ${points} L${last[0]},100 L0,100 Z`} fill="url(#chartFill)" />
      {fri !== null && <line x1="0" x2="455" y1={fri} y2={fri} stroke="#f6f0df" strokeOpacity=".35" strokeDasharray="3 3" />}
      <polyline points={points} fill="none" stroke="#00d6a0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill="#f6f0df" stroke="#00d6a0" strokeWidth="2"/>
    </svg>
    <div className="chart-days">{xlabels.map((l, i) => <span key={i}>{l}</span>)}</div>
  </div>;
}

function AssetPanel() {
  const { book, run } = useContext(Demo);
  const res = run.result;
  return <section className="asset-panel panel">
    <div className="asset-top">
      <div className="asset-id">
        <div className="asset-logo" aria-hidden="true">T</div>
        <div><h2>TSLAx</h2><p>Tesla (tokenized)</p></div>
      </div>
      <div className="close-price"><span>Fri Close</span><strong>{usd(FRI)}</strong><small>{res ? `${res.bps >= 0 ? "+" : ""}${res.bps} bps at your open` : "weekend drift ±385 bps"}</small></div>
    </div>
    <PriceChart />
    <div className="stats-row">
      <div><strong>{book ? book.orders : "…"}</strong><span>sealed orders</span></div>
      <div><strong>{book ? book.rounds : "…"}</strong><span>weekends run</span></div>
      <div><strong>{book?.lastPrint ? usd(book.lastPrint) : "pending"}</strong><span>last open print <CircleHelp size={13} /></span></div>
    </div>
  </section>;
}

function AuctionStatus() {
  const { book, now } = useContext(Demo);
  const sealing = book && now < book.commitEnd, revealing = book && !sealing && now < book.revealEnd;
  return <section className="auction-status panel">
    <div className="status-label"><span className="gold-dot" /><span>{!book ? "Loading auction" : sealing ? "Auction open" : revealing ? "Revealing" : "Open printed"} <em>(rolling weekend)</em></span></div>
    <div className="reveal-time"><span>{sealing ? "Reveals in" : revealing ? "Opens in" : "Next weekend"}</span><strong>{!book ? "…" : sealing ? dur(book.commitEnd - now) : revealing ? dur(book.revealEnd - now) : "soon"}</strong></div>
  </section>;
}

function OrderTicket() {
  const [side, setSide] = useState("Buy");
  const { run, bal, start, fundNow } = useContext(Demo);
  const [price, setPrice] = useState("384.10");
  const [shares, setShares] = useState(1);
  const notice = run.msg || (bal === null ? "Preparing a devnet burner wallet..." : `Burner ${short(kp.publicKey.toBase58())} · ${bal.toFixed(3)} devnet SOL`);
  const total = Math.max(0, Number(price) || 0) * shares;
  void money;

  const changeShares = (delta) => setShares(n => Math.max(1, Math.min(3, n + delta)));
  const submit = () => start(side, price, shares);
  return <section className="order-ticket">
    <div className="ticket-head"><span>ORDER TICKET</span><span>FRI CLOSE&nbsp; {usd(FRI)}</span></div>
    <div className="side-switch" role="tablist" aria-label="Order side">
      {["Buy", "Sell"].map(s => <button key={s} className={side === s ? "selected" : ""} onClick={() => setSide(s)} role="tab" aria-selected={side === s}>{s}</button>)}
    </div>
    <label className="field-label" htmlFor="limit-price">Limit price (USD) <CircleHelp size={13}/></label>
    <div className="number-field"><input id="limit-price" type="number" min="0.01" step="0.1" value={price} onChange={e => setPrice(e.target.value)} /><div className="stepper"><button onClick={() => setPrice((Math.max(0, (Number(price)||0)-0.1)).toFixed(2))} aria-label="Decrease price">−</button><button onClick={() => setPrice(((Number(price)||0)+0.1).toFixed(2))} aria-label="Increase price">+</button></div></div>
    <label className="field-label" htmlFor="shares">Shares</label>
    <div className="number-field"><input id="shares" type="number" min="1" max="3" value={shares} onChange={e => setShares(Math.max(1, Math.min(3, Number(e.target.value)||1)))}/><div className="stepper"><button onClick={() => changeShares(-1)} aria-label="Decrease shares">−</button><button onClick={() => changeShares(1)} aria-label="Increase shares">+</button></div></div>
    <div className="cost-summary">
      <div><span>Estimated order value</span><strong>${total.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
      <div><span>Network fee (est.) <CircleHelp size={12}/></span><span>~0.00002 SOL</span></div>
      <div><b>Total (escrowed)</b><b>${total.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div>
    </div>
    <button className="primary-cta" onClick={submit} disabled={run.busy}><LockKeyhole size={16}/>{run.busy ? "Running the weekend..." : side === "Buy" ? "Seal order and run to the open" : "Seal sell order for the open"}</button>
    <button className="funding-note" onClick={() => run.sig ? window.open(explorer("tx", run.sig), "_blank") : fundNow()}>
      <Wallet size={20}/><span>{notice}</span><ChevronRight size={18}/>
    </button>
  </section>;
}

const steps = [
  ["SEAL", "Orders go on-chain as a hash + escrow"],
  ["REVEAL", "Weekend ends, every seal is opened"],
  ["CLEAR", "One price that crosses the most shares"],
  ["SETTLE", "Fills paid at that price, rest refunded"]
];

function Timeline() {
  const { run } = useContext(Demo);
  const cur = run.phase < 0 ? 0 : Math.min(3, run.phase);
  const names = ["SEAL", "REVEAL", "CLEAR", "SETTLE"];
  const res = run.result;
  return <section className="timeline-section">
    <h2>How it works <span className="rule" /></h2>
    <div className="timeline">
      {steps.map(([title, desc], i) => <div className="timeline-step" key={title}>
        <div className={`step-circle ${i<=cur || run.phase===4 ? "active" : ""}`}>{run.phase===4 || i<cur ? <Check size={15}/> : i+1}</div>
        <strong>{title}</strong><p>{desc}</p>
      </div>)}
    </div>
    <div className="phase-card panel">
      <div className="phase-heading"><span className="gold-dot"/><strong>Current phase: <b>{run.phase === 4 ? "SETTLED" : names[cur]}</b></strong><span className="live-pill">{run.busy ? "LIVE" : "DEVNET"}</span></div>
      <p>{res ? (res.m ? `Monday open printed ${usd(res.px)}: ${res.m} share${res.m === 1 ? "" : "s"} crossed at one price, ${res.bps >= 0 ? "+" : ""}${res.bps} bps vs Friday close. Your order: ${res.you ? `filled ${res.you}` : "not filled, refunded"}.` : "Bids and offers didn't cross. Every order was refunded.") : run.busy ? run.msg : "You can place and seal orders. Nobody can see your limits until the reveal."}</p>
    </div>
  </section>;
}

function RecentOrders() {
  const { run, book } = useContext(Demo);
  const res = run.result;
  return <section className="content-section">
    <div className="section-heading"><h2>Your weekend book</h2><button onClick={() => run.auction && window.open(explorer("address", run.auction), "_blank")}>Explorer <ArrowRight size={15}/></button></div>
    <div className="recent-list panel">
      {run.rows.length === 0 && <div className="recent-row"><span>Seal an order to start a compressed weekend.</span></div>}
      {run.rows.map((o, i) => <div className="recent-row" key={i}><span className={o.side ? "sell-tag" : "buy-tag"}>{o.side ? "Sell" : "Buy"}</span><span>{o.qty} share{o.qty === 1 ? "" : "s"}</span><span>{o.state === "Sealing" || o.state === "Sealed" ? "@ sealed" : `@ ${usd(o.price)}`}</span><span className="sealed-tag">{o.state}{o.filled ? ` ${o.filled} @ ${usd(res.px)}` : ""}</span><small>{o.who}</small><ChevronRight size={16}/></div>)}
    </div>
  </section>;
}

function MarketStats() {
  const { run } = useContext(Demo);
  const res = run.result;
  const shares = run.rows.reduce((t, o) => t + o.qty, 0);
  return <section className="content-section">
    <h2 className="section-title">Your open print <span>(demo weekend)</span> <CircleHelp size={14}/></h2>
    <div className="market-stats panel">
      <div><strong>{run.rows.length || "-"}</strong><span>sealed orders</span></div><div><strong>{shares || "-"}</strong><span>shares total</span></div><div><strong>{res?.m ? usd(res.px) : "-"}</strong><span>clearing price</span></div><div><strong>{res ? `${res.bps >= 0 ? "+" : ""}${res.bps} bps` : "-"}</strong><span>vs Friday close</span></div>
    </div>
  </section>;
}

const explanations = [
  {icon: ShieldCheck, title:"Why sealed", body:"Open order books on a closed market leak intent. Sealing until the open means no one can front-run the Monday gap."},
  {icon: BarChart3, title:"Why one price", body:"Every filled order pays the same clearing price, so the open is set by the whole weekend book, not the first bot awake."},
  {icon: Link2, title:"What's on-chain", body:"Commit, reveal, clear and settle are all Anchor instructions. Escrow sits in a program vault until settlement."}
];

function Explanations() {
  const [open, setOpen] = useState(0);
  return <section className="content-section explanations">
    <h2 className="gold-heading">Why Monday Open?</h2>
    <div className="explanation-list panel">
      {explanations.map(({icon: Icon,title,body},i)=><button className="explanation-row" key={title} onClick={()=>setOpen(open===i?-1:i)} aria-expanded={open===i}>
        <span className="explain-icon"><Icon size={21}/></span><span className="explain-copy"><strong>{title}</strong>{(open===i || window.innerWidth>700) && <small>{body}</small>}</span><ChevronDown className={open===i?"chevron-open":""} size={17}/>
      </button>)}
    </div>
  </section>;
}

function DevnetButton() { const { fundNow } = useContext(Demo); return <button onClick={fundNow}>Get devnet SOL</button>; }

function App() {
  const demo = useDemoState();
  return <Demo.Provider value={demo}><div className="app-shell">
    <Header />
    <main className="layout">
      <div className="left-column">
        <div className="eyebrow">WEEKEND BATCH AUCTION · TSLAx</div>
        <h1>Stocks close Friday.<br/>Tokens trade all weekend.<br/><span>Monday gets one fair price.</span></h1>
        <p className="intro">xStocks drift about <strong>±385 bps</strong> while the underlying market sleeps. MONDAY OPEN collects sealed orders over the weekend and clears them all at a single uniform price at the open. Nobody sees your limit until it's too late to trade against it.</p>
        <AssetPanel />
        <AuctionStatus />
        <OrderTicket />
      </div>
      <div className="right-column">
        <Timeline />
        <RecentOrders />
        <MarketStats />
        <Explanations />
        <section className="content-section">
          <h2 className="gold-heading">For judges</h2>
          <div className="phase-card panel">
            <div className="phase-heading"><span className="gold-dot"/><strong>Try it in 20 seconds</strong><span className="live-pill">DEVNET</span></div>
            <p>1. Leave the ticket as is, or set your own limit and shares. 2. Press "Seal order and run to the open". A burner wallet is funded for you; no wallet needed. 3. Watch the timeline go Seal, Reveal, Clear, Settle on devnet, then read your open print and your weekend book. Each step is a real transaction; open it in the explorer from the ticket note.</p>
          </div>
        </section>
        <section className="content-section">
          <h2 className="gold-heading">Business model</h2>
          <div className="phase-card panel">
            <p>MONDAY OPEN charges a small fee in basis points on the notional of every share that clears at the open, paid by both sides. Issuers and venues that list tokenized stocks (xStocks distributors, Solana DEXs and wallets) integrate the auction so their users get a fair Monday price instead of a weekend gap, and can share the fee. Market makers pay nothing to quote but must post escrow, which keeps the book honest.</p>
          </div>
        </section>
        <div className="devnet-card panel"><Wallet size={21}/><div><strong>Need devnet SOL?</strong><span>Fund a burner wallet to place orders.</span></div><DevnetButton /></div>
      </div>
    </main>
    <footer>MONDAY OPEN <span>·</span> Sealed weekend batch auction <span className="demo-note">DEVNET · price chart is illustrative · UI design by kaverimeshram</span></footer>
  </div></Demo.Provider>;
}

createRoot(document.getElementById("root")).render(<App />);

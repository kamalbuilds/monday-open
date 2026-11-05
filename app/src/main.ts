import { Buffer } from "buffer";
(globalThis as any).Buffer = Buffer;
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import idl from "./idl.json";

const RPC = "https://api.devnet.solana.com";
const TICK = 1000; // on-chain: lamports per price tick per share. The app quotes 1 tick = $0.10 to keep devnet escrow small.
const FRI = 3825; // Friday close $382.50 (TSLAx last seen ~$382.51 on Jupiter, Oct 10) in $0.10 ticks
const conn = new Connection(RPC, "confirmed");
const $ = (id: string) => document.getElementById(id)!;

function burner(): Keypair {
  const s = localStorage.getItem("mo-burner");
  if (s) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(s)));
  const k = Keypair.generate();
  localStorage.setItem("mo-burner", JSON.stringify([...k.secretKey]));
  return k;
}
const kp = burner();
const wallet = {
  publicKey: kp.publicKey,
  signTransaction: async (t: any) => { t.partialSign(kp); return t; },
  signAllTransactions: async (ts: any[]) => { ts.forEach((t) => t.partialSign(kp)); return ts; },
};
const provider = new AnchorProvider(conn, wallet as any, { commitment: "confirmed" });
const program = new Program(idl as any, provider) as any;
const pid = program.programId as PublicKey;
($("pid") as HTMLAnchorElement).textContent = pid.toBase58().slice(0, 4) + "…" + pid.toBase58().slice(-4);
($("pid") as HTMLAnchorElement).href = `https://explorer.solana.com/address/${pid.toBase58()}?cluster=devnet`;

const usd = (t: number) => "$" + (t / 10).toFixed(2);
const log = (m: string) => ($("log").innerHTML = m);
const tx = (s: string) => `<a target="_blank" rel="noopener" href="https://explorer.solana.com/tx/${s}?cluster=devnet">${s.slice(0, 8)}…</a>`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const step = (k: string, st: "on" | "done") => document.querySelector(`[data-k=${k}]`)!.className = st;

async function sha(side: number, price: number, qty: number, salt: Uint8Array, who: PublicKey) {
  const b = new Uint8Array(17 + 32 + 32);
  const dv = new DataView(b.buffer);
  dv.setUint8(0, side); dv.setBigUint64(1, BigInt(price), true); dv.setBigUint64(9, BigInt(qty), true);
  b.set(salt, 17); b.set(who.toBytes(), 49);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))];
}

async function balance() {
  const l = await conn.getBalance(kp.publicKey);
  $("wallet").textContent = `Burner ${kp.publicKey.toBase58().slice(0, 6)}… · ${(l / LAMPORTS_PER_SOL).toFixed(3)} devnet SOL`;
  return l;
}
async function fund() {
  let l = await balance();
  if (l >= 0.018 * LAMPORTS_PER_SOL) return true;
  $("wallet").textContent = "Funding burner with devnet SOL…";
  try {
    const { blockhash } = await conn.getLatestBlockhash();
    const r = await fetch("/api/faucet", { method: "POST", body: JSON.stringify({ to: kp.publicKey.toBase58(), blockhash }) });
    if (!r.ok) throw new Error(await r.text());
    const sig = await conn.sendRawTransaction(Buffer.from((await r.json()).tx, "base64"));
    await conn.confirmTransaction(sig, "confirmed");
  } catch (e) {
    // the drip may have landed even if confirmation timed out (public RPC 429s); recheck first
    await sleep(3000);
    if ((await balance()) >= 0.015 * LAMPORTS_PER_SOL) return true;
    try { await conn.confirmTransaction(await conn.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL), "confirmed"); }
    catch { $("wallet").textContent = "Couldn't fund the burner. Send devnet SOL to " + kp.publicKey.toBase58(); return false; }
  }
  return (await balance()) >= 0.015 * LAMPORTS_PER_SOL;
}

// Seeded weekend book: desks quoting around Friday close with a weekend drift.
function seededBook() {
  const drift = Math.round((Math.random() * 2 - 1) * 385); // bps
  const mid = Math.round(FRI * (1 + drift / 10000));
  const j = (bps: number) => Math.round(mid * (1 + bps / 10000));
  return { drift, orders: [
    { who: "Desk A", side: 0, price: j(40), qty: 1 },
    { who: "Desk C", side: 1, price: j(-60), qty: 2 },
    { who: "Desk D", side: 1, price: j(15), qty: 1 },
  ] };
}

function renderBook(rows: any[], filled?: number[], clearPx?: number) {
  const tb = document.querySelector("#book tbody")!;
  tb.innerHTML = rows.map((o, i) => `<tr class="${o.who === "You" ? "me" : ""}"><td>${i}</td><td>${o.who}</td>
    <td class="${o.side ? "sell" : "buy"}">${o.side ? "SELL" : "BUY"}</td>
    <td>${o.revealed ? usd(o.price) : "sealed"}</td><td>${o.revealed ? o.qty : "·"}</td>
    <td>${o.state}</td><td>${filled ? filled[i] + (clearPx && filled[i] ? " @ " + usd(clearPx) : "") : ""}</td></tr>`).join("");
  ($("book") as HTMLElement).hidden = false;
}

function curve(rows: any[], px: number) {
  const ps = [...new Set(rows.map((o) => o.price))].sort((a, b) => a - b);
  const lo = ps[0] * 0.995, hi = ps[ps.length - 1] * 1.005;
  const maxQ = Math.max(rows.filter((o) => !o.side).reduce((s, o) => s + o.qty, 0), rows.filter((o) => o.side).reduce((s, o) => s + o.qty, 0));
  const X = (p: number) => 40 + ((p - lo) / (hi - lo)) * 500, Y = (q: number) => 180 - (q / maxQ) * 160;
  const pts = (f: (p: number) => number) => { let s = ""; for (let i = 0; i <= 120; i++) { const p = lo + ((hi - lo) * i) / 120; s += `${X(p).toFixed(1)},${Y(f(p)).toFixed(1)} `; } return s; };
  const D = (p: number) => rows.filter((o) => !o.side && o.price >= p).reduce((s, o) => s + o.qty, 0);
  const S = (p: number) => rows.filter((o) => o.side && o.price <= p).reduce((s, o) => s + o.qty, 0);
  // label sits right of its line, or left of it when it would run off the chart
  const lab = (x: number, y: number, c: string, t: string) => x > 400
    ? `<text x="${x - 6}" y="${y}" text-anchor="end" fill="${c}" font-family="IBM Plex Mono" font-size="11" paint-order="stroke" stroke="#10261f" stroke-width="4">${t}</text>`
    : `<text x="${x + 6}" y="${y}" fill="${c}" font-family="IBM Plex Mono" font-size="11" paint-order="stroke" stroke="#10261f" stroke-width="4">${t}</text>`;
  $("curve").innerHTML = `<line x1="40" y1="180" x2="540" y2="180" stroke="#2a4a3e"/>
    <polyline points="${pts(D)}" fill="none" stroke="#5fbf8a" stroke-width="2"/>
    <polyline points="${pts(S)}" fill="none" stroke="#e0775b" stroke-width="2"/>
    <line x1="${X(px)}" y1="14" x2="${X(px)}" y2="180" stroke="#d4a24c" stroke-dasharray="4 3"/>
    <line x1="${X(FRI)}" y1="14" x2="${X(FRI)}" y2="180" stroke="#8fa79c" stroke-dasharray="1 3"/>
    ${lab(X(px), 24, "#d4a24c", "open " + usd(px))}
    ${lab(X(FRI) + (X(FRI) > 400 ? 0 : 0), 172, "#c9d3cc", "Fri close " + usd(FRI))}
    ${[lo, (lo + hi) / 2, hi].map((p, k) => `<text x="${X(p)}" y="200" text-anchor="${["start", "middle", "end"][k]}" fill="#8fa79c" font-family="IBM Plex Mono" font-size="11">${usd(Math.round(p))}</text>`).join("")}
    <text x="34" y="24" text-anchor="end" fill="#8fa79c" font-family="IBM Plex Mono" font-size="11">${maxQ}</text>
    <text x="34" y="40" text-anchor="end" fill="#8fa79c" font-family="IBM Plex Mono" font-size="10">shares</text>
    <text x="34" y="184" text-anchor="end" fill="#8fa79c" font-family="IBM Plex Mono" font-size="11">0</text>
    <text x="40" y="222" fill="#5fbf8a" font-family="IBM Plex Mono" font-size="11">demand (shares bid at or above)</text>
    <text x="300" y="222" fill="#e0775b" font-family="IBM Plex Mono" font-size="11">supply (shares offered at or below)</text>`;
}

async function chainNow() { const s = await conn.getSlot(); return (await conn.getBlockTime(s)) ?? Math.floor(Date.now() / 1000); }
async function until(t: number) { while ((await chainNow()) < t) await sleep(800); }

async function run(side: number, price: number, qty: number) {
  document.querySelectorAll(".steps li").forEach((l) => (l.className = ""));
  ($("print") as HTMLElement).hidden = true;
  const { drift, orders } = seededBook();
  const rows = [{ who: "You", side, price, qty }, ...orders].map((o) => ({ ...o, salt: crypto.getRandomValues(new Uint8Array(32)), revealed: false, state: "sealing" }));
  renderBook(rows);
  step("seal", "on");
  const id = new BN(Date.now());
  const [auction] = PublicKey.findProgramAddressSync([Buffer.from("auction"), kp.publicKey.toBuffer(), id.toArrayLike(Buffer, "le", 8)], pid);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), auction.toBuffer()], pid);
  const orderPda = (i: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(i); return PublicKey.findProgramAddressSync([Buffer.from("order"), auction.toBuffer(), b], pid)[0]; };
  const now = await chainNow();
  const commitEnd = now + 9, revealEnd = commitEnd + 6;
  const dep = (o: any) => (o.side === 0 ? o.qty * o.price * TICK : 1000);
  const commitIx = async (o: any, i: number) => program.methods.commitOrder(await sha(o.side, o.price, o.qty, o.salt, kp.publicKey), new BN(dep(o)))
    .accountsPartial({ auction, order: orderPda(i), vault, trader: kp.publicKey }).instruction();
  const t1 = new Transaction().add(
    await program.methods.createAuction(id, "TSLAx", new BN(FRI), new BN(commitEnd), new BN(revealEnd)).accountsPartial({ auction, vault, authority: kp.publicKey }).instruction(),
    await commitIx(rows[0], 0), await commitIx(rows[1], 1));
  const s1 = await provider.sendAndConfirm(t1);
  rows.slice(0, 2).forEach((r) => (r.state = "sealed")); renderBook(rows);
  log(`Sealed on-chain ${tx(s1)} · auction ${auction.toBase58().slice(0, 8)}…`);
  const t2 = new Transaction();
  for (let i = 2; i < rows.length; i++) t2.add(await commitIx(rows[i], i));
  const s2 = await provider.sendAndConfirm(t2);
  rows.forEach((r) => (r.state = "sealed")); renderBook(rows);
  step("seal", "done"); step("reveal", "on");
  log(`All ${rows.length} orders sealed ${tx(s1)} ${tx(s2)} · weekend closes in ${commitEnd - (await chainNow())}s`);
  await until(commitEnd + 1);
  const t3 = new Transaction();
  for (const [i, o] of rows.entries()) t3.add(await program.methods.revealOrder(o.side, new BN(o.price), new BN(o.qty), [...o.salt]).accountsPartial({ auction, order: orderPda(i), trader: kp.publicKey }).instruction());
  const s3 = await provider.sendAndConfirm(t3);
  rows.forEach((r) => { r.revealed = true; r.state = "revealed"; }); renderBook(rows);
  step("reveal", "done"); step("clear", "on");
  log(`Revealed ${tx(s3)} · waiting for the Monday open bell`);
  await until(revealEnd + 1);
  const rem = rows.map((_, i) => ({ pubkey: orderPda(i), isSigner: false, isWritable: false }));
  const s4 = await program.methods.clear().accountsPartial({ auction }).remainingAccounts(rem).rpc();
  const a = await program.account.auction.fetch(auction);
  step("clear", "done"); step("settle", "on");
  const t5 = new Transaction();
  for (let i = 0; i < rows.length; i++) t5.add(await program.methods.settle().accountsPartial({ auction, order: orderPda(i), vault, trader: kp.publicKey }).instruction());
  const s5 = await provider.sendAndConfirm(t5);
  const fills = await Promise.all(rows.map((_, i) => program.account.order.fetch(orderPda(i))));
  const filled = fills.map((f: any) => f.filled.toNumber());
  rows.forEach((r, i) => (r.state = filled[i] ? "filled" : "refunded"));
  const px = a.clearPrice.toNumber(), m = a.matchedQty.toNumber();
  renderBook(rows, filled, px);
  step("settle", "done");
  ($("print") as HTMLElement).hidden = false;
  if (m === 0) { $("px").textContent = "No cross"; $("pxmeta").textContent = "Bids and offers didn't overlap. Every order was refunded."; }
  else {
    const bps = Math.round(((px - FRI) / FRI) * 10000);
    $("px").textContent = usd(px);
    $("pxmeta").innerHTML = `<div><b>Crossed</b>${m} share${m === 1 ? "" : "s"}, one price</div><div><b>Vs Friday close</b>${bps >= 0 ? "+" : ""}${bps} bps</div><div><b>Your order</b>${filled[0] ? `filled ${filled[0]} at ${usd(px)}` : "not filled, refunded"}</div>`;
    void drift;
    curve(rows, px);
  }
  log(`Cleared ${tx(s4)} · settled ${tx(s5)}`);
  await balance();
}

$("ticket").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = $("seal") as HTMLButtonElement;
  const side = Number((document.querySelector("input[name=side]:checked") as HTMLInputElement).value);
  const price = Math.round(Number(($("price") as HTMLInputElement).value) * 10);
  const qty = Math.max(1, Math.min(3, Math.floor(Number(($("qty") as HTMLInputElement).value))));
  b.disabled = true; b.textContent = "Running the weekend…";
  try { if (!(await fund())) throw new Error("burner has no devnet SOL"); await run(side, price, qty); }
  catch (err: any) { log("Error: " + (err?.message ?? err)); console.error(err); }
  finally { b.disabled = false; b.textContent = "Seal another order"; }
});
// Live rolling book run by scripts/seed.mjs (authority = seeder wallet)
const SEEDER = new PublicKey("GhyXbXu7y3DVptMiSPBri12rGMxJBKtex4hWSa6bfg9j");
const setLive = (h: string, html = false) => document.querySelectorAll(".liveBody").forEach((e) => { if (html) e.innerHTML = h; else e.textContent = h; });
async function live() {
  try {
    const all = await program.account.auction.all([{ memcmp: { offset: 8, bytes: SEEDER.toBase58() } }]);
    if (!all.length) { setLive("No rolling auction yet."); return; }
    all.sort((a: any, b: any) => b.account.revealEnd.toNumber() - a.account.revealEnd.toNumber());
    const cur = all[0], last = all.find((x: any) => x.account.cleared && x.account.matchedQty.toNumber() > 0 && x.account.fridayClose.toNumber() === FRI);
    const now = Math.floor(Date.now() / 1000), c = cur.account;
    const phase = c.cleared ? "printed" : now < c.commitEnd.toNumber() ? `sealing · reveal in ${c.commitEnd.toNumber() - now}s` : now < c.revealEnd.toNumber() ? `revealing · open in ${c.revealEnd.toNumber() - now}s` : "awaiting open crank";
    setLive(`<div class="row"><div><b>Phase</b><a target="_blank" rel="noopener" href="https://explorer.solana.com/address/${cur.publicKey.toBase58()}?cluster=devnet">${phase}</a></div>
      <div><b>Sealed orders</b>${c.orderCount}</div>
      <div><b>Last open print</b>${last ? usd(last.account.clearPrice.toNumber()) + " × " + last.account.matchedQty.toNumber() : "none yet"}</div></div>`, true);
  } catch (e) { setLive("Rolling book unavailable (devnet RPC busy)."); }
}
live(); setInterval(live, 15000);
fund();

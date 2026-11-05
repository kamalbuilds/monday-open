// Devnet wiring for the MONDAY OPEN UI: burner wallet, faucet, one-click compressed weekend
// (seal -> reveal -> clear -> settle) and the live rolling book run by scripts/seed.mjs.
import { Buffer } from "buffer";
globalThis.Buffer = Buffer;
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import idl from "./idl.json";

export const RPC = "https://api.devnet.solana.com";
export const TICK = 1000; // on-chain lamports per price tick per share; the app quotes 1 tick = $0.10
export const FRI = 3825; // Friday close $382.50 in $0.10 ticks
export const SEEDER = new PublicKey("GhyXbXu7y3DVptMiSPBri12rGMxJBKtex4hWSa6bfg9j");
export const usd = (t) => "$" + (t / 10).toFixed(2);
const conn = new Connection(RPC, "confirmed");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function burner() {
  const s = localStorage.getItem("mo-burner");
  if (s) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(s)));
  const k = Keypair.generate();
  localStorage.setItem("mo-burner", JSON.stringify([...k.secretKey]));
  return k;
}
export const kp = burner();
const wallet = {
  publicKey: kp.publicKey,
  signTransaction: async (t) => { t.partialSign(kp); return t; },
  signAllTransactions: async (ts) => { ts.forEach((t) => t.partialSign(kp)); return ts; },
};
const provider = new AnchorProvider(conn, wallet, { commitment: "confirmed" });
export const program = new Program(idl, provider);
export const pid = program.programId;
export const short = (k) => k.slice(0, 4) + "..." + k.slice(-4);
export const explorer = (kind, id) => `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;

async function sha(side, price, qty, salt, who) {
  const b = new Uint8Array(81); const dv = new DataView(b.buffer);
  dv.setUint8(0, side); dv.setBigUint64(1, BigInt(price), true); dv.setBigUint64(9, BigInt(qty), true);
  b.set(salt, 17); b.set(who.toBytes(), 49);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))];
}

export const balance = () => conn.getBalance(kp.publicKey);
export async function fund(onMsg) {
  if ((await balance()) >= 0.018 * LAMPORTS_PER_SOL) return true;
  onMsg?.("Funding burner with devnet SOL...");
  try {
    const { blockhash } = await conn.getLatestBlockhash();
    const r = await fetch("/api/faucet", { method: "POST", body: JSON.stringify({ to: kp.publicKey.toBase58(), blockhash }) });
    if (!r.ok) throw new Error(await r.text());
    const sig = await conn.sendRawTransaction(Buffer.from((await r.json()).tx, "base64"));
    await conn.confirmTransaction(sig, "confirmed");
  } catch {
    await sleep(3000); // the drip may land even when confirmation is rate-limited
    if ((await balance()) >= 0.015 * LAMPORTS_PER_SOL) return true;
    try { await conn.confirmTransaction(await conn.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL), "confirmed"); }
    catch { return false; }
  }
  return (await balance()) >= 0.015 * LAMPORTS_PER_SOL;
}

function seededBook() {
  const drift = Math.round((Math.random() * 2 - 1) * 385);
  const mid = Math.round(FRI * (1 + drift / 10000));
  const j = (bps) => Math.round(mid * (1 + bps / 10000));
  return [
    { who: "Desk A", side: 0, price: j(40), qty: 1 },
    { who: "Desk C", side: 1, price: j(-60), qty: 2 },
    { who: "Desk D", side: 1, price: j(15), qty: 1 },
  ];
}
// Public devnet rate-limits hard (429). Retry every RPC step with backoff, and wait on a
// local clock corrected by one chain-time sample instead of polling getBlockTime.
async function retry(fn, tries = 6) {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) {
      const m = String(e?.message ?? e);
      const transient = /429|Too many|fetch|timeout|blockhash|NotOpenYet|RevealNotOpen|0x1774|0x1775/i.test(m);
      if (!transient || i >= tries - 1) throw e;
      await sleep(800 * 2 ** i);
    }
  }
}
let skew = 0;
const chainNow = async () => { try { const t = await conn.getBlockTime(await conn.getSlot()); if (t) skew = t - Date.now() / 1000; } catch {} return Math.floor(Date.now() / 1000 + skew); };
const until = async (t) => { while (Date.now() / 1000 + skew < t) await sleep(300); };

/** Runs one compressed weekend. update({phase, rows, msg, result}) is called as the chain confirms each step. */
export async function runWeekend(side, price, qty, update) {
  const rows = [{ who: "You", side, price, qty }, ...seededBook()].map((o) => ({ ...o, salt: crypto.getRandomValues(new Uint8Array(32)), state: "Sealing", filled: 0 }));
  const push = (o) => update({ rows: rows.map((r) => ({ ...r })), ...o });
  push({ phase: 0, msg: "Sealing your order on devnet..." });
  const id = new BN(Date.now());
  const [auction] = PublicKey.findProgramAddressSync([Buffer.from("auction"), kp.publicKey.toBuffer(), id.toArrayLike(Buffer, "le", 8)], pid);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), auction.toBuffer()], pid);
  const orderPda = (i) => { const b = Buffer.alloc(2); b.writeUInt16LE(i); return PublicKey.findProgramAddressSync([Buffer.from("order"), auction.toBuffer(), b], pid)[0]; };
  const now = await chainNow();
  const commitEnd = now + 9, revealEnd = commitEnd + 6;
  const dep = (o) => (o.side === 0 ? o.qty * o.price * TICK : 1000);
  const commitIx = async (o, i) => program.methods.commitOrder(await sha(o.side, o.price, o.qty, o.salt, kp.publicKey), new BN(dep(o)))
    .accountsPartial({ auction, order: orderPda(i), vault, trader: kp.publicKey }).instruction();
  const s1 = await retry(async () => provider.sendAndConfirm(new Transaction().add(
    await program.methods.createAuction(id, "TSLAx", new BN(FRI), new BN(commitEnd), new BN(revealEnd)).accountsPartial({ auction, vault, authority: kp.publicKey }).instruction(),
    await commitIx(rows[0], 0), await commitIx(rows[1], 1))));
  rows.slice(0, 2).forEach((r) => (r.state = "Sealed"));
  push({ phase: 0, msg: `Sealed on-chain ${short(s1)}`, sig: s1, auction: auction.toBase58() });
  await retry(async () => { const t2 = new Transaction(); for (let i = 2; i < rows.length; i++) t2.add(await commitIx(rows[i], i)); return provider.sendAndConfirm(t2); });
  rows.forEach((r) => (r.state = "Sealed"));
  push({ phase: 1, msg: `All ${rows.length} orders sealed. Weekend closes in ~${Math.max(0, commitEnd - (await chainNow()))}s` });
  await until(commitEnd + 1);
  const s3 = await retry(async () => { const t3 = new Transaction();
    for (const [i, o] of rows.entries()) t3.add(await program.methods.revealOrder(o.side, new BN(o.price), new BN(o.qty), [...o.salt]).accountsPartial({ auction, order: orderPda(i), trader: kp.publicKey }).instruction());
    return provider.sendAndConfirm(t3); });
  rows.forEach((r) => (r.state = "Revealed"));
  push({ phase: 2, msg: `Revealed ${short(s3)}. Waiting for the Monday open...` });
  await until(revealEnd + 1);
  const rem = rows.map((_, i) => ({ pubkey: orderPda(i), isSigner: false, isWritable: false }));
  const s4 = await retry(() => program.methods.clear().accountsPartial({ auction }).remainingAccounts(rem).rpc(), 8);
  const a = await retry(() => program.account.auction.fetch(auction));
  push({ phase: 3, msg: `Cleared ${short(s4)}. Settling...` });
  const s5 = await retry(async () => { const t5 = new Transaction();
    for (let i = 0; i < rows.length; i++) t5.add(await program.methods.settle().accountsPartial({ auction, order: orderPda(i), vault, trader: kp.publicKey }).instruction());
    return provider.sendAndConfirm(t5); });
  const fills = await retry(() => program.account.order.fetchMultiple(rows.map((_, i) => orderPda(i))));
  rows.forEach((r, i) => { r.filled = fills[i].filled.toNumber(); r.state = r.filled ? "Filled" : "Refunded"; });
  const px = a.clearPrice.toNumber(), m = a.matchedQty.toNumber();
  push({ phase: 4, msg: `Settled ${short(s5)}`, sig: s5, result: { px, m, bps: Math.round(((px - FRI) / FRI) * 10000), you: rows[0].filled } });
}

/** Current round of the seeded rolling book (scripts/seed.mjs). */
export async function liveBook() {
  const all = await program.account.auction.all([{ memcmp: { offset: 8, bytes: SEEDER.toBase58() } }]);
  if (!all.length) return null;
  all.sort((x, y) => y.account.revealEnd.toNumber() - x.account.revealEnd.toNumber());
  const c = all[0].account;
  const last = all.find((x) => x.account.cleared && x.account.matchedQty.toNumber() > 0 && x.account.fridayClose.toNumber() === FRI);
  return { auction: all[0].publicKey.toBase58(), orders: c.orderCount, commitEnd: c.commitEnd.toNumber(), revealEnd: c.revealEnd.toNumber(), cleared: c.cleared,
    lastPrint: last ? last.account.clearPrice.toNumber() : null, lastQty: last ? last.account.matchedQty.toNumber() : null, rounds: all.length };
}

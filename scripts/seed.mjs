// Rolling seeded market: several desk wallets keep a TSLAx weekend auction alive on devnet.
// Each round: create auction -> every desk commits sealed orders -> reveal -> clear -> settle -> next round.
// Usage: node scripts/seed.mjs [--rounds N] [--commit 300] [--reveal 60] [--desks 3]
// Sells escrow TSLAx devnet test tokens (minted to the sell desks by the mint authority in .keys/faucet.json).
// Devnet only. Desk keys live in .keys/ (gitignored); funded from ~/.config/solana/id.json.
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import { createHash, randomBytes } from "crypto";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, getAccount, mintTo } from "@solana/spl-token";
import fs from "fs";
import os from "os";
const { AnchorProvider, Program, BN, Wallet } = anchor;

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const ROUNDS = arg("rounds", Infinity), COMMIT = arg("commit", 300), REVEAL = arg("reveal", 60), DESKS = arg("desks", 3);
const RPC = process.env.RPC ?? "https://api.devnet.solana.com";
if (!/devnet|localhost|127\.0\.0\.1/.test(RPC)) throw new Error("seed.mjs refuses to run off devnet/localnet");
const TICK = 1000, FRI = 3825; // app quotes 1 tick = $0.10
const conn = new Connection(RPC, "confirmed");
const load = (p) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p))));
const admin = load(process.env.ADMIN_KEY ?? os.homedir() + "/.config/solana/id.json");
const idl = JSON.parse(fs.readFileSync(new URL("../target/idl/monday_open.json", import.meta.url)));
const program = new Program(idl, new AnchorProvider(conn, new Wallet(admin), { commitment: "confirmed" }));
const pid = program.programId;
const dev = JSON.parse(fs.readFileSync(new URL("./devnet.json", import.meta.url)));
const mint = new PublicKey(dev.mint), treasury = new PublicKey(dev.treasury);
const SHARE = 1_000_000;
const mintAuth = load(".keys/faucet.json");
const gap = JSON.parse(fs.readFileSync(new URL("./data/tsla-weekend-gap.summary.json", import.meta.url))); // origin of the drift scale
const ataOf = (k) => getAssociatedTokenAddressSync(mint, k);
const tokenBal = async (k) => { try { return Number((await getAccount(conn, ataOf(k))).amount); } catch { return 0; } };
const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], pid);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chainNow = async () => (await conn.getBlockTime(await conn.getSlot())) ?? Math.floor(Date.now() / 1000);
const until = async (t) => {
  // poll gently: public devnet rate-limits getBlockTime
  for (;;) { let now; try { now = await chainNow(); } catch { await sleep(10000); continue; }
    if (now >= t) return; await sleep(Math.min(30000, Math.max(2000, (t - now) * 500))); }
};
const hash = (side, price, qty, salt, who) => {
  const b = Buffer.alloc(17); b.writeUInt8(side, 0); b.writeBigUInt64LE(BigInt(price), 1); b.writeBigUInt64LE(BigInt(qty), 9);
  return [...createHash("sha256").update(Buffer.concat([b, salt, who.toBuffer()])).digest()];
};

fs.mkdirSync(".keys", { recursive: true });
const desks = Array.from({ length: DESKS }, (_, i) => {
  const p = `.keys/seed-desk-${i}.json`;
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify([...Keypair.generate().secretKey]));
  return load(p);
});
async function topUp(min = arg("topmin", 0.015), amt = arg("topup", 0.02)) {
  for (const d of desks) {
    const bal = await conn.getBalance(d.publicKey);
    if (bal < min * LAMPORTS_PER_SOL) {
      const t = new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: d.publicKey, lamports: Math.round(amt * LAMPORTS_PER_SOL) }));
      await sendAndConfirmTransaction(conn, t, [admin]);
      console.log(`  topped up ${d.publicKey.toBase58().slice(0, 6)} +${amt} SOL`);
    }
  }
}

const STATE = ".seed-current.json";
async function round(n) {
  await topUp();
  // Resume an interrupted round (Mac slept / process died) so sealed deposits aren't stranded.
  const prev = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE)) : null;
  const resume = prev && !prev.done && prev.orders;
  const id = new BN(resume ? prev.id : Date.now());
  const [auction] = PublicKey.findProgramAddressSync([Buffer.from("auction"), admin.publicKey.toBuffer(), id.toArrayLike(Buffer, "le", 8)], pid);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), auction.toBuffer()], pid);
  const [tokenVault] = PublicKey.findProgramAddressSync([Buffer.from("tvault"), auction.toBuffer()], pid);
  const orderPda = (i) => { const b = Buffer.alloc(2); b.writeUInt16LE(i); return PublicKey.findProgramAddressSync([Buffer.from("order"), auction.toBuffer(), b], pid)[0]; };
  const now = await chainNow();
  let commitEnd = now + COMMIT, revealEnd = commitEnd + REVEAL;
  let orders;
  if (resume) {
    ({ commitEnd, revealEnd } = prev);
    orders = prev.orders.map((o) => ({ ...o, kp: desks[o.desk], salt: Buffer.from(o.salt, "hex") }));
    console.log(`round ${n}: resuming ${auction.toBase58()}`);
    if ((await chainNow()) >= revealEnd) {
      console.log("  missed the reveal window; abandoning that round (deposits stranded)");
      fs.writeFileSync(STATE, JSON.stringify({ ...prev, done: true })); return;
    }
  } else {
  await program.methods.createAuction(id, "TSLAx", new BN(FRI), new BN(commitEnd), new BN(revealEnd)).accountsPartial({ auction, vault, config, mint, tokenVault, authority: admin.publicKey }).rpc();
  const drift = Math.round((Math.random() * 2 - 1) * gap.p90_abs_bps);
  const mid = Math.round(FRI * (1 + drift / 10000));
  console.log(`round ${n}: auction ${auction.toBase58()} drift ${drift}bps, commit ${COMMIT}s, reveal ${REVEAL}s`);
  orders = desks.map((kp, i) => {
    const side = i % 2; // alternate buy/sell desks, plus random spread
    const price = Math.round(mid * (1 + ((side ? -1 : 1) * Math.random() * 80 - (side ? -20 : 20)) / 10000));
    return { kp, desk: i, side, price, qty: 1 + Math.floor(Math.random() * arg("maxqty", 2)), salt: randomBytes(32) };
  });
  for (const o of orders) {
    const a = ataOf(o.kp.publicKey);
    if (!(await conn.getAccountInfo(a))) await sendAndConfirmTransaction(conn, new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, a, o.kp.publicKey, mint)), [admin]);
    if (o.side === 1 && (await tokenBal(o.kp.publicKey)) < o.qty * SHARE) await mintTo(conn, admin, mint, a, mintAuth, 10 * SHARE);
  }
  fs.writeFileSync(STATE, JSON.stringify({ id: id.toString(), auction: auction.toBase58(), commitEnd, revealEnd, round: n,
    orders: orders.map(({ kp, salt, ...o }) => ({ ...o, salt: salt.toString("hex") })) }, null, 1));
  for (const [i, o] of orders.entries()) {
    const dep = o.side === 0 ? o.qty * 4200 * TICK : 1000; // fixed $420 ceiling, same as ui/src/chain.js BUY_CEIL: a deposit must not reveal its limit
    const tx = await program.methods.commitOrder(hash(o.side, o.price, o.qty, o.salt, o.kp.publicKey), new BN(dep))
      .accountsPartial({ auction, order: orderPda(i), vault, trader: o.kp.publicKey }).signers([o.kp]).rpc();
    console.log(`  sealed #${i} ${o.kp.publicKey.toBase58().slice(0, 6)} ${tx.slice(0, 10)}…`);
    await sleep(Math.min(5000, (COMMIT * 1000) / (orders.length + 2)));
  }
  }
  await until(commitEnd + 1);
  for (const [i, o] of orders.entries())
    await program.methods.revealOrder(o.side, new BN(o.price), new BN(o.qty), [...o.salt]).accountsPartial({ auction, order: orderPda(i), traderAta: ataOf(o.kp.publicKey), tokenVault, trader: o.kp.publicKey }).signers([o.kp]).rpc();
  console.log("  revealed: " + orders.map((o) => `${o.side ? "S" : "B"}${o.qty}@$${(o.price / 10).toFixed(1)}`).join(" "));
  await until(revealEnd + 1);
  await program.methods.clear().accountsPartial({ auction }).remainingAccounts(orders.map((_, i) => ({ pubkey: orderPda(i), isSigner: false, isWritable: true }))).rpc();
  const a = await program.account.auction.fetch(auction);
  const tre0 = await conn.getBalance(treasury);
  for (const [i, o] of orders.entries())
    await program.methods.settle().accountsPartial({ auction, order: orderPda(i), vault, trader: o.kp.publicKey, traderAta: ataOf(o.kp.publicKey), tokenVault, treasury }).rpc();
  console.log(`  treasury fee +${(await conn.getBalance(treasury)) - tre0} lamports; vault ${await conn.getBalance(vault)} lamports, token vault ${Number((await getAccount(conn, tokenVault)).amount)} base units`);
  fs.writeFileSync(STATE, JSON.stringify({ auction: auction.toBase58(), done: true }));
  console.log(`  OPEN PRINT $${(a.clearPrice.toNumber() / 10).toFixed(2)} x ${a.matchedQty.toNumber()} (settled ${orders.length})`);
}

for (let n = 1; n <= ROUNDS; n++) {
  try { await round(n); } catch (e) { console.error(`round ${n} failed:`, e.message ?? e); await sleep(15000); }
}

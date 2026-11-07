// End-to-end proof on devnet: a crafted auction with three buys and one escrowed sell, then reads back
// the token balances, SOL deltas, the treasury fee and the emptied vaults. Exits non-zero on any mismatch.
// Devnet only. Usage: node scripts/devnet-proof.mjs
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, getAccount, mintTo } from "@solana/spl-token";
import { createHash, randomBytes } from "crypto";
import assert from "assert";
import fs from "fs";
import os from "os";
const { AnchorProvider, Program, BN, Wallet } = anchor;

const RPC = process.env.RPC ?? "https://api.devnet.solana.com";
if (!/devnet|localhost|127\.0\.0\.1/.test(RPC)) throw new Error("devnet-proof.mjs refuses to run off devnet/localnet");
const load = (p) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p))));
const admin = load(os.homedir() + "/.config/solana/id.json"), mintAuth = load(".keys/faucet.json");
const dev = JSON.parse(fs.readFileSync(new URL("./devnet.json", import.meta.url)));
const mint = new PublicKey(dev.mint), treasury = new PublicKey(dev.treasury);
const conn = new Connection(RPC, "confirmed");
const idl = JSON.parse(fs.readFileSync(new URL("../target/idl/monday_open.json", import.meta.url)));
const program = new Program(idl, new AnchorProvider(conn, new Wallet(admin), { commitment: "confirmed" }));
const pid = program.programId;
const TICK = 1000, SHARE = 1_000_000, FRI = 3825;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chainNow = async () => (await conn.getBlockTime(await conn.getSlot())) ?? Math.floor(Date.now() / 1000);
const until = async (t) => { for (;;) { let n; try { n = await chainNow(); } catch { await sleep(3000); continue; } if (n >= t) return; await sleep(1500); } };
const ata = (k) => getAssociatedTokenAddressSync(mint, k);
const tok = async (a) => { try { return Number((await getAccount(conn, a)).amount); } catch { return 0; } };
const hash = (side, price, qty, salt, who) => {
  const b = Buffer.alloc(17); b.writeUInt8(side, 0); b.writeBigUInt64LE(BigInt(price), 1); b.writeBigUInt64LE(BigInt(qty), 9);
  return [...createHash("sha256").update(Buffer.concat([b, salt, who.toBuffer()])).digest()];
};
const keyOf = (i) => { const p = `.keys/proof-${i}.json`; if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify([...Keypair.generate().secretKey])); return load(p); };

// three buys of 2 against one sell of 4: matched 4, buyers split 4 as 2/1/1 (floor alone would give 1/1/1)
const book = [{ side: 0, price: 3830, qty: 2 }, { side: 0, price: 3830, qty: 2 }, { side: 0, price: 3830, qty: 2 }, { side: 1, price: 3820, qty: 4 }]
  .map((o, i) => ({ ...o, kp: keyOf(i), salt: randomBytes(32) }));
for (const o of book) {
  const need = (o.side === 0 ? o.qty * o.price * TICK : 1_000_000) + 4_000_000;
  const bal = await conn.getBalance(o.kp.publicKey);
  if (bal < need) await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: o.kp.publicKey, lamports: need - bal })), [admin]);
  await sendAndConfirmTransaction(conn, new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, ata(o.kp.publicKey), o.kp.publicKey, mint)), [admin]);
  if (o.side === 1 && (await tok(ata(o.kp.publicKey))) < o.qty * SHARE) await mintTo(conn, admin, mint, ata(o.kp.publicKey), mintAuth, 5 * SHARE);
}
const id = new BN(Date.now());
const [auction] = PublicKey.findProgramAddressSync([Buffer.from("auction"), admin.publicKey.toBuffer(), id.toArrayLike(Buffer, "le", 8)], pid);
const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), auction.toBuffer()], pid);
const [tokenVault] = PublicKey.findProgramAddressSync([Buffer.from("tvault"), auction.toBuffer()], pid);
const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], pid);
const orderPda = (i) => { const b = Buffer.alloc(2); b.writeUInt16LE(i); return PublicKey.findProgramAddressSync([Buffer.from("order"), auction.toBuffer(), b], pid)[0]; };
const log = (...a) => console.log(...a);

const commitEnd = (await chainNow()) + 60, revealEnd = commitEnd + 45;
log("create_auction", await program.methods.createAuction(id, "TSLAx", new BN(FRI), new BN(commitEnd), new BN(revealEnd)).accountsPartial({ auction, vault, config, mint, tokenVault, authority: admin.publicKey }).rpc());
log("auction", auction.toBase58(), "size", (await conn.getAccountInfo(auction)).data.length);
for (const [i, o] of book.entries()) {
  const dep = o.side === 0 ? o.qty * o.price * TICK : 1_000_000;
  log(`commit #${i}`, await program.methods.commitOrder(hash(o.side, o.price, o.qty, o.salt, o.kp.publicKey), new BN(dep)).accountsPartial({ auction, order: orderPda(i), vault, trader: o.kp.publicKey }).signers([o.kp]).rpc());
}
await until(commitEnd + 1);
const sellerBefore = await tok(ata(book[3].kp.publicKey));
for (const [i, o] of book.entries())
  log(`reveal #${i} ${o.side ? "SELL" : "BUY "}`, await program.methods.revealOrder(o.side, new BN(o.price), new BN(o.qty), [...o.salt]).accountsPartial({ auction, order: orderPda(i), traderAta: ata(o.kp.publicKey), tokenVault, trader: o.kp.publicKey }).signers([o.kp]).rpc());
const escrowed = await tok(tokenVault);
log(`escrow: seller tokens ${sellerBefore} -> ${await tok(ata(book[3].kp.publicKey))}, token vault holds ${escrowed}`);
assert.equal(escrowed, 4 * SHARE, "sell escrow must hold 4 shares");
await until(revealEnd + 1);
log("clear", await program.methods.clear().accountsPartial({ auction }).remainingAccounts(book.map((_, i) => ({ pubkey: orderPda(i), isSigner: false, isWritable: true }))).rpc());
const a = await program.account.auction.fetch(auction);
log(`cleared at ${a.clearPrice} x ${a.matchedQty}, fee_bps ${a.feeBps}`);
const sol0 = await Promise.all(book.map((o) => conn.getBalance(o.kp.publicKey))), tre0 = await conn.getBalance(treasury);
for (const [i, o] of book.entries())
  log(`settle #${i}`, await program.methods.settle().accountsPartial({ auction, order: orderPda(i), vault, trader: o.kp.publicKey, traderAta: ata(o.kp.publicKey), tokenVault, treasury }).rpc());
const sol1 = await Promise.all(book.map((o) => conn.getBalance(o.kp.publicKey))), tre1 = await conn.getBalance(treasury);
const got = await Promise.all(book.map((o) => tok(ata(o.kp.publicKey))));
const notional = 4 * a.clearPrice.toNumber() * TICK, fee = Math.floor((notional * a.feeBps) / 10000);
log("buyer tokens (base units):", got.slice(0, 3), "sum", got.slice(0, 3).reduce((s, x) => s + x, 0));
log("seller SOL delta:", sol1[3] - sol0[3], "expected", 1_000_000 + notional - fee);
log("treasury delta:", tre1 - tre0, "expected fee", fee);
log("vault lamports:", await conn.getBalance(vault), "token vault:", await tok(tokenVault));
assert.equal(got.slice(0, 3).reduce((s, x) => s + x, 0), 4 * SHARE, "buyers receive exactly the matched shares");
assert.deepEqual(got.slice(0, 3), [2 * SHARE, 1 * SHARE, 1 * SHARE]);
assert.equal(sol1[3] - sol0[3], 1_000_000 + notional - fee);
assert.equal(tre1 - tre0, fee); assert(fee > 0);
assert.equal(await conn.getBalance(vault), 0); assert.equal(await tok(tokenVault), 0);
log("PROOF OK");

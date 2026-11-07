import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { MondayOpen } from "../target/types/monday_open";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, createAssociatedTokenAccount, mintTo, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { createHash, randomBytes } from "crypto";
import { expect } from "chai";

const TICK = 1000;
const SHARE = 1_000_000; // token base units per share
const FEE_BPS = 10;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hash = (side: number, price: number, qty: number, salt: Buffer, trader: PublicKey) => {
  const b = Buffer.alloc(17);
  b.writeUInt8(side, 0); b.writeBigUInt64LE(BigInt(price), 1); b.writeBigUInt64LE(BigInt(qty), 9);
  return [...createHash("sha256").update(Buffer.concat([b, salt, trader.toBuffer()])).digest()];
};
const BPF_UPGRADEABLE = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

type Spec = { side: number; price: number; qty: number; tokens?: number; deposit?: number };

describe("monday-open", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.mondayOpen as Program<MondayOpen>;
  const conn = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const treasury = Keypair.generate();
  const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];
  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  let mint: PublicKey;
  const chainNow = async () => (await conn.getBlockTime(await conn.getSlot())) ?? Math.floor(Date.now() / 1000);
  const until = async (t: number) => { while ((await chainNow()) < t) await sleep(400); };

  before(async () => {
    await conn.confirmTransaction(await conn.requestAirdrop(treasury.publicKey, 0.01 * LAMPORTS_PER_SOL));
    mint = await createMint(conn, payer, payer.publicKey, null, 6);
    // a stranger cannot claim the config before the upgrade authority does
    const stranger = Keypair.generate();
    await conn.confirmTransaction(await conn.requestAirdrop(stranger.publicKey, LAMPORTS_PER_SOL));
    const programData = PublicKey.findProgramAddressSync([program.programId.toBuffer()], BPF_UPGRADEABLE)[0];
    try {
      await program.methods.initConfig(500, stranger.publicKey)
        .accountsPartial({ config, program: program.programId, programData, authority: stranger.publicKey }).signers([stranger]).rpc();
      expect.fail("stranger initialised config");
    } catch (e: any) { expect(String(e)).to.match(/NotUpgradeAuthority/); }
    await program.methods.initConfig(FEE_BPS, treasury.publicKey)
      .accountsPartial({ config, program: program.programId, programData, authority: payer.publicKey })
      .rpc();
  });

  /** Runs one auction end to end and returns everything needed to assert on it. */
  async function run(friday: number, specs: Spec[], opts: { commitSecs?: number; hold?: boolean } = {}) {
    const traders = specs.map((s) => ({ ...s, kp: Keypair.generate(), salt: randomBytes(32) }));
    for (const t of traders) {
      await conn.confirmTransaction(await conn.requestAirdrop(t.kp.publicKey, 2 * LAMPORTS_PER_SOL));
      await createAssociatedTokenAccount(conn, payer, mint, t.kp.publicKey);
      if (t.tokens) await mintTo(conn, payer, mint, getAssociatedTokenAddressSync(mint, t.kp.publicKey), payer, t.tokens * SHARE);
    }
    const id = new BN(Date.now() + Math.floor(Math.random() * 1e6));
    const auction = pda([Buffer.from("auction"), payer.publicKey.toBuffer(), id.toArrayLike(Buffer, "le", 8)]);
    const vault = pda([Buffer.from("vault"), auction.toBuffer()]);
    const tokenVault = pda([Buffer.from("tvault"), auction.toBuffer()]);
    const orderPda = (i: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(i); return pda([Buffer.from("order"), auction.toBuffer(), b]); };
    const ata = (t: any) => getAssociatedTokenAddressSync(mint, t.kp.publicKey);
    const now = await chainNow();
    const commitEnd = now + (opts.commitSecs ?? 12 + 2 * traders.length), revealEnd = commitEnd + 14;
    await program.methods.createAuction(id, "TSLAx", new BN(friday), new BN(commitEnd), new BN(revealEnd))
      .accountsPartial({ auction, vault, config, mint, tokenVault, authority: payer.publicKey }).rpc();
    for (const [i, t] of traders.entries()) {
      const dep = t.deposit ?? (t.side === 0 ? t.qty * t.price * TICK : 0.01 * LAMPORTS_PER_SOL);
      await program.methods.commitOrder(hash(t.side, t.price, t.qty, t.salt, t.kp.publicKey), new BN(dep))
        .accountsPartial({ auction, order: orderPda(i), vault, trader: t.kp.publicKey }).signers([t.kp]).rpc();
    }
    if (!opts.hold) await until(commitEnd + 1);
    const reveal = (i: number) => program.methods.revealOrder(traders[i].side, new BN(traders[i].price), new BN(traders[i].qty), [...traders[i].salt])
      .accountsPartial({ auction, order: orderPda(i), trader: traders[i].kp.publicKey, traderAta: ata(traders[i]), tokenVault }).signers([traders[i].kp]).rpc();
    return { commitEnd, traders, auction, vault, tokenVault, orderPda, ata, reveal, revealEnd, id };
  }
  const clearAll = async (r: Awaited<ReturnType<typeof run>>) => {
    await until(r.revealEnd + 1);
    const rem = r.traders.map((_, i) => ({ pubkey: r.orderPda(i), isSigner: false, isWritable: true }));
    await program.methods.clear().accountsPartial({ auction: r.auction }).remainingAccounts(rem).rpc();
  };
  const settle = (r: Awaited<ReturnType<typeof run>>, i: number) => program.methods.settle()
    .accountsPartial({ auction: r.auction, order: r.orderPda(i), vault: r.vault, trader: r.traders[i].kp.publicKey, traderAta: r.ata(r.traders[i]), tokenVault: r.tokenVault, treasury: treasury.publicKey }).rpc();
  const tok = async (a: PublicKey) => Number((await getAccount(conn, a)).amount);
  const expectFail = async (p: Promise<unknown>, re: RegExp) => {
    try { await p; } catch (e: any) { expect(String(e) + (e.logs ?? []).join("\n")).to.match(re); return; }
    expect.fail("expected failure " + re);
  };

  it("clears at one price, delivers tokens to buyers, pays sellers minus the fee, refunds unfilled legs", async () => {
    // buys 10@105, 5@101 ; sells 8@99, 6@103 -> clears 103, 10 matched
    const r = await run(10000, [
      { side: 0, price: 10500, qty: 10 }, { side: 0, price: 10100, qty: 5 },
      { side: 1, price: 9900, qty: 8, tokens: 8 }, { side: 1, price: 10300, qty: 6, tokens: 6 },
    ], { hold: true });
    const sealed = await program.account.order.fetch(r.orderPda(0));
    expect(sealed.revealed).to.eq(false); expect(sealed.price.toNumber()).to.eq(0);
    await expectFail(r.reveal(0), /RevealNotOpen/);
    await until(r.commitEnd + 1);
    // wrong price reveal fails
    const o = r.traders[0];
    await expectFail(program.methods.revealOrder(o.side, new BN(o.price + 1), new BN(o.qty), [...o.salt])
      .accountsPartial({ auction: r.auction, order: r.orderPda(0), trader: o.kp.publicKey, traderAta: r.ata(o), tokenVault: r.tokenVault }).signers([o.kp]).rpc(), /BadReveal/);
    for (let i = 0; i < r.traders.length; i++) await r.reveal(i);
    // sellers' stock sits in escrow after reveal
    expect(await tok(r.tokenVault)).to.eq(14 * SHARE);
    expect(await tok(r.ata(r.traders[2]))).to.eq(0);
    await until(r.revealEnd + 1);
    const rem = r.traders.map((_, i) => ({ pubkey: r.orderPda(i), isSigner: false, isWritable: true }));
    await expectFail(program.methods.clear().accountsPartial({ auction: r.auction }).remainingAccounts(rem.slice(1)).rpc(), /MissingOrders/);
    await expectFail(program.methods.clear().accountsPartial({ auction: r.auction }).remainingAccounts(rem.map((m) => ({ ...m, isWritable: false }))).rpc(), /OrderNotWritable/);
    await clearAll(r);
    const a = await program.account.auction.fetch(r.auction);
    expect(a.clearPrice.toNumber()).to.eq(10300);
    expect(a.matchedQty.toNumber()).to.eq(10);
    expect(a.feeBps).to.eq(FEE_BPS);
    const sol0 = await Promise.all(r.traders.map((t) => conn.getBalance(t.kp.publicKey)));
    const tre0 = await conn.getBalance(treasury.publicKey);
    for (let i = 0; i < r.traders.length; i++) await settle(r, i);
    const sol1 = await Promise.all(r.traders.map((t) => conn.getBalance(t.kp.publicKey)));
    const fills = await Promise.all(r.traders.map((_, i) => program.account.order.fetch(r.orderPda(i))));
    expect(fills.map((f) => f.filled.toNumber())).to.deep.eq([10, 0, 6, 4]);
    // buyer 10@105 filled at 103: 10 shares delivered, 2 ticks/share refunded
    expect(await tok(r.ata(r.traders[0]))).to.eq(10 * SHARE);
    expect(sol1[0] - sol0[0]).to.eq(10 * (10500 - 10300) * TICK);
    // buyer @101 is below the clear: full SOL refund, no tokens
    expect(await tok(r.ata(r.traders[1]))).to.eq(0);
    expect(sol1[1] - sol0[1]).to.eq(5 * 10100 * TICK);
    // sellers: filled shares pay SOL minus 10 bps, unfilled shares come back as tokens
    const fee2 = Math.floor((6 * 10300 * TICK * FEE_BPS) / 10000), fee3 = Math.floor((4 * 10300 * TICK * FEE_BPS) / 10000);
    expect(sol1[2] - sol0[2]).to.eq(0.01 * LAMPORTS_PER_SOL + 6 * 10300 * TICK - fee2);
    expect(sol1[3] - sol0[3]).to.eq(0.01 * LAMPORTS_PER_SOL + 4 * 10300 * TICK - fee3);
    expect(await tok(r.ata(r.traders[2]))).to.eq(2 * SHARE);
    expect(await tok(r.ata(r.traders[3]))).to.eq(2 * SHARE);
    expect((await conn.getBalance(treasury.publicKey)) - tre0).to.eq(fee2 + fee3);
    expect(fee2 + fee3).to.be.greaterThan(0);
    // nothing left in either vault
    expect(await conn.getBalance(r.vault)).to.eq(0);
    expect(await tok(r.tokenVault)).to.eq(0);
    await expectFail(settle(r, 0), /AlreadySettled/);
  });

  it("5/5/5 buys against a sell of 10 deliver exactly 10 shares and leave the vault empty", async () => {
    const r = await run(10000, [
      { side: 0, price: 10000, qty: 5 }, { side: 0, price: 10000, qty: 5 }, { side: 0, price: 10000, qty: 5 },
      { side: 1, price: 10000, qty: 10, tokens: 10 },
    ]);
    for (let i = 0; i < 4; i++) await r.reveal(i);
    await clearAll(r);
    const tre0 = await conn.getBalance(treasury.publicKey);
    const sellerSol0 = await conn.getBalance(r.traders[3].kp.publicKey);
    for (let i = 0; i < 4; i++) await settle(r, i);
    const got = await Promise.all([0, 1, 2].map((i) => tok(r.ata(r.traders[i]))));
    expect(got.reduce((s, x) => s + x, 0)).to.eq(10 * SHARE);
    const notional = 10 * 10000 * TICK;
    expect((await conn.getBalance(r.traders[3].kp.publicKey)) - sellerSol0).to.eq(0.01 * LAMPORTS_PER_SOL + notional - Math.floor((notional * FEE_BPS) / 10000));
    expect((await conn.getBalance(treasury.publicKey)) - tre0).to.eq(Math.floor((notional * FEE_BPS) / 10000));
    expect(await conn.getBalance(r.vault)).to.eq(0);
    expect(await tok(r.tokenVault)).to.eq(0);
  });

  it("a sell without the stock token cannot reveal, never takes buyers' SOL, and is refunded its deposit", async () => {
    const r = await run(10000, [
      { side: 0, price: 10000, qty: 5 },
      { side: 1, price: 10000, qty: 5, tokens: 0 },
      { side: 1, price: 10000, qty: 5, tokens: 2 },
    ]);
    await r.reveal(0);
    await expectFail(r.reveal(1), /insufficient funds|0x1\b/);
    await expectFail(r.reveal(2), /insufficient funds|0x1\b/);
    await clearAll(r);
    const a = await program.account.auction.fetch(r.auction);
    expect(a.matchedQty.toNumber()).to.eq(0);
    const sol0 = await Promise.all(r.traders.map((t) => conn.getBalance(t.kp.publicKey)));
    for (let i = 0; i < 3; i++) await settle(r, i);
    const sol1 = await Promise.all(r.traders.map((t) => conn.getBalance(t.kp.publicKey)));
    expect(sol1[0] - sol0[0]).to.eq(5 * 10000 * TICK);
    expect(sol1[1] - sol0[1]).to.eq(0.01 * LAMPORTS_PER_SOL);
    expect(sol1[2] - sol0[2]).to.eq(0.01 * LAMPORTS_PER_SOL);
    expect(await tok(r.ata(r.traders[2]))).to.eq(2 * SHARE);
    expect(await conn.getBalance(r.vault)).to.eq(0);
  });
});

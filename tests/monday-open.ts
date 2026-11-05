import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { MondayOpen } from "../target/types/monday_open";
import { Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { createHash, randomBytes } from "crypto";
import { expect } from "chai";

const TICK = 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hash = (side: number, price: number, qty: number, salt: Buffer, trader: PublicKey) => {
  const b = Buffer.alloc(17);
  b.writeUInt8(side, 0); b.writeBigUInt64LE(BigInt(price), 1); b.writeBigUInt64LE(BigInt(qty), 9);
  return [...createHash("sha256").update(Buffer.concat([b, salt, trader.toBuffer()])).digest()];
};

describe("monday-open", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.mondayOpen as Program<MondayOpen>;
  const conn = provider.connection;
  const id = new BN(Date.now());
  const [auction] = PublicKey.findProgramAddressSync(
    [Buffer.from("auction"), provider.wallet.publicKey.toBuffer(), id.toArrayLike(Buffer, "le", 8)], program.programId);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), auction.toBuffer()], program.programId);
  const orderPda = (i: number) => {
    const b = Buffer.alloc(2); b.writeUInt16LE(i);
    return PublicKey.findProgramAddressSync([Buffer.from("order"), auction.toBuffer(), b], program.programId)[0];
  };
  // buys 10@105, 5@101 ; sells 8@99, 6@103 -> clears 103, 10 matched
  const book = [
    { side: 0, price: 10500, qty: 10 }, { side: 0, price: 10100, qty: 5 },
    { side: 1, price: 9900, qty: 8 }, { side: 1, price: 10300, qty: 6 },
  ].map((o) => ({ ...o, kp: Keypair.generate(), salt: randomBytes(32) }));
  const deposit = (o: any) => (o.side === 0 ? o.qty * o.price * TICK : 0.01 * LAMPORTS_PER_SOL);

  it("creates, seals, rejects a bad reveal, reveals, clears at one price, settles", async () => {
    for (const o of book) {
      const sig = await conn.requestAirdrop(o.kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig);
    }
    const now = Math.floor(Date.now() / 1000);
    await program.methods.createAuction(id, "TSLAx", new BN(10000), new BN(now + 6), new BN(now + 12))
      .accountsPartial({ auction, vault, authority: provider.wallet.publicKey }).rpc();
    for (const [i, o] of book.entries()) {
      await program.methods.commitOrder(hash(o.side, o.price, o.qty, o.salt, o.kp.publicKey), new BN(deposit(o)))
        .accountsPartial({ auction, order: orderPda(i), vault, trader: o.kp.publicKey }).signers([o.kp]).rpc();
    }
    const sealed = await program.account.order.fetch(orderPda(0));
    expect(sealed.revealed).to.eq(false); expect(sealed.price.toNumber()).to.eq(0);
    // reveal before window opens fails
    try {
      const o = book[0];
      await program.methods.revealOrder(o.side, new BN(o.price), new BN(o.qty), [...o.salt])
        .accountsPartial({ auction, order: orderPda(0), trader: o.kp.publicKey }).signers([o.kp]).rpc();
      expect.fail("early reveal");
    } catch (e: any) { expect(String(e)).to.match(/RevealNotOpen/); }
    await sleep(7000);
    // wrong price reveal fails
    try {
      const o = book[0];
      await program.methods.revealOrder(o.side, new BN(o.price + 1), new BN(o.qty), [...o.salt])
        .accountsPartial({ auction, order: orderPda(0), trader: o.kp.publicKey }).signers([o.kp]).rpc();
      expect.fail("bad reveal");
    } catch (e: any) { expect(String(e)).to.match(/BadReveal/); }
    for (const [i, o] of book.entries()) {
      await program.methods.revealOrder(o.side, new BN(o.price), new BN(o.qty), [...o.salt])
        .accountsPartial({ auction, order: orderPda(i), trader: o.kp.publicKey }).signers([o.kp]).rpc();
    }
    await sleep(6500);
    const rem = book.map((_, i) => ({ pubkey: orderPda(i), isSigner: false, isWritable: false }));
    // clearing with an order missing fails
    try {
      await program.methods.clear().accountsPartial({ auction }).remainingAccounts(rem.slice(1)).rpc();
      expect.fail("partial clear");
    } catch (e: any) { expect(String(e)).to.match(/MissingOrders/); }
    await program.methods.clear().accountsPartial({ auction }).remainingAccounts(rem).rpc();
    const a = await program.account.auction.fetch(auction);
    expect(a.clearPrice.toNumber()).to.eq(10300);
    expect(a.matchedQty.toNumber()).to.eq(10);
    const before = await Promise.all(book.map((o) => conn.getBalance(o.kp.publicKey)));
    for (const [i, o] of book.entries()) {
      await program.methods.settle().accountsPartial({ auction, order: orderPda(i), vault, trader: o.kp.publicKey }).rpc();
    }
    const after = await Promise.all(book.map((o) => conn.getBalance(o.kp.publicKey)));
    const fills = await Promise.all(book.map((_, i) => program.account.order.fetch(orderPda(i))));
    // buyer 10@105 fully filled at 103 -> gets back 2 ticks/share
    expect(fills[0].filled.toNumber()).to.eq(10);
    expect(after[0] - before[0]).to.eq(10 * (10500 - 10300) * TICK);
    // buyer @101 is below the clear: full refund, no fill
    expect(fills[1].filled.toNumber()).to.eq(0);
    expect(after[1] - before[1]).to.eq(5 * 10100 * TICK);
    // sells pro-rata: 14 eligible, 10 matched -> 8*10/14=5, 6*10/14=4
    expect(fills[2].filled.toNumber()).to.eq(5);
    expect(fills[3].filled.toNumber()).to.eq(4);
    expect(after[2] - before[2]).to.eq(0.01 * LAMPORTS_PER_SOL + 5 * 10300 * TICK);
    // double settle fails
    try {
      await program.methods.settle().accountsPartial({ auction, order: orderPda(0), vault, trader: book[0].kp.publicKey }).rpc();
      expect.fail("double settle");
    } catch (e: any) { expect(String(e)).to.match(/AlreadySettled/); }
  });
});
